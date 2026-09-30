import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { archiveNames, prepareUpload, selectionError, MAX_BUNDLE_BYTES, isSendoraBundle } from "./prepare-upload";

test("single file preserves identity, name, MIME and bypasses bundle size limit", async () => {
  const file = new File(["original"], "photo.png", { type: "image/png" });
  assert.equal(await prepareUpload([file]), file);
  assert.equal(selectionError([{ size: MAX_BUNDLE_BYTES + 1 } as File]), null);
});

test("multiple files produce a STORE ZIP with actual archive size and all contents", async () => {
  const files = [new File(["first"], "holiday.jpg"), new File(["second"], "holiday.jpg")];
  const result = await prepareUpload(files);
  assert.equal(result.name, "sendora-files.zip");
  assert.equal(result.type, "application/zip");
  assert.ok(result.size > files.reduce((sum, file) => sum + file.size, 0));
  const bytes = await result.arrayBuffer();
  assert.equal(new DataView(bytes).getUint16(8, true), 0); // ZIP STORE method
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(zip.files), ["holiday.jpg", "holiday (2).jpg"]);
  assert.equal(await zip.file("holiday.jpg")!.async("string"), "first");
  assert.equal(await zip.file("holiday (2).jpg")!.async("string"), "second");
});

test("names stay flat and unique, including suffix collisions and Unicode", () => {
  const names = archiveNames(["../evil.txt", "C:\\temp\\evil.txt", "/root.txt", ".", "..", "a.jpg", "a.jpg", "a (2).jpg", "A.JPG", "été (1).txt"].map(name => ({ name })));
  assert.ok(names.every(name => !/[\\/]/.test(name) && name !== "." && name !== ".."));
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length);
  assert.deepEqual(names.slice(5), ["a.jpg", "a (2).jpg", "a (2) (2).jpg", "A (3).JPG", "été (1).txt"]);
});

test("bundle limit validates aggregate bytes and entry count before reading files", async () => {
  const sized = (size: number) => ({ size } as File);
  assert.equal(MAX_BUNDLE_BYTES, 500 * 1024 * 1024);
  assert.equal(selectionError([sized(MAX_BUNDLE_BYTES - 2), sized(1)]), null);
  assert.equal(selectionError([sized(MAX_BUNDLE_BYTES - 1), sized(1)]), null);
  assert.match(selectionError([sized(MAX_BUNDLE_BYTES), sized(1)])!, /500 MB/);
  await assert.rejects(prepareUpload([sized(MAX_BUNDLE_BYTES), sized(1)]), /500 MB/);
  assert.equal(selectionError(Array.from({ length: 500 }, () => sized(0))), null);
  assert.match(selectionError(Array.from({ length: 501 }, () => sized(0)))!, /500/);
});

test("read failures reject packaging without returning a partial upload", async () => {
  const broken = new File(["x"], "broken.txt");
  broken.arrayBuffer = async () => { throw new Error("read failed"); };
  await assert.rejects(prepareUpload([new File(["ok"], "ok.txt"), broken]), /read failed/);
});

test("bundle presentation only recognizes the branded filename and ZIP MIME", () => {
  assert.equal(isSendoraBundle("sendora-files.zip", "application/zip"), true);
  assert.equal(isSendoraBundle("original.zip", "application/zip"), false);
  assert.equal(isSendoraBundle("sendora-files.zip", "text/plain"), false);
});

 test("whitespace traversal and reserved device names are neutralized", () => {
  assert.deepEqual(archiveNames([{name:" .. "}, {name:"CON.txt"}]), ["file", "_CON.txt"]);
});
