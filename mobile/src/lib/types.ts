export type Book = {
  id: string; user_id: string; title: string; author: string; description: string | null;
  cover_url: string | null; file_path: string; file_type: string; file_size: number; created_at: string;
};

export const supportedFormats = ['pdf', 'epub', 'cbr', 'cbz'] as const;
export type ReadingFormat = (typeof supportedFormats)[number];
export type LocalBook = { uri: string; name: string; size: number; format: ReadingFormat; sourceUri?: string };

export function getReadingFormat(value: string | undefined) {
  return supportedFormats.find((format) => format === value?.toLowerCase());
}
