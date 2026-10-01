import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { useCatalog, formatPrice } from "../catalog";
import CourseCard from "../components/CourseCard";
import SponsoredCard from "../components/SponsoredCard";
import Photo, { PHOTOS } from "../components/Photo";
import { pickPromos, promoProduct } from "../ads";

const FAQ = [
  ["Do I keep a course after buying it?", "Yes. A course you buy is yours for good, including later updates to it."],
  ["Course or All-Access?", "Buy single courses if you need one or two. All-Access unlocks everything, including new releases, for a year."],
  ["Can I get a refund?", "Within 30 days, for any reason. Reply to your receipt and it's done."],
  ["Can my whole team use it?", "Each person needs their own All-Access plan. Seats are billed one by one."],
];

export default function Home() {
  const { catalog, error } = useCatalog();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("ai");

  const courses = catalog?.products.filter((p) => p.kind === "course") ?? [];
  const plan = catalog?.products.find((p) => p.kind === "plan");
  const popular = courses.filter((c) => c.badge === "Bestseller").slice(0, 8);
  const fresh = [...courses].sort((a, b) => Date.parse(`1 ${b.updated}`) - Date.parse(`1 ${a.updated}`)).filter((c) => c.badge !== "Bestseller").slice(0, 4);
  const lessons = courses.reduce((n, c) => n + c.lessons, 0);

  // Sponsored placements: a featured banner under the hero, and one slot in the tabbed row.
  const [heroPromo] = pickPromos({}, 1, new Date().getDate());
  const heroPromoProduct = catalog && heroPromo ? promoProduct(heroPromo, catalog.products) : undefined;
  const tabCourses = courses.filter((c) => c.track === tab).slice(0, 3);
  const [tabPromo] = pickPromos({ track: tab, exclude: [...tabCourses.map((c) => c.id), heroPromo?.courseId ?? ""] });
  const tabPromoProduct = catalog && tabPromo ? promoProduct(tabPromo, catalog.products) : undefined;
  const tabTrack = catalog?.tracks.find((t) => t.id === tab);

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
  }

  return (
    <>
      {/* Full-bleed photo hero with search. */}
      <section className="photo-hero">
        <Photo photo={PHOTOS.hero} sizes="100vw" priority className="photo-hero-img" />
        <div className="photo-hero-shade" aria-hidden />
        <div className="photo-hero-inner">
          <h1>Courses for engineers, <span className="accent">taught by engineers who ship.</span></h1>
          <p>Learn AI, web, backend, data, cloud and security by building real projects, one short lesson at a time.</p>
          <form className="hero-search" role="search" onSubmit={search}>
            <MagnifyingGlass size={18} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to learn?" aria-label="Search courses" name="q" autoComplete="off" />
            <button className="btn btn-sun" type="submit">Search</button>
          </form>
          {catalog && <p className="hero-stats">{courses.length} courses, {lessons.toLocaleString()} lessons, {catalog.tracks.length} categories</p>}
        </div>
      </section>

      {error && <p className="error">Couldn't reach the API ({error}). Is the server running?</p>}

      {heroPromo && heroPromoProduct && (
        <section className="section section-tight">
          <SponsoredCard promo={heroPromo} product={heroPromoProduct} placement="home_hero" layout="banner" />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Explore categories</h2>
          <Link to="/courses" className="text-link">All courses <ArrowRight size={14} aria-hidden /></Link>
        </div>
        <div className="cat-grid">
          {catalog?.tracks.map((t) => {
            const n = courses.filter((c) => c.track === t.id).length;
            const art = courses.find((c) => c.track === t.id);
            return (
              <Link key={t.id} to={`/courses?track=${t.id}`} className="cat-tile">
                {art && <img src={`/posters/${art.id}-800.jpg`} alt="" width={800} height={500} loading="lazy" />}
                <span className="cat-name">{t.name}</span>
                <span className="cat-count">{n} {n === 1 ? "course" : "courses"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Udemy's "broad selection" block: tabs per category, a row of courses, one sponsored slot. */}
      <section className="section">
        <h2 className="section-title">A broad selection of courses</h2>
        <div className="tabs" role="tablist" aria-label="Categories">
          {catalog?.tracks.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => setTab(t.id)}>{t.name}</button>
          ))}
        </div>
        <div className="tab-panel" role="tabpanel">
          {tabTrack && (
            <div className="tab-intro">
              <div>
                <h3>{tabTrack.name}</h3>
                <p className="muted">{tabTrack.blurb}.</p>
              </div>
              <Link to={`/courses?track=${tabTrack.id}`} className="btn btn-quiet">Explore {tabTrack.name}</Link>
            </div>
          )}
          <div className="cgrid cgrid-4">
            {tabCourses.map((c) => <CourseCard key={c.id} product={c} />)}
            {tabPromo && tabPromoProduct && <SponsoredCard key={tabPromo.id} promo={tabPromo} product={tabPromoProduct} placement="home_tabs" />}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Most popular</h2>
          <Link to="/courses" className="text-link">See all <ArrowRight size={14} aria-hidden /></Link>
        </div>
        <div className="cgrid cgrid-4">{popular.map((c) => <CourseCard key={c.id} product={c} />)}</div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">New and updated</h2>
          <Link to="/courses?sort=newest" className="text-link">See all <ArrowRight size={14} aria-hidden /></Link>
        </div>
        <div className="cgrid cgrid-4">{fresh.map((c) => <CourseCard key={c.id} product={c} />)}</div>
      </section>

      {/* Photo + text split. */}
      <section className="split">
        <div className="split-media split-media-tall">
          <Photo photo={PHOTOS.code} sizes="(max-width: 860px) 100vw, 40vw" />
        </div>
        <div className="split-copy">
          <h2>Learn from working code, <span className="accent">not slides.</span></h2>
          <p>Every course is built around a small production-style codebase you extend lesson by lesson. You finish with something you can ship.</p>
          <ul className="checks">
            <li><Check size={16} weight="bold" aria-hidden /> Full source code for every lesson</li>
            <li><Check size={16} weight="bold" aria-hidden /> Exercises with reference solutions</li>
            <li><Check size={16} weight="bold" aria-hidden /> Captions and transcripts you can search</li>
          </ul>
          {catalog && <p className="split-note">{courses.length} courses and {lessons.toLocaleString()} lessons so far, updated every month.</p>}
        </div>
      </section>

      {/* All-Access: reversed split with the team photo. */}
      {plan && (
        <section className="split split-reverse">
          <div className="split-media">
            <Photo photo={PHOTOS.team} sizes="(max-width: 860px) 100vw, 50vw" />
          </div>
          <div className="split-copy">
            <h2>Every course, <span className="accent">one yearly price.</span></h2>
            <p>
              All-Access unlocks the full catalog plus every release in the next 12 months. Bought one by one, the
              courses cost {formatPrice(plan.compareAtCents!)}.
            </p>
            <p className="split-price">{formatPrice(plan.priceCents)} <span>per year</span></p>
            <Link to="/pricing" className="btn btn-sun">Get All-Access</Link>
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Questions</h2>
        <dl className="faq">
          {FAQ.map(([question, answer]) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing banner. */}
      <section className="photo-cta">
        <Photo photo={PHOTOS.desk} sizes="100vw" className="photo-cta-img" />
        <div className="photo-cta-shade" aria-hidden />
        <div className="photo-cta-inner">
          <h2>Your next feature starts <span className="accent">with one lesson.</span></h2>
          <Link to="/courses" className="btn btn-sun">Browse courses</Link>
        </div>
      </section>
    </>
  );
}
