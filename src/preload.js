const { contextBridge, ipcRenderer } = require('electron')

console.log('preload')
contextBridge.exposeInMainWorld('electronAPI', {
  createTab: (url) => ipcRenderer.send('create-tab', url),
  switchTab: (id) => ipcRenderer.send('switch-tab', id),
  navigate: (url) => ipcRenderer.send('navigate', url),
  closeTab: (id) => ipcRenderer.send('close-tab', id),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),

  focusUrlBar: (callback) => {
    ipcRenderer.on('focus-url-bar', callback)
  },
  onUpdateTabs: (callback) => ipcRenderer.on('update-tabs', callback),
  onPageNavigated: (callback) => ipcRenderer.on('page-navigated', callback),
  onKeyupInFindInPage: (value) => ipcRenderer.send('keyup-in-find-in-page', value),
  closeFindInPage: () => ipcRenderer.send('close-find-in-page'),

  reload: () => ipcRenderer.send('reload'),
}) 