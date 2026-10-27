"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { removeImage, uploadImage, UserFacingError } from "@/lib/upload";
import { createSessionClient } from "@/lib/supabase/server";
import {
  categorySchema,
  fieldErrors,
  formValues,
  loginSchema,
  passwordSchema,
  productSchema,
  settingsSchema,
  uuid,
  type FieldErrors,
} from "@/lib/validation";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
};

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";

function refreshCatalog() {
  revalidatePath("/", "layout");
}

function failure(err: unknown): FormState {
  if (err instanceof UserFacingError) return { errors: { image: err.message } };
  console.error(err);
  return { message: GENERIC_ERROR };
}

// ---------------------------------------------------------------------------
// Login / sessão
// ---------------------------------------------------------------------------

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemoMode) {
    return { message: "Painel desativado no modo demonstração. Configure o Supabase (veja o README)." };
  }

  const parsed = loginSchema.safeParse(formValues(formData, ["email", "password"]));
  if (!parsed.success) return { message: "E-mail ou senha incorretos." };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mesma mensagem para qualquer falha: não revela se o e-mail existe.
  if (error || !data.user) return { message: "E-mail ou senha incorretos." };

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { message: "Esta conta não tem acesso ao painel." };
  }

  redirect("/admin");
}

export async function signOut() {
  if (!isDemoMode) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const parsed = passwordSchema.safeParse(formValues(formData, ["password", "confirm"]));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: "Não foi possível trocar a senha. Tente outra senha." };
  return { ok: true, message: "Senha alterada." };
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

const PRODUCT_FIELDS = [
  "name",
  "category_id",
  "description",
  "price_cents",
  "compare_at_cents",
  "serving",
  "tags",
  "sort_order",
  "is_visible",
  "is_available",
  "is_featured",
] as const;

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id && !uuid.safeParse(id).success) return { message: GENERIC_ERROR };

  const parsed = productSchema.safeParse(formValues(formData, PRODUCT_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  let previousImage: string | null = null;
  if (id) {
    const { data: current } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { message: "Produto não encontrado." };
    previousImage = current.image_path;
  }

  let newImage: string | null = null;
  try {
    newImage = await uploadImage(supabase, formData.get("image"), "produtos");
  } catch (err) {
    return failure(err);
  }

  const removeCurrent = formData.get("remove_image") === "on";
  const image_path = newImage ?? (removeCurrent ? null : previousImage);
  const row = { ...parsed.data, image_path };

  const { error } = id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert(row);

  if (error) {
    await removeImage(supabase, newImage);
    return failure(error);
  }
  if (previousImage && previousImage !== image_path) {
    await removeImage(supabase, previousImage);
  }

  refreshCatalog();
  redirect(`/admin?salvo=${encodeURIComponent(parsed.data.name)}`);
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;

  const { data } = await supabase
    .from("products")
    .delete()
    .eq("id", id.data)
    .select("image_path")
    .maybeSingle();
  await removeImage(supabase, data?.image_path);

  refreshCatalog();
  redirect("/admin?removido=1");
}

const TOGGLES = new Set(["is_visible", "is_available", "is_featured"]);

export async function toggleProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const field = formData.get("field");
  if (!id.success || typeof field !== "string" || !TOGGLES.has(field)) return;

  const value = formData.get("value") === "true";
  await supabase
    .from("products")
    .update({ [field]: value })
    .eq("id", id.data);

  refreshCatalog();
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id && !uuid.safeParse(id).success) return { message: GENERIC_ERROR };

  const parsed = categorySchema.safeParse(
    formValues(formData, ["name", "sort_order", "is_active"]),
  );
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data);
  if (error) return failure(error);

  refreshCatalog();
  return { ok: true, message: id ? "Categoria atualizada." : "Categoria criada." };
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;

  // Os produtos da categoria continuam existindo, só ficam "Sem categoria".
  await supabase.from("categories").delete().eq("id", id.data);
  refreshCatalog();
}

// ---------------------------------------------------------------------------
// Configurações da loja
// ---------------------------------------------------------------------------

const SETTINGS_FIELDS = [
  "name",
  "tagline",
  "whatsapp",
  "instagram",
  "address",
  "hours_text",
  "accepting_orders",
  "delivery_enabled",
  "pickup_enabled",
  "delivery_fee_cents",
  "min_order_cents",
] as const;

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const parsed = settingsSchema.safeParse(formValues(formData, SETTINGS_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { data: current } = await supabase
    .from("store_settings")
    .select("cover_image_path, logo_image_path")
    .eq("id", 1)
    .single();
  const previousCover: string | null = current?.cover_image_path ?? null;
  const previousLogo: string | null = current?.logo_image_path ?? null;

  let newCover: string | null = null;
  let newLogo: string | null = null;
  try {
    newCover = await uploadImage(supabase, formData.get("image"), "capa");
    newLogo = await uploadImage(supabase, formData.get("logo"), "logo");
  } catch (err) {
    await removeImage(supabase, newCover);
    if (err instanceof UserFacingError && newCover) return { errors: { logo: err.message } };
    return failure(err);
  }

  const cover_image_path =
    newCover ?? (formData.get("remove_image") === "on" ? null : previousCover);
  const logo_image_path = newLogo ?? (formData.get("remove_logo") === "on" ? null : previousLogo);

  const { error } = await supabase
    .from("store_settings")
    .update({ ...parsed.data, cover_image_path, logo_image_path })
    .eq("id", 1);
  if (error) {
    await removeImage(supabase, newCover);
    await removeImage(supabase, newLogo);
    return failure(error);
  }
  if (previousCover && previousCover !== cover_image_path) {
    await removeImage(supabase, previousCover);
  }
  if (previousLogo && previousLogo !== logo_image_path) {
    await removeImage(supabase, previousLogo);
  }

  refreshCatalog();
  return { ok: true, message: "Configurações salvas." };
}
