/**
 * Penrose: a fictional AI assistant, standing in for a Koah *publisher*.
 *
 * It shows where a Koah ad lives: a native, clearly labeled "Sponsored" card
 * under an answer, matched to what the user is asking about. Clicking it opens
 * the advertiser's site (Kernelcraft) with Koah's tracking parameters:
 *   utm_source=koah · utm_medium=ai_chat · utm_campaign · utm_content · kad_cid
 * which is where the attribution system in this repo takes over.
 *
 * In production the ad creative comes from Koah's ad server via the publisher
 * SDK; here it's built from the advertiser's catalog to keep the demo
 * self-contained.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowSquareOut, ArrowUp, Check, Copy, Plus, Stop, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useCatalog, formatDuration, formatPrice } from "../../catalog";
import type { Product } from "../../api";
import CourseCover from "../../components/CourseCover";
import { FALLBACK, SUGGESTIONS, matchTopic, type Block, type Topic } from "./topics";

interface Turn {
  id: number;
  question: string;
  answer: Block[];
  topic: Topic | null;
  clickId: string; // Koah click id for this ad impression
  cut?: number; // characters shown when the user pressed Stop
}
interface ChatThread { id: string; title: string; turns: Turn[] }
interface Live { chatId: string; turnId: number; chars: number } // chars < 0 means "thinking"

const newClickId = () => `kcid_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const THINK = -140; // ~0.6s of "Thinking" before text appears
const TICK_MS = 24;
const CHARS_PER_TICK = 6;

let turnSeq = 0;
function makeTurn(question: string): Turn {
  const topic = matchTopic(question);
  return { id: ++turnSeq, question, answer: topic?.answer ?? FALLBACK, topic, clickId: newClickId() };
}
const titleOf = (q: string) => (q.length > 34 ? `${q.slice(0, 33).trim()}…` : q);

/** Past conversations, so the sidebar looks lived-in and each one has its own matching ad. */
const PAST: { title: string; q: string }[] = [
  { title: "Support bot hallucinations", q: "My support bot keeps making things up when customers ask about our docs. How do I fix that?" },
  { title: "Slow Postgres query", q: "My Postgres query is slow, where do I start?" },
  { title: "Tool-using agents", q: "How do I build an agent that uses tools?" },
];

const size = (b: Block): number => ("p" in b ? b.p.length : "ol" in b ? b.ol.reduce((n, li) => n + li.length, 0) : b.code.length);
const totalChars = (blocks: Block[]) => blocks.reduce((n, b) => n + size(b), 0);

/** The first `n` characters of an answer, cut mid-sentence like a streamed response. */
function clip(blocks: Block[], n: number): Block[] {
  let left = n;
  const out: Block[] = [];
  for (const b of blocks) {
    if (left <= 0) break;
    if ("p" in b) {
      out.push({ p: b.p.slice(0, left) });
      left -= b.p.length;
    } else if ("code" in b) {
      out.push({ code: b.code.slice(0, left) });
      left -= b.code.length;
    } else {
      const items: string[] = [];
      for (const li of b.ol) {
        if (left <= 0) break;
        items.push(li.slice(0, left));
        left -= li.length;
      }
      out.push({ ol: items });
    }
  }
  return out;
}

const plainText = (blocks: Block[]) =>
  blocks.map((b) => ("p" in b ? b.p : "ol" in b ? b.ol.map((li, i) => `${i + 1}. ${li}`).join("\n") : b.code)).join("\n\n");

/** `code` and **bold** inside a paragraph. */
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? <code key={i}>{part.slice(1, -1)}</code>
    : part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
    : <Fragment key={i}>{part}</Fragment>);
}

function renderBlock(b: Block, i: number) {
  if ("p" in b) return <p key={i}>{inline(b.p)}</p>;
  if ("ol" in b) return <ol key={i}>{b.ol.map((li, j) => <li key={j}>{inline(li)}</li>)}</ol>;
  return <pre key={i} className="chat-code"><code>{b.code}</code></pre>;
}

function SponsoredCard({ turn, product }: { turn: Turn; product: Product }) {
  const [why, setWhy] = useState(false);
  const params = new URLSearchParams({
    utm_source: "koah",
    utm_medium: "ai_chat",
    utm_campaign: turn.topic!.campaign,
    utm_content: "answer_card",
    kad_cid: turn.clickId,
  });
  const href = `/courses/${product.id}?${params}`;
  return (
    <aside className="sponsored" aria-label="Sponsored">
      <div className="sponsored-top">
        <span className="sponsored-label">Sponsored</span>
        <span className="muted">Kernelcraft</span>
        <button className="why" onClick={() => setWhy((w) => !w)} aria-expanded={why}>Why this ad?</button>
      </div>
      {why && (
        <p className="why-text">
          Shown by Koah because your question is about <b>{turn.topic!.id.replace("-", " ")}</b>. Ads don't change
          the answer, and the advertiser never sees your conversation.
        </p>
      )}
      <a className="sponsored-body" href={href} target="_blank" rel="noopener" data-testid="koah-ad">
        <div className="sponsored-thumb"><CourseCover product={product} size="sm" /></div>
        <div className="sponsored-copy">
          <strong>{product.name}</strong>
          <span>{product.subtitle}</span>
          <span className="sponsored-meta">Video course, {formatDuration(product.durationMin)}, {formatPrice(product.priceCents)}</span>
        </div>
        <span className="sponsored-cta">View course <ArrowSquareOut size={14} aria-hidden /></span>
      </a>
    </aside>
  );
}

const DRAFT = "draft-0";
let chatSeq = 0;

export default function Chat() {
  const { catalog } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [chats, setChats] = useState<ChatThread[]>(() => [
    { id: DRAFT, title: "New chat", turns: [] },
    ...PAST.map((p, i) => ({ id: `past-${i}`, title: p.title, turns: [makeTurn(p.q)] })),
  ]);
  const [activeId, setActiveId] = useState(DRAFT);
  const [live, setLive] = useState<Live | null>(null);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [rating, setRating] = useState<Record<number, "up" | "down">>({});
  const thread = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const autoAsked = useRef(false);

  const active = chats.find((c) => c.id === activeId) ?? chats[0];

  useEffect(() => {
    document.title = "Penrose";
    return () => {
      document.title = "Kernelcraft";
    };
  }, []);

  // Typewriter: reveal the newest answer a few characters at a time.
  useEffect(() => {
    if (!live) return;
    const turn = chats.find((c) => c.id === live.chatId)?.turns.find((t) => t.id === live.turnId);
    if (!turn || live.chars >= totalChars(turn.answer)) {
      setLive(null);
      return;
    }
    const t = setTimeout(() => setLive((l) => (l ? { ...l, chars: l.chars + CHARS_PER_TICK } : l)), TICK_MS);
    return () => clearTimeout(t);
  }, [live, chats]);

  // Follow the answer as it grows, unless the user scrolled up. Only the thread
  // scrolls, never the page (scrollIntoView could also move the document).
  useLayoutEffect(() => {
    const el = thread.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) el.scrollTop = el.scrollHeight;
  }, [chats, live, activeId]);

  // The composer grows with its text, up to a limit.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || live) return;
    const turn = makeTurn(q);
    setChats((cs) => cs.map((c) => (c.id === activeId ? { ...c, title: c.turns.length ? c.title : titleOf(q), turns: [...c.turns, turn] } : c)));
    setLive({ chatId: activeId, turnId: turn.id, chars: reduceMotion() ? totalChars(turn.answer) : THINK });
    setInput("");
    requestAnimationFrame(() => thread.current?.scrollTo({ top: thread.current.scrollHeight }));
  }

  // /chat?ask=… (used by the dashboard's "simulate an ad click") asks once on arrival.
  useEffect(() => {
    const q = params.get("ask");
    if (!q || autoAsked.current) return;
    autoAsked.current = true;
    setParams({}, { replace: true });
    ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function newChat() {
    setLive(null);
    const empty = chats.find((c) => c.turns.length === 0);
    if (empty) {
      setActiveId(empty.id);
    } else {
      const id = `chat-${++chatSeq}`;
      setChats((cs) => [{ id, title: "New chat", turns: [] }, ...cs]);
      setActiveId(id);
    }
    box.current?.focus();
  }

  function open(id: string) {
    setLive(null);
    setActiveId(id);
  }

  function stop() {
    if (!live) return;
    const cut = Math.max(0, live.chars);
    setChats((cs) => cs.map((c) => (c.id === live.chatId ? { ...c, turns: c.turns.map((t) => (t.id === live.turnId ? { ...t, cut } : t)) } : c)));
    setLive(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(input);
    }
  }

  async function copy(t: Turn) {
    try {
      await navigator.clipboard.writeText(plainText(t.answer));
      setCopied(t.id);
      setTimeout(() => setCopied((c) => (c === t.id ? null : c)), 1500);
    } catch {
      /* clipboard can be blocked; nothing to do */
    }
  }

  return (
    <div className="penrose">
      <div className="demo-bar">
        <ol className="demo-steps">
          <li><b>Demo publisher.</b> Penrose is a fictional AI app.</li>
          <li><span>1</span> Ask a question</li>
          <li><span>2</span> Click the Sponsored card. Kernelcraft opens in a new tab as a Koah visitor</li>
          <li><span>3</span> Buy a course there, then check the dashboard</li>
        </ol>
        <span className="demo-links">
          <a href="/" target="_blank" rel="noopener">Kernelcraft <ArrowSquareOut size={12} aria-hidden /></a>
          <a href="/admin" target="_blank" rel="noopener">Dashboard <ArrowSquareOut size={12} aria-hidden /></a>
        </span>
      </div>
      <div className="penrose-app">
        <aside className="penrose-side">
          <div className="penrose-logo"><span className="penrose-mark" /> Penrose</div>
          <button className="penrose-new" onClick={newChat}><Plus size={15} aria-hidden /> New chat</button>
          <p className="penrose-label">Recent</p>
          <ul className="penrose-history">
            {chats.filter((c) => c.turns.length > 0 || c.id === activeId).map((c) => (
              <li key={c.id}>
                <button className={c.id === activeId ? "on" : ""} onClick={() => open(c.id)} aria-current={c.id === activeId ? "true" : undefined}>{c.title}</button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="penrose-main">
          <header className="penrose-top">
            <span className="penrose-title">{active.turns.length ? active.title : "New chat"}</span>
            <span className="penrose-model">Penrose 2</span>
            <button className="penrose-new-sm" onClick={newChat}><Plus size={14} aria-hidden /> New</button>
          </header>

          <div className="penrose-thread" ref={thread}>
            {active.turns.length === 0 ? (
              <div className="penrose-empty">
                <span className="penrose-mark big" aria-hidden />
                <h2>What are you building?</h2>
                <p>Ask about code, infrastructure or AI apps. Penrose is free, and supported by relevant ads.</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            ) : (
              <div className="penrose-inner">
                {active.turns.map((t) => {
                  const isLive = live?.chatId === active.id && live.turnId === t.id;
                  const chars = isLive ? live!.chars : t.cut ?? Infinity;
                  const thinking = isLive && chars < 0;
                  const done = !isLive && t.cut === undefined;
                  const blocks = thinking ? [] : clip(t.answer, chars);
                  const product = t.topic && catalog?.products.find((p) => p.id === t.topic!.courseId);
                  return (
                    <div key={t.id} className="turn">
                      <div className="msg-user">{t.question}</div>
                      <div className="msg-assistant">
                        <span className="penrose-mark small" aria-hidden />
                        <div className="msg-body">
                          {thinking ? <span className="dots" aria-label="Thinking"><i /><i /><i /></span> : (
                            <div className={isLive ? "answer is-streaming" : "answer"}>{blocks.map(renderBlock)}</div>
                          )}
                          {done && (
                            <div className="msg-actions">
                              <button onClick={() => copy(t)} aria-label="Copy answer">{copied === t.id ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}</button>
                              <button className={rating[t.id] === "up" ? "on" : ""} onClick={() => setRating((r) => ({ ...r, [t.id]: "up" }))} aria-label="Good answer" aria-pressed={rating[t.id] === "up"}><ThumbsUp size={15} aria-hidden /></button>
                              <button className={rating[t.id] === "down" ? "on" : ""} onClick={() => setRating((r) => ({ ...r, [t.id]: "down" }))} aria-label="Bad answer" aria-pressed={rating[t.id] === "down"}><ThumbsDown size={15} aria-hidden /></button>
                            </div>
                          )}
                          {done && product && <SponsoredCard turn={t} product={product} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form className="composer" onSubmit={submit}>
            <textarea
              ref={box}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask Penrose about your code…"
              name="message"
              autoComplete="off"
              aria-label="Message Penrose"
            />
            {live ? (
              <button type="button" onClick={stop} aria-label="Stop generating" className="is-stop"><Stop size={15} weight="fill" aria-hidden /></button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send message"><ArrowUp size={17} weight="bold" aria-hidden /></button>
            )}
          </form>
          <p className="composer-note">Penrose is a demo and its answers are canned. Try “how do I evaluate my LLM app” or “kafka consumers keep falling behind”.</p>
        </main>
      </div>
    </div>
  );
}
