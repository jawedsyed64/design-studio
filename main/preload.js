// Exposes a small, explicit API to the renderer. Nothing else from Node/Electron leaks through.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  appInfo: () => ipcRenderer.invoke('app:info'),
  takePendingOpen: () => ipcRenderer.invoke('app:take-pending-open'),
  confirmClose: () => ipcRenderer.invoke('app:confirm-close'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  openProjectsFolder: () => ipcRenderer.invoke('shell:open-projects-folder'),
  showItemInFolder: (p) => ipcRenderer.invoke('shell:show-item', p),

  listProjects: () => ipcRenderer.invoke('projects:list'),
  loadProject: (filePath) => ipcRenderer.invoke('projects:load', filePath),
  saveProject: (doc, filePath) => ipcRenderer.invoke('projects:save', { doc, filePath }),
  saveProjectAs: (doc) => ipcRenderer.invoke('projects:save-as', { doc }),
  openProjectDialog: () => ipcRenderer.invoke('projects:open-dialog'),
  deleteProject: (filePath) => ipcRenderer.invoke('projects:delete', filePath),
  duplicateProject: (filePath) => ipcRenderer.invoke('projects:duplicate', filePath),
  renameProject: (filePath, name) => ipcRenderer.invoke('projects:rename', { filePath, name }),
  setProjectFolder: (filePath, folder) => ipcRenderer.invoke('projects:set-folder', { filePath, folder }),

  exportSaveFile: (opts) => ipcRenderer.invoke('export:save-file', opts),
  exportSaveMany: (opts) => ipcRenderer.invoke('export:save-many', opts),
  exportPdf: (opts) => ipcRenderer.invoke('export:pdf', opts),

  // video & audio
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  importMediaFiles: (files) => ipcRenderer.invoke('media:import', Array.from(files || []).map((f) => webUtils.getPathForFile(f))),
  mediaUrl: (ref) => 'dsmedia://media/' + encodeURIComponent(String(ref || '').replace(/^media:/, '')),
  convertMedia: (ref) => ipcRenderer.invoke('media:convert', ref),
  exportStreamBegin: (opts) => ipcRenderer.invoke('export:stream-begin', opts),
  exportStreamWrite: (token, data) => ipcRenderer.invoke('export:stream-write', token, data),
  exportStreamEnd: (token, opts) => ipcRenderer.invoke('export:stream-end', token, opts),
  exportStreamAbort: (token) => ipcRenderer.invoke('export:stream-abort', token),
  onExportProgress: (cb) => { const fn = (_e, v) => cb(v); ipcRenderer.on('export:progress', fn); return () => ipcRenderer.removeListener('export:progress', fn); },

  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  onBeforeClose: (cb) => ipcRenderer.on('app:before-close', () => cb())
});
