"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { XIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils/format";
import {
  ReceiptUploader,
  type UploaderPreset,
} from "./receipt-uploader";

export interface PendingRow {
  id: string;
  sourceFilename: string | null;
  sizeBytes: number;
  createdAt: string;
}

export function UploadWorkspace({ pending }: { pending: PendingRow[] }) {
  const router = useRouter();
  const [preset, setPreset] = useState<UploaderPreset | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function process(row: PendingRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/pending/${row.id}/extract`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? `Extraction failed (HTTP ${res.status}).`);
        return;
      }
      setPreset({
        draft: data.draft,
        filename: row.sourceFilename ?? "public submission",
        pendingReceiptId: row.id,
      });
    } catch {
      setError("Network error while processing — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: PendingRow) {
    if (!confirm("Reject and permanently delete this submission?")) return;
    setBusyId(row.id);
    try {
      await fetch(`/api/receipts/pending/${row.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  // While reviewing a queued submission, show only the review flow.
  if (preset) {
    return (
      <ReceiptUploader
        key={preset.pendingReceiptId}
        preset={preset}
        onExit={() => {
          setPreset(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            Pending submissions{" "}
            <span className="align-middle">
              <Badge tone="amber">{pending.length} waiting</Badge>
            </span>
          </h2>
          {error && (
            <Card className="mb-3 border-red-200 bg-red-50/50 p-3">
              <p className="text-sm text-danger">{error}</p>
            </Card>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {pending.map((row) => (
              <li key={row.id}>
                <Card className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/receipts/pending/${row.id}/image`}
                    alt={`Receipt submission ${row.sourceFilename ?? row.id}`}
                    className="h-44 w-full border-b border-line bg-muted object-cover object-top"
                    loading="lazy"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">
                      {row.sourceFilename ?? "unnamed image"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatDate(row.createdAt)} ·{" "}
                      {(row.sizeBytes / 1024).toFixed(0)} KB
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => process(row)}
                        disabled={busyId !== null}
                        className="flex-1 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-strong disabled:cursor-default disabled:opacity-50"
                      >
                        {busyId === row.id ? "Reading with AI…" : "Process"}
                      </button>
                      <button
                        onClick={() => reject(row)}
                        disabled={busyId !== null}
                        aria-label="Reject submission"
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-danger disabled:opacity-50"
                      >
                        <XIcon size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {pending.length > 0 && (
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            Upload your own receipt
          </h2>
        )}
        <ReceiptUploader />
      </section>
    </div>
  );
}
