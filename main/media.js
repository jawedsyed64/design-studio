// Video and audio support in the main process:
//  - imported clips are copied into "<projects>/media" and referred to as "media:<file>"
//  - the dsmedia:// protocol streams them to the renderer (with Range support so seeking works)
//  - ffmpeg (bundled via ffmpeg-static) converts unsupported clips and turns recordings into MP4
const { app, protocol, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Readable } = require('stream');

const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'wmv', 'mpg', 'mpeg', '3gp'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wma'];
const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', mpg: 'video/mpeg', mpeg: 'video/mpeg', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', flac: 'audio/flac', wma: 'audio/x-ms-wma'
};
const NAME_RE = /^[a-zA-Z0-9_-]+\.[a-z0-9]{2,5}$/;

let getProjectsDir = null;
let getWindow = null;

function mediaDir() {
  const dir = path.join(getProjectsDir(), 'media');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extOf(p) {
  return path.extname(p).slice(1).toLowerCase();
}
function kindOf(ext) {
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return null;
}

function ffmpegPath() {
  try {
    // inside the packaged app the binary lives outside the asar archive
    return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
  } catch {
    return null;
  }
}

function resolveRef(ref) {
  const name = String(ref || '').replace(/^media:/, '');
  if (!NAME_RE.test(name)) throw new Error('Invalid media reference');
  return path.join(mediaDir(), name);
}

async function importOne(src) {
  const ext = extOf(src);
  const kind = kindOf(ext);
  if (!kind) throw new Error(`${path.basename(src)} is not a supported video or audio file.`);
  const name = crypto.randomUUID() + '.' + ext;
  await fsp.copyFile(src, path.join(mediaDir(), name));
  const stat = await fsp.stat(src);
  return { ref: 'media:' + name, name: path.basename(src), kind, size: stat.size };
}

// Runs ffmpeg; onTime(seconds) receives progress parsed from its log.
function runFfmpeg(args, onTime) {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath();
    if (!bin || !fs.existsSync(bin)) {
      reject(new Error('The video converter (ffmpeg) is missing from this installation.'));
      return;
    }
    const proc = spawn(bin, ['-hide_banner', '-y', ...args], { windowsHide: true });
    let log = '';
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      log = (log + s).slice(-4000);
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
      if (m && onTime) onTime(+m[1] * 3600 + +m[2] * 60 + +m[3]);
    });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Video conversion failed.\n' + log.split('\n').slice(-4).join('\n')))));
  });
}

// ---------- dsmedia:// protocol ----------
function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'dsmedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }]);
}

function handleProtocol() {
  protocol.handle('dsmedia', async (req) => {
    try {
      const url = new URL(req.url);
      const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (!NAME_RE.test(name)) return new Response('Bad request', { status: 400 });
      const file = path.join(mediaDir(), name);
      const stat = await fsp.stat(file);
      const type = MIME[extOf(name)] || 'application/octet-stream';
      const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      if (range && (range[1] || range[2])) {
        let start = range[1] ? parseInt(range[1], 10) : stat.size - parseInt(range[2], 10);
        let end = range[1] && range[2] ? parseInt(range[2], 10) : stat.size - 1;
        start = Math.max(0, start); end = Math.min(end, stat.size - 1);
        if (start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
        return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
          status: 206,
          headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${stat.size}` }
        });
      }
      return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...base, 'Content-Length': String(stat.size) } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

// ---------- IPC ----------
const streams = new Map(); // token -> { tmp, out, ws }

function registerIpc() {
  ipcMain.handle('media:pick', async () => {
    const res = await dialog.showOpenDialog(getWindow(), {
      title: 'Upload video or audio',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video and audio', extensions: VIDEO_EXT.concat(AUDIO_EXT) },
        { name: 'Video', extensions: VIDEO_EXT },
        { name: 'Audio', extensions: AUDIO_EXT }
      ]
    });
    if (res.canceled) return [];
    const out = [];
    for (const p of res.filePaths) out.push(await importOne(p));
    return out;
  });

  ipcMain.handle('media:import', async (_e, paths) => {
    const out = [];
    for (const p of paths || []) {
      if (typeof p === 'string' && p && fs.existsSync(p)) out.push(await importOne(p));
    }
    return out;
  });

  // Re-encode a clip Chromium cannot play (e.g. some .avi/.wmv/.mkv/HEVC files) to H.264/AAC MP4.
  ipcMain.handle('media:convert', async (_e, ref) => {
    const src = resolveRef(ref);
    const kind = kindOf(extOf(src));
    const name = crypto.randomUUID() + (kind === 'audio' ? '.m4a' : '.mp4');
    const dest = path.join(mediaDir(), name);
    const args = kind === 'audio'
      ? ['-i', src, '-vn', '-c:a', 'aac', '-b:a', '192k', dest]
      : ['-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', dest];
    await runFfmpeg(args);
    return { ref: 'media:' + name };
  });

  // Streaming export: the renderer records WebM in real time and sends it in chunks,
  // then ffmpeg converts it to an MP4 that plays everywhere.
  ipcMain.handle('export:stream-begin', async (_e, { defaultName, ext }) => {
    const safe = String(defaultName || 'video').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 80) || 'video';
    const res = await dialog.showSaveDialog(getWindow(), {
      title: 'Export video',
      defaultPath: path.join(app.getPath('videos'), safe + '.' + (ext || 'mp4')),
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
    });
    if (res.canceled || !res.filePath) return null;
    const token = crypto.randomUUID();
    const tmp = path.join(app.getPath('temp'), 'design-studio-rec-' + token + '.webm');
    streams.set(token, { tmp, out: res.filePath, ws: fs.createWriteStream(tmp) });
    return { token, path: res.filePath };
  });

  ipcMain.handle('export:stream-write', async (_e, token, data) => {
    const s = streams.get(token);
    if (!s) throw new Error('Export was cancelled');
    await new Promise((resolve, reject) => s.ws.write(Buffer.from(data), (err) => (err ? reject(err) : resolve())));
    return true;
  });

  ipcMain.handle('export:stream-end', async (e, token, { duration }) => {
    const s = streams.get(token);
    if (!s) throw new Error('Export was cancelled');
    await new Promise((resolve) => s.ws.end(resolve));
    try {
      await runFfmpeg([
        '-i', s.tmp,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', s.out
      ], (t) => {
        if (duration > 0) e.sender.send('export:progress', Math.min(1, t / duration));
      });
      return { path: s.out };
    } finally {
      streams.delete(token);
      fsp.unlink(s.tmp).catch(() => {});
    }
  });

  ipcMain.handle('export:stream-abort', async (_e, token) => {
    const s = streams.get(token);
    if (!s) return true;
    streams.delete(token);
    await new Promise((resolve) => s.ws.end(resolve));
    fsp.unlink(s.tmp).catch(() => {});
    return true;
  });
}

function init(opts) {
  getProjectsDir = opts.projectsDir;
  getWindow = opts.getWindow;
  registerScheme();
  registerIpc();
}

module.exports = { init, handleProtocol, VIDEO_EXT, AUDIO_EXT };
