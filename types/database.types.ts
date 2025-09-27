// Minimal Supabase Database type for the tables we touch
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          user_id: string;
          username: string | null;
          display_name: string | null;
          email_verification_token: string | null;
          email_verification_token_expires_at: string | null;
        };
        Insert: {
          user_id: string;
          username?: string | null;
          display_name?: string | null;
          email_verification_token?: string | null;
          email_verification_token_expires_at?: string | null;
        };
        Update: {
          username?: string | null;
          display_name?: string | null;
          email_verification_token?: string | null;
          email_verification_token_expires_at?: string | null;
        };
      };
    };
  };
}
