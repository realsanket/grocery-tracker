/**
 * Price-over-time line chart, one series per store (server-rendered SVG).
 * Palette: validated categorical slots assigned to stores in a fixed
 * (alphabetical) order; identity is reinforced by direct end-labels and the
 * legend, and the full history table below acts as the accessible table view.
 */

interface HistoryPoint {
  storeName: string;
  date: string; // ISO yyyy-mm-dd
  value: number;
}

const SERIES_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948"];

const W = 720;
const H = 240;
const PAD = { top: 16, right: 110, bottom: 28, left: 48 };

export function PriceHistoryChart({
  points,
  unitSuffix,
}: {
  points: HistoryPoint[];
  unitSuffix: string;
}) {
  const clean = points.filter((p) => Number.isFinite(p.value) && p.date);
  if (clean.length < 2) return null;

  const storeNames = [...new Set(clean.map((p) => p.storeName))].sort();
  const series = storeNames.map((name, i) => ({
    name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: clean
      .filter((p) => p.storeName === name)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));

  const dates = clean.map((p) => new Date(p.date).getTime());
  const values = clean.map((p) => p.value);
  const minT = Math.min(...dates);
  const maxT = Math.max(...dates);
  const spanT = Math.max(1, maxT - minT);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const padV = Math.max(0.05, (maxV - minV) * 0.25);
  const lo = Math.max(0, minV - padV);
  const hi = maxV + padV;

  const x = (t: number) => PAD.left + ((t - minT) / spanT) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const yTicks = [lo, (lo + hi) / 2, hi];
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const fmtVal = (v: number) => `€${v.toFixed(2)}${unitSuffix}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Price history by store. ${series
          .map((s) => `${s.name}: latest ${fmtVal(s.points[s.points.length - 1].value)}`)
          .join(". ")}`}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="#898781"
              fontFamily="var(--font-fira-code), monospace"
            >
              €{v.toFixed(2)}
            </text>
          </g>
        ))}
        <text
          x={PAD.left}
          y={H - 8}
          fontSize={11}
          fill="#898781"
        >
          {fmtDate(minT)}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize={11} fill="#898781">
          {fmtDate(maxT)}
        </text>

        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(new Date(p.date).getTime()).toFixed(1)},${y(p.value).toFixed(1)}`)
            .join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.name}>
              {s.points.length > 1 && (
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
              )}
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={x(new Date(p.date).getTime())}
                  cy={y(p.value)}
                  r={4}
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  <title>{`${s.name} — ${fmtDate(new Date(p.date).getTime())}: ${fmtVal(p.value)}`}</title>
                </circle>
              ))}
              <text
                x={x(new Date(last.date).getTime()) + 8}
                y={y(last.value) + 4}
                fontSize={11.5}
                fontWeight={500}
                fill="#0f172a"
              >
                {s.name.length > 15 ? `${s.name.slice(0, 14)}…` : s.name}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
