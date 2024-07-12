const { WebContentsView, session, BaseWindow, Menu, MenuItem, ipcMain } = require("electron");
const path = require("path");
const { verifySessionStorage, base64ToArrayBuffer } = require("./helper");
const { generateCaption, loadModel } = require("./ai-models/image-captioning");
const tf = require('@tensorflow/tfjs-node');
class TabManager {
  /**
   * @param {{width: number, height: number}} currentBounds
   * @param {BaseWindow|null} win
   */
  constructor(currentBounds, win = null) {
    this.tabs = [];
    /** @type {Map<string, WebContentsView>} */
    this.viewMap = new Map();

    this.activeTabId = null;

    /** @type {BaseWindow} */
    this.win = win;

    this.currentBounds = currentBounds;

    /** @type {WebContentsView} */
    this.sidebar = null;

    this.persistentSession = null;
    
    this.aiModel = null;

    this.isFindInPageViewVisible = false;
  }

  setWin(win) {
    this.win = win;
    this.persistentSession = session.fromPartition("persist:browser-session");
  }

  setSidebar(sidebar) {
    this.sidebar = sidebar;
  }

  async loadAIModel() {
    this.aiModel = await loadModel();
  }

  createNewView(url) {
    const newView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "../", "preload.js"),
        partition: "persist:browser-session",
      },
    });

    this.win.contentView.addChildView(newView);

    if (url !== '') {
      newView.webContents.loadURL(url).catch((err) => {
        console.log('💥💥 error loading url 💥💥💥', err);
        if (err.code === "ERR_NAME_NOT_RESOLVED" || err.code === "ERR_INTERNET_DISCONNECTED") {
          newView.webContents.loadFile(path.join(__dirname, "../", "components", "Errors", "address-not-resolved.html"));
        } else {
          newView.webContents.loadFile(path.join(__dirname, "../", "components", "Errors", "something-went-wrong.html"));
        }
      })
    } else {
      newView.webContents.loadFile(path.join(__dirname, "../", "components", "new-tab", "new-tab.html"));
    }
    
    newView.setBounds({
      x: 300,
      y: 0,
      width: this.currentBounds.width - 300,
      height: this.currentBounds.height,
    });

    newView.webContents.on(
      "login",
      async (event, details, authInfo, callback) => {
        event.preventDefault();
        console.log({ event, details, authInfo, callback });
      }
    );

    return newView;
  }

  createTab(url = '') {
    console.log('creating tab ', url)
    const tabId = this.tabs.length + "-" + Date.now();
    let view = this.createNewView(url);
    const newTab = { id: tabId, title: "New Tab", url: url };
    this.viewMap.set(tabId, view);
    this.tabs.push(newTab);
    this.activeTabId = tabId;
    this.updateTabs();

    // view.webContents.openDevTools(); 

    view.webContents.on("did-navigate", (event, url) => {
      console.log('creating tab did-navigate')
      // inititating loading state
      view.webContents.executeJavaScript("document.body.classList.add('loading')").then((res) => {
        console.log('loading state started -----')
      }).catch((err) => {
        console.error('error adding loading state', err)
      })
      this.tabs.forEach((tab) => {
        if (tab.id === tabId) {
          tab.url = url.includes('new-tab') ? '' : url;
          this.updateTabs();
          this.persistCookiesForUrl(url);
        }
      });
    });

    view.webContents.on("did-finish-load", (e) => {
      console.log('loading finished ========')
      // focus the url bar
      view.webContents.focus();
      
      view.webContents.executeJavaScript("document.title").then((title) => {
        this.tabs.filter((tab) => tab.id === tabId)[0].title = title;
        this.updateTabs();
      });
    });

    view.webContents.on("destroyed", () => {
      console.log("🚁 🚁 🚁 🚁  destroyed", tabId);
    });

    /**
     * The below code open the new link with __blank attribute in another tab
     *  Also we are switching to the previous tab because the this.createTab() method creates
     *  and put the newly created tab in focus.
     */
    view.webContents.setWindowOpenHandler(details => {
      console.log({details})
      let prevTabId = this.activeTabId
      this.createTab(details.url)
      this.switchTab(prevTabId)
      return {action: 'deny'}
    });
    
    /**
     * The below code is for context menu
     * Which is it responisble for opening the dialog box when user right click on the page
     */
    view.webContents.on("context-menu", (event, params) => {
      // console.log('context menu', params)
      event.preventDefault()
      const menu =  new Menu()
      menu.append(
        new MenuItem({
          label: 'Open Dev Tools',
          click: () => {
            view.webContents.openDevTools();
          }
        })
      );
      if (params.linkURL) {
        menu.append(new MenuItem({
          label: 'Open in new Tab',
          click: () => {
            let prevTabId = this.activeTabId
            this.createTab(params.linkURL)
            this.switchTab(prevTabId)
          }
        }));
      }

      if (params.mediaType === 'image') {
        menu.append(new MenuItem({
          label: 'Generate Caption',
          click: () => {
            console.log('generating captions')
            console.log({srcURL: params});
            
            this.sidebar.webContents.send('convert-image-to-tensor', params.srcURL, this.aiModel.classify)
          }
        }));
      }
      menu.popup()
      
    })
    return tabId;
  }

  switchTab(id) {
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
    console.log("navigate", id, url, isNewTab);
    if (this.tabs.length === 0) {
      this.createTab(url);
    } else if (isNewTab) {
      this.createTab(url);
    } else {
      this.tabs.find((tab) => tab.id === id).url = url;
      if (id === this.activeTabId) {
        this.viewMap.get(id)?.webContents?.loadURL(url).catch((err) => {
          console.log('💥💥💥💥 error loading url - 2 💥💥💥', err);
          if (
            err.code === "ERR_NAME_NOT_RESOLVED" ||
            err.code === "ERR_INTERNET_DISCONNECTED"
          ) {
            this.viewMap.get(id)?.webContents?.loadFile(
              path.join(
                __dirname,
                "../",
                "components",
                "Errors",
                "address-not-resolved.html"
              )
            );
          } else {
            this.viewMap.get(id)?.webContents?.loadFile(
              path.join(
                __dirname,
                "../",
                "components",
                "Errors",
                "something-went-wrong.html"
              )
            );
          }
        });
      }
      this.updateTabs();
    }
  }

  updateTabTitle(id, title) {
    this.tabs[id].title = title;
    this.updateTabs();
  }

  updateTabs() {
    console.log("active tab id", this.activeTabId);
    this.sidebar.webContents.send("update-tabs", {
      tabs: this.tabs,
      activeTabId: this.activeTabId,
    });
  }

  closeTab(id) {
    console.log({ clostabid: id });
    let viewToDestroy = this.viewMap.get(id);
    viewToDestroy.setVisible(false);
    console.log("destroying view", viewToDestroy.webContents.getTitle());
    if (!viewToDestroy) return;

    this.win.contentView.removeChildView(viewToDestroy);
    viewToDestroy.webContents.close();
    this.viewMap.delete(id);

    this.tabs = this.tabs.filter((tab) => tab.id !== id);

    this.activeTabId = this.tabs[this.tabs.length - 1]?.id;

    console.log("active tab id after closong tab", this.activeTabId);

    // Important to set visible to true as it resets all views which prevents from flickering
    this.viewMap.forEach((view, key) => {
      view.setVisible(true);
    });

    // this.activeTabId = this.tabs[this.tabs.length - 1]?.id;

    if (this.tabs.length === 0) {
      this.createTab();
    }
    this.updateTabs();
    // this.switchTab(this.activeTabId);
    // bring the tab to front

    setTimeout(() => {
      console.log(" 🌸is destroyed", viewToDestroy?.webContents?.isDestroyed());
      this.viewMap.forEach((view, key) => {
        console.log("remaining views", view.webContents.getTitle());
      });
    }, 2000);
  }

  toggleSidebar() {
    let bounds = this.sidebar.getBounds();
    if (bounds.width === 0) {
      this.sidebar.setBounds({
        x: 0,
        y: 0,
        width: 300,
        height: this.currentBounds.height,
      });
      this.viewMap.forEach((view, key) => {
        view.setBounds({
          x: 300,
          y: 0,
          width: this.currentBounds.width - 300,
          height: this.currentBounds.height,
        });
      });
    } else {
      this.sidebar.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: this.currentBounds.height,
      });
      this.viewMap.forEach((view, key) => {
        view.setBounds({
          x: 0,
          y: 0,
          width: this.currentBounds.width,
          height: this.currentBounds.height,
        });
      });
    }
  }

  persistCookiesForUrl(url) {
    if (!url) {
      console.error("No URL provided for cookie persistence");
      return;
    }

    const parsedUrl = new URL(url);

    this.persistentSession.cookies
      .get({ url })
      .then((cookies) => {
        cookies.forEach((cookie) => {
          const {
            name,
            value,
            domain,
            path,
            secure,
            httpOnly,
            expirationDate,
          } = cookie;

          // Check if the cookie's domain is a subdomain of the current URL
          if (
            !domain ||
            !parsedUrl.hostname.endsWith(
              domain.startsWith(".") ? domain : `.${domain}`
            )
          ) {
            console.warn(`Skipping cookie with mismatched domain: ${name}`);
            return;
          }

          // Construct the URL for the cookie
          const cookieUrl = `http${secure ? "s" : ""}://${
            parsedUrl.hostname
          }${path}`;

          // console.log("Setting cookie:", {
          //   cookieUrl,
          //   name,
          //   value,
          //   domain,
          //   path,
          //   secure,
          //   httpOnly,
          //   expirationDate,
          // });

          this.persistentSession.cookies
            .set({
              url: cookieUrl,
              name,
              value,
              domain: domain || parsedUrl.hostname,
              path,
              secure,
              httpOnly,
              expirationDate,
            })
            .catch((err) => {
              if (err.message.includes("EXCLUDE_INVALID_DOMAIN")) {
                console.warn(
                  `Failed to set cookie due to domain mismatch: ${name}`
                );
              } else {
                console.error("Error setting cookie:", err);
              }
            });
        });
      })
      .catch((err) => console.error("Error getting cookies:", err));
  }

  toggleFindInPageView() {}

  splitVertically() {
    /**
     * @type {x: number, y: number, width: number, height: number}
     */
    let sidebarBounds = this.sidebar.getBounds();
    if (sidebarBounds.width === 0) {
      this.viewMap.get(this.activeTabId)?.setBounds({
        x: 0,
        y: 0,
        width: this.currentBounds.width / 2,
        height: this.currentBounds.height,
      })
    } else {
      this.viewMap.get(this.activeTabId)?.setBounds({
        x: sidebarBounds.width,
        y: 0,
        width: (this.currentBounds.width - sidebarBounds.width) / 2,
        height: this.currentBounds.height,
      });
    }

    this.openSuggestionForContemporaryView()
    
  }

  openSuggestionForContemporaryView() {
    let sidebarBounds = this.sidebar.getBounds();
    let temporaryView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    temporaryView.webContents.loadFile(path.join(__dirname, "../", "components", "split-view-suggestion", "split-view-suggestion.html"));

    if (sidebarBounds.width === 0) {
      temporaryView.setBounds({
        x: this.currentBounds.width / 2,
        y: 0,
        width: this.currentBounds.width / 2,
        height: this.currentBounds.height,
      });
    } else {
      temporaryView.setBounds({
        x: (this.currentBounds.width / 2 ) + (sidebarBounds.width / 2),
        y: 0,
        width: (this.currentBounds.width - sidebarBounds.width) / 2,
        height: this.currentBounds.height,
      });
    }

    // this.win.contentView.children.forEach((child) => {
    //   child.setVisible(true)
    // });
    

    this.win.contentView.addChildView(temporaryView);
  }
}

module.exports = TabManager;
