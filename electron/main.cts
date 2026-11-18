import { createReadStream } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";
import type {
  DesktopUpdateStatus,
  LocalBookFileType,
} from "../shared/desktop.js";

import {
  addLocalBooks,
  addLocalBooksFromDirectory,
  getLocalBookCoverPathForBook,
  getLocalBookPath,
  listLocalBooks,
  removeLocalBook,
  saveLocalBookCover,
} from "./localLibraryStore.cjs";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "librio-local",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const FILE_MIME_TYPES: Record<LocalBookFileType, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  cbr: "application/vnd.comicbook-rar",
  cbz: "application/vnd.comicbook+zip",
};

let mainWindow: BrowserWindow | null = null;
let currentUpdateStatus: DesktopUpdateStatus = {
  status: "idle",
  currentVersion: app.getVersion(),
};

function publishUpdateStatus(
  status: DesktopUpdateStatus["status"],
  details: Omit<DesktopUpdateStatus, "status" | "currentVersion"> = {},
): DesktopUpdateStatus {
  currentUpdateStatus = {
    status,
    currentVersion: app.getVersion(),
    ...details,
  };
  mainWindow?.webContents.send("desktop-updates:status", currentUpdateStatus);
  return currentUpdateStatus;
}

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function openExternalUrl(rawUrl: string): void {
  if (!isSafeExternalUrl(rawUrl)) return;
  void shell.openExternal(rawUrl).catch((error: unknown) => {
    console.error("Não foi possível abrir o link externo:", error);
  });
}

function registerLocalBookHandlers(): void {
  ipcMain.handle("local-books:list", () =>
    listLocalBooks(app.getPath("userData")),
  );

  ipcMain.handle("local-books:add", async () => {
    if (!mainWindow) throw new Error("A janela do Librio não está disponível.");
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Adicionar obras locais",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Obras compatíveis",
          extensions: ["pdf", "epub", "cbr", "cbz"],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    return addLocalBooks(app.getPath("userData"), result.filePaths);
  });

  ipcMain.handle("local-books:add-directory", async () => {
    if (!mainWindow) throw new Error("A janela do Librio nao esta disponivel.");
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Selecionar pasta com obras",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    return addLocalBooksFromDirectory(
      app.getPath("userData"),
      result.filePaths[0],
    );
  });

  ipcMain.handle("local-books:remove", (_event, bookId: unknown) => {
    if (typeof bookId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookId)) {
      throw new Error("O identificador da obra local é inválido.");
    }
    return removeLocalBook(app.getPath("userData"), bookId);
  });

  ipcMain.handle(
    "local-books:save-cover",
    (_event, bookId: unknown, cover: unknown) => {
      if (typeof bookId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookId)) {
        throw new Error("O identificador da obra local é inválido.");
      }
      if (!(cover instanceof Uint8Array)) {
        throw new Error("O arquivo da capa local é inválido.");
      }
      return saveLocalBookCover(app.getPath("userData"), bookId, cover);
    },
  );
}

function registerLocalBookProtocol(): void {
  protocol.handle("librio-local", async (request) => {
    const url = new URL(request.url);
    const bookId = url.pathname.slice(1);
    if (
      (url.hostname !== "book" && url.hostname !== "cover") ||
      !/^[0-9a-f-]{36}$/i.test(bookId) ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      return new Response("Not found", { status: 404 });
    }

    try {
      if (url.hostname === "cover") {
        const coverPath = await getLocalBookCoverPathForBook(
          app.getPath("userData"),
          bookId,
        );
        if (request.method === "HEAD") {
          return new Response(null, {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "image/jpeg",
            },
          });
        }
        const coverStream = createReadStream(coverPath);
        const iterator = coverStream[Symbol.asyncIterator]();
        return new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              try {
                const result = await iterator.next();
                if (result.done) {
                  controller.close();
                } else {
                  controller.enqueue(new Uint8Array(result.value));
                }
              } catch (error) {
                controller.error(error);
              }
            },
            async cancel() {
              await iterator.return?.();
            },
          }),
          {
            status: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
              "Content-Type": "image/jpeg",
              "Cross-Origin-Resource-Policy": "cross-origin",
            },
          },
        );
      }

      if (url.hostname !== "book") {
        return new Response("Not found", { status: 404 });
      }
      const filePath = await getLocalBookPath(app.getPath("userData"), bookId);
      const extension = extname(filePath).slice(1).toLowerCase() as LocalBookFileType;
      const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Content-Type": FILE_MIME_TYPES[extension],
      });

      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }

      const fileStream = createReadStream(filePath);
      const iterator = fileStream[Symbol.asyncIterator]();
      const responseStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const result = await iterator.next();
            if (result.done) {
              controller.close();
            } else {
              controller.enqueue(new Uint8Array(result.value));
            }
          } catch (error) {
            controller.error(error);
          }
        },
        async cancel() {
          await iterator.return?.();
        },
      });
      return new Response(responseStream, { status: 200, headers });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível abrir o arquivo local.";
      return new Response(message, { status: 404 });
    }
  });
}

function isAppUrl(rawUrl: string): boolean {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    try {
      return new URL(rawUrl).origin === new URL(devServerUrl).origin;
    } catch {
      return false;
    }
  }
  try {
    const requestedUrl = new URL(rawUrl);
    const appUrl = new URL(
      pathToFileURL(join(__dirname, "../../dist/index.html")).href,
    );
    return (
      requestedUrl.protocol === "file:" &&
      requestedUrl.host === appUrl.host &&
      requestedUrl.pathname === appUrl.pathname
    );
  } catch {
    return false;
  }
}

async function createMainWindow(): Promise<void> {
  const iconPath = join(__dirname, "../../public/librio-icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#171A27",
    icon: iconPath,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#171A27",
      symbolColor: "#C4B5FD",
      height: 38,
    },
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternalUrl(url);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }
}

function registerDesktopUpdateHandlers(): void {
  ipcMain.handle("desktop-updates:get-status", () => currentUpdateStatus);
  ipcMain.handle("desktop-updates:check", async () => {
    if (!app.isPackaged) {
      return publishUpdateStatus("unsupported", {
        message: "A verificacao de atualizacoes funciona na versao instalada do Librio.",
      });
    }
    try {
      await autoUpdater.checkForUpdates();
      return currentUpdateStatus;
    } catch (error) {
      return publishUpdateStatus("error", {
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel verificar atualizacoes.",
      });
    }
  });
  ipcMain.handle("desktop-updates:install", () => {
    if (currentUpdateStatus.status !== "downloaded") {
      throw new Error("Ainda nao ha uma atualizacao pronta para instalar.");
    }
    autoUpdater.quitAndInstall();
  });
}

function configureAutoUpdates(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => {
    publishUpdateStatus("checking");
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateStatus("available", { nextVersion: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateStatus("up-to-date");
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateStatus("downloading", {
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
    });
  });
  autoUpdater.on("error", (error) => {
    publishUpdateStatus("error", {
      message: error.message || "Nao foi possivel verificar as atualizacoes.",
    });
    console.error("Não foi possível verificar/baixar atualizações do Librio:", error);
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateStatus("downloaded", {
      nextVersion: info.version,
      percent: 100,
    });
  });
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error("Não foi possível verificar atualizações do Librio:", error);
  });
}

void app.whenReady().then(async () => {
  registerLocalBookHandlers();
  registerDesktopUpdateHandlers();
  registerLocalBookProtocol();
  await createMainWindow();
  configureAutoUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}).catch((error: unknown) => {
  console.error("Não foi possível iniciar o Librio Desktop:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
