import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  formatPrice,
  type CampaignRow,
  type ConversionRow,
  type FunnelData,
  type Model,
  type SummaryRow,
  type TimeseriesRow,
} from "../../api";
import TrendChart, { type Metric } from "./TrendChart";
import EventDebugger from "./EventDebugger";
import { CampaignTable, ConversionsTable, FunnelTable, LOW_VOLUME, SummaryTable, pct } from "./tables";

const MODELS: { id: Model; label: string; help: string }[] = [
  {
    id: "tab",
    label: "Same tab",
    help: "Credit goes to the ad that opened the tab the purchase happened in. No ad in that tab means direct.",
  },
  {
    id: "last_touch_7d",
    label: "Last touch, 7 days",
    help: "Credit goes to the user's most recent ad click in the 7 days before buying, in any tab.",
  },
  {
    id: "first_touch_30d",
    label: "First touch, 30 days",
    help: "Credit goes to the user's first ad click in the 30 days before buying.",
  },
];

// Simulated ad clicks for testing. Each opens the store in a new tab at the
// page the ad promotes, with that platform's tracking parameters.
const AD_LINKS = [
  { label: "Koah: ask Penrose (AI chat)", href: `/chat?ask=${encodeURIComponent("How do I stop my support bot from making things up?")}` },
  { label: "Google: Production RAG", href: "/courses/production-rag?utm_source=google&utm_medium=cpc&utm_campaign=search_ai_courses&utm_content=rag_text_ad" },
  { label: "Google: brand search", href: "/?utm_source=google&utm_medium=cpc&utm_campaign=search_brand" },
  { label: "Facebook: React Native", href: "/courses/react-native-apps?utm_source=facebook&utm_medium=social&utm_campaign=lookalike_devs&utm_content=feed_video" },
  { label: "Facebook: retargeting", href: "/checkout?utm_source=facebook&utm_medium=social&utm_campaign=retargeting" },
];

const RANGES = [
  { id: "1", label: "Today" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
];

function rangeFor(days: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(days) - 1));
  return { from: start.toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

/** The window of the same length that ends where the current one starts, for "vs previous" comparisons. */
function previousRangeFor(days: string) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - (Number(days) - 1));
  const start = new Date(end);
  start.setDate(start.getDate() - Number(days));
  return { from: start.toISOString(), to: end.toISOString() };
}

const TABS = [
  { id: "funnel", label: "Funnel" },
  { id: "campaigns", label: "Campaigns" },
  { id: "conversions", label: "Recent conversions" },
  { id: "events", label: "Event debugger" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const METRICS: { id: Metric; label: string }[] = [
  { id: "sessions", label: "User sessions" },
  { id: "purchasers", label: "Purchasers" },
  { id: "rate", label: "Conversion rate" },
  { id: "revenue", label: "Revenue" },
];

const sum = (rows: SummaryRow[]) =>
  rows.reduce(
    (t, r) => ({ sessions: t.sessions + r.sessions, purchasers: t.purchasers + r.purchasers, revenue: t.revenue + r.revenue_cents, orders: t.orders + r.orders }),
    { sessions: 0, purchasers: 0, revenue: 0, orders: 0 },
  );

/** "up 12%" / "down 5%" against the previous period; rates compare in percentage points. */
function delta(now: number, before: number, kind: "count" | "rate"): string | null {
  if (kind === "rate") {
    const d = (now - before) * 100;
    return Math.abs(d) < 0.05 ? "no change" : `${d > 0 ? "up" : "down"} ${Math.abs(d).toFixed(1)} points`;
  }
  if (before === 0) return now === 0 ? "no change" : null;
  const d = ((now - before) / before) * 100;
  return Math.abs(d) < 0.5 ? "no change" : `${d > 0 ? "up" : "down"} ${Math.abs(d).toFixed(0)}%`;
}

export default function Admin() {
  // Model and range live in the URL, so a view can be bookmarked or shared.
  const [params, setParams] = useSearchParams();
  const model = (["tab", "last_touch_7d", "first_touch_30d"].includes(params.get("model") ?? "") ? params.get("model") : "tab") as Model;
  const days = ["1", "7", "30", "90"].includes(params.get("days") ?? "") ? params.get("days")! : "30";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  const setModel = (m: Model) => setParam("model", m);
  const setDays = (d: string) => setParam("days", d);
  const metric = (METRICS.some((m) => m.id === params.get("metric")) ? params.get("metric") : "sessions") as Metric;
  const view = (TABS.some((t) => t.id === params.get("view")) ? params.get("view") : "funnel") as TabId;
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [prevSummary, setPrevSummary] = useState<SummaryRow[]>([]);
  const [series, setSeries] = useState<TimeseriesRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const load = useCallback(async () => {
    const q = { model, tz, ...rangeFor(days) };
    try {
      const [s, t, f, c, cv, ps] = await Promise.all([
        api.summary(q),
        api.timeseries(q),
        api.funnel(q),
        api.campaigns(q),
        api.conversions(q),
        api.summary({ model, tz, ...previousRangeFor(days) }),
      ]);
      setSummary(s.rows);
      setPrevSummary(ps.rows);
      setSeries(t);
      setFunnel(f);
      setCampaigns(c);
      setConversions(cv);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(String(e));
    }
  }, [model, days, tz]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 5000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  async function reset() {
    setConfirmReset(false);
    await api.resetData();
    setRefreshKey((k) => k + 1);
  }

  // Platforms always appear in the same order, matching the chart legend.
  const ordered = ["google", "koah", "facebook", "direct"].map((s) => summary.find((r) => r.source === s)).filter((r): r is SummaryRow => !!r);

  const totals = sum(summary);
  const prev = sum(prevSummary);
  const rate = totals.sessions ? totals.purchasers / totals.sessions : 0;
  const NAMES: Record<string, string> = { google: "Google", koah: "Koah", facebook: "Facebook", direct: "Direct" };
  const best = [...ordered].filter((r) => r.sessions >= LOW_VOLUME).sort((a, b) => b.conversion_rate - a.conversion_rate)[0];
  const rangeLabel = days === "1" ? "today" : `in the last ${days} days`;
  const prevLabel = days === "1" ? "yesterday" : `the previous ${days} days`;
  const prevRate = prev.sessions ? prev.purchasers / prev.sessions : 0;
  const cards: { id: Metric; label: string; value: string; change: string | null }[] = [
    { id: "sessions", label: "User sessions", value: totals.sessions.toLocaleString(), change: delta(totals.sessions, prev.sessions, "count") },
    { id: "purchasers", label: "Purchasers", value: totals.purchasers.toLocaleString(), change: delta(totals.purchasers, prev.purchasers, "count") },
    { id: "rate", label: "Conversion rate", value: pct(rate), change: prev.sessions ? delta(rate, prevRate, "rate") : null },
    { id: "revenue", label: "Revenue", value: formatPrice(totals.revenue).replace(/\.00$/, ""), change: delta(totals.revenue, prev.revenue, "count") },
  ];

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <h1>Attribution dashboard</h1>
          <p className="admin-sub">Kernelcraft · {tz} · Simulated traffic plus your own clicks · <a href="#event-debugger" onClick={(e) => { e.preventDefault(); setParam("view", "events"); document.getElementById("event-debugger")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Open the event debugger ↓</a></p>
        </div>
        <div className="controls">
          <div className="segmented" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.id} className={days === r.id ? "on" : ""} onClick={() => setDays(r.id)}>{r.label}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Live
          </label>
          {confirmReset ? (
            <span className="confirm" role="group" aria-label="Confirm reset">
              Delete all data?
              <button className="link-danger" onClick={reset}>Yes, delete</button>
              <button className="link-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          ) : (
            <button className="link-danger" onClick={() => setConfirmReset(true)}>Reset data</button>
          )}
        </div>
      </div>

      {loaded && totals.sessions > 0 && (
        <p className="answer" data-testid="answer">
          {totals.sessions.toLocaleString()} visitors {rangeLabel} led to {totals.purchasers.toLocaleString()} {totals.purchasers === 1 ? "purchase" : "purchases"}, a {pct(rate)} conversion rate.
          {best && <> <span className="accent">{NAMES[best.source]} converts best at {pct(best.conversion_rate)}.</span></>}
        </p>
      )}

      <div className="model-picker">
        <label htmlFor="model-select" className="model-label">Attribution model</label>
        <select id="model-select" data-testid="model-picker" value={model} onChange={(e) => setModel(e.target.value as Model)}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <p>{MODELS.find((m) => m.id === model)!.help}</p>
      </div>

      <nav className="sim" aria-label="Simulate an ad click">
        <span className="model-label">Try it yourself</span>
        {AD_LINKS.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener">{l.label} <span aria-hidden>↗</span></a>)}
        <span className="sim-hint">Each opens in a new tab. For Koah, click the Sponsored card in the chat. Then buy a course and watch the numbers here.</span>
      </nav>

      {error && <p className="error" role="alert">Couldn't load data: {error}</p>}
      {loaded && !error && totals.sessions === 0 && (
        <p className="draft-note" role="status">
          No traffic in this range yet. Open a simulated ad click above and buy a course, or run <code>npm run seed</code> for 60 days of sample data.
        </p>
      )}

      <div className={loaded ? "cards" : "cards is-loading"} role="group" aria-label="Metrics. Choose one to chart it." aria-busy={!loaded}>
        {cards.map((c) => (
          <button key={c.id} className={metric === c.id ? "card on" : "card"} aria-pressed={metric === c.id} onClick={() => setParam("metric", c.id)}>
            <span className="card-label">{c.label}</span>
            <span className="card-value">{c.value}</span>
            <span className="card-change">{c.change ? `${c.change} vs ${prevLabel}` : `no data for ${prevLabel}`}</span>
          </button>
        ))}
      </div>

      {loaded && totals.sessions === 0 ? (
        <section className="panel">
          <div className="panel-head"><h2>{METRICS.find((m) => m.id === metric)!.label} per day</h2></div>
          <p className="panel-empty">The chart appears once there is traffic in this range.</p>
        </section>
      ) : (
        <TrendChart data={series} metric={metric} />
      )}

      <section className="panel">
        <div className="panel-head"><h2>By platform</h2></div>
        <SummaryTable rows={ordered} />
        <p className="panel-note">
          Sessions are unique users who arrived from the platform. Purchasers are unique buyers credited to it under the
          selected model. Conversion rate is purchasers divided by sessions. Crawler traffic is excluded. Rates based on fewer than {LOW_VOLUME} sessions are marked as low volume.
        </p>
      </section>

      <section className="panel" id="event-debugger">
        <div className="dtabs" role="tablist" aria-label="Detail">
          {TABS.map((t) => (
            <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={view === t.id} aria-controls="tabpanel" className={view === t.id ? "dtab on" : "dtab"} onClick={() => setParam("view", t.id)}>{t.label}</button>
          ))}
        </div>
        <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${view}`}>
          {view === "funnel" && (
            <>
              <FunnelTable data={funnel} />
              <p className="panel-note">Unique users reaching each step. The small figure is conversion from the previous step.</p>
            </>
          )}
          {view === "campaigns" && <CampaignTable rows={campaigns} />}
          {view === "conversions" && (
            <>
              <ConversionsTable rows={conversions} />
              <p className="panel-note">
                The server and the browser both report each purchase with the same event ID, and they're merged into one row.
                If an ad blocker stops the browser copy, the server copy still counts.
              </p>
            </>
          )}
          {view === "events" && <EventDebugger refreshKey={refreshKey} />}
        </div>
      </section>
    </div>
  );
}
