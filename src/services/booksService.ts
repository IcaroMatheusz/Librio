import { getSupabaseClient } from "../lib/supabase";
import type { Book, BookFileType } from "../types/database";
import { prepareManualBookCover } from "./coverPreviewService";
import { getUserStorage } from "./storageService";

export const BOOKS_BUCKET = "books";
export const COVERARTS_BUCKET = "coverarts";
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
  bucket: string = BOOKS_BUCKET,
): Promise<void> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(filePath);

  if (error) {
    throw new Error(`Não foi possível preparar o arquivo: ${error.message}`);
  }

  await uploadFileWithProgress(data.signedUrl, file, fileName, onProgress);
}

async function removeUploadedFiles(
  client: Awaited<ReturnType<typeof getSupabaseClient>>,
  filePaths: string[],
  bucket: string = BOOKS_BUCKET,
): Promise<string | null> {
  if (filePaths.length === 0) return null;
  const { error } = await client.storage.from(bucket).remove(filePaths);
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
  const uniquePaths = [...new Set(paths)];
  const urlsByPath = new Map<string, string>();
  const errorsByPath = new Map<string, string>();

  for (const bucket of [COVERARTS_BUCKET, BOOKS_BUCKET]) {
    const unresolvedPaths = uniquePaths.filter((path) => !urlsByPath.has(path));
    if (unresolvedPaths.length === 0) break;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrls(unresolvedPaths, 60 * 60);
    if (error) {
      for (const path of unresolvedPaths) errorsByPath.set(path, error.message);
      continue;
    }

    for (const { error: coverError, path, signedUrl } of data) {
      if (!coverError && path && signedUrl) {
        urlsByPath.set(path, signedUrl);
      } else if (path) {
        errorsByPath.set(path, coverError ?? "resposta incompleta do Storage.");
      }
    }
  }

  const unresolvedPath = uniquePaths.find((path) => !urlsByPath.has(path));
  if (unresolvedPath) {
    throw new Error(
      `Não foi possível carregar uma capa: ${
        errorsByPath.get(unresolvedPath) ?? "link assinado não retornado pelo Storage."
      }`,
    );
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
  let coverBucket = COVERARTS_BUCKET;
  let coverSize = 0;
  const { data: bookRecord, error: bookRecordError } = await client
    .from("books")
    .select("cover_url")
    .eq("id", book.id)
    .eq("user_id", book.user_id)
    .single();

  if (bookRecordError) {
    throw new Error(
      `Não foi possível verificar a capa antes de excluir a obra: ${bookRecordError.message}`,
    );
  }

  const coverPath =
    bookRecord.cover_url && !/^https?:\/\//i.test(bookRecord.cover_url)
      ? bookRecord.cover_url
      : null;
  if (coverPath) {
    let { data: cover, error: coverError } = await client.storage
      .from(COVERARTS_BUCKET)
      .download(coverPath);

    if (coverError?.statusCode === "404") {
      coverBucket = BOOKS_BUCKET;
      const legacyCover = await client.storage
        .from(BOOKS_BUCKET)
        .download(coverPath);
      cover = legacyCover.data;
      coverError = legacyCover.error;
    }

    if (coverError && coverError.statusCode !== "404") {
      throw new Error(
        `Não foi possível verificar a capa antes de excluir a obra: ${coverError.message}`,
      );
    }
    if (cover) {
      coverSize = cover.size;
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
    if (
      deleteError.code === "23503" &&
      deleteError.message.includes("volume_chapters")
    ) {
      throw new Error(
        "Este PDF faz parte de um volume. Exclua o volume antes de remover o arquivo da biblioteca.",
      );
    }
    throw new Error(`Não foi possível excluir a obra: ${deleteError.message}`);
  }
  if (!deleted) {
    throw new Error("A obra não foi encontrada ou não pode ser excluída.");
  }

  const [bookCleanupError, coverCleanupError] = await Promise.all([
    removeUploadedFiles(client, [book.file_path]),
    coverPath
      ? removeUploadedFiles(client, [coverPath], coverBucket)
      : Promise.resolve(null),
  ]);
  if (bookCleanupError || coverCleanupError) {
    return `A obra foi removida da biblioteca, mas não foi possível limpar todos os arquivos do armazenamento: ${[
      bookCleanupError,
      coverCleanupError,
    ]
      .filter(Boolean)
      .join("; ")}`;
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

export interface BookDownloadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
}

export type DownloadProgressCallback = (
  progress: BookDownloadProgress,
) => void;

export async function getBookFile(
  filePath: string,
  expectedBytes: number,
  onProgress: DownloadProgressCallback,
): Promise<Blob> {
  const client = await getSupabaseClient();
  const { data, error } = await client.storage
    .from(BOOKS_BUCKET)
    .createSignedUrl(filePath, 60);

  if (error) throw new Error(`Não foi possível preparar o arquivo: ${error.message}`);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", data.signedUrl);
    request.responseType = "blob";
    request.addEventListener("progress", (event) => {
      const total = event.lengthComputable ? event.total : expectedBytes;
      if (total > 0) {
        onProgress({
          loadedBytes: event.loaded,
          totalBytes: total,
          percent: Math.min(99, Math.round((event.loaded / total) * 100)),
        });
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300 && request.response instanceof Blob) {
        onProgress({
          loadedBytes: request.response.size,
          totalBytes: request.response.size || expectedBytes,
          percent: 100,
        });
        resolve(request.response);
        return;
      }
      reject(
        new Error(
          `Não foi possível baixar o arquivo do armazenamento (HTTP ${request.status}).`,
        ),
      );
    });
    request.addEventListener("error", () => {
      reject(new Error("Falha de conexão ao baixar a obra do armazenamento."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("O download da obra foi interrompido."));
    });
    request.send();
  });
}

export async function uploadBookCover(
  bookId: string,
  imageFile: File,
): Promise<{ book: Book; warning: string | null }> {
  const cover = await prepareManualBookCover(imageFile);
  const client = await getSupabaseClient();
  const storage = await getUserStorage();
  const { data: currentBook, error: currentBookError } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .eq("id", bookId)
    .single();

  if (currentBookError) {
    throw new Error(`Não foi possível localizar a obra: ${currentBookError.message}`);
  }

  const oldCoverPath =
    currentBook.cover_url && !/^https?:\/\//i.test(currentBook.cover_url)
      ? currentBook.cover_url
      : null;
  let oldCoverBucket = COVERARTS_BUCKET;
  let oldCoverSize = 0;
  if (oldCoverPath) {
    let { data: oldCover, error: oldCoverError } = await client.storage
      .from(COVERARTS_BUCKET)
      .download(oldCoverPath);
    if (oldCoverError?.statusCode === "404") {
      oldCoverBucket = BOOKS_BUCKET;
      const legacyCover = await client.storage
        .from(BOOKS_BUCKET)
        .download(oldCoverPath);
      oldCover = legacyCover.data;
      oldCoverError = legacyCover.error;
    }
    if (oldCoverError && oldCoverError.statusCode !== "404") {
      throw new Error(`Não foi possível verificar a capa atual: ${oldCoverError.message}`);
    }
    oldCoverSize = oldCover?.size ?? 0;
  }

  const nextUsedBytes = storage.used_bytes - oldCoverSize + cover.size;
  if (nextUsedBytes > storage.max_bytes) {
    throw new Error("Não há espaço disponível para armazenar esta capa.");
  }

  const newCoverPath = `${currentBook.user_id}/${currentBook.id}-cover-${crypto.randomUUID()}.jpg`;
  try {
    await uploadStorageFile(
      client,
      newCoverPath,
      cover,
      `${currentBook.id}-cover.jpg`,
      undefined,
      COVERARTS_BUCKET,
    );
  } catch (uploadError) {
    const cleanupError = await removeUploadedFiles(
      client,
      [newCoverPath],
      COVERARTS_BUCKET,
    );
    const uploadErrorMessage =
      uploadError instanceof Error
        ? uploadError.message
        : "Ocorreu um erro inesperado.";
    const mimeTypeError = uploadErrorMessage.match(
      /mime type ([\w.+-]+\/[\w.+-]+) is not supported/i,
    );
    const userMessage = mimeTypeError
      ? `O bucket "coverarts" não permite o tipo ${mimeTypeError[1]}. Adicione esse MIME type aos tipos permitidos nas configurações do Storage do Supabase.`
      : uploadErrorMessage;
    throw new Error(
      `Não foi possível enviar a capa: ${userMessage}${cleanupError ? ` Também não foi possível limpar o envio parcial: ${cleanupError}` : ""}`,
      { cause: uploadError },
    );
  }

  const { data: updatedBook, error: updateError } = await client
    .from("books")
    .update({ cover_url: newCoverPath })
    .eq("id", currentBook.id)
    .eq("user_id", currentBook.user_id)
    .select(BOOK_FIELDS)
    .single();

  if (updateError) {
    const cleanupError = await removeUploadedFiles(
      client,
      [newCoverPath],
      COVERARTS_BUCKET,
    );
    throw new Error(
      `A capa foi enviada, mas não foi possível vinculá-la à obra: ${updateError.message}${
        cleanupError ? ` Também não foi possível remover a capa enviada: ${cleanupError}` : ""
      }`,
    );
  }

  const { error: storageError } = await client
    .from("user_storage")
    .update({ used_bytes: nextUsedBytes })
    .eq("user_id", currentBook.user_id)
    .select("user_id")
    .single();

  if (storageError) {
    const [restoreResult, cleanupError] = await Promise.all([
      client
        .from("books")
        .update({ cover_url: currentBook.cover_url })
        .eq("id", currentBook.id)
        .eq("user_id", currentBook.user_id),
      removeUploadedFiles(client, [newCoverPath], COVERARTS_BUCKET),
    ]);
    throw new Error(
      `Não foi possível atualizar o armazenamento da capa: ${storageError.message}${
        restoreResult.error
          ? ` Também não foi possível restaurar a capa anterior: ${restoreResult.error.message}`
          : ""
      }${cleanupError ? ` Não foi possível remover a nova capa: ${cleanupError}` : ""}`,
    );
  }

  let warning: string | null = null;
  if (oldCoverPath) {
    const cleanupError = await removeUploadedFiles(
      client,
      [oldCoverPath],
      oldCoverBucket,
    );
    if (cleanupError) {
      const { error: restoreStorageError } = await client
        .from("user_storage")
        .update({ used_bytes: nextUsedBytes + oldCoverSize })
        .eq("user_id", currentBook.user_id);
      warning = `A nova capa foi salva, mas a antiga não pôde ser removida: ${cleanupError}${
        restoreStorageError
          ? ` O armazenamento também não pôde ser atualizado: ${restoreStorageError.message}`
          : ""
      }`;
    }
  }

  const [book] = await signBookCovers([updatedBook]);
  return { book, warning };
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
    epub: "epub",
    pdf: "pdf",
  };
  const fileType = fileTypes[extension ?? ""];
  if (!fileType) {
    throw new Error("Envie um arquivo .pdf, .epub, .cbr ou .cbz.");
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
  const uploadedCoverPaths: string[] = [];

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
        COVERARTS_BUCKET,
      );
      savedCoverPath = coverPath;
      uploadedCoverPaths.push(coverPath);
    } catch (coverUploadError) {
      const cleanupError = await removeUploadedFiles(
        client,
        [coverPath],
        COVERARTS_BUCKET,
      );
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
    const [cleanupError, coverCleanupError] = await Promise.all([
      removeUploadedFiles(client, uploadedPaths),
      removeUploadedFiles(client, uploadedCoverPaths, COVERARTS_BUCKET),
    ]);
    if (cleanupError || coverCleanupError) {
      throw new Error(
        `Não foi possível salvar a obra (${insertError.message}) nem remover os arquivos enviados (${[
          cleanupError,
          coverCleanupError,
        ]
          .filter(Boolean)
          .join("; ")}).`,
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
    const [deleteBookResult, cleanupErrors] = await Promise.all([
      client.from("books").delete().eq("id", book.id),
      Promise.all([
        removeUploadedFiles(client, uploadedPaths),
        removeUploadedFiles(client, uploadedCoverPaths, COVERARTS_BUCKET),
      ]),
    ]);
    const cleanupError = cleanupErrors.filter(Boolean).join("; ");

    if (deleteBookResult.error || cleanupErrors.some(Boolean)) {
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
