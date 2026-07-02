"use client";

import { useRouter } from "next/navigation";

export function StoreSwitcher({
  stores,
  currentId,
}: {
  stores: { id: string; name: string; city: string | null }[];
  currentId: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Store
      <select
        value={currentId}
        onChange={(e) => router.push(`/stores/${e.target.value}`)}
        className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.city ? ` — ${s.city}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
