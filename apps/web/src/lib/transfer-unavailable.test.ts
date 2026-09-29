import assert from "node:assert/strict";
import { test } from "node:test";
import { transferErrorReason } from "./transfer-unavailable";

for (const reason of ["expired", "revoked", "download_limit_reached"] as const) {
  test(`recognizes terminal reason ${reason}`, async () => {
    assert.equal(await transferErrorReason(Response.json({ error: "transfer_unavailable", reason }, { status: 410 })), reason);
  });
}

test("unknown, absent, malformed and non-JSON 410 bodies use the generic fallback", async () => {
  for (const body of [{}, { reason: "unknown" }, { reason: 42 }, null, "expired"]) {
    assert.equal(await transferErrorReason(Response.json(body, { status: 410 })), "unavailable");
  }
  assert.equal(await transferErrorReason(new Response("not JSON", { status: 410 })), "unavailable");
});

test("missing and pending remain distinct; server errors never imply a terminal reason", async () => {
  for (const [status, expected] of [[404, "missing"], [409, "pending"], [500, "connection"], [502, "connection"]] as const) {
    assert.equal(await transferErrorReason(Response.json({ reason: "expired" }, { status })), expected);
  }
});
