// Browser regression scenario for Playwright's page fixture (or CLI run-code).
// Run against the local web dev server; all API/R2 requests are intercepted.
export default async function checkDownloadAdmission(page) {
  const results = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  const endpoint = "http://localhost:4000/transfers/final-slot-test";
  const exhausted = { error: "Unavailable", reason: "download_limit_reached" };
  let bundle = false;
  let freshExhausted = false;
  let rejectAdmission = false;
  let admissions = 0;
  let downloads = 0;

  await page.route("http://localhost:4000/**", async (route) => {
    const request = route.request();
    const headers = { "access-control-allow-origin": "*" };
    if (request.url() === `${endpoint}/download`) {
      admissions++;
      await route.fulfill({ status: rejectAdmission ? 410 : 200, headers,
        json: rejectAdmission ? exhausted : { downloadUrl: "https://download.example.test/file", expiresIn: 300 } });
    } else {
      await route.fulfill({ status: freshExhausted ? 410 : 200, headers,
        json: freshExhausted ? exhausted : {
          filename: bundle ? "sendora-files.zip" : "photo.jpg",
          contentType: bundle ? "application/zip" : "image/jpeg",
          size: 1234, expiresAt: "2099-01-01T00:00:00.000Z", maxDownloads: 5, downloadCount: 4,
        } });
    }
  });
  await page.route("https://download.example.test/**", async (route) => {
    downloads++;
    await route.fulfill({ status: 200, headers: { "content-disposition": "attachment; filename=file" },
      contentType: "application/octet-stream", body: "test download" });
  });
  await page.goto("http://localhost:3000");
  await page.evaluate(() => localStorage.removeItem("sendora:owner-token:final-slot-test"));

  for (bundle of [false, true]) {
    const kind = bundle ? "ZIP" : "single file";
    freshExhausted = false;
    rejectAdmission = false;
    const before = admissions;
    const beforeDownloads = downloads;
    await page.goto("http://localhost:3000/d/final-slot-test");
    const action = page.getByRole("button", { name: bundle ? "Download All" : "Download File", exact: true });
    await action.click();
    await page.getByRole("status").filter({ hasText: "Your Download is Starting." }).waitFor();
    await page.getByText("0 downloads remaining. Another download cannot be started.", { exact: true }).waitFor();
    const stoppedAction = page.getByRole("button", { name: "Download started", exact: true });
    check(await stoppedAction.isDisabled(), `${kind}: final success disables another download`);
    // A dispatched click also exercises the handler's count guard independently
    // of native disabled-button suppression.
    await stoppedAction.dispatchEvent("click");
    check(admissions === before + 1, `${kind}: only one authorization issued`);
    check(downloads === beforeDownloads + 1, `${kind}: attachment download started`);
    check(await page.getByRole("region", { name: "Transfer details" }).getByRole("alert").count() === 0, `${kind}: final success has no terminal error`);
    check(await page.getByText("0 downloads remaining. Another download cannot be started.").isVisible(), `${kind}: remaining count is zero`);

    freshExhausted = true;
    await page.reload();
    await page.getByRole("heading", { name: "Download Limit Reached", exact: true }).waitFor();
    check(await page.getByRole("region", { name: "Transfer details" }).getByRole("alert").isVisible(), `${kind}: fresh exhausted metadata is terminal`);

    freshExhausted = false;
    rejectAdmission = true;
    await page.reload();
    await page.getByRole("button", { name: bundle ? "Download All" : "Download File", exact: true }).click();
    await page.getByRole("heading", { name: "Download Limit Reached", exact: true }).waitFor();
    check(await page.getByRole("region", { name: "Transfer details" }).getByRole("alert").isVisible(), `${kind}: stale-page 410 is terminal`);
    check(downloads === beforeDownloads + 1, `${kind}: rejected admission starts no download`);
  }
  return { results };
}
