import { getSupabaseClient } from "../lib/supabase";
import type { Book } from "../types/database";
import { signBookCovers } from "./booksService";

export interface VolumeChapter {
  bookId: string;
  chapterNumber: number;
  title: string;
  book: Book;
}

export interface BookVolume {
  id: string;
  userId: string;
  title: string;
  author: string;
  createdAt: string;
  chapters: VolumeChapter[];
}

export interface VolumeProgress {
  chapterNumber: number;
  progress: number;
}

export interface NewVolumeChapter {
  bookId: string;
  title: string;
}

export const VOLUME_SUPPORTED_FILE_TYPES = ["pdf", "cbr", "cbz"] as const;

export function supportsVolumeFileType(fileType: string): boolean {
  return VOLUME_SUPPORTED_FILE_TYPES.includes(
    fileType.toLowerCase() as (typeof VOLUME_SUPPORTED_FILE_TYPES)[number],
  );
}

const BOOK_FIELDS =
  "id, user_id, title, author, description, cover_url, file_path, file_type, file_size, created_at, updated_at";

function isMissingVolumeSchema(message: string): boolean {
  return (
    message.includes("book_volumes") ||
    message.includes("volume_chapters") ||
    message.includes("volume_reading_progress")
  ) && (message.includes("does not exist") || message.includes("schema cache"));
}

function volumeSchemaError(message: string): Error {
  if (isMissingVolumeSchema(message)) {
    return new Error(
      "O recurso de volumes ainda não está configurado no Supabase. Execute o SQL de supabase/migrations/20261114190000_create_virtual_volumes.sql.",
    );
  }
  return new Error(`O Supabase não conseguiu acessar os volumes: ${message}`);
}

async function loadChapters(
  volumeIds: string[],
): Promise<Map<string, VolumeChapter[]>> {
  if (volumeIds.length === 0) return new Map();
  const client = await getSupabaseClient();
  const { data: chapterRows, error: chaptersError } = await client
    .from("volume_chapters")
    .select("volume_id, book_id, chapter_number, title")
    .in("volume_id", volumeIds)
    .order("chapter_number", { ascending: true });

  if (chaptersError) throw volumeSchemaError(chaptersError.message);
  const bookIds = [...new Set(chapterRows.map(({ book_id }) => book_id))];
  if (bookIds.length === 0) {
    return new Map(volumeIds.map((id) => [id, []]));
  }

  const { data: sourceBooks, error: booksError } = await client
    .from("books")
    .select(BOOK_FIELDS)
    .in("id", bookIds);
  if (booksError) {
    throw new Error(`Não foi possível carregar os capítulos do volume: ${booksError.message}`);
  }
  const booksWithCovers = await signBookCovers(sourceBooks);
  const booksById = new Map(booksWithCovers.map((book) => [book.id, book]));
  const chaptersByVolume = new Map<string, VolumeChapter[]>(
    volumeIds.map((id) => [id, []]),
  );

  for (const chapter of chapterRows) {
    const book = booksById.get(chapter.book_id);
    if (!book) continue;
    chaptersByVolume.get(chapter.volume_id)?.push({
      bookId: chapter.book_id,
      chapterNumber: chapter.chapter_number,
      title: chapter.title,
      book,
    });
  }
  return chaptersByVolume;
}

function toBookVolume(
  row: {
    id: string;
    user_id: string;
    title: string;
    author: string;
    created_at: string;
  },
  chapters: VolumeChapter[],
): BookVolume {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author,
    createdAt: row.created_at,
    chapters,
  };
}

export async function getVolumes(): Promise<BookVolume[]> {
  const client = await getSupabaseClient();
  const { data: volumeRows, error } = await client
    .from("book_volumes")
    .select("id, user_id, title, author, created_at")
    .order("created_at", { ascending: false });

  if (error) throw volumeSchemaError(error.message);
  const chaptersByVolume = await loadChapters(volumeRows.map(({ id }) => id));
  return volumeRows.map((row) =>
    toBookVolume(row, chaptersByVolume.get(row.id) ?? []),
  );
}

export async function getVolumeById(volumeId: string): Promise<BookVolume> {
  const client = await getSupabaseClient();
  const { data: volume, error } = await client
    .from("book_volumes")
    .select("id, user_id, title, author, created_at")
    .eq("id", volumeId)
    .single();

  if (error) throw volumeSchemaError(error.message);
  const chaptersByVolume = await loadChapters([volumeId]);
  const chapters = chaptersByVolume.get(volumeId) ?? [];
  if (chapters.length === 0) {
    throw new Error("Este volume não possui capítulos disponíveis.");
  }
  if (chapters.some(({ book }) => !supportsVolumeFileType(book.file_type))) {
    throw new Error(
      "Volumes aceitam PDFs, CBRs e CBZs. EPUBs já possuem capítulos próprios.",
    );
  }
  return toBookVolume(volume, chapters);
}

export async function createVolume(
  title: string,
  author: string,
  chapters: NewVolumeChapter[],
): Promise<void> {
  const normalizedTitle = title.trim();
  const normalizedAuthor = author.trim();
  if (!normalizedTitle || normalizedTitle.length > 200) {
    throw new Error("Informe um título com até 200 caracteres.");
  }
  if (normalizedAuthor.length > 160) {
    throw new Error("O nome do autor deve ter no máximo 160 caracteres.");
  }
  if (chapters.length < 2) {
    throw new Error("Selecione pelo menos dois arquivos para montar um volume.");
  }
  if (new Set(chapters.map(({ bookId }) => bookId)).size !== chapters.length) {
    throw new Error("Um mesmo arquivo não pode ser adicionado mais de uma vez.");
  }

  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(`Não foi possível verificar sua sessão: ${userError.message}`);
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para criar um volume.");
  }

  const { data: sourceBooks, error: sourceError } = await client
    .from("books")
    .select("id, file_type")
    .in(
      "id",
      chapters.map(({ bookId }) => bookId),
    );
  if (sourceError) {
    throw new Error(`Não foi possível verificar os arquivos escolhidos: ${sourceError.message}`);
  }
  const supportedBookIds = new Set(
    sourceBooks
      .filter(({ file_type }) => supportsVolumeFileType(file_type))
      .map(({ id }) => id),
  );
  if (supportedBookIds.size !== chapters.length) {
    throw new Error("Escolha apenas PDFs, CBRs ou CBZs da sua biblioteca.");
  }

  const { data: volume, error: volumeError } = await client
    .from("book_volumes")
    .insert({
      user_id: userData.user.id,
      title: normalizedTitle,
      author: normalizedAuthor,
    })
    .select("id")
    .single();
  if (volumeError) {
    if (
      volumeError.code === "23514" &&
      volumeError.message.includes("book_volumes_author_check")
    ) {
      throw new Error(
        "O banco ainda exige um autor para o volume. Aplique a migração supabase/migrations/20261115130000_allow_empty_volume_author.sql no projeto Supabase.",
      );
    }
    throw volumeSchemaError(volumeError.message);
  }

  const { error: chapterError } = await client.from("volume_chapters").insert(
    chapters.map((chapter, index) => ({
      volume_id: volume.id,
      book_id: chapter.bookId,
      chapter_number: index + 1,
      title: chapter.title.trim() || `Capítulo ${index + 1}`,
    })),
  );

  if (chapterError) {
    const { error: rollbackError } = await client
      .from("book_volumes")
      .delete()
      .eq("id", volume.id);
    const chapterErrorMessage =
      chapterError.code === "42501" || /row-level security/i.test(chapterError.message)
        ? "A política de segurança do Supabase bloqueou a inclusão dos capítulos. Aplique a migração supabase/migrations/20261115120000_allow_volume_chapter_insert.sql no projeto Supabase."
        : chapterError.message;
    throw new Error(
      `O volume foi criado, mas os capítulos não puderam ser salvos: ${chapterErrorMessage}${
        rollbackError
          ? ` Também não foi possível desfazer o volume: ${rollbackError.message}`
          : ""
      }`,
    );
  }
}

export async function deleteVolume(volumeId: string): Promise<void> {
  const client = await getSupabaseClient();
  const { count, error: chaptersError } = await client
    .from("volume_chapters")
    .select("book_id", { count: "exact", head: true })
    .eq("volume_id", volumeId);
  if (chaptersError) throw volumeSchemaError(chaptersError.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      "Exclua primeiro as obras dos capítulos. Depois, você poderá excluir o volume.",
    );
  }

  const { error } = await client
    .from("book_volumes")
    .delete()
    .eq("id", volumeId)
    .select("id")
    .single();
  if (error) throw volumeSchemaError(error.message);
}

export async function updateVolumeAuthor(
  volumeId: string,
  author: string,
): Promise<string> {
  const normalizedAuthor = author.trim();
  if (normalizedAuthor.length > 160) {
    throw new Error("O nome do autor deve ter no máximo 160 caracteres.");
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("book_volumes")
    .update({ author: normalizedAuthor })
    .eq("id", volumeId)
    .select("author")
    .single();

  if (error) throw volumeSchemaError(error.message);
  return data.author;
}

export async function getVolumeProgress(
  volumeId: string,
): Promise<VolumeProgress> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("volume_reading_progress")
    .select("chapter_number, progress")
    .eq("volume_id", volumeId)
    .maybeSingle();

  if (error) throw volumeSchemaError(error.message);
  return {
    chapterNumber: data?.chapter_number ?? 1,
    progress: data?.progress ?? 0,
  };
}

export async function saveVolumeProgress(
  volumeId: string,
  chapterNumber: number,
  progress: number,
): Promise<void> {
  const client = await getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(`Não foi possível identificar sua sessão: ${userError.message}`);
  }
  if (!userData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar o progresso.");
  }

  const { error } = await client.from("volume_reading_progress").upsert(
    {
      volume_id: volumeId,
      user_id: userData.user.id,
      chapter_number: chapterNumber,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "volume_id" },
  );
  if (error) {
    throw new Error(`Não foi possível salvar o progresso do volume: ${error.message}`);
  }
}
