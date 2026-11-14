import { getSupabaseClient } from "../lib/supabase";
import type { Book } from "../types/database";

const BOOK_FIELDS =
  "id, user_id, title, author, cover_url, file_type, file_size, created_at";

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
