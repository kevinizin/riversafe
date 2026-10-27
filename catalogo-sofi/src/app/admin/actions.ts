"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changePassword as changeStoredPassword, login, logout, requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { mutateCatalog } from "@/lib/store";
import { removeImage, uploadImage, UserFacingError } from "@/lib/upload";
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

function failure(err: unknown, field = "image"): FormState {
  if (err instanceof UserFacingError) return { errors: { [field]: err.message } };
  console.error(err);
  return { message: GENERIC_ERROR };
}

function readId(formData: FormData): string | null | false {
  const raw = formData.get("id");
  if (typeof raw !== "string" || raw === "") return null;
  return uuid.safeParse(raw).success ? raw : false;
}

// ---------------------------------------------------------------------------
// Login / sessão
// ---------------------------------------------------------------------------

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemoMode) return { message: "Painel ainda não configurado neste servidor." };

  const parsed = loginSchema.safeParse(formValues(formData, ["user", "password"]));
  if (!parsed.success) return { message: "Usuário ou senha incorretos." };

  const result = await login(parsed.data.user, parsed.data.password);
  if (result === "locked") {
    return { message: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." };
  }
  // Mesma mensagem para usuário ou senha errados.
  if (result !== "ok") return { message: "Usuário ou senha incorretos." };

  redirect("/admin");
}

export async function signOut() {
  await logout();
  redirect("/admin/login");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = passwordSchema.safeParse(formValues(formData, ["current", "password", "confirm"]));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const ok = await changeStoredPassword(parsed.data.current, parsed.data.password);
  if (!ok) return { errors: { current: "Senha atual incorreta." } };
  return { ok: true, message: "Senha alterada. Os outros aparelhos precisarão entrar de novo." };
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
  await requireAdmin();

  const id = readId(formData);
  if (id === false) return { message: GENERIC_ERROR };

  const parsed = productSchema.safeParse(formValues(formData, PRODUCT_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  let newImage: string | null = null;
  try {
    newImage = await uploadImage(formData.get("image"), "produtos");
  } catch (err) {
    return failure(err);
  }
  const removeCurrent = formData.get("remove_image") === "on";

  let previousImage = null as string | null;
  let found = true as boolean;
  try {
    await mutateCatalog((doc) => {
      if (parsed.data.category_id && !doc.categories.some((c) => c.id === parsed.data.category_id)) {
        parsed.data.category_id = null;
      }
      if (id) {
        const product = doc.products.find((p) => p.id === id);
        if (!product) {
          found = false;
          return;
        }
        previousImage = product.image_path;
        Object.assign(product, parsed.data, {
          image_path: newImage ?? (removeCurrent ? null : product.image_path),
        });
      } else {
        doc.products.push({ id: crypto.randomUUID(), ...parsed.data, image_path: newImage });
      }
    });
  } catch (err) {
    await removeImage(newImage);
    return failure(err);
  }

  if (!found) {
    await removeImage(newImage);
    return { message: "Produto não encontrado." };
  }
  if (previousImage && (newImage || removeCurrent)) await removeImage(previousImage);

  refreshCatalog();
  redirect(`/admin?salvo=${encodeURIComponent(parsed.data.name)}`);
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = readId(formData);
  if (!id) return;

  const image = await mutateCatalog((doc) => {
    const index = doc.products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    const [removed] = doc.products.splice(index, 1);
    return removed.image_path;
  });
  await removeImage(image);

  refreshCatalog();
  redirect("/admin?removido=1");
}

const TOGGLES = new Set(["is_visible", "is_available", "is_featured"]);

export async function toggleProduct(formData: FormData) {
  await requireAdmin();
  const id = readId(formData);
  const field = formData.get("field");
  if (!id || typeof field !== "string" || !TOGGLES.has(field)) return;

  const value = formData.get("value") === "true";
  await mutateCatalog((doc) => {
    const product = doc.products.find((p) => p.id === id);
    if (product) product[field as "is_visible" | "is_available" | "is_featured"] = value;
  });

  refreshCatalog();
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = readId(formData);
  if (id === false) return { message: GENERIC_ERROR };

  const parsed = categorySchema.safeParse(
    formValues(formData, ["name", "sort_order", "is_active"]),
  );
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await mutateCatalog((doc) => {
      if (id) {
        const category = doc.categories.find((c) => c.id === id);
        if (category) Object.assign(category, parsed.data);
      } else {
        doc.categories.push({ id: crypto.randomUUID(), ...parsed.data });
      }
    });
  } catch (err) {
    return failure(err);
  }

  refreshCatalog();
  return { ok: true, message: id ? "Categoria atualizada." : "Categoria criada." };
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = readId(formData);
  if (!id) return;

  // Os produtos da categoria continuam existindo, só ficam "Sem categoria".
  await mutateCatalog((doc) => {
    doc.categories = doc.categories.filter((c) => c.id !== id);
    for (const p of doc.products) if (p.category_id === id) p.category_id = null;
  });
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
  await requireAdmin();

  const parsed = settingsSchema.safeParse(formValues(formData, SETTINGS_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  let newCover: string | null = null;
  let newLogo: string | null = null;
  try {
    newCover = await uploadImage(formData.get("image"), "capa");
  } catch (err) {
    return failure(err, "image");
  }
  try {
    newLogo = await uploadImage(formData.get("logo"), "logo");
  } catch (err) {
    await removeImage(newCover);
    return failure(err, "logo");
  }

  const removeCover = formData.get("remove_image") === "on";
  const removeLogo = formData.get("remove_logo") === "on";
  let previous = { cover: null as string | null, logo: null as string | null };

  try {
    await mutateCatalog((doc) => {
      const s = doc.settings;
      previous = { cover: s.cover_image_path, logo: s.logo_image_path };
      Object.assign(s, parsed.data, {
        cover_image_path: newCover ?? (removeCover ? null : s.cover_image_path),
        logo_image_path: newLogo ?? (removeLogo ? null : s.logo_image_path),
      });
    });
  } catch (err) {
    await removeImage(newCover);
    await removeImage(newLogo);
    return failure(err);
  }

  if (previous.cover && (newCover || removeCover)) await removeImage(previous.cover);
  if (previous.logo && (newLogo || removeLogo)) await removeImage(previous.logo);

  refreshCatalog();
  return { ok: true, message: "Configurações salvas." };
}
