const {
  WebContentsView,
  session,
  BaseWindow,
  Menu,
  MenuItem,
  ipcMain,
  app,
} = require("electron");
const path = require("path");
const chalk = require("chalk");
const { throttledNavigation } = require("./helper");
const HistoryManager = require("./HistoryManager,js");

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
    this.isSidebarVisible = false;

    this.persistentSession = null;

    this.isFindInPageViewVisible = false;

    this.navigationLock = new Map();

    // console.log(chalk.yellow('user data path', app.getPath('userData')));

    this.historyManager = new HistoryManager(app.getPath('userData'));
  }

  setWin(win) {
    this.win = win;
    this.persistentSession = session.fromPartition("persist:browser-session");
  }

  setSidebar(sidebar) {
    this.sidebar = sidebar;
  }

  createNewView(url) {
    const newView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "../", "preload.js"),
        partition: "persist:browser-session",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    let currentUserAgent = newView.webContents.getUserAgent();

    let modifiedUserAgent = currentUserAgent.replace(
      " vortex-browser/1.0.0",
      ""
    );
    // modifiedUserAgent = modifiedUserAgent.replace(' Electron/31.0.2', '');

    // console.log("current user agent", currentUserAgent);
    // console.log("modfied user agent", modifiedUserAgent);

    this.win.contentView.addChildView(newView);

    newView.webContents.setUserAgent(modifiedUserAgent);

    if (url !== "") {
      newView.webContents.loadURL(url).catch(async (err) => {
        await newView.webContents.stop();
        console.log("💥💥 error loading url 💥💥💥", err);
        if (
          err.code === "ERR_NAME_NOT_RESOLVED" ||
          err.code === "ERR_INTERNET_DISCONNECTED"
        ) {
          newView.webContents.loadFile(
            path.join(
              __dirname,
              "../",
              "components",
              "Errors",
              "address-not-resolved.html"
            )
          );
        } else {
          newView.webContents.loadFile(
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
    } else {
      newView.webContents.loadFile(
        path.join(__dirname, "../", "components", "new-tab", "new-tab.html")
      );
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

  createTab(url = "https://www.google.com") {
    console.log(chalk.green("1: creating tab "), url);
    const tabId = this.tabs.length + "-" + Date.now();
    let view = this.createNewView(url);
    const newTab = { id: tabId, title: "New Tab", url: url, isLoading: true };
    this.viewMap.set(tabId, view);
    this.tabs.push(newTab);
    this.activeTabId = tabId;
    this.updateTabs();

    view.webContents.on("will-navigate", (event, url) => {
      console.log("2: ::::::: >> will-navigate ", url);
    });

    view.webContents.on("did-start-navigation", (event, url, isInPage) => {
      console.log("3: did-start-navigation", { url, isInPage });

      if (isInPage) {
        event.preventDefault();
      }
    });

    view.webContents.on("will-frame-navigate", (event, url, isMainFrame) => {
      console.log("5: will-frame-navigate", { url, isMainFrame });
    });

    view.webContents.on("will-prevent-unload", (event, url, isMainFrame) => {
      console.log("6: will-prevent-unload", { url, isMainFrame });
    });

    view.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.log(
          "7: did-fail-load",
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame
        );
        if (errorDescription === "ERR_INTERNET_DISCONNECTED") {
          view.webContents.loadFile(
            path.join(
              __dirname,
              "../",
              "components",
              "Errors",
              "no-internet-connection.html"
            )
          );
        }
      }
    );

    view.webContents.on("enter-html-full-screen", (event) => {
      console.log(chalk.yellow("enter-html-full-screen"));
      setTimeout(() => {
        this.hideSidebar();
      }, 300);
    });

    view.webContents.on("leave-html-full-screen", (event) => {
      console.log(chalk.yellow("leave-html-full-screen"));
      this.showSidebar();
    });

    view.webContents.on("did-navigate", (event, url) => {
      console.log(chalk.red("8: did-navigate"), { url });
      this.tabs.find((tab) => tab.id === tabId).isLoading = true;
      this.tabs.forEach((tab) => {
        tab.url = url;
        if (tab.id === tabId) {
          this.updateTabs();
        }
      });
    });

    view.webContents.on("will-frame-navigate", (event, url, isMainFrame) => {
      console.log("5.5: will-frame-navigate", { url, isMainFrame });
    });

    view.webContents.on("will-prevent-unload", (event, url, isMainFrame) => {
      console.log("6.5: will-prevent-unload", { url, isMainFrame });
    });

    view.webContents.on("did-finish-load", (e) => {
      console.log(chalk.blueBright("9: did-finish-load"));
      // this.navigationInProgress[tabId] = false;
      // focus the url bar
      view.webContents.focus();

      view.webContents
        .executeJavaScript("({title: document.title, url: document.URL})")
        .then((data) => {
          // console.log('data', data)
          if (data?.title.length > 30) {
            let title = data.title.substring(0, 30) + "...";
            // console.log(chalk.bgCyan('title', title))
            this.tabs.filter((tab) => tab.id === tabId)[0].title = title;
          } else {

          this.tabs.filter((tab) => tab.id === tabId)[0].title = data.title;
          }
         
          this.updateTabs();
          this.persistCookiesForUrl(url);

          this.historyManager.addToHistory({
            url: data.url,
            title: data.title,
          });
        })
        .catch((error) => console.error("Error getting page title:", error));

      view.webContents
        .executeJavaScript(
          `
        performance.getEntriesByType('navigation')[0].toJSON()
      `
        )
        .then((perfData) => {
          // console.table(perfData);
        });
    });

    view.webContents.on("did-stop-loading", (event) => {
      // console.log(chalk.yellow("10: did-stop-loading"), this.tabs);
      // this.navigationInProgress[tabId] = false;
      this.tabs.find((tab) => tab.id === tabId).isLoading = false;
      this.updateTabs();
    });

    view.webContents.on("destroyed", () => {
      // delete this.navigationInProgress[tabId]
      console.log("🚁 🚁 🚁 🚁  destroyed", tabId);
    });

    /**
     * The below code open the new link with __blank attribute in another tab
     *  Also we are switching to the previous tab because the this.createTab() method creates
     *  and put the newly created tab in focus.
     */
    view.webContents.setWindowOpenHandler((details) => {
      // console.log({ details });
      // console.log(chalk.yellow("Outside spotify login"));
      let prevTabId = this.activeTabId;
      this.createTab(details.url);
      this.switchTab(prevTabId);
      return { action: "deny" };
    });

    /**
     * The below code is for context menu
     * Which is it responisble for opening the dialog box when user right click on the page
     */
    view.webContents.on("context-menu", (event, params) => {
      event.preventDefault();
      const menu = new Menu();
      menu.append(
        new MenuItem({
          label: "Open Dev Tools",
          click: () => {
            view.webContents.openDevTools();
          },
        })
      );
      if (params.linkURL) {
        menu.append(
          new MenuItem({
            label: "Open in new Tab",
            click: () => {
              let prevTabId = this.activeTabId;
              this.createTab(params.linkURL);
              this.switchTab(prevTabId);
            },
          })
        );
      }

      menu.popup();
    });
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

  async navigate(id, url, isNewTab = false) {
    if (this.navigationLock.get(id)) {
      console.log("Navigation already in progress, ignoring");
      return;
    }

    this.navigationLock.set(id, true);

    try {
      console.log("attemptinh to navigate", { id, url, isNewTab });

      if (this.tabs.length === 0) {
        this.createTab(url);
      } else if (isNewTab) {
        this.createTab(url);
      } else {
        console.log(chalk.magenta("------------- ELSE ------------>"));
        this.tabs.find((tab) => tab.id === id).url = url;
        if (id === this.activeTabId) {
          console.log(
            "Loading ...............................................",
            chalk.magenta(
              this.viewMap.get(id)?.webContents?.isLoadingMainFrame()
            )
          );

          this.viewMap.get(id)?.webContents?.stop();

          console.log(
            "Stopped ...............................................",
            chalk.magenta(
              this.viewMap.get(id)?.webContents?.isLoadingMainFrame()
            )
          );

          
          this.viewMap
            .get(id)
            ?.webContents?.loadURL(url, {
              waitUntil: "domcontentloaded",
            })
            .catch((err) => {
              console.log("💥💥💥💥 error loading url - 42 💥💥💥", err);
              this.tabs.find((tab) => tab.id === id).url = url;
              if (
                err.code === "ERR_NAME_NOT_RESOLVED" ||
                err.code === "ERR_INTERNET_DISCONNECTED"
              ) {
                this.viewMap
                  .get(id)
                  ?.webContents?.loadFile(
                    path.join(
                      __dirname,
                      "../",
                      "components",
                      "Errors",
                      "address-not-resolved.html"
                    )
                  );
              } else {
                this.viewMap
                  .get(id)
                  ?.webContents?.loadFile(
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
    } catch (error) {
      console.error("Error navigating", error);
    } finally {
      this.navigationLock.set(id, false);
    }
  }

  updateTabs() {
    this.sidebar.webContents.send("update-tabs", {
      tabs: this.tabs,
      activeTabId: this.activeTabId,
    });
  }

  closeTab(id) {
    let viewToDestroy = this.viewMap.get(id);
    viewToDestroy.setVisible(false);
    // console.log("destroying view/tab", viewToDestroy.webContents.getTitle());
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

    if (this.tabs.length === 0) {
      this.createTab();
    }
    this.updateTabs();
  }

  hideSidebar() {
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

  showSidebar() {
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
      });
    } else {
      this.viewMap.get(this.activeTabId)?.setBounds({
        x: sidebarBounds.width,
        y: 0,
        width: (this.currentBounds.width - sidebarBounds.width) / 2,
        height: this.currentBounds.height,
      });
    }

    this.openSuggestionForContemporaryView();
  }

  openSuggestionForContemporaryView() {
    let sidebarBounds = this.sidebar.getBounds();
    let temporaryView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    temporaryView.webContents.loadFile(
      path.join(
        __dirname,
        "../",
        "components",
        "split-view-suggestion",
        "split-view-suggestion.html"
      )
    );

    if (sidebarBounds.width === 0) {
      temporaryView.setBounds({
        x: this.currentBounds.width / 2,
        y: 0,
        width: this.currentBounds.width / 2,
        height: this.currentBounds.height,
      });
    } else {
      temporaryView.setBounds({
        x: this.currentBounds.width / 2 + sidebarBounds.width / 2,
        y: 0,
        width: (this.currentBounds.width - sidebarBounds.width) / 2,
        height: this.currentBounds.height,
      });
    }

    this.win.contentView.addChildView(temporaryView);
  }
}

module.exports = TabManager;
