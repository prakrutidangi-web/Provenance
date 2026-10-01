import { formatPrice, type CampaignRow, type ConversionRow, type FunnelData, type SummaryRow } from "../../api";

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const short = (id: string | null) => (id ? id.slice(0, 8) : "—");

const SOURCE_NAMES: Record<string, string> = { google: "Google", facebook: "Facebook", koah: "Koah", direct: "Direct" };

/** Source label: a small color key plus the name. Color is never the only cue. */
export function SourceBadge({ source }: { source: string | null }) {
  const s = source ?? "direct";
  return <span className={`src src-${s}`}>{SOURCE_NAMES[s] ?? s}</span>;
}

/** The assignment's core table: per platform user sessions, purchases, conversion rate. */
export function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  const maxRate = Math.max(...rows.map((r) => r.conversion_rate), 0.0001);
  return (
    <table className="table" data-testid="metrics">
      <thead>
        <tr>
          <th>Platform</th>
          <th className="num" title="Unique users who arrived via this platform's ads">User sessions</th>
          <th className="num" title="Unique users whose purchase is credited to this platform">Purchases</th>
          <th>Conversion rate</th>
          <th className="num" title="All orders credited (one user can order several times)">Orders</th>
          <th className="num">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.source} data-testid={`metrics-${m.source}`}>
            <td><SourceBadge source={m.source} /></td>
            <td className="num" data-col="sessions">{m.sessions}</td>
            <td className="num" data-col="purchasers">{m.purchasers}</td>
            <td>
              <div className="rate">
                <span data-col="rate">{pct(m.conversion_rate)}</span>
                <div className="bar"><div className={`s-${m.source}`} style={{ width: `${(m.conversion_rate / maxRate) * 100}%` }} /></div>
              </div>
            </td>
            <td className="num">{m.orders}</td>
            <td className="num">{formatPrice(m.revenue_cents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Funnel per source: unique users at each step, with step-to-step conversion. */
export function FunnelTable({ data }: { data: FunnelData | null }) {
  if (!data) return null;
  const label = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");
  return (
    <div className="scroll">
      <table className="table compact funnel">
        <thead>
          <tr>
            <th>Source</th>
            {data.steps.map((s) => <th key={s} className="num">{label(s)}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.source}>
              <td><SourceBadge source={r.source} /></td>
              {r.counts.map((c, i) => {
                const prev = i === 0 ? null : r.counts[i - 1];
                return (
                  <td key={i} className="num">
                    {c}
                    {prev !== null && prev > 0 && <div className="step-rate">{pct(c / prev)}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) return <p className="muted small">No campaign traffic in this range.</p>;
  return (
    <div className="scroll">
      <table className="table compact">
        <thead>
          <tr>
            <th>Source</th>
            <th>Campaign</th>
            <th className="num">Sessions</th>
            <th className="num">Purchases</th>
            <th className="num">Conv.</th>
            <th className="num">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.source}/${r.campaign}`}>
              <td><SourceBadge source={r.source} /></td>
              <td><code>{r.campaign}</code></td>
              <td className="num">{r.sessions}</td>
              <td className="num">{r.purchasers}</td>
              <td className="num">{pct(r.conversion_rate)}</td>
              <td className="num">{formatPrice(r.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Deduplicated conversions: shows each purchase once, which channels reported it, and who got credit. */
export function ConversionsTable({ rows }: { rows: ConversionRow[] }) {
  if (rows.length === 0) return <p className="muted small">No conversions in this range yet.</p>;
  return (
    <div className="scroll tall">
      <table className="table compact" data-testid="conversions">
        <thead>
          <tr>
            <th>Time</th>
            <th>Order</th>
            <th>Products</th>
            <th className="num">Value</th>
            <th title="Which channels reported this purchase. Both = deduplicated by event_id.">Received via</th>
            <th>Credited to</th>
            <th>Campaign</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.event_id}>
              <td className="nowrap">{new Date(c.occurred_at).toLocaleString()}</td>
              <td><code>{c.order_id ?? short(c.event_id)}</code></td>
              <td>{c.products?.map((p) => `${p.name ?? p.id}${p.quantity && p.quantity > 1 ? ` ×${p.quantity}` : ""}`).join(", ") ?? "—"}</td>
              <td className="num">{c.value_cents !== null ? formatPrice(c.value_cents) : "—"}</td>
              <td>
                {c.received_via.map((v) => <span key={v} className={`chip chip-${v}`}>{v}</span>)}
                {c.received_via.length === 2 && <span className="muted small"> merged</span>}
              </td>
              <td><SourceBadge source={c.source} /></td>
              <td>{c.campaign ? <code>{c.campaign}</code> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
