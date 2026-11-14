import { getSupabaseClient } from "../lib/supabase";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export async function getProfile(userId: string): Promise<Profile> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, username, avatar_url, created_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Não foi possível carregar o perfil: ${error.message}`);
  }

  return data;
}

export async function updateProfile(
  userId: string,
  username: string,
  avatarUrl: string | null,
): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client
    .from("profiles")
    .update({ username, avatar_url: avatarUrl })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este nome de usuário já está sendo utilizado.");
    }

    throw new Error(`Não foi possível salvar o perfil: ${error.message}`);
  }
}
