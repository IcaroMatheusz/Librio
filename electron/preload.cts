import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopBridge,
  DesktopUpdateStatus,
  LocalBook,
} from "../shared/desktop.js";

const desktopBridge: DesktopBridge = {
  listLocalBooks: () =>
    ipcRenderer.invoke("local-books:list") as Promise<LocalBook[]>,
  addLocalBooks: () =>
    ipcRenderer.invoke("local-books:add") as Promise<LocalBook[]>,
  addLocalBooksFromDirectory: () =>
    ipcRenderer.invoke("local-books:add-directory") as Promise<LocalBook[]>,
  removeLocalBook: (bookId) =>
    ipcRenderer.invoke("local-books:remove", bookId) as Promise<void>,
  saveLocalBookCover: (bookId, cover) =>
    ipcRenderer.invoke("local-books:save-cover", bookId, cover) as Promise<LocalBook>,
  getLocalBookUrl: (bookId) =>
    `librio-local://book/${encodeURIComponent(bookId)}`,
  getUpdateStatus: () =>
    ipcRenderer.invoke("desktop-updates:get-status") as Promise<DesktopUpdateStatus>,
  checkForUpdates: () =>
    ipcRenderer.invoke("desktop-updates:check") as Promise<DesktopUpdateStatus>,
  installUpdate: () =>
    ipcRenderer.invoke("desktop-updates:install") as Promise<void>,
  onUpdateStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: DesktopUpdateStatus) =>
      callback(status);
    ipcRenderer.on("desktop-updates:status", listener);
    return () => ipcRenderer.removeListener("desktop-updates:status", listener);
  },
};

contextBridge.exposeInMainWorld("librioDesktop", desktopBridge);
