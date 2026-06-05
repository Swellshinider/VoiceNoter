import { app, BrowserWindow, net, protocol } from "electron";
import { join } from "node:path";
import { registerIpcHandlers } from "./ipc/register";
import { handleVoiceNoterMediaProtocol, registerVoiceNoterMediaScheme } from "./media-protocol";
import { AppServices } from "./services/app-services";

registerVoiceNoterMediaScheme(protocol);

const services = new AppServices();
registerIpcHandlers(services);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 720,
    title: "VoiceNoter",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  handleVoiceNoterMediaProtocol(protocol, net, (itemId) => services.getMediaPathForItem(itemId));
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
