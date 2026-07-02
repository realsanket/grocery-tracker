"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Card, Money, Table, Td, Th } from "@/components/ui/primitives";
import { CheckIcon, PencilIcon, UploadIcon, XIcon } from "@/components/ui/icons";
import { compressReceiptImage } from "@/lib/utils/compress-image";
import { formatDate, formatPrice } from "@/lib/utils/format";
import type { ReceiptExtractionResult } from "@/lib/ai/types";

/* ---------- local draft state (numbers kept as strings while editing) ---------- */

interface DraftItem {
  raw_name_original: string;
  raw_name_english: string;
  canonical_name_en: string;
  brand: string;
  category_en: string;
  quantity: string;
  size_value: string;
  size_unit: string;
  weight_value: string;
  weight_unit: string;
  unit_price: string;
  price_per_kg: string;
  line_total: string;
  is_weighted: boolean;
  confidence: number | null;
}

interface Draft {
  storeName: string;
  storeCity: string;
  purchaseDate: string;
  currency: string;
  items: DraftItem[];
}

function toDraft(result: ReceiptExtractionResult): Draft {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    storeName: result.store.name,
    storeCity: s(result.store.city),
    purchaseDate: s(result.purchase_date),
    currency: result.currency || "EUR",
    items: result.items.map((i) => ({
      raw_name_original: i.raw_name_original,
      raw_name_english: s(i.raw_name_english),
      canonical_name_en: i.canonical_name_en,
      brand: s(i.brand),
      category_en: s(i.category_en),
      quantity: s(i.quantity ?? 1),
      size_value: s(i.size_value),
      size_unit: s(i.size_unit),
      weight_value: s(i.weight_value),
      weight_unit: s(i.weight_unit),
      unit_price: s(i.unit_price),
      price_per_kg: s(i.price_per_kg),
      line_total: s(i.line_total),
      is_weighted: i.is_weighted ?? false,
      confidence: i.confidence ?? null,
    })),
  };
}

function fromDraft(draft: Draft): ReceiptExtractionResult {
  const num = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    store: {
      name: draft.storeName.trim(),
      city: str(draft.storeCity),
      country: "Finland",
    },
    purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate)
      ? draft.purchaseDate
      : null,
    currency: draft.currency.trim() || "EUR",
    items: draft.items.map((i) => ({
      raw_name_original: i.raw_name_original.trim() || i.canonical_name_en.trim(),
      raw_name_english: str(i.raw_name_english),
      canonical_name_en: i.canonical_name_en.trim(),
      brand: str(i.brand),
      category_en: str(i.category_en),
      quantity: num(i.quantity) ?? 1,
      size_value: num(i.size_value),
      size_unit: str(i.size_unit),
      weight_value: num(i.weight_value),
      weight_unit: str(i.weight_unit),
      unit_price: num(i.unit_price),
      price_per_kg: num(i.price_per_kg),
      price_per_l: null,
      line_total: num(i.line_total) ?? 0,
      is_weighted: i.is_weighted,
      confidence: i.confidence,
    })),
  };
}

const EMPTY_ITEM: DraftItem = {
  raw_name_original: "",
  raw_name_english: "",
  canonical_name_en: "",
  brand: "",
  category_en: "",
  quantity: "1",
  size_value: "",
  size_unit: "",
  weight_value: "",
  weight_unit: "",
  unit_price: "",
  price_per_kg: "",
  line_total: "",
  is_weighted: false,
  confidence: null,
};

/* ---------- component ---------- */

interface CommitItem {
  rawNameOriginal: string;
  canonicalNameEn: string;
  productId: string;
  matchedBy: "normalized_key" | "alias" | "created";
  lineTotal: number;
  isWeighted: boolean;
}

interface CommitResponse {
  success: boolean;
  error?: string;
  store?: string;
  observedDate?: string | null;
  currency?: string;
  itemsInserted?: number;
  productsCreated?: number;
  productsMatched?: number;
  items?: CommitItem[];
}

type UploadState =
  | { phase: "idle" }
  | { phase: "extracting"; filename: string }
  | { phase: "review"; draft: Draft; filename: string }
  | { phase: "saving"; draft: Draft; filename: string }
  | { phase: "done"; result: CommitResponse }
  | { phase: "error"; message: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1 block text-xs font-medium text-ink-soft";

export function ReceiptUploader() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setState({ phase: "error", message: "Use a JPG, PNG or WEBP image." });
      return;
    }
    setState({ phase: "extracting", filename: file.name });
    try {
      const compressed = await compressReceiptImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/receipts/extract", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setState({
          phase: "error",
          message: data?.error ?? `Extraction failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({
        phase: "review",
        draft: toDraft(data.draft as ReceiptExtractionResult),
        filename: file.name,
      });
    } catch {
      setState({ phase: "error", message: "Upload failed — check your connection." });
    }
  }, []);

  const save = useCallback(async (draft: Draft, filename: string) => {
    setState({ phase: "saving", draft, filename });
    try {
      const res = await fetch("/api/receipts/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction: fromDraft(draft), sourceFilename: filename }),
      });
      const data: CommitResponse = await res.json().catch(() => ({
        success: false,
        error: "Unexpected server response.",
      }));
      if (!res.ok || !data.success) {
        setState({ phase: "review", draft, filename });
        alert(data.error ?? "Saving failed — check the highlighted fields.");
        return;
      }
      setState({ phase: "done", result: data });
    } catch {
      setState({ phase: "review", draft, filename });
      alert("Network error while saving — try again.");
    }
  }, []);

  /* ---------- dropzone ---------- */

  if (state.phase === "idle" || state.phase === "extracting" || state.phase === "error") {
    return (
      <div className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) processFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors duration-150 ${
            dragOver
              ? "border-primary bg-emerald-50/50"
              : "border-line bg-surface hover:border-primary/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />
          {state.phase === "extracting" ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
              <p className="mt-4 font-medium">Reading {state.filename}…</p>
              <p className="mt-1 text-sm text-ink-faint">
                AI is extracting the products — this can take up to a minute. You can
                review and edit everything before it is saved.
              </p>
            </>
          ) : (
            <>
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary">
                <UploadIcon size={20} />
              </span>
              <p className="font-medium">Drop a receipt photo here, or click to choose</p>
              <p className="mt-1 text-sm text-ink-faint">
                JPG, PNG or WEBP. The image is processed in memory and never stored.
              </p>
            </>
          )}
        </div>

        {state.phase === "error" && (
          <Card className="border-red-200 bg-red-50/50 p-4">
            <p className="text-sm font-medium text-danger">Extraction failed</p>
            <p className="mt-1 text-sm text-red-600">{state.message}</p>
            <button
              onClick={() => setState({ phase: "idle" })}
              className="mt-3 cursor-pointer rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-danger hover:bg-red-50"
            >
              Try again
            </button>
          </Card>
        )}
      </div>
    );
  }

  /* ---------- review & edit ---------- */

  if (state.phase === "review" || state.phase === "saving") {
    const { draft, filename } = state;
    const saving = state.phase === "saving";
    const update = (patch: Partial<Draft>) =>
      setState({ phase: "review", draft: { ...draft, ...patch }, filename });
    const updateItem = (idx: number, patch: Partial<DraftItem>) =>
      update({
        items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      });

    const valid =
      draft.storeName.trim() !== "" &&
      draft.items.length > 0 &&
      draft.items.every(
        (i) => i.canonical_name_en.trim() !== "" && parseFloat(i.line_total) > 0,
      );

    return (
      <div className="space-y-5">
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <PencilIcon size={15} /> Review before saving
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Nothing is stored yet. Fix anything the AI misread, remove lines that are
            not products, then save.
          </p>
        </Card>

        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className={labelCls}>Store name</label>
              <input
                className={inputCls}
                value={draft.storeName}
                onChange={(e) => update({ storeName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input
                className={inputCls}
                value={draft.storeCity}
                onChange={(e) => update({ storeCity: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Purchase date</label>
              <input
                type="date"
                className={inputCls}
                value={draft.purchaseDate}
                onChange={(e) => update({ purchaseDate: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <ul className="space-y-3">
          {draft.items.map((item, idx) => (
            <li key={idx}>
              <Card className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink-faint">
                      {item.raw_name_original || "manual line"}
                      {item.confidence != null &&
                        ` · ${Math.round(item.confidence * 100)}% confident`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      update({ items: draft.items.filter((_, i) => i !== idx) })
                    }
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors duration-150 hover:bg-red-50 hover:text-danger"
                    aria-label={`Remove ${item.canonical_name_en || "item"}`}
                  >
                    <XIcon size={13} /> Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Product name (English)</label>
                    <input
                      className={inputCls}
                      value={item.canonical_name_en}
                      onChange={(e) => updateItem(idx, { canonical_name_en: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Brand</label>
                    <input
                      className={inputCls}
                      value={item.brand}
                      onChange={(e) => updateItem(idx, { brand: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <input
                      className={inputCls}
                      value={item.category_en}
                      onChange={(e) => updateItem(idx, { category_en: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Line total (€)</label>
                    <input
                      inputMode="decimal"
                      className={inputCls}
                      value={item.line_total}
                      onChange={(e) => updateItem(idx, { line_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Quantity</label>
                    <input
                      inputMode="decimal"
                      className={inputCls}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    />
                  </div>

                  {item.is_weighted ? (
                    <>
                      <div>
                        <label className={labelCls}>Weight</label>
                        <div className="flex gap-1.5">
                          <input
                            inputMode="decimal"
                            className={inputCls}
                            value={item.weight_value}
                            onChange={(e) =>
                              updateItem(idx, { weight_value: e.target.value })
                            }
                          />
                          <input
                            className={`${inputCls} w-16`}
                            value={item.weight_unit}
                            placeholder="kg"
                            onChange={(e) =>
                              updateItem(idx, { weight_unit: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Price per kg (€)</label>
                        <input
                          inputMode="decimal"
                          className={inputCls}
                          value={item.price_per_kg}
                          onChange={(e) =>
                            updateItem(idx, { price_per_kg: e.target.value })
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>Pack size</label>
                        <div className="flex gap-1.5">
                          <input
                            inputMode="decimal"
                            className={inputCls}
                            value={item.size_value}
                            onChange={(e) =>
                              updateItem(idx, { size_value: e.target.value })
                            }
                          />
                          <input
                            className={`${inputCls} w-16`}
                            value={item.size_unit}
                            placeholder="g / l"
                            onChange={(e) => updateItem(idx, { size_unit: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Unit price (€)</label>
                        <input
                          inputMode="decimal"
                          className={inputCls}
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, { unit_price: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
                    <input
                      id={`weighted-${idx}`}
                      type="checkbox"
                      checked={item.is_weighted}
                      onChange={(e) => updateItem(idx, { is_weighted: e.target.checked })}
                      className="h-4 w-4 cursor-pointer accent-emerald-600"
                    />
                    <label
                      htmlFor={`weighted-${idx}`}
                      className="cursor-pointer text-sm text-ink-soft"
                    >
                      Sold by weight (loose produce — compared per kg)
                    </label>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => update({ items: [...draft.items, { ...EMPTY_ITEM }] })}
            className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-muted"
          >
            + Add item
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setState({ phase: "idle" })}
              disabled={saving}
              className="cursor-pointer rounded-lg px-4 py-2 text-sm text-ink-soft hover:text-foreground disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={() => save(draft, filename)}
              disabled={!valid || saving}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-strong disabled:cursor-default disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckIcon size={15} /> Save {draft.items.length} item
                  {draft.items.length === 1 ? "" : "s"}
                </>
              )}
            </button>
          </div>
        </div>
        {!valid && (
          <p className="text-xs text-ink-faint">
            Every item needs an English product name and a line total above zero.
          </p>
        )}
      </div>
    );
  }

  /* ---------- done ---------- */

  const { result } = state;
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/50 p-4">
        <p className="flex items-center gap-2 font-medium text-emerald-800">
          <CheckIcon size={16} /> Saved — {result.itemsInserted} item
          {result.itemsInserted === 1 ? "" : "s"} added
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          {result.store}
          {result.observedDate ? ` · ${formatDate(result.observedDate)}` : ""} ·{" "}
          {result.productsMatched} matched existing product
          {result.productsMatched === 1 ? "" : "s"}, {result.productsCreated} new
        </p>
      </Card>

      {result.items && (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Receipt line</Th>
                <Th>Product</Th>
                <Th>Match</Th>
                <Th className="text-right">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item, i) => (
                <tr key={i}>
                  <Td className="font-mono text-xs text-ink-soft">
                    {item.rawNameOriginal}
                  </Td>
                  <Td>
                    <Link
                      href={`/products/${item.productId}`}
                      className="cursor-pointer font-medium text-foreground hover:underline"
                    >
                      {item.canonicalNameEn}
                    </Link>
                    {item.isWeighted && (
                      <span className="ml-2">
                        <Badge tone="amber">per kg</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    {item.matchedBy === "created" ? (
                      <Badge tone="blue">new product</Badge>
                    ) : (
                      <Badge tone="green">
                        matched{item.matchedBy === "alias" ? " via alias" : ""}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Money className="font-medium">
                      {formatPrice(item.lineTotal, result.currency)}
                    </Money>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <button
        onClick={() => setState({ phase: "idle" })}
        className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-muted"
      >
        Upload another receipt
      </button>
    </div>
  );
}
