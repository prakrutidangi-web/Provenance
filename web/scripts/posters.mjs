/**
 * Course poster generator.
 *
 * Each course gets an illustrated poster: a deep navy, lit background in its track's
 * colors plus a visual metaphor for the topic (documents + lens for RAG, a
 * database stack for Postgres, message lanes for Kafka...). Posters are authored
 * as SVG, rendered to JPEG with headless Chromium, and written to
 * web/public/posters/<id>-{800,1600}.jpg.
 *
 *   npm run posters        (from web/)
 *
 * They contain no text, so titles stay real, accessible HTML on the page.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/posters");
const W = 1600;
const H = 1000;

const TRACK = {
  // Koah-like palette on navy: saturated blues, reds and gold.
  ai: ["#f8d870", "#e8553f"],
  frontend: ["#6fa8ff", "#3b6fe0"],
  backend: ["#4fc3a1", "#3b7fe0"],
  data: ["#f8d870", "#ff8a4c"],
  devops: ["#e8553f", "#f8b04c"],
  plan: ["#f8d870", "#6fa8ff"],
  security: ["#ff6b6b", "#f8d870"],
  mobile: ["#6fd3ff", "#5b7bff"],
  career: ["#f8d870", "#6fa8ff"],
  ai2: ["#ff8a4c", "#f8d870"],
  frontend2: ["#8fb8ff", "#e8553f"],
  backend2: ["#ff8a4c", "#f8d870"],
  data2: ["#4fc3a1", "#6fa8ff"],
  devops2: ["#6fd3ff", "#4fc3a1"],
};

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------
const glass = (id, a = 0.2, b = 0.04) => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="${a}"/>
    <stop offset="1" stop-color="#fff" stop-opacity="${b}"/>
  </linearGradient>`;

const lit = (id, c1, c2) => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/>
    <stop offset="1" stop-color="${c2}"/>
  </linearGradient>`;

function frame([c1, c2], motif, { bx = 1120, by = 330, sx = 380, sy = 860 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${glass("glass")}
    ${glass("glassStrong", 0.32, 0.08)}
    ${lit("lit", c1, c2)}
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a1230" stop-opacity="0.5"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#142045"/>
  <circle cx="${bx}" cy="${by}" r="430" fill="${c1}" opacity="0.55" filter="url(#blur)"/>
  <circle cx="${sx}" cy="${sy}" r="420" fill="${c2}" opacity="0.38" filter="url(#blur)"/>
  <circle cx="800" cy="520" r="260" fill="${c1}" opacity="0.12" filter="url(#blur)"/>
  <g transform="translate(800 500) scale(1.12) translate(-800 -500)">${motif}</g>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.10" style="mix-blend-mode:overlay"/>
</svg>`;
}

const lines = (x, y, w, n, gap = 34, op = 0.35) =>
  Array.from({ length: n }, (_, i) => {
    const lw = i === n - 1 ? w * 0.55 : w * (0.75 + ((i * 37) % 25) / 100);
    return `<rect x="${x}" y="${y + i * gap}" width="${lw}" height="12" rx="6" fill="#fff" opacity="${op}"/>`;
  }).join("");

// Isometric cube centered at (cx, cy) with edge s.
function cube(cx, cy, s, top, left, right, stroke = "#fff") {
  const h = s * 0.5;
  return `<g stroke="${stroke}" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round">
    <polygon points="${cx},${cy - h} ${cx + s},${cy} ${cx},${cy + h} ${cx - s},${cy}" fill="${top}"/>
    <polygon points="${cx - s},${cy} ${cx},${cy + h} ${cx},${cy + h + s} ${cx - s},${cy + s}" fill="${left}"/>
    <polygon points="${cx + s},${cy} ${cx},${cy + h} ${cx},${cy + h + s} ${cx + s},${cy + s}" fill="${right}"/>
  </g>`;
}

const check = (x, y, r, c) => `
  <circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>
  <path d="M ${x - r * 0.42} ${y} l ${r * 0.3} ${r * 0.3} l ${r * 0.55} ${-r * 0.58}" fill="none" stroke="#142045" stroke-width="${r * 0.22}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------------------------------------------------------------------------
// Motifs, one per course
// ---------------------------------------------------------------------------
const MOTIFS = {
  "production-rag": ([c1]) => {
    const cards = [-14, -5, 4].map((rot, i) => `
      <g transform="translate(${560 + i * 70} ${250 + i * 18}) rotate(${rot} 180 230)">
        <rect width="360" height="460" rx="26" fill="url(#glass)" stroke="#fff" stroke-opacity="${0.18 + i * 0.1}" stroke-width="2"/>
        ${lines(40, 70, 260, 8, 40, 0.18 + i * 0.08)}
      </g>`).join("");
    return `${cards}
      <g transform="translate(980 330)">
        <circle r="150" fill="${c1}" fill-opacity="0.18" stroke="url(#lit)" stroke-width="26"/>
        <circle r="150" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2"/>
        <path d="M 60 -95 A 115 115 0 0 1 112 -30" stroke="#fff" stroke-opacity="0.7" stroke-width="10" fill="none" stroke-linecap="round"/>
        <rect x="118" y="100" width="48" height="190" rx="24" transform="rotate(-45 118 100)" fill="url(#lit)"/>
      </g>`;
  },

  "llm-evals": ([c1, c2]) => `
    <g transform="translate(820 500)" fill="none">
      ${[330, 250, 170, 90].map((r, i) => `<circle r="${r}" stroke="#fff" stroke-opacity="${0.12 + i * 0.08}" stroke-width="${i === 3 ? 0 : 3}"/>`).join("")}
      <circle r="90" fill="url(#lit)"/>
      <circle r="34" fill="#142045"/>
      <line x1="-420" y1="-260" x2="-20" y2="-10" stroke="#fff" stroke-opacity="0.85" stroke-width="10" stroke-linecap="round"/>
    </g>
    ${check(1190, 300, 52, c1)}${check(1260, 520, 40, "#fff")}${check(1150, 720, 46, c2)}
    <g transform="translate(220 640)">
      ${[220, 300, 260, 340].map((w, i) => `<rect y="${i * 46}" width="${w}" height="22" rx="11" fill="${i === 3 ? c1 : "#fff"}" opacity="${i === 3 ? 0.95 : 0.22}"/>`).join("")}
    </g>`,

  "ai-agents": ([c1, c2]) => {
    const cx = 820, cy = 500;
    const sats = [0, 72, 144, 216, 288].map((deg, i) => {
      const a = (deg - 90) * (Math.PI / 180);
      const x = cx + Math.cos(a) * 360, y = cy + Math.sin(a) * 240;
      return { x, y, i };
    });
    return `
      <ellipse cx="${cx}" cy="${cy}" rx="360" ry="240" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="6 14"/>
      ${sats.map((s) => `<path d="M ${cx} ${cy} Q ${(cx + s.x) / 2 + 40} ${(cy + s.y) / 2 - 60} ${s.x} ${s.y}" fill="none" stroke="url(#lit)" stroke-width="4" opacity="0.8"/>`).join("")}
      ${sats.map((s) => `<rect x="${s.x - 58}" y="${s.y - 58}" width="116" height="116" rx="28" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>
        <rect x="${s.x - 22}" y="${s.y - 22}" width="44" height="44" rx="10" fill="${s.i % 2 ? c2 : c1}" opacity="0.9"/>`).join("")}
      <circle cx="${cx}" cy="${cy}" r="150" fill="${c1}" opacity="0.5" filter="url(#soft)"/>
      <circle cx="${cx}" cy="${cy}" r="112" fill="url(#lit)"/>
      <circle cx="${cx - 34}" cy="${cy - 38}" r="34" fill="#fff" opacity="0.35"/>`;
  },

  "prompting-for-devs": ([c1, c2]) => `
    <g transform="translate(520 200)">
      <rect width="560" height="170" rx="40" fill="url(#glass)" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>
      <path d="M 70 170 l 0 54 l 60 -54 z" fill="#fff" fill-opacity="0.12"/>
      ${lines(56, 52, 420, 3, 32, 0.32)}
    </g>
    <g transform="translate(720 450)">
      <rect width="600" height="210" rx="40" fill="url(#lit)"/>
      <path d="M 520 210 l 0 54 l -60 -54 z" fill="${c2}"/>
      <text x="60" y="140" font-family="ui-monospace, Menlo, monospace" font-size="110" font-weight="700" fill="#142045" opacity="0.85">{ }</text>
      ${lines(260, 70, 270, 3, 36, 0.55)}
    </g>
    <g transform="translate(470 760)">
      <rect width="380" height="120" rx="36" fill="url(#glass)" stroke="#fff" stroke-opacity="0.22" stroke-width="2"/>
      <circle cx="80" cy="60" r="12" fill="${c1}"/><circle cx="124" cy="60" r="12" fill="#fff" opacity="0.6"/><circle cx="168" cy="60" r="12" fill="#fff" opacity="0.3"/>
    </g>`,

  "typescript-deep-dive": ([c1, c2]) => `
    <g transform="translate(800 500) rotate(-12)">
      ${[420, 330, 240, 150].map((s, i) => `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${38 - i * 4}" fill="${i === 3 ? "url(#lit)" : "url(#glass)"}" stroke="#fff" stroke-opacity="${0.16 + i * 0.1}" stroke-width="2.5"/>`).join("")}
      <path d="M -36 -30 h 72 M 0 -30 v 78" stroke="#142045" stroke-width="20" stroke-linecap="round"/>
    </g>
    <g fill="none" stroke="${c2}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
      <path d="M 330 380 l -90 120 l 90 120"/><path d="M 1270 380 l 90 120 l -90 120"/>
    </g>
    <circle cx="1270" cy="760" r="14" fill="${c1}"/><circle cx="330" cy="250" r="10" fill="#fff" opacity="0.6"/>`,

  "react-performance": ([c1, c2]) => {
    const bars = [220, 380, 300, 520, 260, 600, 340, 420, 280, 480, 360, 220];
    return `
      <g transform="translate(330 820)">
        ${bars.map((h, i) => `<rect x="${i * 80}" y="${-h}" width="56" height="${h}" rx="14" fill="${h > 450 ? "url(#lit)" : "url(#glass)"}" stroke="#fff" stroke-opacity="${h > 450 ? 0 : 0.2}" stroke-width="2"/>`).join("")}
        <line x1="-30" y1="-400" x2="990" y2="-400" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="14 12"/>
      </g>
      <path d="M 1020 140 L 870 470 L 990 470 L 900 800 L 1180 400 L 1050 400 L 1150 140 Z" fill="url(#glassStrong)" stroke="${c1}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="1240" cy="200" r="16" fill="${c2}"/>`;
  },

  "streaming-ui": ([c1, c2]) => {
    const wave = (y, amp, ph, op, w) => {
      let d = `M 0 ${y}`;
      for (let x = 0; x <= W; x += 20) d += ` L ${x} ${y + Math.sin(x / 140 + ph) * amp}`;
      return `<path d="${d}" fill="none" stroke="url(#lit)" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
    };
    const dots = Array.from({ length: 11 }, (_, i) => {
      const x = 330 + i * 92, y = 420 + Math.sin(x / 140 + 0.6) * 90;
      return `<rect x="${x - 26}" y="${y - 26}" width="52" height="52" rx="14" fill="${i > 7 ? "#fff" : c1}" opacity="${i > 7 ? 0.25 - (i - 8) * 0.06 : 0.95}"/>`;
    }).join("");
    return `${wave(560, 120, 0, 0.25, 4)}${wave(620, 90, 1.2, 0.4, 6)}${wave(680, 70, 2.1, 0.7, 10)}${dots}
      <rect x="1310" y="380" width="8" height="96" rx="4" fill="#fff"/>`;
  },

  "system-design": ([c1, c2]) => {
    const pos = [[800, 300], [600, 420], [1000, 420], [800, 540], [600, 660], [1000, 660]];
    const links = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]];
    return `
      ${links.map(([a, b]) => `<line x1="${pos[a][0]}" y1="${pos[a][1] + 40}" x2="${pos[b][0]}" y2="${pos[b][1] + 40}" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="8 10"/>`).join("")}
      ${pos.map(([x, y], i) => cube(x, y, 78, i === 3 ? c1 : "rgba(255,255,255,0.20)", i === 3 ? c2 : "rgba(255,255,255,0.08)", i === 3 ? "#0f5c4a" : "rgba(255,255,255,0.04)")).join("")}
      <circle cx="800" cy="580" r="160" fill="${c1}" opacity="0.18" filter="url(#soft)"/>`;
  },

  "postgres-performance": ([c1, c2]) => {
    const disk = (y, fill, op) => `
      <path d="M 560 ${y} v 120 a 240 70 0 0 0 480 0 v -120" fill="${fill}" fill-opacity="${op}" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
      <ellipse cx="800" cy="${y}" rx="240" ry="70" fill="${fill}" fill-opacity="${Math.min(op + 0.15, 1)}" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/>`;
    return `${disk(640, "#ffffff", 0.08)}${disk(480, "#ffffff", 0.12)}${disk(320, c1, 0.85)}
      ${[0, 1, 2, 3].map((i) => `<rect x="${170 + i * 40}" y="${330 + i * 110}" width="${300 - i * 50}" height="14" rx="7" fill="#fff" opacity="${0.5 - i * 0.1}"/>`).join("")}
      <circle cx="1180" cy="250" r="20" fill="${c2}"/>`;
  },

  "event-driven-kafka": ([c1, c2]) => {
    const lanes = [0, 1, 2, 3].map((i) => {
      const y = 260 + i * 140;
      const blocks = [0, 1, 2, 3, 4].map((j) => {
        const x = 330 + j * 170 + ((i * 53) % 90);
        const hot = (i + j) % 4 === 0;
        return `<rect x="${x}" y="${y + 18}" width="120" height="64" rx="16" fill="${hot ? "url(#lit)" : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="${hot ? 0 : 0.25}" stroke-width="2"/>`;
      }).join("");
      return `<rect x="270" y="${y}" width="1060" height="100" rx="50" fill="#fff" fill-opacity="0.04" stroke="#fff" stroke-opacity="0.14" stroke-width="2"/>${blocks}`;
    }).join("");
    return `${lanes}<rect x="1370" y="230" width="14" height="590" rx="7" fill="${c2}"/>
      <path d="M 1300 520 l 50 0" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.6"/>`;
  },

  "clickhouse-analytics": ([c1, c2]) => {
    const hs = [180, 260, 220, 360, 300, 460, 400, 560];
    return hs.map((h, i) => {
      const x = 360 + i * 120, base = 820;
      const hot = i >= 5;
      return `<g>
        <polygon points="${x},${base - h} ${x + 60},${base - h - 30} ${x + 120},${base - h} ${x + 60},${base - h + 30}" fill="${hot ? c1 : "rgba(255,255,255,0.28)"}"/>
        <polygon points="${x},${base - h} ${x + 60},${base - h + 30} ${x + 60},${base + 30} ${x},${base}" fill="${hot ? c2 : "rgba(255,255,255,0.12)"}"/>
        <polygon points="${x + 120},${base - h} ${x + 60},${base - h + 30} ${x + 60},${base + 30} ${x + 120},${base}" fill="${hot ? "#8a5a00" : "rgba(255,255,255,0.05)"}"/>
      </g>`;
    }).join("");
  },

  "python-data-pipelines": ([c1, c2]) => `
    <path d="M 260 360 C 520 360 520 640 780 640 S 1040 360 1300 360" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="70" stroke-linecap="round"/>
    <path d="M 260 360 C 520 360 520 640 780 640 S 1040 360 1300 360" fill="none" stroke="url(#lit)" stroke-width="26" stroke-linecap="round" stroke-dasharray="80 40"/>
    ${[[260, 360], [780, 640], [1300, 360]].map(([x, y], i) => `
      <circle cx="${x}" cy="${y}" r="88" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.45" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="38" fill="${i === 2 ? c1 : i === 1 ? c2 : "#fff"}" opacity="${i === 0 ? 0.6 : 1}"/>`).join("")}
    <path d="M 760 230 c 0 0 -40 50 -40 78 a 40 40 0 0 0 80 0 c 0 -28 -40 -78 -40 -78 z" fill="${c1}"/>`,

  "terraform-aws": ([c1, c2]) => {
    const plate = (y, fill, op) => `<polygon points="800,${y - 150} 1160,${y} 800,${y + 150} 440,${y}" fill="${fill}" fill-opacity="${op}" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>
      <polygon points="440,${y} 800,${y + 150} 800,${y + 180} 440,${y + 30}" fill="#fff" fill-opacity="${op * 0.5}"/>
      <polygon points="1160,${y} 800,${y + 150} 800,${y + 180} 1160,${y + 30}" fill="#fff" fill-opacity="${op * 0.25}"/>`;
    return `${plate(700, "#ffffff", 0.08)}${plate(530, "#ffffff", 0.14)}${plate(360, c1, 0.9)}
      ${cube(800, 330, 60, c2, "#a33a2f", "#6e2219")}
      ${[[620, 520], [980, 520], [800, 610]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="#fff" opacity="0.7"/>`).join("")}`;
  },

  "observability-otel": ([c1, c2]) => {
    const spans = [[300, 820], [360, 520], [400, 300], [720, 380], [900, 220], [460, 160]];
    let d = "M 0 760";
    const pts = [[260, 760], [320, 760], [360, 640], [410, 880], [460, 700], [520, 760], [1600, 760]];
    pts.forEach(([x, y]) => (d += ` L ${x} ${y}`));
    return `
      ${spans.map(([x, w], i) => `<rect x="${x}" y="${190 + i * 70}" width="${w}" height="44" rx="12" fill="${i === 3 ? "url(#lit)" : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="${i === 3 ? 0 : 0.22}" stroke-width="2"/>`).join("")}
      <path d="${d}" fill="none" stroke="${c2}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="410" cy="880" r="16" fill="#fff"/>`;
  },

  // ----- motifs added with the larger catalog
  neural: ([c1, c2]) => {
    const cols = [[420, 3], [680, 5], [940, 5], [1200, 2]];
    const pts = cols.map(([x, n]) => Array.from({ length: n }, (_, i) => [x, 500 + (i - (n - 1) / 2) * 130]));
    let edges = "";
    for (let c = 0; c < pts.length - 1; c++) for (const a of pts[c]) for (const b of pts[c + 1]) edges += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#fff" stroke-opacity="0.13" stroke-width="2"/>`;
    const nodes = pts.flatMap((col, c) => col.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${c === 3 ? 46 : 34}" fill="${c === 3 ? "url(#lit)" : (i + c) % 3 === 0 ? c2 : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>`)).join("");
    return edges + nodes;
  },
  shield: ([c1, c2]) => `
    <g transform="translate(800 500)">
      <path d="M 0 -330 L 260 -230 L 260 20 C 260 190 130 290 0 340 C -130 290 -260 190 -260 20 L -260 -230 Z" fill="url(#glass)" stroke="#fff" stroke-opacity="0.4" stroke-width="3"/>
      <path d="M 0 -250 L 190 -175 L 190 15 C 190 140 95 215 0 255 C -95 215 -190 140 -190 15 L -190 -175 Z" fill="url(#lit)" opacity="0.9"/>
      <path d="M -80 10 l 55 55 l 110 -115" fill="none" stroke="#142045" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${[[330, 300], [1270, 330], [1220, 760], [380, 720]].map(([x, y], i) => `<rect x="${x - 40}" y="${y - 40}" width="80" height="80" rx="20" fill="${i % 2 ? c2 : "url(#glassStrong)"}" opacity="${i % 2 ? 0.8 : 1}" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>`).join("")}`,
  chatShield: ([c1, c2]) => `
    <g transform="translate(470 270)">
      <rect width="520" height="200" rx="44" fill="url(#glass)" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>
      ${lines(50, 60, 380, 3, 40, 0.3)}
      <path d="M 80 200 l 0 60 l 66 -60 z" fill="#fff" fill-opacity="0.12"/>
    </g>
    <g transform="translate(1040 560)">
      <path d="M 0 -220 L 180 -150 L 180 20 C 180 140 90 210 0 240 C -90 210 -180 140 -180 20 L -180 -150 Z" fill="url(#lit)" stroke="#fff" stroke-opacity="0.5" stroke-width="3"/>
      <rect x="-60" y="-20" width="120" height="100" rx="18" fill="#142045"/>
      <path d="M -36 -20 v -36 a 36 36 0 0 1 72 0 v 36" fill="none" stroke="#142045" stroke-width="22"/>
    </g>
    <circle cx="400" cy="720" r="70" fill="${c2}" opacity="0.6" filter="url(#soft)"/>`,
  key: ([c1, c2]) => `
    <g transform="translate(560 520) rotate(-28)">
      <circle r="170" fill="url(#lit)"/>
      <circle r="70" fill="#142045"/>
      <rect x="150" y="-38" width="560" height="76" rx="38" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.45" stroke-width="2"/>
      <rect x="520" y="30" width="56" height="110" rx="16" fill="#fff" opacity="0.55"/>
      <rect x="620" y="30" width="56" height="80" rx="16" fill="${c2}"/>
    </g>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${1060 + i * 64}" cy="230" r="18" fill="#fff" opacity="${0.2 + i * 0.12}"/>`).join("")}`,
  phone: ([c1, c2]) => `
    <g transform="translate(560 140) rotate(-8 170 360)">
      <rect width="340" height="700" rx="56" fill="url(#glass)" stroke="#fff" stroke-opacity="0.45" stroke-width="3"/>
      <rect x="120" y="26" width="100" height="22" rx="11" fill="#fff" opacity="0.35"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="32" y="${90 + i * 140}" width="276" height="116" rx="22" fill="${i === 1 ? "url(#lit)" : "#fff"}" opacity="${i === 1 ? 0.95 : 0.1}"/>`).join("")}
    </g>
    <g transform="translate(980 260) rotate(6 150 300)">
      <rect width="300" height="600" rx="50" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${36 + (i % 2) * 120}" y="${80 + Math.floor(i / 2) * 140}" width="108" height="108" rx="26" fill="${i === 2 ? c2 : "#fff"}" opacity="${i === 2 ? 0.9 : 0.14}"/>`).join("")}
    </g>`,
  steps: ([c1, c2]) => `
    ${[0, 1, 2, 3].map((i) => `<rect x="${330 + i * 250}" y="${720 - i * 140}" width="230" height="${140 + i * 140}" rx="22" fill="${i === 3 ? "url(#lit)" : "url(#glass)"}" stroke="#fff" stroke-opacity="${i === 3 ? 0 : 0.3}" stroke-width="2"/>`).join("")}
    <path d="M 445 660 C 600 600 700 560 950 400 S 1180 300 1205 250" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="6" stroke-dasharray="4 16" stroke-linecap="round"/>
    <circle cx="1205" cy="230" r="44" fill="#fff"/>
    <path d="M 1190 230 h 30 M 1205 215 v 30" stroke="#142045" stroke-width="8" stroke-linecap="round"/>
    <circle cx="445" cy="660" r="20" fill="${c2}"/>`,
  layoutGrid: ([c1, c2]) => {
    const cells = [[0, 0, 2, 1], [2, 0, 1, 2], [0, 1, 1, 2], [1, 1, 1, 1], [1, 2, 2, 1]];
    return `<g transform="translate(400 170)">${cells.map(([x, y, w, h], i) => `<rect x="${x * 270}" y="${y * 220}" width="${w * 270 - 24}" height="${h * 220 - 24}" rx="24" fill="${i === 1 ? "url(#lit)" : i === 3 ? c2 : "url(#glass)"}" opacity="${i === 3 ? 0.85 : 1}" stroke="#fff" stroke-opacity="${i === 1 || i === 3 ? 0 : 0.3}" stroke-width="2"/>`).join("")}
      <path d="M -40 -40 h 850 M -40 -40 v 700" stroke="#fff" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="10 10"/></g>`;
  },
  swatches: ([c1, c2]) => `
    ${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(800 820) rotate(${-50 + i * 22})"><rect x="-70" y="-620" width="140" height="560" rx="30" fill="${i === 4 ? "url(#lit)" : i === 2 ? c2 : "url(#glassStrong)"}" opacity="${i === 2 ? 0.85 : 1}" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/><circle cy="-540" r="26" fill="#fff" opacity="0.5"/></g>`).join("")}
    <circle cx="800" cy="820" r="40" fill="#fff" opacity="0.7"/>`,
  containers: ([c1, c2]) => {
    const box = (x, y, hot) => `<rect x="${x}" y="${y}" width="250" height="110" rx="14" fill="${hot ? "url(#lit)" : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="${hot ? 0 : 0.35}" stroke-width="2"/>${[0, 1, 2, 3, 4].map((k) => `<rect x="${x + 26 + k * 42}" y="${y + 22}" width="12" height="66" rx="6" fill="#fff" opacity="${hot ? 0.45 : 0.18}"/>`).join("")}`;
    return [[540, 600], [810, 600], [1080, 600], [675, 470], [945, 470], [810, 340]].map(([x, y], i) => box(x - 120, y, i === 5)).join("") +
      `<path d="M 300 740 C 500 820 1100 820 1340 740" fill="none" stroke="${c2}" stroke-opacity="0.8" stroke-width="10" stroke-linecap="round"/>`;
  },
  helm: ([c1, c2]) => {
    const spokes = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2 - Math.PI / 2; return [Math.cos(a), Math.sin(a)]; });
    return `<g transform="translate(800 500)">
      <polygon points="${spokes.map(([x, y]) => `${x * 330},${y * 330}`).join(" ")}" fill="url(#glass)" stroke="#fff" stroke-opacity="0.35" stroke-width="3"/>
      ${spokes.map(([x, y]) => `<line x1="0" y1="0" x2="${x * 300}" y2="${y * 300}" stroke="#fff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/><circle cx="${x * 300}" cy="${y * 300}" r="36" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>`).join("")}
      <circle r="120" fill="url(#lit)"/><circle r="46" fill="#142045"/>
      <circle cx="${spokes[2][0] * 300}" cy="${spokes[2][1] * 300}" r="36" fill="${c2}"/>
    </g>`;
  },
  pipeline: ([c1, c2]) => {
    const st = [300, 600, 900, 1200];
    return `<path d="M 300 500 H 1300" stroke="#fff" stroke-opacity="0.25" stroke-width="8"/>
      ${st.map((x, i) => `<circle cx="${x}" cy="500" r="${i === 3 ? 96 : 80}" fill="${i === 3 ? "url(#lit)" : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="${i === 3 ? 0 : 0.4}" stroke-width="2"/>${i < 3 ? check(x, 500, 34, i === 1 ? c2 : "#fff") : ""}`).join("")}
      <path d="M 1170 500 l 24 24 l 46 -50" fill="none" stroke="#142045" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 600 580 V 760 H 900" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="6" stroke-dasharray="10 12"/>
      <rect x="900" y="720" width="200" height="80" rx="24" fill="url(#glass)" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>`;
  },
  waveFrame: ([c1, c2]) => `
    <g transform="translate(380 230)">
      <rect width="460" height="360" rx="30" fill="url(#glass)" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>
      <circle cx="340" cy="100" r="44" fill="${c2}" opacity="0.9"/>
      <path d="M 30 330 L 170 170 L 270 270 L 340 210 L 430 330 Z" fill="url(#lit)" opacity="0.9"/>
    </g>
    <g transform="translate(920 640)">${Array.from({ length: 13 }, (_, i) => { const h = 40 + Math.abs(Math.sin(i * 0.9)) * 220; return `<rect x="${i * 34}" y="${-h / 2}" width="18" height="${h}" rx="9" fill="${i % 4 === 1 ? c1 : "#fff"}" opacity="${i % 4 === 1 ? 0.95 : 0.4}"/>`; }).join("")}</g>`,
  hexNet: ([c1, c2]) => {
    const hex = (x, y, r, fill, so) => `<polygon points="${Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`; }).join(" ")}" fill="${fill}" stroke="#fff" stroke-opacity="${so}" stroke-width="2"/>`;
    const pos = [[800, 500], [520, 330], [1080, 330], [520, 680], [1080, 680], [800, 190], [800, 820]];
    return pos.slice(1).map(([x, y]) => `<line x1="800" y1="500" x2="${x}" y2="${y}" stroke="#fff" stroke-opacity="0.3" stroke-width="4" stroke-dasharray="10 10"/>`).join("") +
      pos.map(([x, y], i) => hex(x, y, i === 0 ? 130 : 84, i === 0 ? "url(#lit)" : i === 4 ? c2 : "url(#glassStrong)", i === 0 ? 0 : 0.4)).join("");
  },
  brackets: ([c1, c2]) => `
    <path d="M 560 220 C 440 220 470 420 380 500 C 470 580 440 780 560 780" fill="none" stroke="url(#lit)" stroke-width="44" stroke-linecap="round"/>
    <path d="M 1040 220 C 1160 220 1130 420 1220 500 C 1130 580 1160 780 1040 780" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="44" stroke-linecap="round"/>
    ${[0, 1, 2].map((i) => `<rect x="${640}" y="${370 + i * 90}" width="${320 - i * 70}" height="40" rx="20" fill="${i === 0 ? c2 : "#fff"}" opacity="${i === 0 ? 0.9 : 0.3}"/>`).join("")}`,
  chip: ([c1, c2]) => `
    <g transform="translate(800 500)">
      ${[-1, 0, 1].map((k) => [`<rect x="${k * 110 - 14}" y="-330" width="28" height="90" rx="10" fill="#fff" opacity="0.4"/>`, `<rect x="${k * 110 - 14}" y="240" width="28" height="90" rx="10" fill="#fff" opacity="0.4"/>`, `<rect x="-330" y="${k * 110 - 14}" width="90" height="28" rx="10" fill="#fff" opacity="0.4"/>`, `<rect x="240" y="${k * 110 - 14}" width="90" height="28" rx="10" fill="#fff" opacity="0.4"/>`].join("")).join("")}
      <rect x="-240" y="-240" width="480" height="480" rx="60" fill="url(#glassStrong)" stroke="#fff" stroke-opacity="0.45" stroke-width="3"/>
      <rect x="-150" y="-150" width="300" height="300" rx="40" fill="url(#lit)"/>
      <circle r="58" fill="#142045"/><circle r="22" fill="${c2}"/>
    </g>`,
  scatter: ([c1, c2]) => {
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const dots = Array.from({ length: 70 }, () => { const cl = rnd() > 0.5; const cx = cl ? 1050 : 560, cy = cl ? 380 : 640; return [cx + (rnd() - 0.5) * 420, cy + (rnd() - 0.5) * 300, cl]; });
    return dots.map(([x, y, cl], i) => `<circle cx="${x}" cy="${y}" r="${8 + (i % 4) * 4}" fill="${cl ? c1 : "#fff"}" opacity="${cl ? 0.8 : 0.35}"/>`).join("") +
      `<circle cx="1000" cy="420" r="60" fill="none" stroke="#fff" stroke-width="6"/><line x1="1042" y1="462" x2="1110" y2="530" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="1000" cy="420" r="16" fill="${c2}"/>`;
  },
  table: ([c1, c2]) => `
    <g transform="translate(380 220)">
      <rect width="840" height="560" rx="30" fill="url(#glass)" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
      <rect width="840" height="96" rx="30" fill="url(#lit)"/>
      ${[1, 2, 3, 4].map((r) => `<line x1="0" y1="${96 + r * 93}" x2="840" y2="${96 + r * 93}" stroke="#fff" stroke-opacity="0.18" stroke-width="2"/>`).join("")}
      ${[280, 560].map((c) => `<line x1="${c}" y1="0" x2="${c}" y2="560" stroke="#fff" stroke-opacity="0.18" stroke-width="2"/>`).join("")}
      ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => `<rect x="${c * 280 + 36}" y="${130 + r * 93}" width="${120 + ((r + c) % 3) * 40}" height="22" rx="11" fill="${r === 2 && c === 1 ? c2 : "#fff"}" opacity="${r === 2 && c === 1 ? 0.95 : 0.3}"/>`).join("")).join("")}
    </g>`,
  "all-access": () => {
    const colors = Object.values(TRACK).slice(0, 5).map((c) => c[0]);
    const tiles = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) {
        const i = r * 5 + c;
        const x = 360 + c * 190, y = 230 + r * 190;
        const on = [0, 3, 6, 9, 12, 13].includes(i);
        tiles.push(`<rect x="${x}" y="${y}" width="150" height="150" rx="30" fill="${on ? colors[i % 5] : "url(#glassStrong)"}" stroke="#fff" stroke-opacity="${on ? 0 : 0.22}" stroke-width="2"/>`);
      }
    return tiles.join("");
  },
};

// Which track colors each poster uses (mirrors server/src/domain/catalog.ts).
const COURSES = {
  "production-rag": "ai",
  "llm-evals": "ai",
  "ai-agents": "ai",
  "prompting-for-devs": "ai",
  "typescript-deep-dive": "frontend",
  "react-performance": "frontend",
  "streaming-ui": "frontend",
  "system-design": "backend",
  "postgres-performance": "backend",
  "event-driven-kafka": "backend",
  "clickhouse-analytics": "data",
  "python-data-pipelines": "data",
  "terraform-aws": "devops",
  "observability-otel": "devops",
  "fine-tuning-llms": ["neural", "ai2"],
  "multimodal-apps": ["waveFrame", "ai"],
  "ml-foundations": ["neural", "frontend2"],
  "local-llms": ["chip", "ai"],
  "vector-databases": ["scatter", "ai2"],
  "ai-product-design": ["streaming-ui", "career"],
  "nextjs-app-router": ["react-performance", "frontend2"],
  "modern-css": ["layoutGrid", "frontend"],
  "accessibility-engineering": ["llm-evals", "frontend2"],
  "design-systems": ["swatches", "frontend"],
  "go-microservices": ["hexNet", "backend"],
  "api-design": ["brackets", "backend2"],
  "redis-caching": ["postgres-performance", "security"],
  "rust-backend": ["system-design", "backend2"],
  "dbt-analytics": ["python-data-pipelines", "data2"],
  "spark-at-scale": ["clickhouse-analytics", "data2"],
  "sql-for-engineers": ["table", "data"],
  "kubernetes-production": ["helm", "devops2"],
  "github-actions-cicd": ["pipeline", "devops"],
  "docker-fundamentals": ["containers", "devops2"],
  "appsec-for-devs": ["shield", "security"],
  "llm-security": ["chatShield", "security"],
  "auth-oauth-oidc": ["key", "security"],
  "react-native-apps": ["phone", "mobile"],
  "swiftui-apps": ["phone", "frontend2"],
  "staff-engineer": ["steps", "career"],
  "all-access": "plan",
};

// ---------------------------------------------------------------------------
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
let k = 0;
const only = process.argv.slice(2);
for (const [id, spec] of Object.entries(COURSES)) {
  // spec is a color key, or [motif, color key] for courses that share a motif.
  const [motif, track] = Array.isArray(spec) ? spec : [id, spec];
  if (only.length && !only.includes(id)) { k++; continue; }
  const colors = TRACK[track];
  // Shift the light sources per course so posters in the same track differ.
  const o = (k++ * 97) % 300;
  const svg = frame(colors, MOTIFS[motif](colors), { bx: 1000 + o, by: 260 + (o % 160), sx: 300 + (o % 200), sy: 820 - (o % 120) });
  await page.setContent(`<html><body style="margin:0;background:#142045">${svg}</body></html>`);
  for (const [w, q] of [[1600, 82], [800, 80]]) {
    await page.setViewportSize({ width: W, height: H });
    const buf = await page.screenshot({ type: "jpeg", quality: q, clip: { x: 0, y: 0, width: W, height: H }, scale: "css" });
    if (w === 1600) {
      await import("node:fs/promises").then((fs) => fs.writeFile(path.join(OUT, `${id}-1600.jpg`), buf));
    } else {
      // Downscale by rendering the SVG inside a half-size viewport.
      await page.setContent(`<html><body style="margin:0;background:#142045"><div style="width:800px;height:500px">${svg.replace(`width="${W}" height="${H}"`, 'width="800" height="500"')}</div></body></html>`);
      await page.setViewportSize({ width: 800, height: 500 });
      const small = await page.screenshot({ type: "jpeg", quality: q, clip: { x: 0, y: 0, width: 800, height: 500 } });
      await import("node:fs/promises").then((fs) => fs.writeFile(path.join(OUT, `${id}-800.jpg`), small));
    }
  }
  console.log("poster", id);
}
await browser.close();
