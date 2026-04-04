import { createClient } from "@supabase/supabase-js";

// .env.local に隠した「2つの鍵」を呼び出します
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// アプリとSupabaseを繋ぐ「専用パイプ（supabase）」を作ってエクスポート（外部公開）します
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
