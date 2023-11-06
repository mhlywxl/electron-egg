'use strict';

const path = require('path');

/**
 * 默认配置
 */
module.exports = (appInfo) => {

  const config = {};

  /**
   * 开发者工具
   */
  config.openDevTools = false;

  /**
   * 应用程序顶部菜单
   */
  config.openAppMenu = true;

  /**
   * 主窗口
   */
  config.windowsOption = {
    title: 'EE框架',
    width: 980,
    height: 650,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      webSecurity: false,
      contextIsolation: false, // false -> 可在渲染进程中使用electron的api，true->需要bridge.js(contextBridge)
      nodeIntegration: true,
      //preload: path.join(appInfo.baseDir, 'preload', 'bridge.js'),
    },
    frame: false,
    show: false,
    icon: path.join(appInfo.home, 'public', 'images', 'logo-32.png'),
  };

  /**
   * ee框架日志
   */
  config.logger = {
    encoding: 'utf8',
    level: 'INFO',
    outputJSON: false,
    buffer: true,
    enablePerformanceTimer: false,
    rotator: 'day',
    appLogName: 'ee.log',
    coreLogName: 'ee-core.log',
    errorLogName: 'ee-error.log'
  }

  /**
   * 远程模式-web地址
   */
  config.remoteUrl = {
    enable: false,
    url: 'http://electron-egg.kaka996.com/'
  };

  /**
   * 内置socket服务
   */
  config.socketServer = {
    enable: false,
    port: 7070,
    path: "/socket.io/",
    connectTimeout: 45000,
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8,
    transports: ["polling", "websocket"],
    cors: {
      origin: true,
    }
  };

  /**
   * 内置http服务
   */
  config.httpServer = {
    enable: false,
    https: {
      enable: false,
      key: '/public/ssl/localhost+1.key',
      cert: '/public/ssl/localhost+1.pem'
    },
    host: '127.0.0.1',
    port: 7071,
    cors: {
      origin: "*"
    },
    body: {
      multipart: true,
      formidable: {
        keepExtensions: true
      }
    },
    filterRequest: {
      uris:  [
        'favicon.ico'
      ],
      returnData: ''
    }
  };

  /**
   * 主进程
   */
  config.mainServer = {
    protocol: 'file://',
    indexPath: '/public/dist/index.html',
    host: '127.0.0.1',
    port: 7072,
  };

  /**
   * 硬件加速
   */
  config.hardGpu = {
    enable: false
  };

  /**
   * 异常捕获
   */
  config.exception = {
    mainExit: false,
    childExit: true,
    rendererExit: true,
  };

  /**
   * jobs
   */
  config.jobs = {
    messageLog: true
  };

  /**
   * 插件功能
   */
  config.addons = {
    tabs: {
      enable: true,
      tabItemCount: 0,
      DEV: 'development',
      // startPage: "http://hubon.cn/kingbes-std/",
      startPage: "http://www.baidu.com",
      blankPage: '',
      APP_HOME_URL: process.env.WEBPACK_DEV_SERVER_URL + "/index.html",
      TAB_BAR_VIEW: "tabBar",
      DARK_WIN_COLOUR: "#000",
      LIGHT_WIN_COLOUR: "#FFF",
      MIN_WIN_HEIGHT: 600,
      MIN_WIN_WIDTH: 800,
      MACOS: "darwin",
      TITLE_BAR_OVERLAY_COLOUR: "#0f172a",
      TAB_BAR_HEIGHT: 40,  // tab栏的高度
      MIN_LOG_LEVEL: "info",
      APP_SCHEME: 'app',
      WAIT_FOR_BEFORE_UNLOAD: true,  // 关闭标签页面之前是否触发页面的beforeunload事件,目前只支持false,设置为true会造成有beforeunload事件的标签页面在关闭时不能正常销毁页面而导致内存不能释放
    },
    window: {
      enable: true,
    },
    tray: {
      enable: true,
      title: 'EE程序',
      icon: '/public/images/tray.png'
    },
    security: {
      enable: true,
    },
    awaken: {
      enable: true,
      protocol: 'ee',
      args: []
    },
    autoUpdater: {
      enable: true,
      windows: false,
      macOS: false,
      linux: false,
      options: {
        provider: 'generic',
        url: 'http://kodo.qiniu.com/'
      },
      force: false,
    },
    javaServer: {
      enable: false,
      port: 18080,
      jreVersion: 'jre1.8.0_201',
      opt: '-server -Xms512M -Xmx512M -Xss512k -Dspring.profiles.active=prod -Dserver.port=${port} -Dlogging.file.path="${path}" ',
      name: 'java-app.jar'
    }
  };

  return {
    ...config
  };
}
