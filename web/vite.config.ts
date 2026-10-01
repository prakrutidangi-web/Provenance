import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { randomUUID } from "node:crypto";

// In dev, Vite serves the store on :5180 and proxies the tracking + API routes to
// the Express server on :4180, so the pixel and the store share one origin.
const API = "http://127.0.0.1:4180";

/**
 * Sets the first-party user id cookie on the HTML document response, like the
 * Express server does in production (and like Koah's docs recommend: the
 * advertiser's server sets it on every page load). Establishing identity BEFORE
 * any script runs avoids a race where the first pixel request and a fast
 * checkout request each mint a different id.
 */
function firstPartyIdentity(): Plugin {
  return {
    name: "koah-first-party-identity",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const wantsHtml = (req.headers.accept ?? "").includes("text/html");
        const hasId = /(?:^|;\s*)koah_uid=/.test(req.headers.cookie ?? "");
        if (wantsHtml && !hasId) {
          res.setHeader("Set-Cookie", `koah_uid=${randomUUID()}; Path=/; Max-Age=${365 * 86400}; HttpOnly; SameSite=Lax`);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), firstPartyIdentity()],
  server: {
    port: 5180,
    strictPort: true, // fail loudly instead of silently sharing a port with another app
    proxy: { "/api": API, "/kad": API, "/pixel.js": API },
  },
});
