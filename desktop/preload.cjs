const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("keyVisionDesktop", {
  platform: process.platform,
});
