const {
  BaseWindow,
  WebContentsView,
  app,
  ipcMain,
  MenuItem,
  Menu,
  webContents,
} = require("electron");
const path = require("path");
const { debounce } = require("./backend/helper");
const TabManager = require("./backend/TabManager");

/**
 * @type {BaseWindow|null}
 */
let win;

let sidebar;
let menu;
let isUrlBarVisible = false;
let isVerticallySplit = false;

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
    titleBarStyle: "hiddenInset",
  });

  let urlBar = new WebContentsView({
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:browser-session",
    },
  });
  win.setBackgroundColor('#c46464')

  urlBar.webContents.loadFile(
    path.join(__dirname, "components", "url-dialog", "url-dialog.html")
  );
  urlBar.setBounds({
    x: 0,
    y: 0,
    width: currentBounds.width,
    height: currentBounds.height,
  });
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
  sidebar.setBounds({ x: 0, y: 0, width: 300, height: currentBounds.height });

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
            console.log("focus url bar");
            tabManager.sidebar.webContents.send("focus-url-bar");
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
            tabManager.viewMap
              .get(tabManager.activeTabId)
              ?.webContents?.reload();
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
            tabManager.viewMap
              .get(tabManager.activeTabId)
              ?.webContents?.openDevTools();
          },
        },
      ],
    })
  );

  menu.append(
    new MenuItem({
      label: "Edit",
      submenu: [
        {
          role: "Find",
          accelerator: "CommandOrControl+f",
          label: "Find",
          click: manageFindInPageView,
        },
      ],
    })
  );

  menu.append(
    new MenuItem({
      label: "View",
      submenu: [
        {
          role: "splitVertically",
          accelerator: "CommandOrControl+d",
          label: "Split Vertically",
          click: () => {
            if (!isVerticallySplit) {
              console.log("splitting vertically");
              isVerticallySplit = true;
              // tabManager.splitVertically();
            } else {
              tabManager.viewMap.get(tabManager.activeTabId)?.setBounds({
                x: 300,
                y: 0,
                width: currentBounds.width - 300,
                height: currentBounds.height,
              });
              isVerticallySplit = false;
            }
          },
        },
      ],
    })
  );
}

function manageFindInPageView() {
    /**
     * @type {WebContentsView | null}
     */
    let findInPageView = tabManager.win.contentView.children.filter((child) => child.webContents.getTitle() === "find-in-page.html")[0];  
    
    findInPageView.setVisible(!tabManager.isFindInPageViewVisible)
    tabManager.isFindInPageViewVisible = !tabManager.isFindInPageViewVisible
    tabManager.win.contentView.addChildView(findInPageView)

    findInPageView.webContents.focus();
    findInPageView.webContents.executeJavaScript(`
      let findBox = document.getElementById('find-input')
      findBox.focus()
      `
    ).then((res) => {
      console.log({res})
    }).catch((err) => {
      console.error('error', err)
    });

    if (tabManager.isFindInPageViewVisible) {
      ipcMain.emit("open-find-in-page")
    } else {
      // findInPageView.setVisible(false)
      console.log('closing find in page view')
      tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.stopFindInPage('clearSelection');
      // TODO: clear previous value in search input box
    }
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
  // add a child view that acts as find in page view
  let findInPageView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:browser-session",
      transparent: true,
    },
  });
  findInPageView.webContents.loadFile(
    path.join(__dirname, "components", "find-in-page", "find-in-page.html")
  );
  findInPageView.setBounds({
    x: currentBounds.width / 1.5 ,
    y: 0,
    width: currentBounds.width / 2 ,
    // height: 68,
    height: currentBounds.height,
  });

  findInPageView.setVisible(tabManager.isFindInPageViewVisible);

  win.contentView.addChildView(findInPageView);
  tabManager.setWin(win);
  tabManager.setSidebar(sidebar);
  tabManager.loadAIModel();
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

ipcMain.on("keyup-in-find-in-page", async (event, value) => {
  console.log("keyup in find in page", value);
  let res = await tabManager.viewMap
    .get(tabManager.activeTabId)
    ?.webContents?.findInPage(value);
    
  tabManager.viewMap
    .get(tabManager.activeTabId)
    ?.webContents?.on("found-in-page", (event, result) => {
      console.log("found in page", result);
    });
  // found in page
});

/***
 * When user clicks on the close button in find in page view
 */
ipcMain.on("close-find-in-page", () => {
  console.log("close-find-in-page");
  manageFindInPageView()
});

// ipcMain.on('convert-image-to-tensor', async (image) => {
//   console.log('convert image to tensor', image  )
// })

ipcMain.on("converted-image-to-tensor", async (event, image) => {
  console.log("converted image to tensor", event, image);
  tabManager.aiModel
    .classify(image)
    .then((caption) => {
      console.log("captions", caption);
    })
    .catch((err) => {
      console.error("error generating captions", err);
    });
});


ipcMain.on("reload", () => {
  tabManager.viewMap.get(tabManager.activeTabId)?.webContents?.reload();
});