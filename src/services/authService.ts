import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "../lib/supabase";

const INITIAL_STORAGE_LIMIT_BYTES = 104_857_600;

function getPortugueseAuthError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return new Error("E-mail ou senha incorretos.");
  }
  if (
    normalizedMessage.includes("user already registered") ||
    normalizedMessage.includes("already been registered")
  ) {
    return new Error("Este e-mail já possui uma conta.");
  }
  if (message.startsWith("Este e-mail já possui")) {
    return new Error(message);
  }
  if (normalizedMessage.includes("email not confirmed")) {
    return new Error("Confirme seu e-mail antes de entrar.");
  }
  if (
    normalizedMessage.includes("password should be at least") ||
    normalizedMessage.includes("password must be at least") ||
    normalizedMessage.includes("password is too weak")
  ) {
    return new Error("A senha precisa ter pelo menos 8 caracteres.");
  }
  if (
    normalizedMessage.includes("unable to validate email") ||
    normalizedMessage.includes("email address is invalid")
  ) {
    return new Error("Informe um endereço de e-mail válido.");
  }
  if (
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many requests")
  ) {
    return new Error("Muitas tentativas. Aguarde um pouco e tente novamente.");
  }
  if (
    message.startsWith("A conta foi criada,") ||
    message.startsWith("Não foi possível verificar") ||
    message.startsWith("Este nome de usuário") ||
    message.startsWith("Não foi possível identificar") ||
    message.startsWith("O Supabase não retornou")
  ) {
    return new Error(message);
  }
  if (normalizedMessage.includes("supabase não está configurado")) {
    return new Error(message);
  }

  return new Error(
    message
      ? `Não foi possível concluir a autenticação: ${message}`
      : "Ocorreu um erro inesperado na autenticação.",
  );
}

function getUsername(user: User): string {
  const metadataUsername = user.user_metadata.username;
  if (typeof metadataUsername === "string" && metadataUsername.trim()) {
    return metadataUsername.trim();
  }

  return user.email?.split("@")[0] || "leitor";
}

async function insertAccountRecords(user: User): Promise<void> {
  const client = await getSupabaseClient();
  const [profileResult, storageResult] = await Promise.all([
    client
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username: getUsername(user),
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    client
      .from("user_storage")
      .upsert(
        {
          user_id: user.id,
          used_bytes: 0,
          max_bytes: INITIAL_STORAGE_LIMIT_BYTES,
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
  ]);

  if (profileResult.error?.code === "23505") {
    throw new Error("Este nome de usuário já está sendo utilizado.");
  }
  if (profileResult.error) {
    throw new Error(
      `A conta foi criada, mas não foi possível salvar seu perfil: ${profileResult.error.message}`,
    );
  }
  if (storageResult.error && storageResult.error.code !== "23505") {
    throw new Error(
      `A conta foi criada, mas não foi possível preparar seu armazenamento: ${storageResult.error.message}`,
    );
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Não foi possível identificar sua conta.");

    await insertAccountRecords(data.user);
    return data.user;
  } catch (error) {
    throw getPortugueseAuthError(error);
  }
}

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

export async function signUpWithEmail(
  username: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("O Supabase não retornou os dados da conta.");
    if (data.user.identities?.length === 0) {
      throw new Error("Este e-mail já possui uma conta.");
    }

    if (data.session) {
      await insertAccountRecords(data.user);
    }

    return { requiresEmailConfirmation: !data.session };
  } catch (error) {
    throw getPortugueseAuthError(error);
  }
}

export async function signOutFromSupabase(): Promise<void> {
  try {
    const client = await getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw getPortugueseAuthError(error);
  }
}

export async function ensureAccountRecords(user: User): Promise<void> {
  try {
    await insertAccountRecords(user);
  } catch (error) {
    throw getPortugueseAuthError(error);
  }
}
