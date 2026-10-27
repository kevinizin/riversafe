const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
}

/** Valor em centavos para o campo de texto do painel: 1290 -> "12,90". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Converte o que a pessoa digitou ("12,90", "12.90", "1.234,56", "R$ 15")
 * em centavos. Retorna null quando não é um valor válido.
 */
export function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatWhatsapp(digits: string): string {
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digits;
}
