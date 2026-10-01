import { test } from "node:test";
import assert from "node:assert/strict";
import { correctedTime } from "./routes.js";

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);

test("subtracts the time an event waited in the pixel's outbox", () => {
  // Browser clock is 3 hours fast, event waited 2s before sending: skew cancels out.
  const skew = 3 * 3600 * 1000;
  const clientTs = NOW + skew - 2000;
  const sentAt = NOW + skew;
  assert.equal(correctedTime(NOW, sentAt, clientTs).getTime(), NOW - 2000);
});

test("falls back to receive time when timestamps are missing", () => {
  assert.equal(correctedTime(NOW).getTime(), NOW);
});

test("never moves an event into the future, and caps very old delays", () => {
  assert.equal(correctedTime(NOW, 1000, 5000).getTime(), NOW); // negative delay -> 0
  const week = 7 * 24 * 3600 * 1000;
  assert.equal(correctedTime(NOW, 10 * week, 1).getTime(), NOW - week);
});
