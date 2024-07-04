const {
  BaseWindow,
  WebContentsView,
  app,
  ipcMain,
  MenuItem,
  Menu,
} = require("electron");
const path = require("path");
const { debounce } = require("./backend/helper");
const TabManager = require("./backend/TabManager");


let win;
let sidebar;
let menu;
let isUrlBarVisible = false;

let currentBounds = {
  width: 1200,
  height: 790,
};

let tabManager = new TabManager(currentBounds);

function createWindow() {
  win = new BaseWindow({
    width: currentBounds.width,
    height: currentBounds.height,
    backgroundColor: "rgba(28, 28, 45, 0.8)",
    titleBarStyle: "default",
  });


  let urlBar = new WebContentsView({
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:browser-session",
    },
  })

  urlBar.webContents.loadFile(path.join(__dirname, "components", "url-dialog", "url-dialog.html"));
  urlBar.setBounds({ x: 0, y: 0, width: currentBounds.width, height: currentBounds.height });
  urlBar.setVisible(isUrlBarVisible);
  urlBar.setBackgroundColor("#00000000");
  


  const debouncedResizeViews = debounce(resizeViews, 200);
  win.on("resize", debouncedResizeViews);

  sidebar = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:browser-session",
    },
  });

  win.contentView.addChildView(sidebar);
  sidebar.webContents.loadFile(
    path.join(__dirname, "components", "sidebar", "sidebar.html")
  );
  sidebar.setBounds({ x: 0, y: 0, width: 300, height: 768 });

  win.contentView.addChildView(urlBar);

  win.show();

  // sidebar.webContents.openDevTools();

  /**
   * MENU MANAGER
   */
  menu = new Menu();
  menu.append(
    new MenuItem({
      label: "Sidebar",
      submenu: [
        {
          role: "toggleSidebar",
          accelerator: "CommandOrControl+.",
          label: "Toggle Sidebar",
          click: () => {
            tabManager.toggleSidebar();
          },
        },
        {
          role: "focusUrlBar",
          accelerator: "CommandOrControl+i",
          label: "Focus URL Bar",
          click: () => {
            console.log('focus url bar')
            tabManager.sidebar.webContents.send('focus-url-bar')
          },
        },
        {
          role: "closeApplication",
          accelerator: "CommandOrControl+q",
          label: "Quit Vortex Browser",
          click: () => {
            app.quit();
          },
        },
      ],
    })
  );

  menu.append(
    new MenuItem({
      label: "File",
      submenu: [
        {
          role: "newTab",
          accelerator: "CommandOrControl+t",
          label: "New Tab",
          click: () => {
            tabManager.createTab();
          },
        },
        {
          role: "newTab",
          accelerator: "CommandOrControl+w",
          label: "Delete Tab",
          click: () => {
            tabManager.closeTab(tabManager.activeTabId);
          },
        },
        {
          role: "reloadTab",
          accelerator: "CommandOrControl+r",
          label: "Reload Tab",
          click: () => {
            tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.reload();
          },
        },
      ],
    })
  );

  menu.append(
    new MenuItem({
      label: "Developer",
      submenu: [
        {
          role: "Open DevTools",
          accelerator: "CommandOrControl+Option+i",
          label: "Open DevTools",
          click: () => {
            tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.openDevTools();
          },
        },
      ],
    })
  );

  
}

function resizeViews() {
  let contnetSize = win.getContentSize();
  sidebar.setBounds({ x: 0, y: 0, width: 300, height: contnetSize[1] });

  tabManager.viewMap.forEach((view, key) => {
    view.setBounds({
      x: 300,
      y: 0,
      width: contnetSize[0] - 300,
      height: contnetSize[1],
    });
  });

  currentBounds.width = contnetSize[0];
  currentBounds.height = contnetSize[1];
}

app.whenReady().then(() => {
  createWindow();
  tabManager.setWin(win);
  tabManager.setSidebar(sidebar);
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BaseWindow.getAllWindows().length === 0) createWindow();
});

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

ipcMain.on("close-tab", (event, id) => {
  tabManager.closeTab(id);
});

ipcMain.on("go-back", (event) => {
  console.log("go-back");
  tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.goBack();
});

ipcMain.on("go-forward", (event) => {
  console.log("go-forward");
  tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.goForward();
});
