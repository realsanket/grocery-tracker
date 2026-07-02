"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { SearchIcon, XIcon } from "@/components/ui/icons";
import type { PickerProduct } from "@/db/queries/shopping-list";

export interface Selection {
  id: string;
  qty: number;
}

function label(p: PickerProduct): string {
  const size =
    p.sizeValue && p.sizeUnit ? ` ${parseFloat(p.sizeValue)}${p.sizeUnit}` : "";
  return `${p.canonicalNameEn}${size}`;
}

function encode(selection: Selection[]): string {
  return selection.map((s) => (s.qty === 1 ? s.id : `${s.id}:${s.qty}`)).join(",");
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function ListBuilder({
  products,
  initial,
}: {
  products: PickerProduct[];
  initial: Selection[];
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection[]>(initial);
  const [query, setQuery] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedIds = useMemo(() => new Set(selection.map((s) => s.id)), [selection]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return products
      .filter(
        (p) =>
          !selectedIds.has(p.id) &&
          (norm(p.canonicalNameEn).includes(q) || norm(p.brand ?? "").includes(q)),
      )
      .slice(0, 8);
  }, [query, products, selectedIds]);

  function apply(next: Selection[]) {
    setSelection(next);
    router.replace(next.length ? `/list?items=${encode(next)}` : "/list", {
      scroll: false,
    });
  }

  function add(id: string) {
    if (selectedIds.has(id)) return;
    apply([...selection, { id, qty: 1 }]);
    setQuery("");
    inputRef.current?.focus();
  }

  function importPaste() {
    const terms = pasteText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...selection];
    const misses: string[] = [];
    for (const term of terms) {
      const q = norm(term);
      const hit = products.find(
        (p) =>
          !next.some((s) => s.id === p.id) &&
          (norm(p.canonicalNameEn).includes(q) || q.includes(norm(p.canonicalNameEn))),
      );
      if (hit) next.push({ id: hit.id, qty: 1 });
      else misses.push(term);
    }
    setUnmatched(misses);
    setPasteText("");
    setPasteOpen(false);
    apply(next);
  }

  return (
    <Card className="p-4">
      {/* typeahead */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
          <SearchIcon size={16} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              add(matches[0].id);
            }
          }}
          placeholder="Type to add a product… rice, milk, onion"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/15"
          aria-label="Search products to add to your list"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-lg">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => add(p.id)}
                  className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-sm transition-colors duration-100 hover:bg-muted"
                >
                  <span>
                    {label(p)}
                    {p.brand && (
                      <span className="ml-1.5 text-xs text-ink-faint">{p.brand}</span>
                    )}
                  </span>
                  {p.isWeighted && (
                    <span className="text-xs text-amber-700">per kg</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* paste mode */}
      <div className="mt-2">
        {pasteOpen ? (
          <div className="rounded-lg border border-line bg-muted/50 p-3">
            <label htmlFor="paste" className="mb-1 block text-xs font-medium text-ink-soft">
              One item per line (or comma-separated)
            </label>
            <textarea
              id="paste"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder={"rice\nmilk\nonion"}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={importPaste}
                disabled={!pasteText.trim()}
                className="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-strong disabled:opacity-50"
              >
                Match against tracked products
              </button>
              <button
                onClick={() => setPasteOpen(false)}
                className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-soft hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPasteOpen(true)}
            className="cursor-pointer text-sm text-primary-strong hover:underline"
          >
            …or paste your whole grocery list as text
          </button>
        )}
        {unmatched.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            No price data yet for: {unmatched.join(", ")} — these need a receipt first.
          </p>
        )}
      </div>

      {/* selected chips */}
      {selection.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {selection.map((s) => {
            const p = byId.get(s.id);
            if (!p) return null;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-full border border-line bg-muted py-1 pl-3 pr-1.5 text-sm"
              >
                <span className="font-medium">{label(p)}</span>
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <label className="sr-only" htmlFor={`qty-${s.id}`}>
                    Quantity for {p.canonicalNameEn}
                  </label>
                  <input
                    id={`qty-${s.id}`}
                    inputMode="decimal"
                    value={String(s.qty)}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value.replace(",", "."));
                      apply(
                        selection.map((x) =>
                          x.id === s.id
                            ? { ...x, qty: Number.isFinite(q) && q > 0 ? q : 1 }
                            : x,
                        ),
                      );
                    }}
                    className="w-11 rounded-md border border-line bg-white px-1.5 py-0.5 text-center text-xs outline-none focus:border-primary"
                  />
                  {p.isWeighted ? "kg" : "×"}
                </span>
                <button
                  onClick={() => apply(selection.filter((x) => x.id !== s.id))}
                  aria-label={`Remove ${p.canonicalNameEn}`}
                  className="cursor-pointer rounded-full p-1 text-ink-faint transition-colors duration-100 hover:bg-red-50 hover:text-danger"
                >
                  <XIcon size={13} />
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => apply([])}
              className="cursor-pointer rounded-full px-3 py-1.5 text-xs text-ink-faint hover:text-danger"
            >
              Clear all
            </button>
          </li>
        </ul>
      )}
    </Card>
  );
}
