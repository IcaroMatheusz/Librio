import { contextBridge, ipcRenderer } from "electron";

import type { DesktopBridge, LocalBook } from "../shared/desktop.js";

const desktopBridge: DesktopBridge = {
  listLocalBooks: () =>
    ipcRenderer.invoke("local-books:list") as Promise<LocalBook[]>,
  addLocalBooks: () =>
    ipcRenderer.invoke("local-books:add") as Promise<LocalBook[]>,
  removeLocalBook: (bookId) =>
    ipcRenderer.invoke("local-books:remove", bookId) as Promise<void>,
  getLocalBookUrl: (bookId) =>
    `librio-local://book/${encodeURIComponent(bookId)}`,
};

contextBridge.exposeInMainWorld("librioDesktop", desktopBridge);
