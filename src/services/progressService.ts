import { getSupabaseClient } from "../lib/supabase";
import type { Book, RecentRead } from "../types/database";

export interface ProgressCounts {
  inProgress: number;
  completed: number;
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
    .select("id, user_id, title, author, cover_url, file_type, file_size, created_at")
    .in("id", bookIds);

  if (booksError) {
    throw new Error(`Não foi possível carregar as obras lidas: ${booksError.message}`);
  }

  const booksById = new Map<string, Book>(books.map((book) => [book.id, book]));

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
