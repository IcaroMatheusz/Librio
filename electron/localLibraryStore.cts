import { randomUUID } from "node:crypto";
import { access, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import type { LocalBook, LocalBookFileType } from "../shared/desktop.js";

interface StoredLocalBook {
  id: string;
  title: string;
  author: string;
  file_type: LocalBookFileType;
  file_size: number;
  added_at: string;
  file_path: string;
}

const BOOKS_FILE_NAME = "local-books.json";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isSupportedFileType(value: string): value is LocalBookFileType {
  return value === "pdf" || value === "epub" || value === "cbr" || value === "cbz";
}

function isStoredLocalBook(value: unknown): value is StoredLocalBook {
  if (typeof value !== "object" || value === null) return false;
  const book = value as Record<string, unknown>;

  return (
    typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.author === "string" &&
    typeof book.file_type === "string" &&
    isSupportedFileType(book.file_type) &&
    typeof book.file_size === "number" &&
    Number.isFinite(book.file_size) &&
    typeof book.added_at === "string" &&
    typeof book.file_path === "string"
  );
}

async function readBooks(userDataPath: string): Promise<StoredLocalBook[]> {
  const booksPath = join(userDataPath, BOOKS_FILE_NAME);
  let contents: string;

  try {
    contents = await readFile(booksPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw new Error(
      `Não foi possível ler a biblioteca local: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("O catálogo local está corrompido e não pôde ser carregado.");
  }

  if (!Array.isArray(parsed) || !parsed.every(isStoredLocalBook)) {
    throw new Error("O catálogo local contém dados inválidos.");
  }

  return parsed;
}

async function writeBooks(
  userDataPath: string,
  books: StoredLocalBook[],
): Promise<void> {
  const booksPath = join(userDataPath, BOOKS_FILE_NAME);
  const temporaryPath = `${booksPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, JSON.stringify(books, null, 2), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, booksPath);
  } catch (error) {
    throw new Error(
      `Não foi possível salvar a biblioteca local: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
  }
}

async function isAvailable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw new Error(
      `Não foi possível verificar um arquivo local: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
  }
}

function toLocalBook(book: StoredLocalBook, available: boolean): LocalBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover_url: null,
    file_type: book.file_type,
    file_size: book.file_size,
    added_at: book.added_at,
    available,
  };
}

export async function listLocalBooks(
  userDataPath: string,
): Promise<LocalBook[]> {
  const books = await readBooks(userDataPath);
  return Promise.all(
    books.map(async (book) =>
      toLocalBook(book, await isAvailable(book.file_path)),
    ),
  );
}

export async function addLocalBooks(
  userDataPath: string,
  selectedPaths: string[],
): Promise<LocalBook[]> {
  const books = await readBooks(userDataPath);
  const knownPaths = new Set(
    books.map((book) => resolve(book.file_path).toLocaleLowerCase()),
  );
  const addedBooks: StoredLocalBook[] = [];

  for (const selectedPath of selectedPaths) {
    const filePath = resolve(selectedPath);
    const fileType = extname(filePath).slice(1).toLowerCase();
    if (!isSupportedFileType(fileType)) {
      throw new Error(`Formato de arquivo não suportado: ${basename(filePath)}.`);
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error(`${basename(filePath)} não é um arquivo válido.`);
    }

    const normalizedPath = filePath.toLocaleLowerCase();
    if (knownPaths.has(normalizedPath)) continue;
    knownPaths.add(normalizedPath);

    const extension = extname(filePath);
    const title = basename(filePath, extension).trim();
    if (!title) {
      throw new Error(`Não foi possível obter o título de ${basename(filePath)}.`);
    }

    addedBooks.push({
      id: randomUUID(),
      title,
      author: "Autor desconhecido",
      file_type: fileType,
      file_size: fileStat.size,
      added_at: new Date().toISOString(),
      file_path: filePath,
    });
  }

  if (addedBooks.length > 0) {
    await writeBooks(userDataPath, [...books, ...addedBooks]);
  }

  return addedBooks.map((book) => toLocalBook(book, true));
}

export async function removeLocalBook(
  userDataPath: string,
  bookId: string,
): Promise<void> {
  const books = await readBooks(userDataPath);
  const remainingBooks = books.filter((book) => book.id !== bookId);
  if (remainingBooks.length === books.length) {
    throw new Error("Esta obra não existe na biblioteca local.");
  }
  await writeBooks(userDataPath, remainingBooks);
}

export async function getLocalBookPath(
  userDataPath: string,
  bookId: string,
): Promise<string> {
  const books = await readBooks(userDataPath);
  const book = books.find((item) => item.id === bookId);
  if (!book) throw new Error("Esta obra não existe na biblioteca local.");

  try {
    const fileStat = await stat(book.file_path);
    if (!fileStat.isFile()) throw new Error("O caminho salvo não é um arquivo.");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(
        `O arquivo “${book.title}” não foi encontrado no local onde foi adicionado.`,
      );
    }
    if (error instanceof Error && error.message.startsWith("O caminho salvo")) {
      throw error;
    }
    throw new Error(
      `Não foi possível abrir “${book.title}”: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
  }

  return book.file_path;
}
