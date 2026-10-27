import "server-only";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Confere no servidor do Supabase se há um usuário logado E se ele está na
 * tabela de admins. Toda página e toda ação do painel passa por aqui — o
 * proxy só faz um redirecionamento rápido, não é a barreira de segurança.
 * (A barreira final são as policies RLS no banco.)
 */
export async function requireAdmin() {
  if (isDemoMode) redirect("/admin/login");

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Logado, mas não é admin (ex.: conta criada por engano).
  if (!admin) redirect("/admin/login?erro=acesso");

  return { supabase, user };
}
