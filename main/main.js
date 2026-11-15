// Design Studio — Electron main process.
// Owns the window, the file system and every privileged operation.
// The renderer never touches Node directly; it calls the small API in preload.js.

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const media = require('./media');
const library = require('./library');

const PROJECT_EXT = '.dstudio';
let mainWindow = null;
let pendingOpenPath = null; // a .dstudio file passed on the command line / double-clicked

// ---------- paths ----------
function projectsDir() {
  const dir = path.join(app.getPath('documents'), 'Design Studio Projects');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// ---------- helpers ----------
async function writeFileAtomic(filePath, data) {
  const tmp = filePath + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, filePath);
}

function safeFileName(name) {
  const cleaned = String(name || 'Untitled design').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
  return (cleaned || 'Untitled design').slice(0, 80);
}

async function readProject(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  const doc = JSON.parse(raw);
  if (!doc || !Array.isArray(doc.pages) || !doc.format) {
    throw new Error('This file is not a valid Design Studio project.');
  }
  return doc;
}

async function loadSettings() {
  try {
    return JSON.parse(await fsp.readFile(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

// ---------- window ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f4f5f9',
    title: 'Design Studio',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false, // keep video export running if the window is covered
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Never let the app navigate away or open windows with web content.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  // Ask the renderer whether there are unsaved changes before closing.
  let closingConfirmed = false;
  mainWindow.on('close', (e) => {
    if (closingConfirmed) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });
  ipcMain.removeHandler('app:confirm-close');
  ipcMain.handle('app:confirm-close', () => {
    closingConfirmed = true;
    mainWindow.close();
  });
}

function buildMenu() {
  // Minimal menu: the app has its own toolbar. Keep standard edit roles so
  // copy/paste work inside text boxes, and dev tools for troubleshooting.
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+H', click: () => mainWindow.webContents.send('menu', 'home') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu', 'open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu', 'save') },
        { label: 'Save a Copy As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu', 'saveAs') },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu', 'export') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]
    },
    {
      label: 'View',
      submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }, { role: 'reload' }]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open Projects Folder', click: () => shell.openPath(projectsDir()) },
        { label: 'Project on GitHub', click: () => shell.openExternal('https://github.com/jawedsyed64/design-studio') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC: app ----------
ipcMain.handle('app:info', async () => ({
  version: app.getVersion(),
  projectsDir: projectsDir(),
  platform: process.platform
}));
ipcMain.handle('app:take-pending-open', async () => {
  const p = pendingOpenPath;
  pendingOpenPath = null;
  if (!p) return null;
  try {
    return { path: p, doc: await readProject(p) };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('settings:get', loadSettings);
ipcMain.handle('settings:set', async (_e, patch) => {
  const s = Object.assign(await loadSettings(), patch || {});
  await writeFileAtomic(settingsPath(), JSON.stringify(s, null, 2));
  return s;
});
ipcMain.handle('shell:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
});
ipcMain.handle('shell:open-projects-folder', () => shell.openPath(projectsDir()));
ipcMain.handle('shell:show-item', (_e, p) => {
  if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p);
});

// ---------- IPC: projects ----------
ipcMain.handle('projects:list', async () => {
  const dir = projectsDir();
  const names = (await fsp.readdir(dir)).filter((n) => n.toLowerCase().endsWith(PROJECT_EXT));
  const items = [];
  for (const n of names) {
    const p = path.join(dir, n);
    try {
      const doc = await readProject(p);
      items.push({
        path: p,
        id: doc.id,
        name: doc.name,
        folder: doc.folder || '',
        format: doc.format,
        pageCount: doc.pages.length,
        updatedAt: doc.updatedAt || (await fsp.stat(p)).mtimeMs,
        thumbnail: doc.thumbnail || null
      });
    } catch {
      // skip unreadable files silently; they stay on disk untouched
    }
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items;
});

ipcMain.handle('projects:load', async (_e, filePath) => readProject(filePath));

// Saves into the projects library unless the document already has a path.
ipcMain.handle('projects:save', async (_e, { doc, filePath }) => {
  let target = filePath;
  if (!target) target = path.join(projectsDir(), doc.id + PROJECT_EXT);
  await writeFileAtomic(target, JSON.stringify(doc));
  return { path: target };
});

ipcMain.handle('projects:save-as', async (_e, { doc }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save a copy of this design',
    defaultPath: path.join(app.getPath('documents'), safeFileName(doc.name) + PROJECT_EXT),
    filters: [{ name: 'Design Studio Project', extensions: ['dstudio'] }]
  });
  if (res.canceled || !res.filePath) return null;
  await writeFileAtomic(res.filePath, JSON.stringify(doc));
  return { path: res.filePath };
});

ipcMain.handle('projects:open-dialog', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Open a design',
    properties: ['openFile'],
    filters: [{ name: 'Design Studio Project', extensions: ['dstudio'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  const p = res.filePaths[0];
  return { path: p, doc: await readProject(p) };
});

ipcMain.handle('projects:delete', async (_e, filePath) => {
  // Only allow deleting project files; send to the Recycle Bin, never hard-delete.
  if (!filePath.toLowerCase().endsWith(PROJECT_EXT)) throw new Error('Not a project file');
  await shell.trashItem(filePath);
  return true;
});

ipcMain.handle('projects:duplicate', async (_e, filePath) => {
  const doc = await readProject(filePath);
  doc.id = crypto.randomUUID();
  doc.name = (doc.name || 'Untitled design') + ' (copy)';
  doc.createdAt = doc.updatedAt = Date.now();
  const target = path.join(projectsDir(), doc.id + PROJECT_EXT);
  await writeFileAtomic(target, JSON.stringify(doc));
  return { path: target };
});

ipcMain.handle('projects:rename', async (_e, { filePath, name }) => {
  const doc = await readProject(filePath);
  doc.name = String(name || '').slice(0, 120) || doc.name;
  doc.updatedAt = Date.now();
  await writeFileAtomic(filePath, JSON.stringify(doc));
  return true;
});

ipcMain.handle('projects:set-folder', async (_e, { filePath, folder }) => {
  const doc = await readProject(filePath);
  doc.folder = String(folder || '').slice(0, 60);
  await writeFileAtomic(filePath, JSON.stringify(doc));
  return true;
});

// ---------- IPC: export ----------
// data: Uint8Array (binary) or string (text, e.g. SVG)
ipcMain.handle('export:save-file', async (_e, { defaultName, ext, data }) => {
  const filters = {
    png: [{ name: 'PNG image', extensions: ['png'] }],
    jpg: [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }],
    svg: [{ name: 'SVG vector image', extensions: ['svg'] }],
    pdf: [{ name: 'PDF document', extensions: ['pdf'] }]
  }[ext] || [];
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export design',
    defaultPath: path.join(app.getPath('downloads'), safeFileName(defaultName) + '.' + ext),
    filters
  });
  if (res.canceled || !res.filePath) return null;
  await fsp.writeFile(res.filePath, typeof data === 'string' ? data : Buffer.from(data));
  return { path: res.filePath };
});

// Several files at once (e.g. every page as PNG): choose a folder, write all.
ipcMain.handle('export:save-many', async (_e, { baseName, ext, files }) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder for the exported pages',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths.length) return null;
  const dir = res.filePaths[0];
  const base = safeFileName(baseName);
  const written = [];
  for (let i = 0; i < files.length; i++) {
    const p = path.join(dir, `${base} - page ${i + 1}.${ext}`);
    const d = files[i];
    await fsp.writeFile(p, typeof d === 'string' ? d : Buffer.from(d));
    written.push(p);
  }
  return { paths: written, dir };
});

// PDF: render every page's SVG into a hidden window sized to the page, then
// use Chromium's PDF printer. Text and shapes stay vector.
ipcMain.handle('export:pdf', async (_e, { defaultName, pages, widthIn, heightIn }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as PDF',
    defaultPath: path.join(app.getPath('downloads'), safeFileName(defaultName) + '.pdf'),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }]
  });
  if (res.canceled || !res.filePath) return null;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">
<style>
@page { size: ${widthIn}in ${heightIn}in; margin: 0; }
html, body { margin: 0; padding: 0; }
.page { width: ${widthIn}in; height: ${heightIn}in; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.page svg { width: 100%; height: 100%; display: block; }
</style></head><body>
${pages.map((svg) => `<div class="page">${svg}</div>`).join('\n')}
</body></html>`;

  const tmpFile = path.join(app.getPath('temp'), 'design-studio-pdf-' + crypto.randomBytes(6).toString('hex') + '.html');
  await fsp.writeFile(tmpFile, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  });
  try {
    await win.loadFile(tmpFile);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' }
    });
    await fsp.writeFile(res.filePath, pdf);
    return { path: res.filePath };
  } finally {
    win.destroy();
    fsp.unlink(tmpFile).catch(() => {});
  }
});

// ---------- lifecycle ----------
function pathFromArgv(argv) {
  return argv.find((a) => a && a.toLowerCase().endsWith(PROJECT_EXT) && fs.existsSync(a)) || null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = pathFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (p) {
        pendingOpenPath = p;
        mainWindow.webContents.send('menu', 'pending-open');
      }
    }
  });
  pendingOpenPath = pathFromArgv(process.argv);
  media.init({ projectsDir, getWindow: () => mainWindow });
  library.init({ settingsPath, mediaDir: media.mediaDir });
  app.whenReady().then(() => {
    media.handleProtocol();
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
