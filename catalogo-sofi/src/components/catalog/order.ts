import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "@/lib/types";

export type CheckoutInfo = {
  name: string;
  mode: "delivery" | "pickup";
  address: string;
  payment: "pix" | "card" | "cash";
  changeFor: string;
  notes: string;
};

export type ResolvedLine = {
  key: string;
  product: CatalogProduct;
  qty: number;
  note: string;
};

const PAYMENT_LABEL: Record<CheckoutInfo["payment"], string> = {
  pix: "Pix",
  card: "Cartão na entrega/retirada",
  cash: "Dinheiro",
};

export function paymentLabel(p: CheckoutInfo["payment"]) {
  return PAYMENT_LABEL[p];
}

// Remove caracteres de formatação do WhatsApp do que o cliente digitou,
// para o texto não "quebrar" a mensagem.
const clean = (s: string) => s.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();

export function buildOrderMessage(opts: {
  storeName: string;
  lines: ResolvedLine[];
  info: CheckoutInfo;
  deliveryFee: number;
}): string {
  const { storeName, lines, info, deliveryFee } = opts;
  const subtotal = lines.reduce((sum, l) => sum + l.product.price_cents * l.qty, 0);
  const fee = info.mode === "delivery" ? deliveryFee : 0;

  const out: string[] = [`*Novo pedido — ${clean(storeName)}*`, ""];
  for (const l of lines) {
    out.push(`• ${l.qty}x ${l.product.name} — ${formatPrice(l.product.price_cents * l.qty)}`);
    if (l.note) out.push(`   Obs.: ${clean(l.note)}`);
  }
  out.push("");
  out.push(`Subtotal: ${formatPrice(subtotal)}`);
  if (info.mode === "delivery") {
    out.push(`Entrega: ${fee > 0 ? formatPrice(fee) : "grátis"}`);
  }
  out.push(`*Total: ${formatPrice(subtotal + fee)}*`);
  out.push("");
  out.push(`*Nome:* ${clean(info.name)}`);
  out.push(
    info.mode === "delivery"
      ? `*Entregar em:* ${clean(info.address)}`
      : "*Retirada na loja*",
  );
  let payment = PAYMENT_LABEL[info.payment];
  if (info.payment === "cash" && clean(info.changeFor)) {
    payment += ` (troco para ${clean(info.changeFor)})`;
  }
  out.push(`*Pagamento:* ${payment}`);
  if (clean(info.notes)) out.push(`*Observações:* ${clean(info.notes)}`);

  return out.join("\n");
}

export function whatsappLink(phoneDigits: string, message: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
