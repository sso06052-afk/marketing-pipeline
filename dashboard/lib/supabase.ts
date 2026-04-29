import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Artist = {
  melon_artist_id: string;
  genie_artist_id: string | null;
  source: string;
  name: string;
  genre: string | null;
  agency: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  instagram_source: string | null;
  confidence_score: number | null;
  needs_review: boolean;
  email: string | null;
  email_source: string | null;
  contacted: boolean;
  contacted_date: string | null;
  contact_count: number;
  contact_method: string | null;
  reply_received: boolean;
  reply_date: string | null;
  not_found_reason: string | null;
  reply_result: '긍정' | '거절' | '보류' | null;
  memo: string | null;
  followup_date: string | null;
  deal_status: '진행중' | '완료' | null;
  deal_count: number;
  created_at: string;
};

export type Song = {
  melon_song_id: string;
  melon_artist_id: string;
  title: string;
  album: string | null;
  release_date: string | null;
};
