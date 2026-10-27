import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Cliente com a sessão do admin (cookies). Usado só no painel. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado durante a renderização de um Server Component: o proxy
          // já renova a sessão, então pode ser ignorado.
        }
      },
    },
  });
}

/**
 * Cliente anônimo, sem cookies. O catálogo público sempre usa este, para que
 * um admin logado nunca veja (nem vaze em cache) produtos ocultos.
 */
export function createPublicClient() {
  return createPlainClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
