import Link from "next/link";
import { Badge, Money } from "@/components/ui/primitives";
import { CheckIcon } from "@/components/ui/icons";
import { formatDate, formatEffectivePrice } from "@/lib/utils/format";
import type { StorePriceRow } from "@/db/queries/products";

/**
 * Side-by-side store comparison: one horizontal bar per store, width
 * proportional to price, cheapest highlighted. Single measure → single hue;
 * values are direct-labeled so the bars never rely on color alone.
 */
export function PriceCompareBars({ prices }: { prices: StorePriceRow[] }) {
  if (prices.length === 0) return null;
  const max = Math.max(...prices.map((p) => parseFloat(p.effectivePrice)));
  const min = parseFloat(prices[0].effectivePrice);

  return (
    <ul className="space-y-3">
      {prices.map((p, i) => {
        const value = parseFloat(p.effectivePrice);
        const widthPct = max > 0 ? Math.max(8, (value / max) * 100) : 100;
        const cheapest = i === 0 && prices.length > 1;
        const deltaPct = min > 0 ? Math.round(((value - min) / min) * 100) : 0;
        return (
          <li key={p.storeId}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
              <span>
                <Link
                  href={`/stores/${p.storeId}`}
                  className="cursor-pointer font-medium text-foreground hover:underline"
                >
                  {p.storeName}
                </Link>
                {p.storeCity && (
                  <span className="ml-1.5 text-xs text-ink-faint">{p.storeCity}</span>
                )}
                {cheapest && (
                  <span className="ml-2 align-middle">
                    <Badge tone="green">
                      <CheckIcon size={12} /> cheapest
                    </Badge>
                  </span>
                )}
              </span>
              <span className="shrink-0">
                <Money
                  className={
                    cheapest
                      ? "text-[15px] font-semibold text-primary-strong"
                      : "text-[15px] font-medium"
                  }
                >
                  {formatEffectivePrice(p.effectivePrice, p.isWeighted, p.currency)}
                </Money>
                {!cheapest && deltaPct > 0 && (
                  <span className="ml-1.5 text-xs font-medium text-accent">
                    +{deltaPct}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 w-full rounded-[4px] bg-muted">
              <div
                className={`h-3 rounded-[4px] transition-[width] duration-300 ${
                  cheapest ? "bg-primary" : "bg-secondary/45"
                }`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              observed {formatDate(p.observedDate)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
