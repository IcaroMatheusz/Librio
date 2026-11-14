import { getSupabaseClient } from "../lib/supabase";
import type { UserStorage } from "../types/database";

export async function getUserStorage(): Promise<UserStorage> {
  const { data, error } = await getSupabaseClient()
    .from("user_storage")
    .select("used_bytes, max_bytes")
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o armazenamento: ${error.message}`);
  }
  if (!data) {
    throw new Error("Os dados de armazenamento ainda não estão disponíveis.");
  }

  return data;
}
