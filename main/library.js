// Online stock library: searches free providers from the main process (so API keys
// never reach the web page) and downloads chosen items.
//   Openverse  – photos, illustrations and audio under Creative Commons. No key needed.
//   Pexels     – photos and videos, free licence. Free API key.
//   Pixabay    – photos, illustrations, vectors and videos, free licence. Free API key.
const { app, ipcMain, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const UA = 'DesignStudio/0.3 (+https://github.com/jawedsyed64/design-studio)';
const PER_PAGE = 24;
const MAX_IMAGE = 40 * 1024 * 1024;
const MAX_MEDIA = 600 * 1024 * 1024;

let settingsPath = null;
let mediaDir = null;

// ---------- API keys (encrypted with Windows data protection when available) ----------
async function readSettings() {
  try { return JSON.parse(await fsp.readFile(settingsPath(), 'utf8')); } catch { return {}; }
}
async function writeSettings(s) {
  const p = settingsPath();
  const tmp = p + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(s, null, 2));
  await fsp.rename(tmp, p);
}
async function getKey(provider) {
  const s = await readSettings();
  const v = s.keys && s.keys[provider];
  if (!v) return '';
  try {
    if (v.enc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(v.enc, 'base64'));
    return v.plain || '';
  } catch {
    return '';
  }
}
async function setKey(provider, key) {
  const s = await readSettings();
  s.keys = s.keys || {};
  key = String(key || '').trim();
  if (!key) delete s.keys[provider];
  else if (safeStorage.isEncryptionAvailable()) s.keys[provider] = { enc: safeStorage.encryptString(key).toString('base64') };
  else s.keys[provider] = { plain: key };
  await writeSettings(s);
}

// ---------- licences ----------
function ccLicense(code, version, url) {
  const c = String(code || '').toLowerCase();
  const names = { cc0: 'CC0 (public domain)', pdm: 'Public domain', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' };
  return {
    code: c,
    label: (names[c] || c.toUpperCase()) + (version && c !== 'cc0' && c !== 'pdm' ? ' ' + version : ''),
    url: url || '',
    attribution: !(c === 'cc0' || c === 'pdm'),
    commercial: !c.includes('nc'),
    modify: !c.includes('nd')
  };
}
const PEXELS_LICENSE = { code: 'pexels', label: 'Pexels License (free)', url: 'https://www.pexels.com/license/', attribution: false, commercial: true, modify: true };
const PIXABAY_LICENSE = { code: 'pixabay', label: 'Pixabay Content License (free)', url: 'https://pixabay.com/service/license-summary/', attribution: false, commercial: true, modify: true };

// ---------- HTTP ----------
async function getJson(url, headers) {
  let res;
  try {
    res = await net.fetch(url, { headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, headers || {}) });
  } catch (err) {
    throw new Error('No internet connection, or the service could not be reached.');
  }
  if (res.status === 401 || res.status === 403) throw new Error('The API key was not accepted. Check it in Settings.');
  if (res.status === 429) throw new Error('Too many searches for now. Please wait a little and try again.');
  if (!res.ok) throw new Error(`The service answered with an error (${res.status}).`);
  return res.json();
}

// ---------- providers ----------
async function searchOpenverse({ kind, q, page, category }) {
  const isAudio = kind === 'audio';
  const params = new URLSearchParams({
    q: q || (isAudio ? 'music' : 'nature'),
    page: String(page || 1),
    page_size: '20',
    license_type: 'commercial,modification',
    mature: 'false'
  });
  if (category) params.set('category', category);
  const data = await getJson(`https://api.openverse.org/v1/${isAudio ? 'audio' : 'images'}/?${params}`);
  const items = (data.results || []).map((r) => {
    let duration = +r.duration || 0;
    if (duration > 1000) duration /= 1000; // Openverse gives audio length in milliseconds
    return {
      id: 'ov-' + r.id, provider: 'openverse', kind: isAudio ? 'audio' : 'image',
      thumb: r.thumbnail || (isAudio ? '' : r.url), preview: isAudio ? r.url : '',
      title: r.title || 'Untitled', creator: r.creator || '', w: r.width || 0, h: r.height || 0, duration,
      download: r.url, fallback: r.thumbnail || '', ext: r.filetype || '',
      source: r.foreign_landing_url || '', sourceName: r.source || r.provider || 'Openverse',
      license: ccLicense(r.license, r.license_version, r.license_url),
      attribution: r.attribution || ''
    };
  });
  return { items, hasMore: (data.page_count || 0) > (page || 1) };
}

async function searchPexels({ kind, q, page }) {
  const key = await getKey('pexels');
  if (!key) return { needsKey: 'pexels', items: [] };
  const query = encodeURIComponent(q || (kind === 'video' ? 'nature' : 'nature'));
  if (kind === 'video') {
    const data = await getJson(`https://api.pexels.com/videos/search?query=${query}&per_page=${PER_PAGE}&page=${page || 1}`, { Authorization: key });
    const items = (data.videos || []).map((v) => {
      const files = (v.video_files || []).filter((f) => f.link && f.width && /mp4/.test(f.file_type || 'mp4'));
      files.sort((a, b) => a.width * a.height - b.width * b.height);
      const best = files.filter((f) => Math.max(f.width, f.height) <= 1920).pop() || files[0];
      const small = files.find((f) => Math.max(f.width, f.height) >= 480) || files[0];
      return {
        id: 'px-v' + v.id, provider: 'pexels', kind: 'video', thumb: v.image, preview: small ? small.link : '',
        title: (v.url || '').split('/').filter(Boolean).pop() || 'Pexels video', creator: v.user ? v.user.name : '',
        w: best ? best.width : v.width, h: best ? best.height : v.height, duration: v.duration || 0,
        download: best ? best.link : '', ext: 'mp4', source: v.url, sourceName: 'Pexels', license: PEXELS_LICENSE,
        attribution: v.user ? `Video by ${v.user.name} on Pexels` : 'Video from Pexels'
      };
    }).filter((i) => i.download);
    return { items, hasMore: !!data.next_page };
  }
  const data = await getJson(`https://api.pexels.com/v1/search?query=${query}&per_page=${PER_PAGE}&page=${page || 1}`, { Authorization: key });
  const items = (data.photos || []).map((p) => ({
    id: 'px-p' + p.id, provider: 'pexels', kind: 'image', thumb: p.src && (p.src.medium || p.src.small), preview: '',
    title: p.alt || 'Pexels photo', creator: p.photographer || '', w: p.width, h: p.height,
    download: p.src && (p.src.large2x || p.src.original), fallback: p.src && p.src.large, ext: 'jpg',
    source: p.url, sourceName: 'Pexels', license: PEXELS_LICENSE, attribution: `Photo by ${p.photographer} on Pexels`
  }));
  return { items, hasMore: !!data.next_page };
}

async function searchPixabay({ kind, q, page, imageType }) {
  const key = await getKey('pixabay');
  if (!key) return { needsKey: 'pixabay', items: [] };
  const params = new URLSearchParams({ key, q: q || '', page: String(page || 1), per_page: String(PER_PAGE), safesearch: 'true' });
  if (kind === 'video') {
    const data = await getJson(`https://pixabay.com/api/videos/?${params}`);
    const items = (data.hits || []).map((v) => {
      const vs = v.videos || {};
      const best = (vs.large && vs.large.url && vs.large.width <= 1920 ? vs.large : null) || vs.medium || vs.small || vs.tiny;
      const small = vs.tiny || vs.small || best;
      return {
        id: 'pb-v' + v.id, provider: 'pixabay', kind: 'video',
        thumb: (best && best.thumbnail) || (small && small.thumbnail) || '', preview: small ? small.url : '',
        title: v.tags || 'Pixabay video', creator: v.user || '', w: best ? best.width : 0, h: best ? best.height : 0,
        duration: v.duration || 0, download: best ? best.url : '', ext: 'mp4', source: v.pageURL, sourceName: 'Pixabay',
        license: PIXABAY_LICENSE, attribution: `Video by ${v.user} from Pixabay`
      };
    }).filter((i) => i.download);
    return { items, hasMore: (page || 1) * PER_PAGE < (data.totalHits || 0) };
  }
  params.set('image_type', imageType || 'photo');
  const data = await getJson(`https://pixabay.com/api/?${params}`);
  const items = (data.hits || []).map((p) => ({
    id: 'pb-i' + p.id, provider: 'pixabay', kind: 'image', thumb: p.webformatURL || p.previewURL, preview: '',
    title: p.tags || 'Pixabay image', creator: p.user || '', w: p.imageWidth, h: p.imageHeight,
    download: p.largeImageURL || p.webformatURL, fallback: p.webformatURL, ext: 'jpg',
    source: p.pageURL, sourceName: 'Pixabay', license: PIXABAY_LICENSE, attribution: `Image by ${p.user} from Pixabay`
  }));
  return { items, hasMore: (page || 1) * PER_PAGE < (data.totalHits || 0) };
}

async function search(opts) {
  if (opts.provider === 'openverse') return searchOpenverse(opts);
  if (opts.provider === 'pexels') return searchPexels(opts);
  if (opts.provider === 'pixabay') return searchPixabay(opts);
  throw new Error('Unknown provider');
}

// ---------- download ----------
async function fetchOk(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Unsupported link');
  const res = await net.fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res;
}

const IMG_MIME = /^image\/(png|jpe?g|webp|gif|svg\+xml|bmp)/;

async function downloadImage(item) {
  let res;
  try { res = await fetchOk(item.download); } catch (err) { if (!item.fallback) throw err; res = await fetchOk(item.fallback); }
  let type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE) throw new Error('This image is too large to download.');
  if (!IMG_MIME.test(type)) {
    // some hosts send a generic type; sniff the common formats
    if (buf[0] === 0xff && buf[1] === 0xd8) type = 'image/jpeg';
    else if (buf[0] === 0x89 && buf[1] === 0x50) type = 'image/png';
    else if (buf.slice(0, 4).toString() === 'RIFF') type = 'image/webp';
    else if (buf.slice(0, 3).toString() === 'GIF') type = 'image/gif';
    else throw new Error('The download was not an image.');
  }
  return { dataUrl: `data:${type};base64,${buf.toString('base64')}` };
}

async function downloadMedia(item) {
  const res = await fetchOk(item.download);
  const len = +(res.headers.get('content-length') || 0);
  if (len > MAX_MEDIA) throw new Error('This file is too large to download.');
  let ext = String(item.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ext) {
    const type = res.headers.get('content-type') || '';
    ext = /mpeg/.test(type) ? 'mp3' : /ogg/.test(type) ? 'ogg' : /wav/.test(type) ? 'wav' : /mp4/.test(type) ? (item.kind === 'audio' ? 'm4a' : 'mp4') : /webm/.test(type) ? 'webm' : item.kind === 'audio' ? 'mp3' : 'mp4';
  }
  const name = crypto.randomUUID() + '.' + ext;
  const dest = path.join(mediaDir(), name);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
  return { ref: 'media:' + name, name: (item.title || 'clip').slice(0, 60) + '.' + ext, kind: item.kind };
}

function init(opts) {
  settingsPath = opts.settingsPath;
  mediaDir = opts.mediaDir;
  ipcMain.handle('library:search', (_e, opts2) => search(opts2 || {}));
  ipcMain.handle('library:download', (_e, item) => (item.kind === 'image' ? downloadImage(item) : downloadMedia(item)));
  ipcMain.handle('keys:status', async () => ({ pexels: !!(await getKey('pexels')), pixabay: !!(await getKey('pixabay')) }));
  ipcMain.handle('keys:set', async (_e, provider, key) => {
    if (!['pexels', 'pixabay'].includes(provider)) throw new Error('Unknown provider');
    await setKey(provider, key);
    if (!key) return { ok: true, removed: true };
    // check the key straight away so mistakes show up in Settings, not later
    try {
      await search({ provider, kind: 'image', q: 'flower', page: 1 });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { init };
