import { getSupabaseClient } from "../lib/supabase";
import { signBookCovers } from "./booksService";
import type { Book, RecentRead } from "../types/database";

export interface ProgressCounts {
  inProgress: number;
  completed: number;
}

function getLocalProgressTableError(
  error: { code?: string; message: string },
  action: string,
): Error {
  if (
    error.code === "PGRST205" &&
    error.message.includes("local_reading_progress")
  ) {
    return new Error(
      `A tabela de progresso das obras locais ainda não existe no Supabase. Para ${action}, execute o arquivo supabase/migrations/20261115000000_create_local_reading_progress.sql no SQL Editor do projeto Supabase. Depois, atualize esta página. O arquivo da obra e seu caminho não são enviados à nuvem.`,
    );
  }

  return new Error(
    `Não foi possível ${action} o progresso das obras locais: ${error.message}`,
  );
}

export async function getBookProgress(
  bookId: string,
): Promise<number> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("reading_progress")
    .select("progress")
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o progresso da leitura: ${error.message}`);
  }

  return data?.progress ?? 0;
}

export async function saveBookProgress(
  bookId: string,
  progress: number,
): Promise<void> {
  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(
      `Não foi possível identificar sua sessão para salvar o progresso: ${userError.message}`,
    );
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar o progresso.");
  }

  const { error } = await client.from("reading_progress").upsert(
    {
      book_id: bookId,
      user_id: userData.user.id,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "book_id" },
  );

  if (error) {
    if (
      error.message.includes(
        "there is no unique or exclusion constraint matching the ON CONFLICT specification",
      )
    ) {
      throw new Error(
        "A tabela reading_progress precisa de uma restrição UNIQUE em book_id para sincronizar o progresso. Crie uma chave única nessa coluna no Supabase e tente novamente.",
      );
    }
    throw new Error(`Não foi possível salvar o progresso da leitura: ${error.message}`);
  }
}

export async function getRecentReads(): Promise<RecentRead[]> {
  const client = await getSupabaseClient();
  const { data: progressRows, error: progressError } = await client
    .from("reading_progress")
    .select("book_id, progress, last_read_at")
    .not("last_read_at", "is", null)
    .order("last_read_at", { ascending: false })
    .limit(5);

  if (progressError) {
    throw new Error(`Não foi possível carregar as leituras: ${progressError.message}`);
  }

  if (progressRows.length === 0) return [];

  const bookIds = progressRows.map(({ book_id }) => book_id);
  const { data: books, error: booksError } = await client
    .from("books")
    .select("id, user_id, title, author, description, cover_url, file_path, file_type, file_size, created_at, updated_at")
    .in("id", bookIds);

  if (booksError) {
    throw new Error(`Não foi possível carregar as obras lidas: ${booksError.message}`);
  }

  const booksWithSignedCovers = await signBookCovers(books);
  const booksById = new Map<string, Book>(
    booksWithSignedCovers.map((book) => [book.id, book]),
  );

  return progressRows.flatMap((progress) => {
    const book = booksById.get(progress.book_id);
    return book ? [{ ...book, ...progress }] : [];
  });
}

export async function getProgressCounts(): Promise<ProgressCounts> {
  const client = await getSupabaseClient();
  const [inProgressResult, completedResult] = await Promise.all([
    client
      .from("reading_progress")
      .select("book_id", { count: "exact", head: true })
      .gt("progress", 0)
      .lt("progress", 100),
    client
      .from("reading_progress")
      .select("book_id", { count: "exact", head: true })
      .eq("progress", 100),
  ]);

  if (inProgressResult.error) {
    throw new Error(
      `Não foi possível contar as obras em andamento: ${inProgressResult.error.message}`,
    );
  }
  if (completedResult.error) {
    throw new Error(
      `Não foi possível contar as obras concluídas: ${completedResult.error.message}`,
    );
  }

  return {
    inProgress: inProgressResult.count ?? 0,
    completed: completedResult.count ?? 0,
  };
}

export async function getLocalReadingProgress(): Promise<
  Map<string, number>
> {
  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(
      `Não foi possível identificar sua sessão para carregar o progresso local: ${userError.message}`,
    );
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para carregar o progresso local.");
  }

  const { data, error } = await client
    .from("local_reading_progress")
    .select("local_book_id, progress")
    .eq("user_id", userData.user.id);

  if (error) {
    throw getLocalProgressTableError(error, "carregar");
  }

  return new Map(data.map(({ local_book_id, progress }) => [local_book_id, progress]));
}

export async function getLocalBookProgress(
  localBookId: string,
): Promise<number> {
  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(
      `Não foi possível identificar sua sessão para abrir a obra local: ${userError.message}`,
    );
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para abrir esta obra.");
  }

  const { data, error } = await client
    .from("local_reading_progress")
    .select("progress")
    .eq("user_id", userData.user.id)
    .eq("local_book_id", localBookId)
    .maybeSingle();

  if (error) {
    throw getLocalProgressTableError(error, "carregar");
  }

  return data?.progress ?? 0;
}

export async function saveLocalBookProgress(
  localBookId: string,
  progress: number,
): Promise<void> {
  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(
      `Não foi possível identificar sua sessão para salvar o progresso local: ${userError.message}`,
    );
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar o progresso local.");
  }

  const { error } = await client.from("local_reading_progress").upsert(
    {
      user_id: userData.user.id,
      local_book_id: localBookId,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,local_book_id" },
  );

  if (error) {
    throw getLocalProgressTableError(error, "salvar");
  }
}
