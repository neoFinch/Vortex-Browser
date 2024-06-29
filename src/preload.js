const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  createTab: (url) => ipcRenderer.send('create-tab', url),
  switchTab: (id) => ipcRenderer.send('switch-tab', id),
  navigate: (url) => ipcRenderer.send('navigate', url),
  onUpdateTabs: (callback) => ipcRenderer.on('update-tabs', callback),
  onPageNavigated: (callback) => ipcRenderer.on('page-navigated', callback),
  closeTab: (id) => ipcRenderer.send('close-tab', id)
}) 