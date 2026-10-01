import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSource, resolveTouchSource } from "./sources.js";
import { isBot } from "../lib/bots.js";

test("normalizeSource accepts known sources regardless of case/whitespace", () => {
  assert.equal(normalizeSource("google"), "google");
  assert.equal(normalizeSource("  KOAH "), "koah");
  assert.equal(normalizeSource("Facebook"), "facebook");
});

test("normalizeSource rejects unknown or empty sources", () => {
  assert.equal(normalizeSource("tiktok"), null);
  assert.equal(normalizeSource(""), null);
  assert.equal(normalizeSource(null), null);
});

test("a Koah click id wins over a mismatched UTM tag", () => {
  assert.equal(resolveTouchSource("facebook", "cid_123"), "koah");
  assert.equal(resolveTouchSource("google", null), "google");
  assert.equal(resolveTouchSource(null, null), null);
});

test("isBot flags crawlers, headless browsers and missing user agents", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot("Mozilla/5.0 HeadlessChrome/120.0"), true);
  assert.equal(isBot("curl/8.4.0"), true);
  assert.equal(isBot(undefined), true);
  assert.equal(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36"), false);
});
