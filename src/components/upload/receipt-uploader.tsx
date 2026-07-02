"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Card, Table, Td, Th } from "@/components/ui/primitives";
import { compressReceiptImage } from "@/lib/utils/compress-image";
import { formatDate, formatPrice } from "@/lib/utils/format";

interface ExtractResponseItem {
  rawNameOriginal: string;
  canonicalNameEn: string;
  normalizedKey: string;
  productId: string;
  matchedBy: "normalized_key" | "alias" | "created";
  lineTotal: number;
  isWeighted: boolean;
  confidence: number | null;
}

interface ExtractResponse {
  success: boolean;
  error?: string;
  store?: string;
  storeId?: string;
  observedDate?: string | null;
  currency?: string;
  itemsInserted?: number;
  productsCreated?: number;
  productsMatched?: number;
  items?: ExtractResponseItem[];
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string }
  | { phase: "done"; result: ExtractResponse }
  | { phase: "error"; message: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ReceiptUploader() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setState({ phase: "error", message: "Use a JPG, PNG or WEBP image." });
      return;
    }
    setState({ phase: "uploading", filename: file.name });
    try {
      const compressed = await compressReceiptImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/receipts/extract", { method: "POST", body: form });
      const data: ExtractResponse = await res.json().catch(() => ({
        success: false,
        error: "Unexpected server response.",
      }));
      if (!res.ok || !data.success) {
        setState({
          phase: "error",
          message: data.error ?? `Extraction failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({ phase: "done", result: data });
    } catch {
      setState({ phase: "error", message: "Upload failed — check your connection." });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-50/50"
            : "border-stone-300 bg-white hover:border-stone-400"
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
        {state.phase === "uploading" ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-emerald-600" />
            <p className="mt-4 font-medium text-stone-700">
              Extracting products from {state.filename}…
            </p>
            <p className="mt-1 text-sm text-stone-400">
              Reading the receipt with AI — this can take up to a minute.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-stone-700">
              Drop a receipt photo here, or click to choose a file
            </p>
            <p className="mt-1 text-sm text-stone-400">
              JPG, PNG or WEBP. The image is processed in memory and never stored.
            </p>
          </>
        )}
      </div>

      {state.phase === "error" && (
        <Card className="border-red-200 bg-red-50/50 p-4">
          <p className="text-sm font-medium text-red-700">Extraction failed</p>
          <p className="mt-1 text-sm text-red-600">{state.message}</p>
        </Card>
      )}

      {state.phase === "done" && state.result.items && (
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50/40 p-4">
            <p className="font-medium text-emerald-800">
              Receipt processed — {state.result.itemsInserted} item
              {state.result.itemsInserted === 1 ? "" : "s"} saved
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {state.result.store}
              {state.result.observedDate
                ? ` · ${formatDate(state.result.observedDate)}`
                : ""}{" "}
              · {state.result.productsMatched} matched existing product
              {state.result.productsMatched === 1 ? "" : "s"},{" "}
              {state.result.productsCreated} new
            </p>
          </Card>

          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Receipt line</Th>
                  <Th>Product</Th>
                  <Th>Match</Th>
                  <Th className="text-right">Line total</Th>
                  <Th className="text-right">Confidence</Th>
                </tr>
              </thead>
              <tbody>
                {state.result.items.map((item, i) => (
                  <tr key={i}>
                    <Td className="font-mono text-xs text-stone-500">
                      {item.rawNameOriginal}
                    </Td>
                    <Td>
                      <Link
                        href={`/products/${item.productId}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {item.canonicalNameEn}
                      </Link>
                      {item.isWeighted && (
                        <span className="ml-2">
                          <Badge tone="amber">by weight</Badge>
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
                    <Td className="text-right font-medium">
                      {formatPrice(item.lineTotal, state.result.currency)}
                    </Td>
                    <Td className="text-right text-stone-400">
                      {item.confidence != null
                        ? `${Math.round(item.confidence * 100)}%`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <button
            onClick={() => setState({ phase: "idle" })}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Upload another receipt
          </button>
        </div>
      )}
    </div>
  );
}
