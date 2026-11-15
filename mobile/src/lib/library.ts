import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { requireSupabase } from './supabase';
import type { Book, LocalBook } from './types';

export async function getBooks(): Promise<Book[]> {
  const { data, error } = await requireSupabase().from('books').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function pickAndUploadBook(): Promise<void> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/epub+zip', 'application/vnd.comicbook-rar', 'application/vnd.comicbook+zip'], copyToCacheDirectory: true });
  if (result.canceled) return;
  const asset = result.assets[0];
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['pdf', 'epub', 'cbr', 'cbz'].includes(extension)) throw new Error('Formato não suportado.');
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
  const bytes = asset.size ?? new File(asset.uri).size;
  const { data: storage, error: storageError } = await client.from('user_storage').select('used_bytes,max_bytes').eq('user_id', user.id).maybeSingle();
  if (storageError) throw storageError;
  const maxBytes = storage?.max_bytes ?? 104857600;
  const usedBytes = storage?.used_bytes ?? 0;
  if (usedBytes + bytes > maxBytes) throw new Error('Este arquivo ultrapassa o espaço disponível na sua biblioteca.');
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${user.id}/${id}.${extension}`;
  const body = await new File(asset.uri).arrayBuffer();
  const { error: uploadError } = await client.storage.from('books').upload(path, body, { contentType: asset.mimeType ?? 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await client.from('books').insert({ id, user_id: user.id, title: asset.name.replace(/\.[^.]+$/, ''), author: '', description: null, cover_url: null, file_path: path, file_type: extension, file_size: asset.size ?? body.byteLength });
  if (error) {
    await client.storage.from('books').remove([path]);
    throw error;
  }
}

export async function removeBook(book: Book) {
  const client = requireSupabase();
  const { error: storageError } = await client.storage.from('books').remove([book.file_path]);
  if (storageError) throw storageError;
  const { error } = await client.from('books').delete().eq('id', book.id);
  if (error) throw error;
}

export async function getBookUrl(book: Book) {
  const { data, error } = await requireSupabase().storage.from('books').createSignedUrl(book.file_path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function chooseDirectory(): Promise<LocalBook[]> {
  if (process.env.EXPO_OS !== 'android') throw new Error('A seleção recursiva de diretórios está disponível no Android. No iOS, escolha arquivos individualmente.');
  const picked = await Directory.pickDirectoryAsync();
  const result: LocalBook[] = [];
  async function walk(folder: Directory): Promise<void> {
    for (const item of folder.list()) {
      if (item instanceof Directory) { await walk(item); continue; }
      if (!(item instanceof File)) continue;
      const format = item.name.split('.').pop()?.toLowerCase() ?? '';
      if (['pdf', 'epub', 'cbr', 'cbz'].includes(format)) result.push({ uri: item.uri, name: item.name, size: item.size, format });
    }
  }
  await walk(picked);
  return result;
}

export async function chooseLocalFiles(): Promise<LocalBook[]> {
  const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ['application/pdf', 'application/epub+zip', 'application/vnd.comicbook-rar', 'application/vnd.comicbook+zip'] });
  if (picked.canceled) return [];
  const folder = new Directory(Paths.document, 'librio-local-files');
  if (!folder.exists) folder.create({ intermediates: true });
  const books: LocalBook[] = [];
  for (const asset of picked.assets) {
    const format = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'epub', 'cbr', 'cbz'].includes(format)) continue;
    const destination = new File(folder, `${Date.now()}-${asset.name.replace(/[^\p{L}\p{N}._-]/gu, '_')}`);
    await new File(asset.uri).copy(destination);
    books.push({ uri: destination.uri, name: asset.name, size: asset.size ?? 0, format });
  }
  return books;
}

export async function rememberLocalFiles(files: LocalBook[]) {
  const dir = new Directory(Paths.document, 'librio-local');
  if (!dir.exists) dir.create({ intermediates: true });
  const index = new File(dir, 'index.json');
  let existing: LocalBook[] = [];
  if (index.exists) {
    try { existing = JSON.parse(await index.text()) as LocalBook[]; } catch { existing = []; }
  }
  const byUri = new Map([...existing, ...files].map((book) => [book.uri, book]));
  index.write(JSON.stringify([...byUri.values()]));
}

export async function readRememberedLocalFiles(): Promise<LocalBook[]> {
  const index = new File(new Directory(Paths.document, 'librio-local'), 'index.json');
  if (!index.exists) return [];
  try { return JSON.parse(await index.text()) as LocalBook[]; } catch { return []; }
}
