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
import TrendChart from "./TrendChart";
import EventDebugger from "./EventDebugger";
import { CampaignTable, ConversionsTable, FunnelTable, SummaryTable, pct } from "./tables";

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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [series, setSeries] = useState<TimeseriesRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const load = useCallback(async () => {
    const q = { model, tz, ...rangeFor(days) };
    try {
      const [s, t, f, c, cv] = await Promise.all([
        api.summary(q),
        api.timeseries(q),
        api.funnel(q),
        api.campaigns(q),
        api.conversions(q),
      ]);
      setSummary(s.rows);
      setSeries(t);
      setFunnel(f);
      setCampaigns(c);
      setConversions(cv);
      setError(null);
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
    if (!confirm("Delete all events, conversions and orders?")) return;
    await api.resetData();
    setRefreshKey((k) => k + 1);
  }

  const totals = summary.reduce(
    (t, r) => ({ sessions: t.sessions + r.sessions, purchasers: t.purchasers + r.purchasers, revenue: t.revenue + r.revenue_cents, orders: t.orders + r.orders }),
    { sessions: 0, purchasers: 0, revenue: 0, orders: 0 },
  );
  const rate = totals.sessions ? totals.purchasers / totals.sessions : 0;

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <h1>Attribution dashboard</h1>
          <p className="admin-sub">Kernelcraft · {tz} · <a href="#event-debugger" onClick={(e) => { e.preventDefault(); document.getElementById("event-debugger")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Jump to event debugger ↓</a></p>
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
          <button className="link-danger" onClick={reset}>Reset data</button>
        </div>
      </div>

      <section className="model-picker">
        <span className="model-label">Attribution model</span>
        <div className="segmented" role="group" aria-label="Attribution model" data-testid="model-picker">
          {MODELS.map((m) => (
            <button key={m.id} className={model === m.id ? "on" : ""} onClick={() => setModel(m.id)} data-model={m.id}>
              {m.label}
            </button>
          ))}
        </div>
        <p>{MODELS.find((m) => m.id === model)!.help}</p>
      </section>

      <nav className="sim" aria-label="Simulate an ad click">
        <span className="model-label">Simulate an ad click</span>
        {AD_LINKS.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener">{l.label} <span aria-hidden>↗</span></a>)}
        <span className="sim-hint">Each opens in a new tab. For Koah, click the Sponsored card in the chat. Then buy a course and watch the numbers here.</span>
      </nav>

      {error && <p className="error">Couldn't load data: {error}</p>}

      <dl className="kpis">
        <div><dt>User sessions</dt><dd>{totals.sessions.toLocaleString()}</dd></div>
        <div><dt>Purchasers</dt><dd>{totals.purchasers.toLocaleString()}</dd></div>
        <div><dt>Conversion rate</dt><dd>{pct(rate)}</dd></div>
        <div><dt>Revenue</dt><dd>{formatPrice(totals.revenue)}</dd></div>
      </dl>

      <section className="panel">
        <div className="panel-head"><h2>By platform</h2></div>
        <SummaryTable rows={summary} />
        <p className="panel-note">
          Sessions are unique users who arrived from the platform. Purchases are unique buyers credited to it under the
          selected model. Conversion rate is purchases divided by sessions.
        </p>
      </section>

      <TrendChart data={series} />

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h2>Funnel</h2></div>
          <FunnelTable data={funnel} />
          <p className="panel-note">Unique users reaching each step. The small figure is conversion from the previous step.</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Campaigns</h2></div>
          <CampaignTable rows={campaigns} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Recent conversions</h2></div>
        <ConversionsTable rows={conversions} />
        <p className="panel-note">
          The server and the browser both report each purchase with the same event ID, and they're merged into one row.
          If an ad blocker stops the browser copy, the server copy still counts.
        </p>
      </section>

      <EventDebugger refreshKey={refreshKey} />
    </div>
  );
}
