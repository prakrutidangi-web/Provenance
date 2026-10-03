import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlass, ShoppingBagOpen } from "@phosphor-icons/react";
import Home from "./pages/Home";
import Courses from "./pages/Courses";
import CoursePage from "./pages/CoursePage";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import ThankYou from "./pages/ThankYou";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import { Terms, Privacy } from "./pages/Legal";
import { useCart } from "./cart";
import { useCatalog } from "./catalog";

function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere, unless the user is already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
  }
  return (
    <form className="search" onSubmit={submit} role="search">
      <input
        ref={input}
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What do you want to learn?"
        aria-label="Search courses"
        autoComplete="off"
      />
      <button type="submit" className="search-go" aria-label="Search"><MagnifyingGlass size={16} weight="bold" aria-hidden /></button>
    </form>
  );
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Kernelcraft home" translate="no">
      <span className="logo-mark" aria-hidden><i /><i /><i /><i /></span>
      kernelcraft
    </Link>
  );
}

function Header() {
  const count = useCart().length;
  const { catalog } = useCatalog();
  const { pathname } = useLocation();
  return (
    <header className="header">
      <div className="header-row">
        <Logo />
        <nav className="nav" aria-label="Main">
          <NavLink to="/courses" end>Explore</NavLink>
          <NavLink to="/pricing">All-Access</NavLink>
          <NavLink to="/chat">Ask Penrose</NavLink>
        </nav>
        <SearchBox />
        <NavLink to="/checkout" className="cart-btn" data-testid="cart-link" aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}>
          <ShoppingBagOpen size={19} aria-hidden />
          <span>Cart</span>
          {count > 0 && <span className="pill" data-testid="cart-count">{count}</span>}
        </NavLink>
      </div>
      {/* Category bar: hidden on /courses, where the Category filter does the same job. */}
      {pathname !== "/courses" && (
      <nav className="catbar" aria-label="Categories">
        <div className="catbar-row">
          {catalog?.tracks.map((t) => (
            <Link key={t.id} to={`/courses?track=${t.id}`}>{t.name}</Link>
          ))}
        </div>
      </nav>
      )}
    </header>
  );
}

/** The dashboard is a tool, not part of the store, so it gets its own slim bar. */
function AdminBar() {
  return (
    <header className="admin-bar">
      <div className="admin-bar-row">
        <Link to="/admin" className="logo" translate="no" aria-label="Provenance dashboard">
          <span className="logo-mark" aria-hidden><i /><i /><i /><i /></span>
          Provenance
        </Link>
        <nav aria-label="Demo apps">
          <a href="/" target="_blank" rel="noopener">Kernelcraft store <span aria-hidden>↗</span></a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-cols">
        <div className="footer-brand">
          <Logo />
          <p>Video courses for engineers building with AI.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/courses">Courses</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/chat">Ask Penrose</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      </div>
      <p className="footer-legal">Kernelcraft is a fictional practice store. Nothing is sold and no payment is taken.</p>
      <p className="footer-credits">
        Photos by Tim van der Kuip, Annie Spratt, Safar Safarov and Luca Bravo on{" "}
        <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>.
      </p>
    </footer>
  );
}

export default function App() {
  const { pathname } = useLocation();
  // Penrose is a different "app" (the publisher), so it gets none of the store's chrome.
  if (pathname.startsWith("/chat")) return <Chat />;
  const isAdmin = pathname.startsWith("/admin");
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {isAdmin ? <AdminBar /> : <Header />}
      <main id="main" className={isAdmin ? "container wide" : "container"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CoursePage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/cart" element={<Checkout />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <h1>Page not found</h1>
                <p className="muted">That page doesn't exist or has moved.</p>
                <Link to="/courses" className="btn">Browse courses</Link>
              </div>
            }
          />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </>
  );
}
