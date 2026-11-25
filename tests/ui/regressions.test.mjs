import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";
let browser, server, directory, base;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "zekindo-ui-"));
  const mocks = path.resolve("tests/ui/mocks.tsx");
  await build({
    entryPoints: ["tests/ui/harness.tsx"],
    outdir: directory,
    bundle: true,
    loader: { ".avif": "file" },
    format: "esm",
    jsx: "automatic",
    plugins: [
      {
        name: "isolate-server-actions",
        setup(b) {
          b.onResolve(
            { filter: /^next\/(link|image|navigation)$/ },
            (args) => ({ path: args.path, namespace: "next-mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "next-mock" }, (args) => ({
            contents:
              args.path === "next/link"
                ? `export {Link as default} from ${JSON.stringify(mocks)}`
                : args.path === "next/image"
                  ? `export {Image as default} from ${JSON.stringify(mocks)}`
                  : `export {useRouter,usePathname,useSearchParams} from ${JSON.stringify(mocks)}`,
            loader: "js",
            resolveDir: process.cwd(),
          }));
          b.onResolve(
            {
              filter:
                /^@\/lib\/(actions|auth\/actions|milestone-actions|folder-actions)$/,
            },
            () => ({ path: mocks }),
          );
        },
      },
    ],
  });
  const themePath = path.resolve("src/app/theme.css");
  const theme = await postcss([tailwind()]).process(await readFile(themePath, "utf8"), { from: themePath });
  server = createServer(async (req, res) => {
    const file = req.url.split("?")[0];
    if (file === "/harness.js" || file === "/harness.css") {
      res.setHeader(
        "Content-Type",
        file.endsWith(".js") ? "text/javascript" : "text/css",
      );
      const content = await readFile(path.join(directory, file));
      res.end(file.endsWith(".css") ? theme.css + content.toString() : content);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/harness.css"></head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>',
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function open(component, width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${base}/?component=${component}`);
  return page;
}
test("without financial access, money is masked and register revenue columns are removed", async () => {
  for (const width of [1440, 375]) {
    const page = await open("guest-money", width);
    const field = page.getByTestId("money-field");
    const mask = field.locator('[aria-hidden="true"]');
    assert.equal(await mask.textContent(), "Rp ••••••••");
    assert.equal(
      await mask.evaluate((el) => getComputedStyle(el).filter),
      "blur(4px)",
    );
    await field
      .getByRole("img", { name: "Sign in to view monetary values" })
      .waitFor();
    assert.equal(
      (await page.locator("body").innerText()).includes("1.234.568"),
      false,
    );
    assert.equal(
      (await page.locator("body").innerText()).includes("987.654"),
      false,
    );
    // The register drops revenue columns for roles without financial access.
    assert.equal(
      await page.getByRole("columnheader", { name: /Bid Value|OE \(Rp\)/ }).count(),
      0,
    );
    await page.getByRole("button", { name: /Columns/ }).first().click();
    await page.getByRole("checkbox", { name: "Qty" }).waitFor();
    assert.equal(await page.getByRole("checkbox", { name: "OE (Rp)" }).count(), 0);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("link", { name: "Export to Excel" }).isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.close();
  }
});

test("signed-in viewers see monetary fields and metrics without administrator controls", async () => {
  for (const width of [1440, 375]) {
    const page = await open("viewer-money", width);
    assert.equal(
      await page.getByTestId("money-field").textContent(),
      "Rp 1.234.568",
    );
    assert.equal(
      await page
        .getByRole("img", { name: "Sign in to view monetary values" })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: "Sign in to view amounts" }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: /Edit result/ }).count(),
      0,
    );
    assert.ok(
      (await page.locator("body").innerText()).includes("Rp 1,2 Jt") ||
        (await page.locator("body").innerText()).includes("Rp 1.2 Jt"),
    );
    assert.ok((await page.locator("body").innerText()).includes("987.654"));
    await page.close();
  }
});
test("mobile account shows sign out without duplicating navigation", async () => {
  const page = await open("nav", 375);
  await page.goto(page.url() + "&track=downstream");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.getByRole("link").count(), 0);
  assert.equal(
    await dialog
      .getByRole("button", { name: "Sign out", exact: true })
      .isVisible(),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Account", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.close();
});
test("collapsed desktop navigation leaves no rail and can be reopened", async () => {
  const page = await open("nav", 1440);
  const toggle = page.getByRole("button", {name: "Toggle navigation"});
  const settings = page.getByRole("link", {name: "Settings", exact: true});
  await settings.waitFor();
  await toggle.click();
  await settings.waitFor({state: "hidden"});
  assert.equal(await page.locator('[data-slot="sidebar-gap"]').evaluate(el => el.offsetWidth), 0);
  await toggle.click();
  await settings.waitFor();
  await page.close();
});
test("decimal fields retain fractions and precision during editing", async () => {
  const page = await open("number");
  const input = page.getByRole("textbox", { name: "Amount" });
  await input.focus();
  assert.equal(await input.inputValue(), "123.45");
  await input.fill("9007199254740993.50");
  await input.blur();
  assert.equal(await input.inputValue(), "9.007.199.254.740.993,50");
  await page.close();
});
test("new tender validates identity, reviews all stages and surfaces save errors", async () => {
  const page = await open("wizard");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(
    await page.getByRole("combobox", { name: "Area", exact: true }).isVisible(),
    true,
  );
  await page
    .getByRole("combobox", { name: "Area", exact: true })
    .selectOption("Jawa");
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption("Customer");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Entity / Consortium", exact: true })
    .waitFor();
  await page.getByLabel("Quantity", { exact: true }).fill("12.5");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create tender", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Test save blocked" })
    .waitFor();
  await page.close();
});
test("table filters reset pagination and selection; URL and export match", async () => {
  const page = await open("table");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select tender TN-51", exact: true })
    .check();
  await page.getByRole("searchbox").fill("Package 11");
  await page.getByText("Page 1 of 1", { exact: true }).waitFor();
  assert.equal(await page.getByText("1 selected", { exact: true }).count(), 0);
  await page.waitForURL(/search=Package/);
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Export to Excel", exact: true })
        .getAttribute("href")
    ).includes("search=Package+11"),
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click();
  await page.getByText("Page 1 of 5", { exact: true }).waitFor();
  await page.close();
});
test("deadline cards filter the register and preserve the Excel scope", async () => {
  const page = await open("table");
  await page.getByRole("button", { name: /Needs follow-up/ }).click();
  await page.waitForURL(/deadline=followup/);
  assert.match(await page.getByRole("link", {name: "Export to Excel"}).getAttribute("href"), /deadline=followup/);
  await page.reload();
  assert.equal(await page.getByRole("button", {name: /Needs follow-up/}).getAttribute("aria-pressed"), "true");
  await page.getByRole("tab", {name:"Won", exact:true}).click();
  await page.waitForURL(/result=WIN/);
  assert.equal(new URL(page.url()).searchParams.has("deadline"), false);
  await page.close();
});
test("sorting and quick edits work with keyboard; detail links preserve context", async () => {
  const page = await open("table");
  const sort = page.getByRole("button", { name: "Customer", exact: true });
  await sort.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("columnheader", { name: /Customer/ })
      .getAttribute("aria-sort"),
    "ascending",
  );
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Columns", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  assert.ok(
    (
      await page
        .getByRole("link", { name: "TN-1", exact: true })
        .getAttribute("href")
    ).startsWith("/tenders/0?returnTo="),
  );
  await page
    .getByRole("button", { name: "Edit result for TN-1", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: "Edit result for TN-1", exact: true })
    .waitFor();
  await page.close();
});
test("schedule matrix opens on desktop and phone and contains long package names", async () => {
  for (const width of [390, 1440]) {
    const page = await open("table", width);
    const matrix = page.getByRole("region", {name:"Schedule matrix"});
    await matrix.getByRole("columnheader", {name:"Site visit"}).waitFor();
    const link = matrix.getByRole("link", {name:"Package 1", exact:true});
    assert.match(await link.getAttribute("href"), /^\/tenders\/0/);
    assert.equal(await link.getAttribute("title"), "Package 1");
    const truncated = await link.evaluate(el => {
      const height = el.offsetHeight;
      el.textContent = "UnbrokenPackageReference".repeat(12);
      const style = getComputedStyle(el);
      return el.scrollWidth > el.clientWidth && el.offsetHeight === height &&
        style.textOverflow === "ellipsis" && style.overflowX === "hidden";
    });
    assert.ok(truncated, `expected a single truncated line at ${width}px`);
    if (width === 390) assert.ok(await matrix.evaluate(el => el.scrollWidth > el.clientWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
  }
});
test("long statuses and editors stay inside the cell, and matrix preferences work", async () => {
  for (const width of [390, 1440]) {
    const page = await open("table&audit=1", width);
    const status = page.getByRole("button", {name:"Edit result for TN-1", exact:true});
    const inside = el => {
      const cell = el.closest("td").getBoundingClientRect();
      const content = el.getBoundingClientRect();
      return content.left >= cell.left - 1 && content.right <= cell.right + 1;
    };
    assert.ok(await status.locator('[data-slot="badge"]').evaluate(inside));
    await status.click();
    const editor = page.getByRole("combobox",{name:"Edit result for TN-1",exact:true});
    assert.ok(await editor.evaluate(inside));
    await page.getByRole("combobox",{name:"Jump to milestone"}).selectOption("site");
    assert.equal(await page.evaluate(() => document.activeElement.closest("th")?.dataset.column),"site");
    await page.getByRole("button",{name:"Columns",exact:true}).click();
    await page.getByRole("searchbox",{name:"Find a column"}).fill("site");
    await page.getByRole("checkbox",{name:"Site visit"}).uncheck();
    assert.equal(await page.getByRole("columnheader",{name:"Site visit"}).count(),0);
    await page.getByRole("checkbox",{name:"Compact rows"}).check();
    await page.getByRole("button",{name:"Restore default columns"}).click();
    await page.keyboard.press("Escape");
    await page.getByRole("columnheader",{name:"Site visit"}).waitFor();
    assert.equal(await page.getByRole("table").getAttribute("data-compact"), "true");
    await page.close();
  }
});
test("saved views restore filter state and column preferences persist", async () => {
  const page = await open("table");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Result", exact: true })
    .selectOption("WIN");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "View name" }).fill("Wins");
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Saved views", exact: true })
    .selectOption("0");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Result", exact: true })
      .inputValue(),
    "WIN",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByRole("checkbox", { name: "Period", exact: true }).check();
  await page.reload();
  await page.getByRole("columnheader", { name: /Period/ }).waitFor();
  await page.close();
});
test("failed user removal and role changes preserve server-confirmed rows", async () => {
  const page = await open("users");
  const row = page.getByRole("row").filter({ hasText: "Test Viewer" });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await row.waitFor();
  await row.getByRole("combobox").selectOption("admin");
  await page
    .getByRole("alert")
    .filter({ hasText: "Could not update role" })
    .waitFor();
  assert.equal(await row.getByRole("combobox").inputValue(), "viewer");
  await page.close();
});
test("user creation validates inputs and refreshes after success", async () => {
  const page = await open("users");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("New user");
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("new@example.test");
  await dialog
    .getByLabel("Initial password", { exact: true })
    .fill("example-password");
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  assert.equal(
    await page.locator("body").getAttribute("data-refreshed"),
    "true",
  );
  await page.close();
});
test("document folder actions use a dialog and upload errors restore controls", async () => {
  const page = await open("documents");
  await page.getByRole("button", { name: /Site Visit/ }).click();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Folder name", exact: true })
    .fill("Proposals");
  await page.getByRole("button", { name: "Save folder", exact: true }).click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("button", { name: "Upload files", exact: true })
    .waitFor({ state: "visible" });
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await (
    await choosing
  ).setFiles({
    name: "test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("fixture"),
  });
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Upload files", exact: true })
      .isEnabled(),
    true,
  );
  await page.close();
});
test("bulk archive confirms intent and failure uses alert feedback", async () => {
  const page = await open("table");
  await page
    .getByRole("checkbox", { name: "Select tender TN-1", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Archive selected", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").textContent(),
    "Could not archive tenders",
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Select tender TN-1", exact: true })
      .isChecked(),
    true,
  );
  await page.close();
});
test("edit saves decimal values and an empty milestone order together", async () => {
  const page = await open("edit");
  await page.getByRole("button", { name: "Milestones", exact: true }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").waitFor();
  const saved = JSON.parse(
    await page.locator("body").getAttribute("data-saved"),
  );
  assert.deepEqual(saved.milestoneOrder, []);
  assert.equal(saved.qty, "12.5");
  await page.close();
});
test("permanent deletion requires typed confirmation and surfaces failure", async () => {
  const page = await open("archive");
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Delete permanently", exact: true })
      .isDisabled(),
    true,
  );
  await dialog.getByRole("textbox").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  await page.close();
});
test("deadline views export a readable calendar and handle empty followups", async () => {
  const page = await open("deadlines");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download calendar", exact: true })
    .click();
  assert.equal((await download).suggestedFilename(), "zekindo-deadlines.ics");
  await page
    .getByRole("button", { name: "Needs follow-up", exact: true })
    .click();
  await page
    .getByText("Nothing matches this view.", { exact: false })
    .waitFor();
  await page.close();
});
test("milestone catalogs switch tracks without mixing them", async () => {
  const page = await open("milestones");
  await page.getByRole("button", { name: "Downstream", exact: true }).click();
  await page
    .getByRole("heading", { name: "Downstream milestones", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Upstream milestones", exact: true })
      .count(),
    0,
  );
  await page.close();
});
test("dirty forms guard navigation and allow an explicit discard", async () => {
  const page = await open("wizard");
  await page
    .getByRole("textbox", { name: "Tender number", exact: true })
    .fill("DRAFT");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/tenders";
    link.textContent = "Other page";
    document.body.append(link);
  });
  await page.getByRole("link", { name: "Other page", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("heading", { name: "Leave without saving?", exact: true })
    .waitFor();
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Tender number", exact: true })
      .inputValue(),
    "DRAFT",
  );
  await page.getByRole("link", { name: "Other page", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard and leave", exact: true })
    .click();
  assert.equal(
    await page.locator("body").getAttribute("data-pushed"),
    "/tenders",
  );
  await page.close();
});
test("custom milestones remain available after reviewing a new tender", async () => {
  const page = await open("wizard");
  await page
    .getByRole("combobox", { name: "Area", exact: true })
    .selectOption("Jawa");
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption("Customer");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Create a custom milestone", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Custom milestone name", exact: true })
    .fill("Special gate");
  await page
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await page.getByLabel("Special gate", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByLabel("Special gate", { exact: true }).waitFor();
  await page.close();
});
test("login preserves entries after a failed sign-in and supports password visibility", async () => {
  const page = await open("login");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Email address", exact: true })
      .inputValue(),
    "test@example.test",
  );
  await page.close();
});
test("key screens and admin forms fit narrow phones, tablets and desktop", async () => {
  for (const width of [320, 768, 1440])
    for (const component of [
      "nav",
      "table",
      "wizard",
      "edit",
      "users",
      "documents",
      "deadlines",
      "milestones",
      "login",
    ]) {
      const page = await open(component, width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false, `${component} overflow at ${width}`);
      await page.close();
    }
});
test("file uploads complete registration after storage transfer", async () => {
  const page = await open("documents");
  await page.goto(page.url() + "&upload=success");
  await page.getByRole("button", { name: /Site Visit/ }).click();
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await (
    await choosing
  ).setFiles([
    { name: "one.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
    { name: "two.txt", mimeType: "text/plain", buffer: Buffer.from("two") },
  ]);
  await page
    .getByRole("status")
    .filter({ hasText: "2 files uploaded." })
    .waitFor();
  const uploaded = JSON.parse(
    await page.locator("body").getAttribute("data-uploaded"),
  );
  assert.equal(uploaded.length, 2);
  assert.equal(uploaded[0].fileName, "one.txt");
  assert.equal(uploaded[1].size, 3);
  await page.close();
});
