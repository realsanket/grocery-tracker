"use client";

import { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { CheckIcon, UploadIcon } from "@/components/ui/icons";
import { compressReceiptImage } from "@/lib/utils/compress-image";

type SubmitState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string }
  | { phase: "done" }
  | { phase: "error"; message: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function PublicSubmitter() {
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setState({ phase: "error", message: "Use a JPG, PNG or WEBP photo of a receipt." });
      return;
    }
    setState({ phase: "uploading", filename: file.name });
    try {
      const compressed = await compressReceiptImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/receipts/submit", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setState({
          phase: "error",
          message: data?.error ?? `Submission failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({ phase: "done" });
    } catch {
      setState({ phase: "error", message: "Upload failed — check your connection." });
    }
  }, []);

  if (state.phase === "done") {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <p className="flex items-center justify-center gap-2 font-medium text-emerald-800">
          <CheckIcon size={17} /> Receipt submitted — thank you!
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-700">
          It is now waiting for review. Once approved, its prices appear in the
          comparisons and the photo itself is deleted.
        </p>
        <button
          onClick={() => setState({ phase: "idle" })}
          className="mt-4 cursor-pointer rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
        >
          Submit another receipt
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
          if (file) submit(file);
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
            if (file) submit(file);
            e.target.value = "";
          }}
        />
        {state.phase === "uploading" ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
            <p className="mt-4 font-medium">Submitting {state.filename}…</p>
          </>
        ) : (
          <>
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary">
              <UploadIcon size={20} />
            </span>
            <p className="font-medium">Drop a receipt photo here, or click to choose</p>
            <p className="mt-1 text-sm text-ink-faint">
              JPG, PNG or WEBP only. No account needed.
            </p>
          </>
        )}
      </div>

      {state.phase === "error" && (
        <Card className="border-red-200 bg-red-50/50 p-4">
          <p className="text-sm text-danger">{state.message}</p>
        </Card>
      )}
    </div>
  );
}
