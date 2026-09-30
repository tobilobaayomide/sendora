// Playwright page scenario. API responses and XHR are controlled; no real R2.
export default async function checkUploadProgress(page) {
  const results = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  let metadata;
  let complete;
  let completionCalls = 0;
  await page.addInitScript(() => {
    window.XMLHttpRequest = class {
      upload = {};
      status = 200;
      open() {}
      setRequestHeader() {}
      send(body) { this.body = body; window.testUpload = this; }
    };
  });
  await page.route("http://localhost:4000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = { "access-control-allow-origin": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-methods": "POST,GET", "access-control-allow-headers": "content-type" } });
    if (path === "/uploads/presign") {
      metadata = route.request().postDataJSON();
      return route.fulfill({ headers, json: { slug: "progress-test", uploadUrl: "https://upload.example.test", ownerToken: "a".repeat(43) } });
    }
    if (path.endsWith("/complete")) {
      completionCalls++;
      await new Promise((resolve) => { complete = resolve; });
      return route.fulfill({ headers, json: { status: "ready" } });
    }
    return route.fulfill({ headers, json: { ...metadata, expiresAt: "2099-01-01T00:00:00Z", downloadCount: 0 } });
  });
  for (const count of [1, 2]) {
    await page.goto("http://localhost:3000");
    await page.locator('#upload-file').setInputFiles(Array.from({ length: count }, (_, index) => ({ name: `file${index}.txt`, mimeType: "text/plain", buffer: Buffer.from("test bytes") })));
    await page.getByRole("button", { name: count === 1 ? "Send File" : "Send 2 Files", exact: true }).click();
    await page.getByRole("progressbar").waitFor();
    check(await page.evaluate(() => window.testUpload.body.size) === metadata.size, `${count} file(s): actual upload size matches presign`);
    if (count === 2) check(metadata.size > 20 && metadata.filename === "sendora-files.zip", "ZIP progress uses generated archive size");
    await page.evaluate(() => window.testUpload.upload.onprogress({ loaded: window.testUpload.body.size / 2 }));
    check(await page.getByRole("progressbar").getAttribute("aria-valuenow") === "50", `${count} file(s): measured half upload shows 50%`);
    for (const scheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 390, height: 1000 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${count} file(s): ${scheme} mobile fits`);
    }
    const before = completionCalls;
    await page.evaluate(() => window.testUpload.upload.onprogress({ loaded: window.testUpload.body.size }));
    check(completionCalls === before, "100% alone does not finalize before R2 response");
    await page.evaluate(() => window.testUpload.onload());
    await page.getByRole("button", { name: "Finalizing your transfer…", exact: true }).waitFor();
    check(await page.getByRole("progressbar").getAttribute("aria-valuenow") === "100", "finalizing retains measured full progress without showing ready");
    check(new URL(page.url()).pathname === "/", "not ready before completion");
    // The UI update can precede interception of the completion request.
    for (let attempt = 0; completionCalls === before && attempt < 100; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    check(completionCalls === before + 1, "completion requested exactly once after R2 success");
    complete();
    await page.waitForURL("**/d/progress-test");
    await page.getByRole("heading", { name: "Transfer Ready", exact: true }).waitFor();
    check(true, `${count} file(s): completion success opens ready owner view`);
  }
  return { results };
}
