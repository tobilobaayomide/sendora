// Playwright page scenario. Size boundaries use tiny Files with mocked sizes.
export default async function checkFileSelection(page) {
  const results = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  await page.route("http://localhost:4000/**", route => route.abort());
  await page.goto("http://localhost:3000");
  const input = page.locator("#upload-file");
  const file = name => ({ name, mimeType: "text/plain", buffer: Buffer.from("test") });
  await input.setInputFiles(file("A.txt"));
  check(await page.getByRole("button", { name: "Send File", exact: true }).isEnabled(), "one selected file enables Send File");
  check(await page.getByRole("button", { name: "Add File", exact: true }).isVisible(), "single-file Add File action is available");
  await input.setInputFiles(file("B.txt"));
  await page.getByText("2 files selected", { exact: true }).waitFor();
  check(await page.getByRole("button", { name: "Send 2 Files", exact: true }).isEnabled(), "adding one file switches to multi-file selection");
  await input.setInputFiles([file("C.txt"), file("D.txt")]);
  await page.getByText("4 files selected", { exact: true }).waitFor();
  check(await page.getByText("A.txt", { exact: true }).isVisible(), "adding multiple files preserves existing selection");
  await page.getByRole("button", { name: "Remove B.txt", exact: true }).click();
  check(await page.getByRole("button", { name: "Send 3 Files", exact: true }).isEnabled() && await page.getByText("B.txt", { exact: true }).count() === 0, "individual removal works after adding");
  await page.getByRole("button", { name: "Clear All", exact: true }).click();
  check(await page.getByRole("button", { name: "Send File", exact: true }).isDisabled(), "Clear All empties selection");
  async function selectSized(items) {
    await page.evaluate(items => {
      const dt = new DataTransfer();
      for (const { name, size } of items) {
        const file = new File(["x"], name);
        Object.defineProperty(file, "size", { value: size });
        dt.items.add(file);
      }
      const input = document.querySelector("#upload-file");
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, items);
  }
  await selectSized([{ name: "large.txt", size: 300 * 1024 * 1024 }]);
  await selectSized([{ name: "too-large.txt", size: 250 * 1024 * 1024 }]);
  await page.getByRole("alert").filter({ hasText: "Multiple files can total up to 500 MB" }).waitFor();
  check(await page.getByText("large.txt", { exact: true }).isVisible() && await page.getByText("too-large.txt", { exact: true }).count() === 0, "combined size rejects addition and preserves prior valid selection");
  await selectSized([{ name: "fits.txt", size: 200 * 1024 * 1024 }]);
  await page.getByText("2 files selected", { exact: true }).waitFor();
  check(await page.getByRole("button", { name: "Send 2 Files", exact: true }).isEnabled(), "exact combined limit is accepted");
  await selectSized(Array.from({ length: 499 }, (_, i) => ({ name: `empty-${i}`, size: 0 })));
  await page.getByRole("alert").filter({ hasText: "500 files" }).waitFor();
  check(await page.getByText("2 files selected", { exact: true }).isVisible(), "combined count limit preserves previous files");
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File(["drop"], "dropped.txt"));
    document.querySelector("#upload-file").parentElement.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  });
  check(await page.getByRole("button", { name: "Send File", exact: true }).isEnabled() && await page.getByText("dropped.txt", { exact: true }).isVisible(), "drag/drop retains its existing replacement behavior");
  await input.setInputFiles(Array.from({ length: 40 }, (_, index) => file(`list-${index}.txt`)));
  check(await page.getByRole("list", { name: "Selected files" }).evaluate(list => list.scrollHeight > list.clientHeight), "large file lists scroll inside a bounded region");
  check(await page.getByRole("button", { name: "Clear All", exact: true }).isVisible(), "list controls remain outside the scroll region");
  return { results };
}
