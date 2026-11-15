export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          author: string;
          description: string | null;
          cover_url: string | null;
          file_path: string;
          file_type:
            | "pdf"
            | "epub"
            | "cbr"
            | "cbz"
            | "PDF"
            | "EPUB"
            | "CBR"
            | "CBZ";
          file_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          author: string;
          description?: string | null;
          cover_url?: string | null;
          file_path: string;
          file_type: "pdf" | "epub" | "cbr" | "cbz";
          file_size: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      reading_progress: {
        Row: {
          book_id: string;
          user_id: string;
          progress: number;
          last_read_at: string | null;
        };
        Insert: {
          book_id: string;
          user_id: string;
          progress: number;
          last_read_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["reading_progress"]["Insert"]
        >;
        Relationships: [];
      };
      local_reading_progress: {
        Row: {
          user_id: string;
          local_book_id: string;
          progress: number;
          last_read_at: string;
        };
        Insert: {
          user_id: string;
          local_book_id: string;
          progress: number;
          last_read_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["local_reading_progress"]["Insert"]
        >;
        Relationships: [];
      };
      user_storage: {
        Row: {
          user_id: string;
          used_bytes: number;
          max_bytes: number;
        };
        Insert: {
          user_id: string;
          used_bytes: number;
          max_bytes: number;
        };
        Update: Partial<Database["public"]["Tables"]["user_storage"]["Insert"]>;
        Relationships: [];
      };
      book_volumes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          author: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          author: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["book_volumes"]["Insert"]>;
        Relationships: [];
      };
      volume_chapters: {
        Row: {
          volume_id: string;
          book_id: string;
          chapter_number: number;
          title: string;
          created_at: string;
        };
        Insert: {
          volume_id: string;
          book_id: string;
          chapter_number: number;
          title: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["volume_chapters"]["Insert"]>;
        Relationships: [];
      };
      volume_reading_progress: {
        Row: {
          volume_id: string;
          user_id: string;
          chapter_number: number;
          progress: number;
          last_read_at: string | null;
        };
        Insert: {
          volume_id: string;
          user_id: string;
          chapter_number: number;
          progress: number;
          last_read_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["volume_reading_progress"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Book = Database["public"]["Tables"]["books"]["Row"];
export type BookFileType = "pdf" | "epub" | "cbr" | "cbz";
export type ReadingProgress =
  Database["public"]["Tables"]["reading_progress"]["Row"];
export type LocalReadingProgress =
  Database["public"]["Tables"]["local_reading_progress"]["Row"];
export type UserStorage = Database["public"]["Tables"]["user_storage"]["Row"];
export type RecentRead = Book &
  Pick<ReadingProgress, "progress" | "last_read_at">;
