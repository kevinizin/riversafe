import { z } from "zod";
import { ptBR } from "zod/locales";
import { onlyDigits, parsePriceToCents } from "@/lib/format";

z.config(ptBR());

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => v.replace(/\s+/g, " "));

const optionalText = (max: number) =>
  text(max).transform((v) => (v === "" ? null : v));

const multilineText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v.replace(/\n{3,}/g, "\n\n")));

const price = z.string().transform((value, ctx) => {
  const cents = parsePriceToCents(value);
  if (cents == null) {
    ctx.addIssue({ code: "custom", message: "Informe um valor válido, ex.: 12,90" });
    return z.NEVER;
  }
  if (cents > 100_000_000) {
    ctx.addIssue({ code: "custom", message: "Valor muito alto." });
    return z.NEVER;
  }
  return cents;
});

const optionalPrice = z.string().transform((value, ctx) => {
  if (value.trim() === "") return null;
  const cents = parsePriceToCents(value);
  if (cents == null || cents > 100_000_000) {
    ctx.addIssue({ code: "custom", message: "Informe um valor válido, ex.: 15,90" });
    return z.NEVER;
  }
  return cents;
});

const checkbox = z
  .union([z.literal("on"), z.null()])
  .transform((v) => v === "on");

const sortOrder = z
  .string()
  .trim()
  .regex(/^-?\d{0,4}$/, "Use um número inteiro entre -9999 e 9999.")
  .transform((v) => (v === "" || v === "-" ? 0 : Number(v)));

export const uuid = z.uuid();

export const productSchema = z
  .object({
    name: text(100).pipe(z.string().min(1, "Dê um nome ao produto.")),
    category_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Categoria inválida.").nullable()),
    description: multilineText(600),
    price_cents: price,
    compare_at_cents: optionalPrice,
    serving: optionalText(60),
    tags: z.string().transform((v) =>
      Array.from(
        new Set(
          v
            .split(",")
            .map((t) => t.trim().replace(/\s+/g, " "))
            .filter(Boolean),
        ),
      ),
    ).pipe(
      z
        .array(z.string().max(24, "Cada etiqueta pode ter até 24 caracteres."))
        .max(6, "Use no máximo 6 etiquetas."),
    ),
    sort_order: sortOrder,
    is_visible: checkbox,
    is_available: checkbox,
    is_featured: checkbox,
  })
  .refine((d) => d.compare_at_cents == null || d.compare_at_cents > d.price_cents, {
    path: ["compare_at_cents"],
    message: "O preço \"de\" precisa ser maior que o preço atual.",
  });

export const categorySchema = z.object({
  name: text(60).pipe(z.string().min(1, "Dê um nome à categoria.")),
  sort_order: sortOrder,
  is_active: checkbox,
});

export const settingsSchema = z
  .object({
    name: text(80).pipe(z.string().min(1, "Informe o nome da loja.")),
    tagline: optionalText(160),
    whatsapp: z
      .string()
      .transform(onlyDigits)
      .pipe(
        z
          .string()
          .regex(/^\d{12,13}$/, "Use DDI + DDD + número, ex.: 55 11 98765-4321."),
      ),
    instagram: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ""))
      .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, "Use só o nome de usuário, ex.: minhaloja"))
      .transform((v) => (v === "" ? null : v)),
    address: optionalText(200),
    hours_text: optionalText(200),
    accepting_orders: checkbox,
    delivery_enabled: checkbox,
    pickup_enabled: checkbox,
    delivery_fee_cents: price,
    min_order_cents: price,
  })
  .refine((d) => d.delivery_enabled || d.pickup_enabled, {
    path: ["pickup_enabled"],
    message: "Deixe pelo menos entrega ou retirada ativada.",
  });

export const loginSchema = z.object({
  user: z.string().trim().min(1, "Informe o usuário.").max(60),
  password: z.string().min(1, "Informe a senha.").max(128),
});

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual.").max(128),
    password: z
      .string()
      .min(10, "A senha precisa ter pelo menos 10 caracteres.")
      .max(128)
      .regex(/[a-zA-Z]/, "Inclua letras.")
      .regex(/\d/, "Inclua pelo menos um número."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem.",
  });

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Lê os campos do FormData como string (checkbox ausente vira null). */
export function formValues(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(
    keys.map((k) => {
      const v = formData.get(k);
      return [k, typeof v === "string" ? v : null];
    }),
  );
}
