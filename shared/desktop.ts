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

export interface DesktopBridge {
  listLocalBooks(): Promise<LocalBook[]>;
  addLocalBooks(): Promise<LocalBook[]>;
  removeLocalBook(bookId: string): Promise<void>;
  saveLocalBookCover(bookId: string, cover: Uint8Array): Promise<LocalBook>;
  getLocalBookUrl(bookId: string): string;
}
