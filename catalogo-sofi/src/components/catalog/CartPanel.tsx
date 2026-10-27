"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  BagIcon,
  CheckIcon,
  CloseIcon,
  TrashIcon,
  WhatsappIcon,
} from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { CatalogSettings } from "@/lib/types";
import {
  buildOrderMessage,
  paymentLabel,
  whatsappLink,
  type CheckoutInfo,
  type ResolvedLine,
} from "./order";
import { Quantity } from "./Quantity";

const INFO_KEY = "azven-checkout:v1";

type Step = "bag" | "checkout" | "sent";

export function CartPanel({
  settings,
  lines,
  unavailable,
  onQty,
  onRemove,
  onClear,
  onClose,
}: {
  settings: CatalogSettings;
  lines: ResolvedLine[];
  unavailable: ResolvedLine[];
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("bag");
  const [info, setInfo] = useState<CheckoutInfo>(() => ({
    name: "",
    mode: settings.delivery_enabled ? "delivery" : "pickup",
    address: "",
    payment: "pix",
    changeFor: "",
    notes: "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutInfo, string>>>({});

  // Lembra nome e endereço do cliente neste aparelho (só no navegador dele).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(INFO_KEY) ?? "null");
      if (saved && typeof saved === "object") {
        setInfo((i) => ({
          ...i,
          name: typeof saved.name === "string" ? saved.name.slice(0, 80) : i.name,
          address: typeof saved.address === "string" ? saved.address.slice(0, 200) : i.address,
        }));
      }
    } catch {
      // ignora
    }
  }, []);

  const subtotal = lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  const fee = info.mode === "delivery" ? settings.delivery_fee_cents : 0;
  const total = subtotal + fee;
  const belowMinimum = settings.min_order_cents > 0 && subtotal < settings.min_order_cents;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const set = <K extends keyof CheckoutInfo>(key: K, value: CheckoutInfo[K]) => {
    setInfo((i) => ({ ...i, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function send() {
    const next: typeof errors = {};
    if (info.name.trim().length < 2) next.name = "Informe seu nome.";
    if (info.mode === "delivery" && info.address.trim().length < 6) {
      next.address = "Informe o endereço com número e bairro.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      window.localStorage.setItem(
        INFO_KEY,
        JSON.stringify({ name: info.name.trim(), address: info.address.trim() }),
      );
    } catch {
      // ignora
    }

    const message = buildOrderMessage({
      storeName: settings.name,
      lines,
      info,
      deliveryFee: settings.delivery_fee_cents,
    });
    window.open(whatsappLink(settings.whatsapp, message), "_blank", "noopener,noreferrer");
    setStep("sent");
  }

  const input =
    "mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] placeholder:text-muted/70 focus:border-accent focus:outline-none";

  return (
    <div className="flex h-full w-full max-w-md flex-col bg-cream shadow-lift animate-slide-in">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        {step === "checkout" ? (
          <button
            type="button"
            onClick={() => setStep("bag")}
            aria-label="Voltar para a sacola"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream-deep"
          >
            <ArrowLeftIcon />
          </button>
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-cream">
            <BagIcon width={18} height={18} />
          </span>
        )}
        <h2 className="flex-1 font-display text-2xl font-semibold">
          {step === "checkout" ? "Finalizar pedido" : step === "sent" ? "Pedido enviado" : "Sua sacola"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream-deep"
        >
          <CloseIcon />
        </button>
      </header>

      {step === "sent" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-leaf-soft text-leaf">
            <CheckIcon width={30} height={30} />
          </span>
          <p className="mt-5 font-display text-2xl font-semibold">Quase lá!</p>
          <p className="mt-2 text-ink-soft">
            Abrimos o WhatsApp com seu pedido pronto. É só tocar em <b>enviar</b> por lá — a loja
            confirma o pedido e o pagamento com você.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="h-12 rounded-full bg-ink font-semibold text-cream hover:bg-accent"
            >
              Esvaziar sacola e voltar
            </button>
            <button
              type="button"
              onClick={() => setStep("checkout")}
              className="h-12 rounded-full border border-line font-semibold hover:bg-cream-deep"
            >
              O WhatsApp não abriu? Tentar de novo
            </button>
          </div>
        </div>
      ) : lines.length === 0 && unavailable.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-cream-deep text-muted">
            <BagIcon width={28} height={28} />
          </span>
          <p className="mt-5 font-display text-2xl font-semibold">Sua sacola está vazia</p>
          <p className="mt-2 text-ink-soft">Escolha suas delícias no cardápio.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 h-12 rounded-full bg-ink px-8 font-semibold text-cream hover:bg-accent"
          >
            Ver cardápio
          </button>
        </div>
      ) : step === "bag" ? (
        <>
          <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-4 py-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
                  {l.product.image_url && (
                    <Image src={l.product.image_url} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{l.product.name}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(l.key)}
                      aria-label={`Remover ${l.product.name}`}
                      className="-mr-2 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-cream-deep hover:text-accent"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                  {l.note && <p className="mt-0.5 text-[13px] text-muted">Obs.: {l.note}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <Quantity
                      size="sm"
                      value={l.qty}
                      min={1}
                      onChange={(q) => onQty(l.key, q)}
                      label={`Quantidade de ${l.product.name}`}
                    />
                    <span className="font-semibold tabular-nums">
                      {formatPrice(l.product.price_cents * l.qty)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {unavailable.map((l) => (
              <li key={l.key} className="flex items-center gap-3 py-4 text-muted">
                <p className="flex-1 text-sm">
                  <b className="text-ink-soft">{l.product.name}</b> esgotou e não entra no pedido.
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(l.key)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-cream-deep"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>

          <footer className="border-t border-line bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-soft">
                Subtotal · {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
              <span className="text-xl font-bold tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            {belowMinimum && (
              <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-deep">
                Pedido mínimo de {formatPrice(settings.min_order_cents)}. Faltam{" "}
                {formatPrice(settings.min_order_cents - subtotal)}.
              </p>
            )}
            {!settings.accepting_orders && (
              <p className="mt-2 rounded-xl bg-cream-deep px-3 py-2 text-sm text-ink-soft">
                A loja pausou os pedidos no momento.
              </p>
            )}
            <button
              type="button"
              disabled={lines.length === 0 || belowMinimum || !settings.accepting_orders}
              onClick={() => setStep("checkout")}
              className="mt-4 h-[52px] w-full rounded-full bg-ink font-semibold text-cream transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"
            >
              Continuar
            </button>
          </footer>
        </>
      ) : (
        <>
          <form
            id="checkout"
            className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            noValidate
          >
            <label className="block">
              <span className="text-sm font-semibold">Seu nome</span>
              <input
                className={input}
                value={info.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={80}
                autoComplete="name"
                aria-invalid={!!errors.name}
              />
              {errors.name && <span className="mt-1 block text-sm text-accent">{errors.name}</span>}
            </label>

            {settings.delivery_enabled && settings.pickup_enabled && (
              <fieldset>
                <legend className="text-sm font-semibold">Como quer receber?</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["delivery", "Entrega", settings.delivery_fee_cents > 0 ? formatPrice(settings.delivery_fee_cents) : "Grátis"],
                      ["pickup", "Retirada", "Na loja"],
                    ] as const
                  ).map(([value, title, hint]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 transition ${
                        info.mode === value
                          ? "border-ink bg-white ring-1 ring-ink"
                          : "border-line bg-white/60 hover:border-ink-soft"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={value}
                        checked={info.mode === value}
                        onChange={() => set("mode", value)}
                        className="sr-only"
                      />
                      <span className="block font-semibold">{title}</span>
                      <span className="text-sm text-muted">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {info.mode === "delivery" ? (
              <label className="block">
                <span className="text-sm font-semibold">Endereço de entrega</span>
                <textarea
                  className={`${input} resize-none`}
                  rows={2}
                  value={info.address}
                  onChange={(e) => set("address", e.target.value)}
                  maxLength={200}
                  autoComplete="street-address"
                  placeholder="Rua, número, bairro e complemento"
                  aria-invalid={!!errors.address}
                />
                {errors.address && (
                  <span className="mt-1 block text-sm text-accent">{errors.address}</span>
                )}
              </label>
            ) : (
              settings.address && (
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-soft">
                  Retirada em <b className="text-ink">{settings.address}</b>
                </p>
              )
            )}

            <fieldset>
              <legend className="text-sm font-semibold">Pagamento</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["pix", "card", "cash"] as const).map((p) => (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      info.payment === p
                        ? "border-ink bg-ink text-cream"
                        : "border-line bg-white hover:border-ink-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={p}
                      checked={info.payment === p}
                      onChange={() => set("payment", p)}
                      className="sr-only"
                    />
                    {p === "card" ? "Cartão" : paymentLabel(p)}
                  </label>
                ))}
              </div>
            </fieldset>

            {info.payment === "cash" && (
              <label className="block">
                <span className="text-sm font-semibold">Troco para quanto? (opcional)</span>
                <input
                  className={input}
                  value={info.changeFor}
                  onChange={(e) => set("changeFor", e.target.value)}
                  maxLength={20}
                  inputMode="decimal"
                  placeholder="Ex.: R$ 100"
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold">Observações (opcional)</span>
              <textarea
                className={`${input} resize-none`}
                rows={2}
                value={info.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={300}
                placeholder="Horário preferido, ponto de referência…"
              />
            </label>
          </form>

          <footer className="border-t border-line bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-soft">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              {info.mode === "delivery" && (
                <div className="flex justify-between text-ink-soft">
                  <dt>Entrega</dt>
                  <dd className="tabular-nums">{fee > 0 ? formatPrice(fee) : "Grátis"}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-lg font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>
            <button
              type="submit"
              form="checkout"
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1f8f4e] font-semibold text-white transition hover:bg-[#187540]"
            >
              <WhatsappIcon />
              Enviar pedido pelo WhatsApp
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
