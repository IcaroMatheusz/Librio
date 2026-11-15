import type { LocalBook } from "../../shared/desktop";

function getDesktopBridge() {
  const bridge = window.librioDesktop;
  if (!bridge) {
    throw new Error("A biblioteca local está disponível somente no app desktop.");
  }
  return bridge;
}

export function isDesktopApp(): boolean {
  return Boolean(window.librioDesktop);
}

export async function getLocalBooks(): Promise<LocalBook[]> {
  return getDesktopBridge().listLocalBooks();
}

export async function addLocalBooks(): Promise<LocalBook[]> {
  return getDesktopBridge().addLocalBooks();
}

export async function removeLocalBook(bookId: string): Promise<void> {
  return getDesktopBridge().removeLocalBook(bookId);
}

export async function saveLocalBookCover(
  bookId: string,
  cover: Blob,
): Promise<LocalBook> {
  const bridge = getDesktopBridge();
  if (typeof bridge.saveLocalBookCover !== "function") {
    throw new Error(
      "A integração do app está desatualizada. Feche todas as janelas do Librio Desktop e abra o aplicativo novamente para atualizar o suporte a capas locais.",
    );
  }
  return bridge.saveLocalBookCover(bookId, new Uint8Array(await cover.arrayBuffer()));
}

export async function getLocalBookById(bookId: string): Promise<LocalBook> {
  const book = (await getLocalBooks()).find((item) => item.id === bookId);
  if (!book) throw new Error("Esta obra não existe na biblioteca local.");
  if (!book.available) {
    throw new Error(
      `O arquivo “${book.title}” não está mais no local onde foi adicionado.`,
    );
  }
  return book;
}

export async function getLocalBookFile(bookId: string): Promise<Blob> {
  const response = await fetch(getDesktopBridge().getLocalBookUrl(bookId));
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Não foi possível abrir o arquivo local (HTTP ${response.status}).`,
    );
  }
  return response.blob();
}
