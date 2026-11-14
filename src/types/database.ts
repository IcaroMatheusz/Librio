export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          author: string;
          cover_url: string | null;
          file_type: "PDF" | "EPUB" | string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          author: string;
          cover_url?: string | null;
          file_type: "PDF" | "EPUB" | string;
          file_size: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      reading_progress: {
        Row: {
          book_id: string;
          progress: number;
          last_read_at: string | null;
        };
        Insert: {
          book_id: string;
          progress: number;
          last_read_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["reading_progress"]["Insert"]
        >;
        Relationships: [];
      };
      user_storage: {
        Row: {
          used_bytes: number;
          max_bytes: number;
        };
        Insert: {
          used_bytes: number;
          max_bytes: number;
        };
        Update: Partial<Database["public"]["Tables"]["user_storage"]["Insert"]>;
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
export type ReadingProgress =
  Database["public"]["Tables"]["reading_progress"]["Row"];
export type UserStorage = Database["public"]["Tables"]["user_storage"]["Row"];
export type RecentRead = Book &
  Pick<ReadingProgress, "progress" | "last_read_at">;
