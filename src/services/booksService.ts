import { getSupabaseClient } from "../lib/supabase";
import type { Book, BookFileType } from "../types/database";
import { getUserStorage } from "./storageService";

export const BOOKS_BUCKET = "books";
// TODO: Criar o bucket privado "books" no Supabase e permitir acesso somente à pasta auth.uid().
const BOOK_FIELDS =
  "id, user_id, title, author, description, cover_url, file_path, file_type, file_size, created_at, updated_at";

function uploadFileWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);

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

export async function getRecentBooks(): Promise<Book[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(`Não foi possível carregar as obras: ${error.message}`);
  return data;
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
  return data;
}

export async function getBookById(bookId: string): Promise<Book> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .eq("id", bookId)
    .single();

  if (error) throw new Error(`Não foi possível encontrar esta obra: ${error.message}`);
  return data;
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
  if (storage.used_bytes + file.size > storage.max_bytes) {
    throw new Error("Este arquivo ultrapassa o espaço disponível na sua biblioteca.");
  }

  const client = await getSupabaseClient();
  const bookId = crypto.randomUUID();
  const filePath = `${userId}/${bookId}.${fileType}`;
  const { data: signedUpload, error: signedUploadError } = await client.storage
    .from(BOOKS_BUCKET)
    .createSignedUploadUrl(filePath);

  if (signedUploadError) {
    throw new Error(
      `Não foi possível preparar o envio da obra: ${signedUploadError.message}`,
    );
  }

  try {
    await uploadFileWithProgress(signedUpload.signedUrl, file, onProgress);
  } catch (uploadError) {
    throw new Error(
      `Não foi possível enviar a obra: ${
        uploadError instanceof Error
          ? uploadError.message
          : "Ocorreu um erro inesperado."
      }`,
      { cause: uploadError },
    );
  }

  const { data: book, error: insertError } = await client
    .from("books")
    .insert({
      id: bookId,
      user_id: userId,
      title: title.trim(),
      author: author.trim(),
      file_path: filePath,
      file_type: fileType,
      file_size: file.size,
    })
    .select(BOOK_FIELDS)
    .single();

  if (insertError) {
    const { error: cleanupError } = await client.storage
      .from(BOOKS_BUCKET)
      .remove([filePath]);
    if (cleanupError) {
      throw new Error(
        `Não foi possível salvar a obra (${insertError.message}) nem remover o arquivo enviado (${cleanupError.message}).`,
      );
    }
    throw new Error(`Não foi possível salvar a obra: ${insertError.message}`);
  }

  const { error: storageError } = await client
    .from("user_storage")
    .update({ used_bytes: storage.used_bytes + file.size })
    .eq("user_id", userId)
    .select("user_id")
    .single();

  if (storageError) {
    const [deleteBookResult, deleteFileResult] = await Promise.all([
      client.from("books").delete().eq("id", book.id),
      client.storage.from(BOOKS_BUCKET).remove([filePath]),
    ]);

    if (deleteBookResult.error || deleteFileResult.error) {
      throw new Error(
        `A obra foi enviada, mas não foi possível atualizar o armazenamento: ${storageError.message}`,
      );
    }
    throw new Error(`Não foi possível atualizar o armazenamento: ${storageError.message}`);
  }

  return book;
}
