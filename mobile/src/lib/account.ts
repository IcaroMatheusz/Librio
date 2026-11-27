import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { requireSupabase } from './supabase';

export type Profile = { id: string; username: string; avatar_url: string | null; created_at: string };
export type StorageInfo = { used_bytes: number; max_bytes: number };

async function userStorage(userId: string): Promise<StorageInfo> {
  const { data, error } = await requireSupabase().from('user_storage').select('used_bytes,max_bytes').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ?? { used_bytes: 0, max_bytes: 104857600 };
}

export async function getCloudStorage() {
  const { data: { user }, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
  return userStorage(user.id);
}

export async function getProfile(): Promise<{ profile: Profile; avatarUrl: string | null; storage: StorageInfo }> {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
  const [profileResult, storage] = await Promise.all([
    client.from('profiles').select('id,username,avatar_url,created_at').eq('id', user.id).single(),
    userStorage(user.id),
  ]);
  if (profileResult.error) throw profileResult.error;
  const avatarPath = profileResult.data.avatar_url;
  let avatarUrl: string | null = avatarPath;
  if (avatarPath && !avatarPath.startsWith('http')) {
    const { data, error } = await client.storage.from('pfp').createSignedUrl(avatarPath, 3600);
    if (error) throw error;
    avatarUrl = data.signedUrl;
  }
  return { profile: profileResult.data as Profile, avatarUrl, storage };
}

export async function saveProfile(username: string, email: string, password: string) {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessão expirou.');
  const normalizedName = username.trim();
  if (!normalizedName) throw new Error('Informe seu nome de perfil.');
  const { error: profileError } = await client.from('profiles').update({ username: normalizedName }).eq('id', user.id);
  if (profileError) throw profileError;
  const changes: { email?: string; password?: string } = {};
  if (email.trim() && email.trim() !== user.email) changes.email = email.trim().toLowerCase();
  if (password.trim()) changes.password = password;
  if (Object.keys(changes).length) {
    const { error } = await client.auth.updateUser(changes);
    if (error) throw error;
  }
}

export async function changeAvatar() {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
  if (picked.canceled) return;
  const asset = picked.assets[0];
  const ext = asset.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw new Error('Escolha uma imagem JPG, PNG ou WEBP.');
  if ((asset.size ?? 0) > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessão expirou.');
  const { data: previous } = await client.from('profiles').select('avatar_url').eq('id', user.id).single();
  const objectPath = `${user.id}/${Date.now()}.${ext}`;
  const type = asset.mimeType ?? 'image/jpeg';
  const { error: uploadError } = await client.storage.from('pfp').upload(objectPath, await new File(asset.uri).arrayBuffer(), { contentType: type, upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await client.from('profiles').update({ avatar_url: objectPath }).eq('id', user.id);
  if (error) { await client.storage.from('pfp').remove([objectPath]); throw error; }
  if (previous?.avatar_url && !previous.avatar_url.startsWith('http')) await client.storage.from('pfp').remove([previous.avatar_url]);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export async function persistLocalIndex(index: unknown[]) {
  const folder = new Directory(Paths.document, 'librio-local');
  if (!folder.exists) folder.create({ intermediates: true });
  await new File(folder, 'index.json').write(JSON.stringify(index));
}
