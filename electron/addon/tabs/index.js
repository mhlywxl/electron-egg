const Log = require('ee-core/log');

const {EventEmitter} = require('events')

const { nativeTheme, screen, dialog, app, ipcMain, webContents, ipcRenderer, BrowserWindow, BrowserView } = require('electron')
const CoreWindow = require('ee-core/electron/window');
const Conf = require('ee-core/config');
const EE = require('ee-core/ee');
const path = require("path");
const Storage = require('ee-core/storage');


/**
 * @typedef {number} TabID
 * @description BrowserView's ID as the tab ID.
 */

/**
 * @typedef {object} Tab
 * @property {string} url the tab's url (the address bar).
 * @property {string} href the tab's loaded page url (location.href).
 * @property {string} title the tab's title.
 * @property {string} favicon the tab's favicon url.
 * @property {boolean} isLoading
 * @property {boolean} canGoBack
 * @property {boolean} canGoForward
 */

/**
 * @typedef {Object.<TabID, Tab>} Tabs
 */

/**
 * @typedef {object} Bounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

class TabbedWindow extends EventEmitter {
  /**
   * The constructor for defining a tabbed window.
   * @param {object} options the options for building a tabbed window.
   * @param {string} [options.blankPage = ''] the blank page to load on new tab.
   * @param {string} options.blankTitle the blank page's title.
   * @param {number} options.controlHeight the control interface's height.
   * @param {string} options.controlPanel the control interface path to load.
   * @param {object} [options.controlReferences] the additional web peferences for the control panel view.
   * @param {boolean} [options.debug] toggle debug.
   * @param {number} options.height the tabbed window's height.
   * @param {function} [options.onNewWindow] - the custom web content `new-window` event handler.
   * @param {string} [options.startPage = ''] the start page to load on the tabbed window open.
   * @param {object} [options.viewReferences] the additional web preferences for every tab view.
   * @param {number} options.width the tabbed window's width.
   * @param {object} [options.winOptions] the tabbed window options.
   */
  constructor(cfg, options) {
    super();
    this.options = options;

    this.cfg = cfg

    this.defCurrentViewId = null;
    this.defTabConfigs = {};
    this.ipc = null; // IPC channel.
    this.tabs = []; // Keep order.
    this.views = {}; // Prevent browser views garbage collected.
    this.win = CoreWindow.getMainWindow();
    this.setChannel();
  } // end constructor

  /**
   * The current tab view.
   */
  get currentView() {
    return this.currentViewId ? this.views[this.currentViewId] : null;
  }

  /**
   * The current tab view ID.
   */
  get currentViewId() {
    return this.defCurrentViewId;
  }

  set currentViewId(id) {
    this.defCurrentViewId = id;
    this.setContentBounds();

    if (this.ipc) {
      this.ipc.reply("active-update", id);
    } // end if
  }

  /**
   * The current tab view's web contents.
   */
  get currentWebContents() {
    const { webContents } = this.currentView || {};
    return webContents;
  }

  /**
   * The tab configurations.
   */
  get tabConfigs() {
    return this.defTabConfigs;
  }

  set tabConfigs(v) {
    this.defTabConfigs = v;

    if (this.ipc) {
      this.ipc.reply("tabs-update", {
        confs: v,
        tabs: this.tabs,
      });
    } // end if
  }

  /**
   * Destroy the tab.
   * @param {TabID} viewId the tab view ID.
   * @ignore
   */
  destroyView(viewId) {
    const view = this.views[viewId];
    // console.log(view)
    if (view) {
      // view.webContents.close({ waitForBeforeUnload: this.cfg.WAIT_FOR_BEFORE_UNLOAD });
      if (!view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
      this.views[viewId] = null;
    } // end if
  } // end function destoryView

  /**
   * Get the control view's bounds.
   * @returns the bounds of the control view excluding the window's frame.
   */
  getControlBounds() {
    const contentBounds = this.win.getContentBounds();
    return {
      height: this.options.controlHeight,
      width: contentBounds.width,
      x: 0,
      y: 0,
    };
  } // end function getControlBounds

  /**
   * Load the URL on the view.
   * @param {string} url the URL to load.
   * @ignore
   */
  loadURL(url) {
    const { currentView } = this;

    if (!url || !currentView) {
      return;
    } // end if

    const { id, webContents } = currentView;
    const MARKS = "__IS_INITIALIZED__";

    // Prevent addEventListeners on the same webContents when entering urls in the same tab.
    if (webContents[MARKS]) {
      webContents.loadURL(url);
      return;
    } // end if

    const onNewWindow = async (
      e,
      newUrl,
      frameName,
      disposition,
      winOptions
    ) => {
      // Handle newUrl = "about:blank" in some cases.
      if (!new URL(newUrl).host) {
        return;
      } // end if

      e.preventDefault();

      if (disposition === "new-window") {
        e.newGuest = new BrowserWindow(winOptions);
      } else if (disposition === "foreground-tab") {
        await this.newTab(newUrl, id);
        e.newGuest = new BrowserWindow({ ...winOptions, show: false }); // `newGuest` must be set to prevent freeze the trigger tab. The window will be destroyed automatically on the trigger tab closed.
      } else {
        await this.newTab(newUrl, id);
      } // end nested if...else
    };

    webContents.on("new-window", this.options.onNewWindow || onNewWindow);

    // Keep the events in order.
    webContents
      .on("did-start-loading", () => {
        this.setTabConfig(id, { isLoading: true });
      })
      .on("did-start-navigation", (e, href, isInPlace, isMainFrame) => {
        if (isMainFrame) {
          this.setTabConfig(id, { url: href, href });

          /**
           * The url-updated event.
           * @event TabbedWindow#url-updated
           * @returns the current tab view.
           * @returns the updated URL.
           */
          this.emit("url-updated", { view: currentView, href });
        } // end if
      })
      .on("will-redirect", (e, href) => {
        this.setTabConfig(id, { url: href, href });
        this.emit("url-updated", { view: currentView, href });
      })
      .on("page-title-updated", (e, title) => {
        this.setTabConfig(id, { title });
      })
      .on("page-favicon-updated", (e, favicons) => {
        this.setTabConfig(id, { favicon: favicons[0] });
      })
      .on("did-stop-loading", () => {
        this.setTabConfig(id, { isLoading: false });
      })
      .on("dom-ready", () => {
        webContents.focus();
      });

    webContents.loadURL(url);
    webContents[MARKS] = true;

    this.setContentBounds();
  } // end function loadURL

  /**
   * Create a tab.
   * @param {string} [url=this.options.blankPage] the URL to load.
   * @param {number} [appendTo] the specified tab ID to add the new tab next to the specific tab.
   * @param {object} [references=this.options.viewReferences] the custom web preferences to the new tab.
   * @fires TabbedWindow#new-tab
   */
  async newTab(url, appendTo, references) {
    const view = new BrowserView({
      webPreferences: {
        // ...this.commonWebPreferences,
        ...(references || this.options.viewReferences), // Put it here to overwrite existing values in the above properties.
      },
    });

    // custom window.open() action
    view.webContents.setWindowOpenHandler((details) => {
      this.newTab(details.url)
      return { action: 'deny' }
    })

    view.id = view.webContents.id;

    if (appendTo) {
      const prevIndex = this.tabs.indexOf(appendTo);
      this.tabs.splice(prevIndex + 1, 0, view.id);
    } else {
      this.tabs.push(view.id);
    } // end if...else

    this.views[view.id] = view;

    // Add to the manager first.
    const lastView = this.currentView;
    this.setCurrentView(view.id);
    view.setAutoResize({ height: true, width: true });
    this.loadURL(url || this.options.blankPage);
    this.setTabConfig(view.id, {
      title: this.options.blankTitle,
    });

    /**
     * The new-tab event.
     * @event TabbedWindow#new-tab
     * @returns the current tab view.
     * @returns the loaded URL.
     * @returns the previous active view.
     */
    this.emit("new-tab", view, { openedURL: url, lastView });
    return view;
  } // end function newTab

  /**
   * Set the tabbed window event channel.
   * @ignore
   */
  setChannel() {
    const webContentsAct = (actionName) => {
      const webContents = this.currentWebContents;
      const action = webContents && webContents[actionName];
      if (typeof action === "function") {
        if (actionName === "reload" && webContents.getURL() === "") {
          return;
        } // end if
        action.call(webContents);
      } else {
        Log.warn("Invalid tabbed window web content action:", actionName);
      } // end if...else
    };

    const channels = Object.entries({
      act: (e, actName) => webContentsAct(actName),
      "close-tab": async (e, id) => {
        if (id === this.currentViewId) {
          const removeIndex = this.tabs.indexOf(id);
          const nextIndex =
            removeIndex === this.tabs.length - 1 ? removeIndex - 1 : removeIndex + 1;
          this.setCurrentView(this.tabs[nextIndex]);
        } // end if

        this.tabs = this.tabs.filter((v) => v !== id);
        this.tabConfigs = {
          ...this.tabConfigs,
          [id]: null,
        };
        this.destroyView(id);

        /**
         * The close-tab event.
         * @event TabbedWindow#close-tab
         * @returns the tab item index.
         */
        this.emit("close-tab", id);
      },
      "control-ready": async (e) => {
        this.ipc = e;
        await this.newTab(this.options.startPage || "");
        this.win.show();

        /**
         * The control-ready event.
         * @event TabbedWindow#control-ready
         * @type {IpcMainEvent}
         */
        this.emit("control-ready", e);
      },
      "new-tab": async (e, url, references) => {
        await this.newTab(url, null, references);
      },
      "switch-tab": (e, id) => {
        this.switchTab(id);
      },
      "url-change": (e, url) => {
        this.setTabConfig(this.currentViewId, { url });
      },
    });

    channels
      .map(([name, listener]) => [
        name,
        (e, ...args) => {
          // Support multiple tabbed windows.
          if (
            this.win &&
            !this.win.isDestroyed() &&
            e.sender === this.win.webContents
          ) {
            listener(e, ...args);
          } // end if
        },
      ])
      .forEach(([name, listener]) => ipcMain.on(name, listener));

    this.win.on("closed", () => {
      channels.forEach(([name, listener]) =>
        ipcMain.removeListener(name, listener)
      ); // Remember to clear all ipcMain events as ipcMain bind on every new tabbed window instance.

      this.tabs.forEach((id) => this.destroyView(id)); // Prevent BrowserView memory leak on close.

      /**
       * The closed event.
       * @event TabbedWindow#closed
       */
      this.emit("closed");
    });
  } // end function setChannel

  /**
   * Set the web content view's bounds automatically.
   * @ignore
   */
  setContentBounds() {
    const [contentWidth, contentHeight] = this.win.getContentSize();
    const controlBounds = this.getControlBounds();

    if (this.currentView) {
      this.currentView.setBounds({
        height: contentHeight - controlBounds.height,
        width: contentWidth,
        x: 0,
        y: controlBounds.y + controlBounds.height,
      });
    } // end if
  } // end function setControlBounds

  /**
   * Set the current tab view.
   * @param {number} viewId the tab view ID.
   * @ignore
   */
  setCurrentView(viewId) {
    if (!viewId) {
      return;
    } // end if
    if (this.currentView) this.win.removeBrowserView(this.currentView);
    this.win.addBrowserView(this.views[viewId]);
    this.currentViewId = viewId;
    this.win.webContents.send('fromMain', { currentTabId: viewId });
    this.currentWebContents.focus();
  } // end function setCurrentView

  /**
   * Set the tab configurations.
   * @param {number} viewId the tab view ID.
   * @param {object} kv the configurations.
   * @returns the tab configurations
   * @ignore
   */
  setTabConfig(viewId, kv) {
    const tab = this.tabConfigs[viewId];
    const { webContents } = this.views[viewId] || {};
    this.tabConfigs = {
      ...this.tabConfigs,
      [viewId]: {
        ...tab,
        canGoBack: webContents && webContents.canGoBack(),
        canGoForward: webContents && webContents.canGoForward(),
        ...kv, // Put it here to overwrite existing values in the above properties.
      },
    };
    return this.tabConfigs;
  } // end function setTabConfig

  /**
   * Switch to the specified tab.
   * @param {TabID} viewId the tab view ID.
   */
  switchTab(viewId) {
    this.setCurrentView(viewId);
  } // end function switchTab
} // end class TabbedWindow


/**
 * tabs插件
 * @class
 */
class TabsAddon {

  constructor() {
    let configPath = ''
    if (app.isPackaged) {
      configPath = path.join(app.getAppPath(), "resources", "extraResources", "config.json")
    } else {
      configPath = path.join(app.getAppPath(), "build", "extraResources", "config.json")
    }
    this.jdb = Storage.connection(configPath);
    this.cfg = this.jdb.getItem('addons.tabs');
  }

  updateConfig() {
    Conf.setValue('addons.tabs', this.cfg)
    this.jdb.setItem('addons.tabs', this.cfg)
  }

  /**
   * 创建
   */
  create () {
    Log.info('[addon:tabs] load');
    this.cfg = this.cfg || Conf.getValue('addons.tabs');

    this.cfg.tabItemCount = 0;

    const { height, width } = screen.getPrimaryDisplay().workAreaSize;
    let baseUrl;

    // if (process.env.WEBPACK_DEV_SERVER_URL == null) {
    //   createProtocol(this.cfg.APP_SCHEME);
    //   baseUrl = `${this.cfg.APP_SCHEME}://./index.html/`; // Load "index.html" if the dev server URL does not exist.
    // } else {
    //   baseUrl = process.env.WEBPACK_DEV_SERVER_URL; // Load the dev server URL if it exists.
    // }

    const winHeight = Math.round(height * 0.7);
    const winOptions = {
      backgroundColor: nativeTheme.shouldUseDarkColors
        ? this.cfg.DARK_WIN_COLOUR
        : this.cfg.LIGHT_WIN_COLOUR,
      center: true,
      minHeight: this.cfg.MIN_WIN_HEIGHT,
      minWidth: this.cfg.MIN_WIN_WIDTH,
      // titleBarStyle: platform === this.cfg.MACOS ? "hiddenInset" : "hidden",
    };

    // TODO: titleBarOverlay temp workaround.
    if (process.platform === this.cfg.MACOS) {
      winOptions.titleBarOverlay = {
        color: this.cfg.TITLE_BAR_OVERLAY_COLOUR,
        height: this.cfg.TAB_BAR_HEIGHT,
        symbolColor: this.cfg.LIGHT_WIN_COLOUR,
      };
    } // end if


    const winWidth = Math.round(width * 0.7);
    const tabbedWin = new TabbedWindow(this.cfg, {
      blankPage: this.cfg.blankPage,
      blankTitle: "新标签页",
      controlHeight: this.cfg.TAB_BAR_HEIGHT,
      debug: process.env.NODE_ENV === this.cfg.DEV,
      height:
        winHeight >= this.cfg.MIN_WIN_HEIGHT
          ? winHeight
          : this.cfg.MIN_WIN_HEIGHT,
      startPage: this.cfg.startPage,
      viewReferences: { scrollBounce: true },
      width:
        winWidth >= this.cfg.MIN_WIN_WIDTH
          ? winWidth
          : this.cfg.MIN_WIN_WIDTH,
      winOptions,
    });

    // 监听tab控制事件
    this.initialiseCustomisedWinListener(tabbedWin)
    // 监听主窗口的事件
    this.initialiseIpcMainListener(tabbedWin);

    this.updateConfig();
    // const mainWindow = CoreWindow.getMainWindow();
    // new TabbedWindow()
    // ipcMain.on('new-tab', (event, webContentsId) => {
    //   const tabWebContents = webContents.fromId(webContentsId)
    //   tabWebContents.setWindowOpenHandler((details) => {
    //     console.log(details)
    //     console.log(`Handle ${details.url} as ${details.disposition} for ${tabWebContents.id}`)
    //     if (details.url.indexOf('download.do') !== -1) {
    //       return {
    //         action: 'allow'
    //       }
    //     }
    //     switch(details.disposition) {
    //       case "foreground-tab":
    //         mainWindow.webContents.send('open-tab', {url: details.url, active: true})
    //         break
    //       case "background-tab":
    //         mainWindow.webContents.send('open-tab', {url: details.url, active: false})
    //         break
    //       case "new-window":
    //         mainWindow.webContents.send('open-tab', {url: details.url, active: true})
    //         break
    //       // return {
    //       //     action: 'allow'
    //       // }
    //
    //     }
    //     return { action: 'deny' }
    //   })
    // })

  }

  initialiseCustomisedWinListener(tabbedWin) {
    tabbedWin.on("closed", () => {
      tabbedWin = null;
    })
    tabbedWin.on('close-tab', () => {
      this.cfg.tabItemCount--
      this.updateConfig()
    })
    tabbedWin.on('control-ready', async () => {
      // auto update
      // console.log('check update start')
    })
    tabbedWin.on('new-tab', () => {
      this.cfg.tabItemCount++
      this.updateConfig()
    })
    tabbedWin.win.on("close", (e) => {

    })
    tabbedWin.win.on("enter-full-screen", () => {

    })
    tabbedWin.win.on("leave-full-screen", () => {
      // setAppMenu(tabbedWin);
      // tabbedWin.win.webContents.send(
      //   global.common.IPC_RECEIVE,
      //   global.common.EXIT_FULL_SCREEN
      // );
    })
  }

// 监听主窗口的事件，最大化，最小化、关闭等
  initialiseIpcMainListener(tabbedWin) {
    let topMenu
    ipcMain.removeAllListeners(['toMain', 'showMenu'])
    ipcMain.on('toMain', async (event, data) => {
      const viewContents = webContents.fromId(event.sender.id)

      if (typeof data === "object") {
        await this.reactToIpcObjectData(data, tabbedWin, viewContents)
      } else {
        await this.reactToIpcIdData(data, tabbedWin, viewContents)
      }
    })
    ipcMain.on('topMenu', async (event, data) => {
      // console.log(event, data)
      switch (data.action) {
        case 'show': {
          const { height, width } = screen.getPrimaryDisplay().workAreaSize;
          topMenu = new BrowserWindow({
            parent: tabbedWin.win,
            width: width, height: height,
            transparent: true,
            frame: false,
            // 其他窗口选项...
            webPreferences: {
              webSecurity: false,
              contextIsolation: false,
              nodeIntegration: true,
            },
          });

          const html = path.join(__dirname, 'menu.html')
          topMenu.webContents.on('did-finish-load', () => {
            topMenu.webContents.send('topMenuShow', {x: data.x, y: data.y})
          });
          topMenu.webContents.on("dom-ready", () => {
            topMenu.webContents.focus();
          });
          topMenu.loadFile(html)
          break
        }
        case 'menu1':
          console.log('修改主页')
          this.cfg.startPage = 'http://hubon.cn/kingbes-std/'
          this.updateConfig()
          if (topMenu && !topMenu.webContents.isDestroyed()) {
            topMenu.webContents.destroy();
          }
          dialog.showMessageBoxSync(tabbedWin.win, {
            buttons: ["确认"],
            detail: "重启后生效",
            message: "修改主页成功",
            noLink: true,
            title: app.name,
            type: "info",
          })
          break
      }
      // this.cfg.startPage = 'http://hubon.cn/kingbes-std/'
      // Conf.setValue('addons.tabs', this.cfg)
      // const { height, width } = screen.getPrimaryDisplay().workAreaSize;
      // const overlayWindow = new BrowserWindow({
      //   parent: tabbedWin.win,
      //   width: width, height: height,
      //   transparent: true,
      //   frame: false,
      //   // 其他窗口选项...
      // });
      //
      // const html = path.join(__dirname, 'menu.html')
      // overlayWindow.loadFile(html)
      // break
    })
  }

  async reactToIpcIdData(data, tabbedWin, viewContents) {
    switch (data) {
      // 刷新
      case 'refreshWin': {
        tabbedWin.currentView.webContents.reload()
        break
      }
      // 最小化窗口
      case 'minimiseWin': {
        // TODO: titleBarOverlay temp workaround.
        tabbedWin.win.minimize();
        break
      }
      // 最大化或恢复窗口大小
      case 'maximiseOrRestoreWin': {
        this.maximiseOrRestoreWin(tabbedWin, viewContents)
        break
      }
      // 关闭窗口
      case 'closeWin': {
        const buttonIndex = dialog.showMessageBoxSync(tabbedWin.win, {
          buttons: ["确认", "取消"],
          cancelId: 1,
          detail: "关闭窗口将会关闭所有标签页，并退出程序。",
          message: "关闭窗口将会关闭所有标签页，并退出程序。",
          noLink: true,
          title: app.name,
          type: "info",
        })

        if (buttonIndex === 1) {
          return
        } // end if
        tabbedWin.win.close()
        // EE.CoreApp.appQuit();
        break
      }
      // 设置夜间模式
      case 'correctWinColour': {
        Array.prototype.forEach.call(BrowserWindow.getAllWindows(), (element) =>
          element.setBackgroundColor(
            nativeTheme.shouldUseDarkColors
              ? this.cfg.DARK_WIN_COLOUR
              : this.cfg.LIGHT_WIN_COLOUR
          )
        )
        break
      }
      // 获取平台信息
      case 'getPlatform': {
        const os = {}
        os.getPlatform = process.platform
        viewContents.send('fromMain', os)
        break
      }
      // 首次打开页面，返回第一个tab id
      case 'getStartTabId': {
        const startTabId = {}
        startTabId.currentTabId = tabbedWin.tabs[0]
        viewContents.send('fromMain', startTabId)
        break
      }
      default: {
        Log.warn(
          "Unknown IPC channel event in the data message:",
          JSON.stringify(data)
        )
      }
    }
  }

// 响应ipc的object类型数据的事件
  async reactToIpcObjectData(data, tabbedWin, viewContents) {
    switch (data['tag']) {
      case 'getNewTabItemId': {
        const newTabId = {}
        newTabId.getNewTabItemId = tabbedWin.tabs[tabbedWin.tabs.length - 1]
        newTabId.newTabItemIndex = data.newTabItemIndex
        viewContents.send('fromMain')
        break
      }
      default: {
        Log.warn(
          "Unknown IPC channel event in the data message:",
          JSON.stringify(data)
        )
      }
    }
  }

// 最大化或恢复窗口大小
  maximiseOrRestoreWin(tabbedWin, viewContents) {
    // TODO: titleBarOverlay temp workaround.
    if (process.platform === 'win32') {
      if (tabbedWin.win.isMaximized()) {
        tabbedWin.win.unmaximize()
        viewContents.send('fromMain', 'restoreWin')
      } else {
        tabbedWin.win.maximize()
        viewContents.send('fromMain', 'maximiseWin')
      }

      return
    }

    tabbedWin.win.isMaximized()
      ? tabbedWin.win.unmaximize()
      : tabbedWin.win.maximize();
    // NOTE: react to this ID data on macOS only.
    // Reference: https://github.com/electron/electron/issues/16385#issuecomment-653952292
    // switch (
    //   systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string")
    // ) {
    //   case "Minimize": {
    //     tabbedWin.win.minimize();
    //     break;
    //   }
    //   case "None": {
    //     break;
    //   }
    //   default: {
    //     tabbedWin.win.isMaximized()
    //       ? tabbedWin.win.unmaximize()
    //       : tabbedWin.win.maximize();
    //   }
    // }
  }

  sendAct = (actName) => ipcRenderer.send("act", actName);

  /**
   * Tell the tab view URL in the address bar changed.
   * @param {string} url the tab view URL in the address bar.
   */
  sendChangeURL = (url) => ipcRenderer.send("url-change", url);

  /**
   * Tell the tab view to close the tab.
   * @param {TabID} id the tab view ID.
   */
  sendCloseTab = (id) => ipcRenderer.send("close-tab", id);

  /**
   * Tell the tab view to load the URL.
   * @param {string} url the URL to load.
   */
  sendEnterURL = (url) => ipcRenderer.send("url-enter", url);

  /**
   * Tell the tab view to go back.
   */
  sendGoBack = () => this.sendAct("goBack");

  /**
   * Tell the tab view to go forward.
   */
  sendGoForward = () => this.sendAct("goForward");

  /**
   * Create a new tab.
   * @param {string} [url] the URL to load.
   * @param {object} [references] the custom web preferences to the new tab.
   */
  sendNewTab = (url, references) =>
    ipcRenderer.send("new-tab", url, references);

  /**
   * Tell the tab view to reload.
   */
  sendReload = () => this.sendAct("reload");

  /**
   * Tell the tab view to stop loading.
   */
  sendStop = () => this.sendAct("stop");

  /**
   * Tell the tab view to switch to the specified tab.
   * @param {TabID} id the tab view ID.
   */
  sendSwitchTab = (id) => ipcRenderer.send("switch-tab", id);

}

TabsAddon.toString = () => '[class TabsAddon]';
module.exports = TabsAddon;
