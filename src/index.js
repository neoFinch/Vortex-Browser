const { BaseWindow, WebContentsView, app, ipcMain, globalShortcut } = require("electron");

if (process.env.NODE_ENV !== 'production') {
  app.commandLine.appendSwitch('js-flags', '--expose-gc');
}

const path = require("path");
let win;
let mainView, sidebar;

let tabs = [];
let viewMap = new Map();
let activeTabId = null;
let currentBounds = {
  width: 1200,
  height: 790,
};

function createWindow() {
  win = new BaseWindow({
    width: currentBounds.width,
    height: currentBounds.height,
    backgroundColor: "rgba(28, 28, 45, 0.8)",
    titleBarStyle: "default",
  });

  
  
  const debouncedResizeViews = debounce(resizeViews, 200);

  win.on("resize", debouncedResizeViews);

  sidebar = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.contentView.addChildView(sidebar);
  sidebar.webContents.loadFile(
    path.join(__dirname, "components", "sidebar", "sidebar.html")
  );
  sidebar.setBounds({ x: 0, y: 0, width: 300, height: 768 });

  win.show();

  // sidebar.webContents.openDevTools();
}

function resizeViews() {
  let contnetSize = win.getContentSize();
  // mainView.setBounds({ x: 300, y: 0, width: contnetSize[0] - 300, height: contnetSize[1] });
  console.log({ contnetSize });
  sidebar.setBounds({ x: 0, y: 0, width: 300, height: contnetSize[1] });
  console.log('viewMap', viewMap);
  tabManager.viewMap.forEach((view, key) => {
    console.log({ key: view.getBounds() });
    view.setBounds({
      x: 300,
      y: 0,
      width: contnetSize[0] - 300,
      height: contnetSize[1],
    });
  });

  currentBounds.width = contnetSize[0];
  currentBounds.height = contnetSize[1];

  // viewMap.forEach((view, key) => {
  //   console.log({ key: view.getBounds() });
  //   view.setBounds({
  //     x: 300,
  //     y: 0,
  //     width: contnetSize[0] - 300,
  //     height: contnetSize[1],
  //   });
  // });
  currentBounds.width = contnetSize[0];
  currentBounds.height = contnetSize[1];
}

app.whenReady().then(() => {
  globalShortcut.register("CommandOrControl+.", () => {
    let bounds = sidebar.getBounds();
    if (bounds.width === 0) {
      sidebar.setBounds({ x: 0, y: 0, width: 300, height: currentBounds.height });
      tabManager.viewMap.forEach((view, key) => {
        view.setBounds({
          x: 300,
          y: 0,
          width: currentBounds.width - 300,
          height: currentBounds.height,
        });
      });
    } else {
      sidebar.setBounds({ x: 0, y: 0, width: 0, height: currentBounds.height });
      tabManager.viewMap.forEach((view, key) => {
        view.setBounds({
          x: 0,
          y: 0,
          width: currentBounds.width,
          height: currentBounds.height,
        });
      });
    }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BaseWindow.getAllWindows().length === 0) createWindow();
});

/**
 *
 * TAB MANAGER CLASS
 *
 */

class TabManager {
  constructor(tabs, viewMap, activeTabId) {
    // this.tabs = tabs;
    // this.viewMap = viewMap;
    // this.activeTabId = activeTabId;
    this.tabs = [];
    this.viewMap = new Map();
    this.activeTabId = null;
  }

  createNewView(url) {
    const newView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    win.contentView.addChildView(newView);
    
    newView.webContents.loadURL(url);
    newView.setBounds({
      x: 300,
      y: 0,
      width: currentBounds.width - 300,
      height: currentBounds.height,
    });
    return newView;
  }

  createTab(url = "https://www.google.com") {
    const tabId = this.tabs.length;
    let view = this.createNewView(url);
    console.log("createTab", tabId, view);
    const newTab = { id: tabId, title: "New Tab", url: url };
    this.viewMap.set(tabId, view);
    this.tabs.push(newTab);
    this.activeTabId = tabId;
    this.updateTabs();
    view.webContents.on("did-navigate", (event, url) => {
      console.log("did-navigate", url);
      this.tabs[tabId].url = url;
      this.updateTabs();
    });
    
    view.webContents.on('render-process-gone', () => {
      console.log('🖐  render-process-gone', tabId);

    })

    view.webContents.on('unresponsive', () => {
      console.log('🚁 🚁 🚁 🚁  unresponsive', tabId);
      // this.closeTab(tabId);
    });
    view.webContents.on('destroyed', () => {
      console.log('🚁 🚁 🚁 🚁  destroyed', tabId);
      // this.closeTab(tabId);
      console.log('🤬 removing child view');
      
    });
    return tabId;
  }

  switchTab(id) {
    console.log("switchTab", id, this.activeTabId);
    if (this.activeTabId === id) {
      return;
    }
    this.activeTabId = id;
    // bring the tab to front

    this.viewMap.forEach((view, key) => {
      view.setVisible(false);
    });
    this.viewMap.get(this.activeTabId).setVisible(true);
    this.updateTabs();
  }

  navigate(id, url, isNewTab = false) {
    if (this.tabs.length === 0) {
      console.log("create tab", url);
      this.createTab(url);
    } else if (isNewTab) {
      this.createTab(url);
    } else {
      this.tabs[id].url = url;
      if (id === this.activeTabId) {
        this.viewMap.get(id)?.webContents?.loadURL(url);
      }
      this.updateTabs();
    }
  }

  updateTabTitle(id, title) {
    this.tabs[id].title = title;
    this.updateTabs();
  }

  updateTabs() {
    console.log("updateTabs", this.tabs, this.activeTabId);
    sidebar.webContents.send("update-tabs", {
      tabs: this.tabs,
      activeTabId: this.activeTabId,
    });
  }

  closeTab(id) {
    console.log('close tab : ', {id})
    console.log({viewMap: this.viewMap})
    let viewToDestroy = this.viewMap.get(id);
    if(!viewToDestroy) return;
    console.log({viewToDestroy})
    win.contentView.removeChildView(viewToDestroy);
    viewToDestroy.webContents.close(); 
    this.viewMap.delete(id);
    this.tabs = this.tabs.filter(tab => tab.id !== id);
    // this.activeTabId = this.tabs.length > 0 ? this.tabs[0].id : null;
    if (this.tabs.length === 0) {
      this.createTab();
    }
    this.updateTabs();
    setTimeout(() => {
      console.log(' 🌸is destroyed', viewToDestroy?.webContents?.isDestroyed());
    }, 2000);
  }
}

function checkStatus(children) {
  console.log('💮 💮 💮 💮 💮  checking status 💮 💮 💮 💮 ')
  for (let child of children) {
    console.log('title ==>', child.webContents.getTitle());
    console.log('🌸 is destroyed', child.webContents.isDestroyed());
  }
}

const tabManager = new TabManager(tabs, viewMap, activeTabId);


/**
 * IPC EVENTS
 */

ipcMain.on("create-tab", (event, url) => {
  tabManager.createTab(url);
});

ipcMain.on("switch-tab", (event, id) => {
  tabManager.switchTab(id);
});

ipcMain.on("navigate", (event, url) => {
  tabManager.navigate(tabManager.activeTabId, url, false);
});

ipcMain.on("page-navigated", (event, url) => {
  console.log({ event, url });
  // tabManager.navigate(tabManager.activeTabId, url, false);
});
 
ipcMain.on("close-tab", (event, id) => {
  tabManager.closeTab(id);
});

// win.

// mainView?.webContents.on("page-title-updated", (event, title) => {
//   tabManager.updateTabTitle(tabManager.activeTabId, title);
// });

// mainView?.webContents.on("did-navigate", (event, url) => {
//   tabManager.navigate(tabManager.activeTabId, url, false);
// });

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
