const { contextBridge, ipcRenderer } = require('electron')


console.log("Vaibhav")

console.log('platform', process.platform);

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
  // check os mac or windows or linux 
  getOS: process.platform,

  // get-history is channel name
  getHistory: () => ipcRenderer.send('get-history'),
  onHistoryData: (callback) => ipcRenderer.on('history-data', (_, data) => {
    console.log({_, data})
    return callback(data)
  }),
  clearHistory: () => ipcRenderer.send('clear-history'),
}) 