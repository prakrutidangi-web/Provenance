import { useEffect, useState } from "react";
import { api, formatPrice, type RawEvent } from "../../api";
import { SourceBadge, short } from "./tables";

/** Show the path and query; the host is always the same demo origin, and the full URL stays in the tooltip. */
const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
};

const EVENT_NAMES = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"];

/** The raw event log, exactly as received from the pixel and the Conversion API. */
export default function EventDebugger({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [via, setVia] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [showBots, setShowBots] = useState(false);

  useEffect(() => {
    api.events({ via, name, source }).then(setEvents).catch(() => {});
  }, [via, name, source, refreshKey]);

  const shown = showBots ? events : events.filter((e) => !e.is_bot);

  return (
    <div>
      <div className="panel-head">
        <div className="controls">
          <select value={via} onChange={(e) => setVia(e.target.value)} aria-label="Channel">
            <option value="">Pixel + API</option>
            <option value="pixel">Pixel only</option>
            <option value="api">API only</option>
          </select>
          <select value={name} onChange={(e) => setName(e.target.value)} aria-label="Event">
            <option value="">All events</option>
            {EVENT_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {[["google", "Google"], ["koah", "Koah"], ["facebook", "Facebook"], ["direct", "Direct"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="check-inline"><input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} /> Show crawler traffic</label>
        </div>
      </div>
      <div className="scroll tall" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="table compact events" data-testid="events">
          <thead>
            <tr>
              <th>Received</th>
              <th>Channel</th>
              <th>Event</th>
              <th>Source</th>
              <th>Product</th>
              <th>Page URL</th>
              <th>User</th>
              <th>Tab</th>
              <th>Event ID</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={9} className="muted">No events yet. Open the shop with ?utm_source=koah and click around.</td></tr>
            )}
            {shown.map((e) => {
              const p = e.properties;
              const product = p.products?.map((x) => x.name ?? x.id).join(", ");
              return (
                <tr key={e.id} className={e.event_name === "Purchase" ? "purchase-row" : e.is_bot ? "bot-row" : ""}>
                  <td className="nowrap">{new Date(e.received_at).toLocaleTimeString()}</td>
                  <td><span className={`chip chip-${e.via}`}>{e.via}</span></td>
                  <td className="nowrap">
                    {e.event_name}
                    {e.is_bot && <span className="chip chip-bot" title="Excluded from metrics">bot</span>}
                  </td>
                  <td title={e.source_raw ? `utm_source=${e.source_raw}${e.click_id ? ` · kad_cid=${e.click_id}` : ""}` : undefined}>
                    {e.via === "api" ? <span className="muted">n/a</span> : <SourceBadge source={e.source} />}
                    {e.campaign && <div className="muted small">{e.campaign}</div>}
                  </td>
                  <td>
                    {product ?? "none"}
                    {p.value !== undefined && <div className="muted small">{formatPrice(Math.round(p.value * 100))}</div>}
                  </td>
                  <td className="url" title={e.page_url ?? undefined}>{e.page_url ? pathOf(e.page_url) : "none"}</td>
                  <td><code title={e.user_id}>{short(e.user_id)}</code></td>
                  <td><code title={e.tab_id ?? ""}>{short(e.tab_id)}</code></td>
                  <td><code title={e.event_id}>{e.event_id.length > 14 ? `${e.event_id.slice(0, 14)}…` : e.event_id}</code></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="panel-note">
        Every event as received, newest first. Crawler traffic is stored but hidden by default. Source comes from the tab's ad visit, so pages without UTMs still show the ad
        that brought the user in. Server events have no tab, so no source.
      </p>
    </div>
  );
}
