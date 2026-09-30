// Playwright page scenario: only public URLs are copied and feedback resets.
export default async function checkCopyLink(page) {
  const slug = "copy-feedback";
  await page.route("http://localhost:4000/**", route => route.fulfill({ json: {
    filename: "document.pdf", contentType: "application/pdf", size: 12000,
    expiresAt: "2099-01-01T00:00:00Z", maxDownloads: 5, downloadCount: 0,
  } }));
  await page.goto("http://localhost:3000");
  await page.evaluate(slug => localStorage.setItem(`sendora:owner-token:${slug}`, "a".repeat(43)), slug);
  await page.goto(`http://localhost:3000/d/${slug}`);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async value => { window.copiedPublicLink = value; },
  } }));
  await page.getByRole("button", { name: "Copy Link", exact: true }).click();
  await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
  if (await page.evaluate(() => window.copiedPublicLink) !== `http://localhost:3000/d/${slug}`) throw new Error("Unexpected clipboard content");
  await page.getByRole("button", { name: "Copy Link", exact: true }).waitFor();
  return { results: ["copies only the public URL", "shows Copied feedback", "returns to Copy Link after feedback timeout"] };
}
