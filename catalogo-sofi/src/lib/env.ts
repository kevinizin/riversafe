export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sem Supabase configurado o site mostra dados de exemplo e o painel fica desligado. */
export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

export const STORAGE_BUCKET = "catalogo";
