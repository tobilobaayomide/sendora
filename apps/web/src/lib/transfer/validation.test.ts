import assert from "node:assert/strict";
import test from "node:test";
import { validateTransferSettings } from "./validation";

test("accepts transfer settings at their inclusive limits", () => {
  assert.deepEqual(validateTransferSettings("1", "1"), {
    expiresInHours: 1,
    maxDownloads: 1,
  });
  assert.deepEqual(validateTransferSettings("168", "100"), {
    expiresInHours: 168,
    maxDownloads: 100,
  });
});

test("returns field-specific errors for invalid transfer settings", () => {
  assert.deepEqual(validateTransferSettings("0", "1"), {
    field: "expiry",
    message: "Choose a whole number from 1 to 168 hours.",
  });
  assert.deepEqual(validateTransferSettings("24", "1.5"), {
    field: "downloads",
    message: "Choose a whole number from 1 to 100 downloads.",
  });
});
