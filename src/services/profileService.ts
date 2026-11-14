import { getSupabaseClient } from "../lib/supabase";

const PROFILE_PHOTO_BUCKET = "pfp";
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthAccountChanges {
  email?: string;
  password?: string;
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

export async function getProfilePhotoUrl(
  avatarPath: string | null,
): Promise<string | null> {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return avatarPath;
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(avatarPath, 60 * 60);

  if (error) {
    throw new Error(`Não foi possível carregar a foto de perfil: ${error.message}`);
  }

  return data.signedUrl;
}

export async function uploadProfilePhoto(
  userId: string,
  file: File,
): Promise<string> {
  const allowedTypes: Record<string, string> = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = allowedTypes[file.type];
  if (!extension) {
    throw new Error("A foto deve estar no formato PNG, JPG, WEBP ou GIF.");
  }
  if (file.size > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error("A foto de perfil deve ter no máximo 5 MB.");
  }

  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const client = await getSupabaseClient();
  const { error } = await client.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  }

  return objectPath;
}

export async function deleteProfilePhoto(avatarPath: string): Promise<void> {
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return;
  }

  const client = await getSupabaseClient();
  const { error } = await client.storage
    .from(PROFILE_PHOTO_BUCKET)
    .remove([avatarPath]);

  if (error) {
    throw new Error(`Não foi possível remover a foto anterior: ${error.message}`);
  }
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

export async function updateAuthAccount(
  changes: AuthAccountChanges,
): Promise<{ emailConfirmationRequired: boolean }> {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.updateUser(changes);

  if (error) {
    if (error.message.toLowerCase().includes("password")) {
      throw new Error("Não foi possível atualizar a senha. Confira os requisitos da senha.");
    }

    throw new Error(`Não foi possível atualizar sua conta: ${error.message}`);
  }

  return {
    emailConfirmationRequired: Boolean(changes.email && data.user.email !== changes.email),
  };
}
