"use client";

import { MinusIcon, PlusIcon } from "@/components/icons";
import { MAX_QTY } from "./cart";

export function Quantity({
  value,
  onChange,
  min = 1,
  size = "md",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  size?: "sm" | "md";
  label: string;
}) {
  const btn =
    size === "sm"
      ? "grid h-8 w-8 place-items-center rounded-full"
      : "grid h-11 w-11 place-items-center rounded-full";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1"
    >
      <button
        type="button"
        className={`${btn} text-ink transition hover:bg-cream-deep disabled:opacity-30`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Diminuir"
      >
        <MinusIcon width={16} height={16} />
      </button>
      <span
        className={`min-w-7 text-center font-semibold tabular-nums ${size === "sm" ? "text-sm" : ""}`}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={`${btn} text-ink transition hover:bg-cream-deep disabled:opacity-30`}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QTY}
        aria-label="Aumentar"
      >
        <PlusIcon width={16} height={16} />
      </button>
    </div>
  );
}
