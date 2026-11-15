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
  if (!['pdf', 'epub', 'cbr', 'cbz'].includes(extension)) throw new Error('Formato nÃ£o suportado.');
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessÃ£o expirou. Entre novamente.');
  const bytes = asset.size ?? new File(asset.uri).size;
  const { data: storage, error: storageError } = await client.from('user_storage').select('used_bytes,max_bytes').eq('user_id', user.id).maybeSingle();
  if (storageError) throw storageError;
  const maxBytes = storage?.max_bytes ?? 104857600;
  const usedBytes = storage?.used_bytes ?? 0;
  if (usedBytes + bytes > maxBytes) throw new Error('Este arquivo ultrapassa o espaÃ§o disponÃ­vel na sua biblioteca.');
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
  const { error: quotaError } = await client.from('user_storage').update({ used_bytes: usedBytes + bytes }).eq('user_id', user.id);
  if (quotaError) {
    await client.from('books').delete().eq('id', id);
    await client.storage.from('books').remove([path]);
    throw quotaError;
  }
}

export async function removeBook(book: Book) {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessão expirou.');
  const coverPath = book.cover_url && !book.cover_url.startsWith('http') ? book.cover_url : null;
  let coverSize = 0;
  let coverBucket = 'coverarts';
  if (coverPath) {
    let cover = await client.storage.from(coverBucket).download(coverPath);
    if (cover.error?.statusCode === '404') {
      coverBucket = 'books';
      cover = await client.storage.from(coverBucket).download(coverPath);
    }
    if (cover.data) coverSize = cover.data.size;
  }
  const { data: deleted, error } = await client.from('books').delete().eq('id', book.id).eq('user_id', user.id).select('id').single();
  if (error?.code === '23503' && error.message.includes('volume_chapters')) throw new Error('Esta obra faz parte de um volume. Exclua o volume antes de remover o arquivo.');
  if (error) throw error;
  if (!deleted) throw new Error('A obra não foi encontrada.');
  const { error: storageError } = await client.storage.from('books').remove([book.file_path]);
  if (storageError) throw new Error('A obra saiu da biblioteca, mas o arquivo não pôde ser removido: ' + storageError.message);
  if (coverPath) {
    const { error: coverError } = await client.storage.from(coverBucket).remove([coverPath]);
    if (coverError) throw new Error('A obra foi removida, mas a capa não pôde ser removida: ' + coverError.message);
  }
  const { data: storage, error: loadError } = await client.from('user_storage').select('used_bytes').eq('user_id', user.id).maybeSingle();
  if (loadError) throw loadError;
  const { error: quotaError } = await client.from('user_storage').update({ used_bytes: Math.max(0, (storage?.used_bytes ?? book.file_size + coverSize) - book.file_size - coverSize) }).eq('user_id', user.id);
  if (quotaError) throw new Error('A obra foi removida, mas não foi possível atualizar a cota: ' + quotaError.message);
}

export async function updateBook(bookId: string, title: string, author: string) {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 200) throw new Error('Informe um tÃ­tulo com atÃ© 200 caracteres.');
  if (author.trim().length > 160) throw new Error('O autor deve ter atÃ© 160 caracteres.');
  const { error } = await requireSupabase().from('books').update({ title: cleanTitle, author: author.trim() }).eq('id', bookId);
  if (error) throw error;
}

export async function updateBookCover(book: Book) {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
  if (picked.canceled) return;
  const asset = picked.assets[0];
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('Escolha uma capa JPG, PNG ou WEBP.');
  const size = asset.size ?? new File(asset.uri).size;
  if (size > 5 * 1024 * 1024) throw new Error('A capa deve ter no mÃ¡ximo 5 MB.');
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessÃ£o expirou.');
  const { data: quota, error: quotaReadError } = await client.from('user_storage').select('used_bytes,max_bytes').eq('user_id', user.id).maybeSingle();
  if (quotaReadError) throw quotaReadError;
  const oldPath = book.cover_url && !book.cover_url.startsWith('http') ? book.cover_url : null;
  let oldBucket = 'coverarts';
  let oldSize = 0;
  if (oldPath) {
    let old = await client.storage.from(oldBucket).download(oldPath);
    if (old.error?.statusCode === '404') {
      oldBucket = 'books';
      old = await client.storage.from(oldBucket).download(oldPath);
    }
    if (!old.error) oldSize = old.data.size;
  }
  const usedBytes = quota?.used_bytes ?? 0;
  const maxBytes = quota?.max_bytes ?? 104857600;
  if (usedBytes - oldSize + size > maxBytes) throw new Error('NÃ£o hÃ¡ espaÃ§o suficiente para esta capa.');
  const path = `${user.id}/${book.id}-${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage.from('coverarts').upload(path, await new File(asset.uri).arrayBuffer(), { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { error: updateError } = await client.from('books').update({ cover_url: path }).eq('id', book.id);
  if (updateError) { await client.storage.from('coverarts').remove([path]); throw updateError; }
  const { error: quotaError } = await client.from('user_storage').update({ used_bytes: usedBytes - oldSize + size }).eq('user_id', user.id);
  if (quotaError) {
    await client.from('books').update({ cover_url: book.cover_url }).eq('id', book.id);
    await client.storage.from('coverarts').remove([path]);
    throw quotaError;
  }
  if (oldPath) await client.storage.from(oldBucket).remove([oldPath]);
}

export async function getBookCoverUrl(book: Book): Promise<string | null> {
  if (!book.cover_url) return null;
  if (book.cover_url.startsWith('http')) return book.cover_url;
  const client = requireSupabase();
  let { data, error } = await client.storage.from('coverarts').createSignedUrl(book.cover_url, 3600);
  if (error) ({ data, error } = await client.storage.from('books').createSignedUrl(book.cover_url, 3600));
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getBookProgress(bookId: string): Promise<number> {
  const { data, error } = await requireSupabase().from('reading_progress').select('progress').eq('book_id', bookId).maybeSingle();
  if (error) throw error;
  return data?.progress ?? 0;
}

export async function markBookOpened(bookId: string) {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sua sessÃ£o expirou. Entre novamente.');
  const { data: previous, error: readError } = await client.from('reading_progress').select('progress').eq('book_id', bookId).maybeSingle();
  if (readError) throw readError;
  const { error } = await client.from('reading_progress').upsert({ book_id: bookId, user_id: user.id, progress: previous?.progress ?? 0, last_read_at: new Date().toISOString() }, { onConflict: 'book_id' });
  if (error) throw error;
}

export async function getBookUrl(book: Book) {
  const { data, error } = await requireSupabase().storage.from('books').createSignedUrl(book.file_path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function chooseDirectory(): Promise<LocalBook[]> {
  if (process.env.EXPO_OS !== 'android') throw new Error('A seleÃ§Ã£o recursiva de diretÃ³rios estÃ¡ disponÃ­vel no Android. No iOS, escolha arquivos individualmente.');
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
