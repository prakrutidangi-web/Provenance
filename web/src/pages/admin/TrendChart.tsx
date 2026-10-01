import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { SOURCES, type TimeseriesRow } from "../../api";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Metric = "sessions" | "purchasers";
const METRIC_LABEL: Record<Metric, string> = { sessions: "User sessions", purchasers: "Purchasers" };

const H = 260;
const M = { top: 16, right: 84, bottom: 28, left: 40 }; // right margin holds the direct labels

/** Picks a round tick step (1, 2, 5 × 10^n) so ~4 gridlines land on round values. */
function niceScale(max: number): { yMax: number; ticks: number[] } {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow);
  const yMax = step * Math.ceil(Math.max(1, max) / step);
  return { yMax, ticks: Array.from({ length: yMax / step + 1 }, (_, i) => i * step) };
}

const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Daily line chart, one line per source. One metric at a time: never two y-axes. */
export default function TrendChart({ data }: { data: TimeseriesRow[] }) {
  const [metric, setMetric] = useState<Metric>("sessions");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = useMemo(() => [...new Set(data.map((d) => d.day))], [data]);
  const series = useMemo(
    () =>
      SOURCES.map((source) => ({
        source,
        values: days.map((day) => data.find((d) => d.day === day && d.source === source)?.[metric] ?? 0),
      })),
    [data, days, metric],
  );

  const { yMax, ticks } = niceScale(Math.max(...series.flatMap((s) => s.values), 0));
  const innerW = width - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(innerW / 70))));

  // Direct labels at the line ends, nudged apart so they never overlap.
  const endLabels = series
    .map((s) => ({ source: s.source, v: s.values.at(-1) ?? 0, y: y(s.values.at(-1) ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) endLabels[i].y = Math.max(endLabels[i].y, endLabels[i - 1].y + 14);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * innerW;
    setHover(days.length <= 1 ? 0 : Math.round((px / innerW) * (days.length - 1)));
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Daily trend</h2>
        <div className="controls">
          <div className="segmented" role="group" aria-label="Metric">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <button key={m} className={metric === m ? "on" : ""} onClick={() => setMetric(m)}>{METRIC_LABEL[m]}</button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="View">
            {(["chart", "table"] as const).map((v) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "chart" ? "Chart" : "Table"}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-body">
      <div className="legend">
        {SOURCES.map((s) => (
          <span key={s}><i className={`swatch line s-${s}`} />{cap(s)}</span>
        ))}
      </div>

      {view === "table" ? (
        <div className="scroll">
          <table className="table compact">
            <thead>
              <tr><th>Day</th>{SOURCES.map((s) => <th key={s} className="num">{cap(s)}</th>)}</tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr key={day}>
                  <td>{shortDay(day)}</td>
                  {series.map((s) => <td key={s.source} className="num">{s.values[i]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap" ref={wrap}>
          <svg width={width} height={H} role="img" aria-label={`${METRIC_LABEL[metric]} per day by source`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} />
                <text className="axis" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{t}</text>
              </g>
            ))}
            {days.map((d, i) =>
              i % labelEvery === 0 ? (
                <text key={d} className="axis" x={x(i)} y={H - 8} textAnchor="middle">{shortDay(d)}</text>
              ) : null,
            )}

            {series.map((s) => (
              <polyline
                key={s.source}
                className={`series s-${s.source}`}
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              />
            ))}

            {endLabels.map((l) => (
              <text key={l.source} className="direct-label" x={M.left + innerW + 8} y={l.y} dy="0.32em">
                <tspan className="dl-value">{l.v}</tspan> {cap(l.source)}
              </text>
            ))}

            {hover !== null && (
              <g>
                <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} />
                {series.map((s) => (
                  <circle key={s.source} className={`marker s-${s.source}`} cx={x(hover)} cy={y(s.values[hover])} r={4.5} />
                ))}
              </g>
            )}
            {/* Hit target covers the whole plot, much bigger than the 2px lines. */}
            <rect
              x={M.left}
              y={M.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hover !== null && (
            <div
              className="tooltip"
              style={{ left: Math.min(x(hover) + 12, width - 170), top: M.top }}
              role="status"
            >
              <strong>{shortDay(days[hover])}</strong>
              {[...series]
                .sort((a, b) => b.values[hover] - a.values[hover])
                .map((s) => (
                  <div key={s.source} className="tt-row">
                    <i className={`swatch line s-${s.source}`} />
                    <span>{cap(s.source)}</span>
                    <span className="num">{s.values[hover]}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
