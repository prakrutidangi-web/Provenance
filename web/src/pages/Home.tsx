import { Link } from "react-router-dom";
import { Code, Timer, Stack, CalendarCheck } from "@phosphor-icons/react";
import Photo, { PHOTOS } from "../components/Photo";
import { useCatalog, formatPrice } from "../catalog";
import SponsoredCard from "../components/SponsoredCard";
import { pickPromos, promoProduct } from "../ads";
import Chat from "./chat/Chat";


const FAQ = [
  ["What do I get with a course?", "Short video lessons, taught by the instructor, that build one project from start to finish. Each course page lists the lessons, the level and the total running time."],
  ["What is All-Access?", "One yearly price that unlocks every course in the catalog, including new releases. If you plan to take more than two or three courses, it usually costs less than buying them one by one."],
  ["Which course should I start with?", "Use the level and length filters on Explore, or search for a topic. Not sure? Ask Penrose a question and it will point you to a course that fits."],
  ["Do I need experience?", "Every course shows its level, from beginner to advanced, so you can pick one that matches where you are."],
];

export default function Home() {
  const { catalog } = useCatalog();
  const plan = catalog?.products.find((p) => p.kind === "plan");

  // Real numbers from the catalog itself.
  const courses = catalog?.products.filter((p) => p.kind === "course") ?? [];
  const lessons = courses.reduce((n, c) => n + c.lessons, 0);
  const hours = Math.round(courses.reduce((n, c) => n + c.durationMin, 0) / 60);
  const num = (n: number) => (catalog ? n.toLocaleString() : "...");

  // One sponsored placement on the page itself; the others are in the chat.
  const [heroPromo] = pickPromos({}, 1, new Date().getDate());
  const heroPromoProduct = catalog && heroPromo ? promoProduct(heroPromo, catalog.products) : undefined;

  return (
    <>
      <section className="band band-sand hero2">
        <div className="hero2-copy">
          <h1>Learn engineering by <span className="accent">building it.</span></h1>
          <p>Short video courses for engineers working with AI, backend, data and cloud. Every course ends in a project you can run.</p>
          <div className="intro-actions">
            <Link to="/courses" className="btn btn-sun">Browse courses</Link>
            <Link to="/pricing" className="btn btn-quiet">All-Access, {plan ? formatPrice(plan.priceCents) : ""} a year</Link>
          </div>
        </div>
        <div className="hero2-photo" aria-hidden="true">
          <Photo photo={{ ...PHOTOS.desk, alt: "" }} sizes="100vw" priority />
        </div>
      </section>

      <section className="band band-navy ask" aria-labelledby="ask-h">
        <div className="ask-head">
          <h2 id="ask-h">Stuck on something? <span className="accent">Ask Penrose.</span></h2>
          <p>Ask a technical question and get a short answer. If a course fits, Penrose points you to it in a clearly labeled sponsored card.</p>
        </div>
        <Chat embedded />
      </section>

      <section className="band band-cream" aria-label="The catalog in numbers">
        <dl className="big-facts">
          <div><dd>{num(courses.length)}</dd><dt>video courses</dt></div>
          <div><dd>{num(lessons)}</dd><dt>short lessons</dt></div>
          <div><dd>{num(hours)}</dd><dt>hours of video</dt></div>
          <div><dd>{num(catalog?.tracks.length ?? 0)}</dd><dt>categories</dt></div>
        </dl>
      </section>

      <section className="band band-sand feature">
        <div className="feature-photo">
          <Photo photo={PHOTOS.hero} sizes="(max-width: 960px) 100vw, 45vw" />
        </div>
        <div className="feature-copy">
          <h2>Built for people who learn by shipping</h2>
          <ul className="feature-list">
            <li><Code size={20} aria-hidden /><span><strong>One project per course.</strong> From first commit to something deployed.</span></li>
            <li><Timer size={20} aria-hidden /><span><strong>Lessons of a few minutes.</strong> Stop and start between meetings.</span></li>
            <li><Stack size={20} aria-hidden /><span><strong>Eight categories.</strong> AI engineering to security, beginner to advanced.</span></li>
            <li><CalendarCheck size={20} aria-hidden /><span><strong>One yearly price.</strong> All-Access unlocks every course and every new release.</span></li>
          </ul>
        </div>
      </section>

      {heroPromo && heroPromoProduct && (
        <section className="section-tight">
          <SponsoredCard promo={heroPromo} product={heroPromoProduct} placement="home_hero" layout="banner" />
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
    </>
  );
}
