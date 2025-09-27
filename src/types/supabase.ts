// Generated Supabase types placeholder.
// Replace by running (with Supabase CLI installed):
// npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/supabase.ts
// For now we define only the tables we actively use to satisfy TypeScript.

export interface Database {
  public: {
    Tables: {
      community_posts: {
        Row: { id: string; author_id: string; topic: string | null; category: string | null; content: string; likes: string[]; reply_count: number; created_at: string; updated_at: string };
        Insert: { id?: string; author_id: string; topic?: string | null; category?: string | null; content: string; likes?: string[]; reply_count?: number };
        Update: Partial<Database['public']['Tables']['community_posts']['Insert']>;
      };
      community_replies: {
        Row: { id: string; post_id: string; author_id: string; content: string; created_at: string };
        Insert: { id?: string; post_id: string; author_id: string; content: string };
        Update: Partial<Database['public']['Tables']['community_replies']['Insert']>;
      };
      community_posts_public: {
        Row: { id: string; topic: string | null; category: string | null; content: string; likes: string[]; reply_count: number; created_at: string; updated_at: string };
      };
      therapists: {
        Row: { id: string; name: string; specialty: string; email: string; phone: string | null; bio: string | null; active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; specialty: string; email: string; phone?: string | null; bio?: string | null; active?: boolean };
        Update: Partial<Database['public']['Tables']['therapists']['Insert']>;
      };
      bookings: {
        Row: { id: string; therapist_id: string; user_id: string | null; date: string; slot: string; session_type: string | null; notes: string | null; contact_email: string | null; created_at: string; meet_url?: string | null; calendar_event_id?: string | null };
        Insert: { id?: string; therapist_id: string; user_id?: string | null; date: string; slot: string; session_type?: string | null; notes?: string | null; contact_email?: string | null; meet_url?: string | null; calendar_event_id?: string | null };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
    };
    Functions: {
      toggle_post_like: { Args: { p_post_id: string }; Returns: { post_id: string; likes: string[] }[] };
      activity_heartbeat: { Args: { p_sleep_hours: number | null; p_mood: number | null }; Returns: void };
    };
  };
}

export type PublicTables = Database['public']['Tables'];
