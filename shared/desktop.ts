export type LocalBookFileType = "pdf" | "epub" | "cbr" | "cbz";

export interface LocalBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  file_type: LocalBookFileType;
  file_size: number;
  added_at: string;
  available: boolean;
}

export type DesktopUpdateStatusName =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error"
  | "unsupported";

export interface DesktopUpdateStatus {
  status: DesktopUpdateStatusName;
  currentVersion: string;
  nextVersion?: string;
  percent?: number;
  message?: string;
}

export interface DesktopBridge {
  listLocalBooks(): Promise<LocalBook[]>;
  addLocalBooks(): Promise<LocalBook[]>;
  addLocalBooksFromDirectory(): Promise<LocalBook[]>;
  removeLocalBook(bookId: string): Promise<void>;
  saveLocalBookCover(bookId: string, cover: Uint8Array): Promise<LocalBook>;
  getLocalBookUrl(bookId: string): string;
  getUpdateStatus(): Promise<DesktopUpdateStatus>;
  checkForUpdates(): Promise<DesktopUpdateStatus>;
  installUpdate(): Promise<void>;
  onUpdateStatus(
    callback: (status: DesktopUpdateStatus) => void,
  ): () => void;
}
