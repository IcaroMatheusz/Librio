import { getSupabaseClient } from "../lib/supabase";
import type { UserStorage } from "../types/database";

export async function getUserStorage(): Promise<UserStorage> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("user_storage")
    .select("user_id, used_bytes, max_bytes")
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o armazenamento: ${error.message}`);
  }
  if (!data) {
    throw new Error("Os dados de armazenamento ainda não estão disponíveis.");
  }

  return data;
}
