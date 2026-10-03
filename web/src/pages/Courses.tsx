import { Fragment, useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useCatalog } from "../catalog";
import CourseCard from "../components/CourseCard";
import SponsoredCard from "../components/SponsoredCard";
import type { Product } from "../api";
import { PROMOS, pickPromos, promoProduct } from "../ads";
import { trackOnce } from "../trackOnce";

const SORTS: Record<string, { label: string; fn: (a: Product, b: Product) => number }> = {
  featured: { label: "Most relevant", fn: () => 0 },
  newest: { label: "Newest", fn: (a, b) => Date.parse(`1 ${b.updated}`) - Date.parse(`1 ${a.updated}`) },
  shortest: { label: "Shortest", fn: (a, b) => a.durationMin - b.durationMin },
  price_asc: { label: "Price: low to high", fn: (a, b) => a.priceCents - b.priceCents },
  price_desc: { label: "Price: high to low", fn: (a, b) => b.priceCents - a.priceCents },
};
const LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"];
const DURATIONS: Record<string, { label: string; test: (min: number) => boolean }> = {
  short: { label: "Under 2.5 hours", test: (m) => m < 150 },
  mid: { label: "2.5 to 4 hours", test: (m) => m >= 150 && m <= 240 },
  long: { label: "Over 4 hours", test: (m) => m > 240 },
};
const PRICES: Record<string, { label: string; test: (p: Product) => boolean }> = {
  under75: { label: "Under $75", test: (p) => p.priceCents < 7500 },
  mid: { label: "$75 to $120", test: (p) => p.priceCents >= 7500 && p.priceCents <= 12000 },
  over120: { label: "Over $120", test: (p) => p.priceCents > 12000 },
  sale: { label: "On sale", test: (p) => !!p.compareAtCents },
};

/** Index (in the result list) after which the second sponsored slot appears. */
const MID_SLOT_AFTER = 5;

type Group = "track" | "level" | "duration" | "price";
const GROUPS: Group[] = ["track", "level", "duration", "price"];

/** Does course `p` pass option `value` of filter group `g`? */
function passes(p: Product, g: Group, value: string): boolean {
  switch (g) {
    case "track": return p.track === value;
    case "level": return p.level === value;
    case "duration": return !!DURATIONS[value]?.test(p.durationMin);
    case "price": return !!PRICES[value]?.test(p);
  }
}

export default function Courses() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { catalog, error } = useCatalog();
  const q = params.get("q")?.trim() ?? "";
  const sort = params.get("sort") ?? "featured";

  // Each group is multi-select, stored in the URL as a comma list (?level=Beginner,Advanced).
  // Options in a group are OR-ed; groups are AND-ed; the search is AND-ed with all of them.
  const selected = useMemo(() => {
    const out = {} as Record<Group, string[]>;
    for (const g of GROUPS) out[g] = (params.get(g) ?? "").split(",").filter(Boolean);
    return out;
  }, [params]);

  // Koah's standard "Search" event, once per search.
  useEffect(() => {
    if (q) trackOnce(location.key, "Search", { search_string: q });
  }, [q, location.key]);

  const courses = useMemo(() => catalog?.products.filter((p) => p.kind === "course") ?? [], [catalog]);

  /** Filter predicate, optionally ignoring one group (for that group's facet counts). */
  const matches = useMemo(() => {
    const needle = q.toLowerCase();
    const trackName = (id: string) => catalog?.tracks.find((t) => t.id === id)?.name ?? "";
    return (p: Product, ignore?: Group) =>
      GROUPS.every((g) => g === ignore || selected[g].length === 0 || selected[g].some((v) => passes(p, g, v))) &&
      (!needle || `${p.name} ${p.subtitle} ${p.instructor.name} ${trackName(p.track)} ${p.outcomes.join(" ")}`.toLowerCase().includes(needle));
  }, [catalog, selected, q]);

  const results = useMemo(
    () => courses.filter((p) => matches(p)).sort((SORTS[sort] ?? SORTS.featured).fn),
    [courses, matches, sort],
  );

  // Up to two sponsored slots. A promo only runs if its course fits every active
  // filter and the search, and it's shown once (not again in the organic list).
  const promos = useMemo(() => {
    const ranked = pickPromos({ track: selected.track.length === 1 ? selected.track[0] : undefined, q }, PROMOS.length);
    return ranked.filter((pr) => {
      const c = courses.find((x) => x.id === pr.courseId);
      return c && matches(c);
    }).slice(0, 2);
  }, [selected, q, courses, matches]);
  const organic = useMemo(() => results.filter((p) => !promos.some((pr) => pr.courseId === p.id)), [results, promos]);

  if (error) return <p className="error">Couldn't load courses ({error}).</p>;
  if (!catalog) return (
    <div className="listing" aria-busy="true" aria-label="Loading courses">
      <div className="skel skel-line" style={{ width: "30%", height: 36, margin: "24px 0" }} />
      <div className="rlist">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="skel skel-card" style={{ height: 150 }} />)}
      </div>
    </div>
  );

  const toggle = (g: Group, value: string) => {
    const cur = selected[g];
    const nextValues = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    const next = new URLSearchParams(params);
    if (nextValues.length) next.set(g, nextValues.join(","));
    else next.delete(g);
    setParams(next, { replace: true });
  };
  const setSort = (value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "featured") next.set("sort", value);
    else next.delete("sort");
    setParams(next, { replace: true });
  };
  /** How many results this option would give, with the user's other filters applied. */
  const facet = (g: Group, value: string) => courses.filter((p) => matches(p, g) && passes(p, g, value)).length;
  const current = selected.track.length === 1 ? catalog.tracks.find((t) => t.id === selected.track[0]) : undefined;
  const trackNames = catalog.tracks.filter((t) => selected.track.includes(t.id)).map((t) => t.name);
  const title = q
    ? `${results.length} results for “${q}”`
    : trackNames.length === 0 ? "All courses"
    : `${trackNames.length > 1 ? `${trackNames.slice(0, -1).join(", ")} and ${trackNames.at(-1)}` : trackNames[0]} courses`;
  const anyFilter = GROUPS.some((g) => selected[g].length > 0);
  const clearHref = q ? `/courses?q=${encodeURIComponent(q)}` : "/courses";

  const option = (g: Group, value: string, label: string) => {
    const n = facet(g, value);
    const on = selected[g].includes(value);
    return (
      <label key={value} className={n === 0 && !on ? "filter-opt is-empty" : "filter-opt"}>
        <input type="checkbox" checked={on} disabled={n === 0 && !on} onChange={() => toggle(g, value)} />
        <span>{label}</span><span className="filter-n">{n}</span>
      </label>
    );
  };

  const sponsored = (i: number, placement: string) => {
    const promo = promos[i];
    const product = promo && promoProduct(promo, catalog.products);
    return product ? <SponsoredCard promo={promo} product={product} placement={placement} layout={placement === "search_top" ? "banner" : "grid"} /> : null;
  };

  return (
    <div className="listing">
      <nav className="crumbs"><Link to="/">Home</Link> / <Link to="/courses">Courses</Link>{current && <> / {current.name}</>}</nav>
      <div className="listing-head">
        <h1>{title}</h1>
        <p className="muted">{current?.blurb ?? "Practical, project-based courses for working engineers."}</p>
      </div>

      <div className="listing-layout">
        <aside className="filters" aria-label="Filters">
          <fieldset>
            <legend>Category</legend>
            {catalog.tracks.map((t) => option("track", t.id, t.name))}
          </fieldset>
          <fieldset>
            <legend>Level</legend>
            {LEVELS.map((l) => option("level", l, l))}
          </fieldset>
          <fieldset>
            <legend>Video length</legend>
            {Object.entries(DURATIONS).map(([id, d]) => option("duration", id, d.label))}
          </fieldset>
          <fieldset>
            <legend>Price</legend>
            {Object.entries(PRICES).map(([id, pr]) => option("price", id, pr.label))}
          </fieldset>
          {anyFilter && <Link to={clearHref} className="text-link">Clear filters</Link>}
        </aside>

        <div className="results">
          <div className="results-bar">
            <p className="result-count">{results.length} {results.length === 1 ? "course" : "courses"}</p>
            <label className="sort">
              <span className="muted small">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {sponsored(0, "search_top")}
          {results.length === 0 ? (
            <div className="empty">
              <p>No courses match. Try a different search or fewer filters.</p>
              <Link to={clearHref}>Clear filters</Link>
            </div>
          ) : (
            <div className="cgrid">
              {organic.map((p, i) => (
                <Fragment key={p.id}>
                  <CourseCard product={p} layout="grid" />
                  {i === MID_SLOT_AFTER && sponsored(1, "search_mid")}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
