import { getSupabaseClient } from "../lib/supabase";
import type { Book, BookFileType } from "../types/database";
import { getUserStorage } from "./storageService";

export const BOOKS_BUCKET = "books";
// TODO: Criar o bucket privado "books" no Supabase e permitir acesso somente à pasta auth.uid().
const BOOK_FIELDS =
  "id, user_id, title, author, description, cover_url, file_path, file_type, file_size, created_at, updated_at";

function uploadFileWithProgress(
  signedUrl: string,
  file: Blob,
  fileName: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file, fileName);

    request.open("PUT", signedUrl);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      let message = `O servidor recusou o arquivo (HTTP ${request.status}).`;
      try {
        const response: unknown = JSON.parse(request.responseText);
        if (
          typeof response === "object" &&
          response !== null &&
          "message" in response &&
          typeof response.message === "string"
        ) {
          message = response.message;
        }
      } catch {
        if (request.responseText) message = request.responseText;
      }
      reject(new Error(message));
    });
    request.addEventListener("error", () => {
      reject(new Error("Falha de conexão durante o envio do arquivo."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("O envio do arquivo foi interrompido."));
    });
    request.send(body);
  });
}

async function uploadStorageFile(
  client: Awaited<ReturnType<typeof getSupabaseClient>>,
  filePath: string,
  file: Blob,
  fileName: string,
  onProgress: (progress: number) => void = () => {},
): Promise<void> {
  const { data, error } = await client.storage
    .from(BOOKS_BUCKET)
    .createSignedUploadUrl(filePath);

  if (error) {
    throw new Error(`Não foi possível preparar o arquivo: ${error.message}`);
  }

  await uploadFileWithProgress(data.signedUrl, file, fileName, onProgress);
}

async function removeUploadedFiles(
  client: Awaited<ReturnType<typeof getSupabaseClient>>,
  filePaths: string[],
): Promise<string | null> {
  if (filePaths.length === 0) return null;
  const { error } = await client.storage.from(BOOKS_BUCKET).remove(filePaths);
  return error?.message ?? null;
}

export async function signBookCovers(books: Book[]): Promise<Book[]> {
  const paths = books
    .map((book) => book.cover_url)
    .filter(
      (coverUrl): coverUrl is string =>
        coverUrl !== null && !/^https?:\/\//i.test(coverUrl),
    );

  if (paths.length === 0) return books;

  const client = await getSupabaseClient();
  const { data, error } = await client.storage
    .from(BOOKS_BUCKET)
    .createSignedUrls([...new Set(paths)], 60 * 60);

  if (error) {
    throw new Error(`Não foi possível carregar as capas das obras: ${error.message}`);
  }

  const urlsByPath = new Map<string, string>();
  for (const { error: coverError, path, signedUrl } of data) {
    if (coverError || !path || !signedUrl) {
      throw new Error(
        `Não foi possível gerar o link de uma capa: ${
          coverError ?? "resposta incompleta do Storage."
        }`,
      );
    }
    urlsByPath.set(path, signedUrl);
  }

  return books.map((book) => {
    if (!book.cover_url || /^https?:\/\//i.test(book.cover_url)) return book;
    return {
      ...book,
      cover_url: urlsByPath.get(book.cover_url) ?? null,
    };
  });
}

export async function getRecentBooks(): Promise<Book[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(`Não foi possível carregar as obras: ${error.message}`);
  return signBookCovers(data);
}

export async function getBookCount(): Promise<number> {
  const client = await getSupabaseClient();
  const { count, error } = await client
    .from("books")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`Não foi possível contar as obras: ${error.message}`);
  return count ?? 0;
}

export async function getBooks(): Promise<Book[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Não foi possível carregar a biblioteca: ${error.message}`);
  return signBookCovers(data);
}

export async function getBookById(bookId: string): Promise<Book> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .eq("id", bookId)
    .single();

  if (error) throw new Error(`Não foi possível encontrar esta obra: ${error.message}`);
  const [book] = await signBookCovers([data]);
  return book;
}

export async function renameBook(bookId: string, title: string): Promise<Book> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("O título da obra não pode ficar vazio.");
  }
  if (normalizedTitle.length > 200) {
    throw new Error("O título deve ter no máximo 200 caracteres.");
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .update({ title: normalizedTitle })
    .eq("id", bookId)
    .select(BOOK_FIELDS)
    .single();

  if (error) {
    throw new Error(`Não foi possível renomear a obra: ${error.message}`);
  }
  return data;
}

export async function deleteBook(book: Book): Promise<string | null> {
  const client = await getSupabaseClient();
  const storage = await getUserStorage();
  const filePaths = [book.file_path];
  let coverSize = 0;
  if (book.cover_url) {
    const userFolder = book.file_path.slice(
      0,
      book.file_path.lastIndexOf("/") + 1,
    );
    const coverPath = `${userFolder}${book.id}-cover.jpg`;
    const { data: cover, error: coverError } = await client.storage
      .from(BOOKS_BUCKET)
      .download(coverPath);

    if (coverError && coverError.statusCode !== "404") {
      throw new Error(
        `Não foi possível verificar a capa antes de excluir a obra: ${coverError.message}`,
      );
    }
    if (cover) {
      coverSize = cover.size;
      filePaths.push(coverPath);
    }
  }

  const { data: deleted, error: deleteError } = await client
    .from("books")
    .delete()
    .eq("id", book.id)
    .eq("user_id", book.user_id)
    .select("id")
    .single();

  if (deleteError) {
    throw new Error(`Não foi possível excluir a obra: ${deleteError.message}`);
  }
  if (!deleted) {
    throw new Error("A obra não foi encontrada ou não pode ser excluída.");
  }

  const cleanupError = await removeUploadedFiles(client, filePaths);
  if (cleanupError) {
    return `A obra foi removida da biblioteca, mas não foi possível limpar os arquivos do armazenamento: ${cleanupError}`;
  }

  const { error: storageError } = await client
    .from("user_storage")
    .update({
      used_bytes: Math.max(0, storage.used_bytes - book.file_size - coverSize),
    })
    .eq("user_id", book.user_id)
    .select("user_id")
    .single();

  if (storageError) {
    return `A obra foi excluída, mas não foi possível atualizar o espaço utilizado: ${storageError.message}`;
  }
  return null;
}

export async function getBookFile(filePath: string): Promise<Blob> {
  const client = await getSupabaseClient();
  const { data, error } = await client.storage
    .from(BOOKS_BUCKET)
    .download(filePath);

  if (error) throw new Error(`Não foi possível abrir o arquivo: ${error.message}`);
  return data;
}

export async function uploadBook(
  userId: string,
  file: File,
  title: string,
  author: string,
  onProgress: (progress: number) => void = () => {},
  coverPreview?: Blob,
): Promise<Book> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const fileTypes: Record<string, BookFileType> = {
    cbr: "cbr",
    cbz: "cbz",
    pdf: "pdf",
  };
  const fileType = fileTypes[extension ?? ""];
  if (!fileType) {
    throw new Error("Envie um arquivo .pdf, .cbr ou .cbz.");
  }
  if (file.size === 0) throw new Error("O arquivo está vazio.");

  const storage = await getUserStorage();
  const canStoreCover =
    Boolean(coverPreview) &&
    storage.used_bytes + file.size + (coverPreview?.size ?? 0) <=
      storage.max_bytes;
  const totalSize = file.size + (canStoreCover ? (coverPreview?.size ?? 0) : 0);
  if (storage.used_bytes + file.size > storage.max_bytes) {
    throw new Error("Este arquivo ultrapassa o espaço disponível na sua biblioteca.");
  }

  const client = await getSupabaseClient();
  const bookId = crypto.randomUUID();
  const filePath = `${userId}/${bookId}.${fileType}`;
  const coverPath =
    canStoreCover && coverPreview ? `${userId}/${bookId}-cover.jpg` : null;
  const uploadedPaths = [filePath];

  try {
    await uploadStorageFile(
      client,
      filePath,
      file,
      file.name,
      (progress) =>
        onProgress(Math.round((progress * file.size) / totalSize)),
    );
  } catch (uploadError) {
    const cleanupError = await removeUploadedFiles(client, uploadedPaths);
    throw new Error(
      `Não foi possível enviar a obra: ${
        uploadError instanceof Error
          ? uploadError.message
          : "Ocorreu um erro inesperado."
      }${
        cleanupError
          ? ` Também não foi possível limpar os arquivos enviados: ${cleanupError}`
          : ""
      }`,
      { cause: uploadError },
    );
  }

  let savedCoverPath: string | null = null;
  if (coverPath && coverPreview) {
    try {
      await uploadStorageFile(
        client,
        coverPath,
        coverPreview,
        `${bookId}-cover.jpg`,
        (progress) =>
          onProgress(
            Math.round(
              (file.size + (progress * coverPreview.size) / 100) /
                totalSize *
                100,
            ),
          ),
      );
      savedCoverPath = coverPath;
      uploadedPaths.push(coverPath);
    } catch (coverUploadError) {
      const cleanupError = await removeUploadedFiles(client, [coverPath]);
      if (cleanupError) {
        const fileCleanupError = await removeUploadedFiles(client, [filePath]);
        throw new Error(
          `Não foi possível salvar a capa (${coverUploadError instanceof Error ? coverUploadError.message : "erro inesperado"}) nem limpar o arquivo parcial (${cleanupError}).${
            fileCleanupError ? ` Também não foi possível limpar a obra: ${fileCleanupError}` : ""
          }`,
          { cause: coverUploadError },
        );
      }
      onProgress(100);
    }
  } else {
    onProgress(100);
  }

  const { data: book, error: insertError } = await client
    .from("books")
    .insert({
      id: bookId,
      user_id: userId,
      title: title.trim(),
      author: author.trim(),
      file_path: filePath,
      cover_url: savedCoverPath,
      file_type: fileType,
      file_size: file.size,
    })
    .select(BOOK_FIELDS)
    .single();

  if (insertError) {
    const cleanupError = await removeUploadedFiles(client, uploadedPaths);
    if (cleanupError) {
      throw new Error(
        `Não foi possível salvar a obra (${insertError.message}) nem remover os arquivos enviados (${cleanupError}).`,
      );
    }
    throw new Error(`Não foi possível salvar a obra: ${insertError.message}`);
  }

  const { error: storageError } = await client
    .from("user_storage")
    .update({
      used_bytes:
        storage.used_bytes +
        file.size +
        (savedCoverPath && coverPreview ? coverPreview.size : 0),
    })
    .eq("user_id", userId)
    .select("user_id")
    .single();

  if (storageError) {
    const [deleteBookResult, cleanupError] = await Promise.all([
      client.from("books").delete().eq("id", book.id),
      removeUploadedFiles(client, uploadedPaths),
    ]);

    if (deleteBookResult.error || cleanupError) {
      throw new Error(
        `A obra foi enviada, mas houve falhas ao atualizar o armazenamento ou desfazer o envio: ${storageError.message}${
          deleteBookResult.error ? `; ${deleteBookResult.error.message}` : ""
        }${cleanupError ? `; ${cleanupError}` : ""}`,
      );
    }
    throw new Error(`Não foi possível atualizar o armazenamento: ${storageError.message}`);
  }

  return book;
}
