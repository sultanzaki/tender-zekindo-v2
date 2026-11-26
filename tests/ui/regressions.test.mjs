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
    if (width > 600) {
      // The Columns menu exists only beside the desktop matrix.
      await page.getByRole("button", { name: /Columns/ }).first().click();
      await page.getByRole("checkbox", { name: "Qty" }).waitFor();
      assert.equal(await page.getByRole("checkbox", { name: "OE (Rp)" }).count(), 0);
      await page.keyboard.press("Escape");
    }
    assert.equal(
      await page.getByRole("link", { name: "Export to Excel" }).count(),
      0,
      "export is administrator-only",
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
    // Bid values appear in the desktop matrix; phone cards keep to the schedule.
    if (width > 600)
      assert.ok((await page.locator("body").innerText()).includes("987.654"));
    await page.close();
  }
});
test("administrators add milestone notes in place; others only read them", async () => {
  const page = await open("milestone-note");
  const reader = page.getByTestId("reader");
  assert.equal(await reader.innerText(), "Read me");
  assert.equal(await reader.getByRole("button").count(), 0);
  await page.getByRole("button", { name: "Add note for Prebid" }).click();
  const field = page.getByLabel("Notes for Prebid");
  await field.fill("fail on purpose");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("alert").filter({ hasText: "Could not save note" }).waitFor();
  assert.equal(await field.inputValue(), "fail on purpose", "draft survives a failed save");
  await field.fill("Dokumen sudah dikirim");
  await field.press("Control+Enter");
  await page.getByRole("button", { name: "Edit note for Prebid" }).waitFor();
  assert.ok((await page.locator("body").innerText()).includes("Dokumen sudah dikirim"));
  assert.deepEqual(JSON.parse(await page.evaluate(() => document.body.dataset.note)), {
    key: "prebid",
    note: "Dokumen sudah dikirim",
  });
  await page.close();
});

test("inactivity warns after 59 minutes and signs out at 60 unless the user stays", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.clock.install();
  await page.goto(`${base}/?component=nav`);
  await page.getByText("Page content").waitFor();
  await page.clock.runFor("58:00");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.clock.runFor("01:05");
  const dialog = page.getByRole("dialog", { name: "Still there?" });
  await dialog.waitFor();
  await page.mouse.wheel(0, 200);
  await page.clock.runFor("00:02");
  assert.equal(await dialog.isVisible(), true, "stray input does not dismiss the warning");
  // The frozen test clock stops the dialog animation, so skip the stability wait.
  await dialog.getByRole("button", { name: "Stay signed in" }).click({ force: true });
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.body.dataset.heartbeats), "1");
  assert.equal(await page.evaluate(() => document.body.dataset.idleLogout), undefined);
  await page.clock.runFor("01:00:05");
  await page.waitForFunction(() => document.body.dataset.idleLogout === "true");
  await page.close();
});

test("calendar shows colour-coded stages, details, filters and a phone agenda", async () => {
  const page = await open("calendar", 1440);
  const grid = page.getByRole("region", { name: "November 2026 month view" });
  await grid.waitFor();
  assert.match(await page.locator("body").innerText(), /6 due within 3 days/);
  const chip = grid.getByRole("button", { name: "Prebid: Production Chemical Supply" });
  assert.equal(await chip.getAttribute("data-tone"), "urgent");
  await chip.click();
  const detail = page.getByRole("dialog");
  await detail.getByText("Tomorrow").waitFor();
  assert.equal(await detail.getByRole("link", { name: /Production Chemical Supply/ }).getAttribute("href"), "/tenders/C0");
  await page.keyboard.press("Escape");
  // 25 Nov holds five entries: two shown, the rest behind "+N more".
  await grid.getByRole("button", { name: "+3 more" }).click();
  const day = page.getByRole("dialog").filter({ hasText: "Wednesday 25 November" });
  await day.waitFor();
  assert.equal(await day.getByRole("article").count(), 5);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Downstream", exact: true }).click();
  assert.equal(await grid.getByRole("button", { name: /Production Chemical Supply/ }).count(), 0);
  await page.getByRole("button", { name: "All tracks" }).click();
  await page.getByLabel("Meetings").uncheck();
  assert.equal(await grid.getByRole("button", { name: /^Meeting/ }).count(), 0);
  await page.getByLabel("Hide closed tenders").check();
  assert.equal(await grid.locator('[data-tone="closed"]').count(), 0);
  await page.getByRole("button", { name: "Agenda" }).click();
  assert.equal(await grid.isVisible(), false);
  await page.getByRole("region", { name: "November 2026 agenda" }).waitFor();
  await page.close();

  const phone = await open("calendar", 375);
  assert.equal(await phone.getByRole("region", { name: "November 2026 month view" }).isVisible(), false);
  await phone.getByRole("region", { name: "November 2026 agenda" }).getByRole("link", { name: /Field Test|Demulsifier/ }).first().waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.close();
});

test("access-log filter pills stay readable when active, on desktop and phone", async () => {
  // WCAG contrast ratio between an element's text and its own background.
  const contrast = (locator) =>
    locator.evaluate((el) => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (c) => {
        const [r, g, b] = rgb(c).map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const style = getComputedStyle(el);
      let bg = style.backgroundColor;
      for (let n = el; n && /rgba\(.*, 0\)|transparent/.test(bg); n = n.parentElement)
        bg = getComputedStyle(n).backgroundColor;
      const [a, b] = [lum(style.color), lum(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
  for (const [active, label] of [["export", "Excel export"], ["", "All events"]]) {
    for (const width of [1280, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 700 } });
      await page.goto(`${base}/?component=access-filters&active=${active}`);
      const pill = page.getByRole("link", { name: label });
      assert.equal(await pill.getAttribute("aria-current"), "page");
      assert.equal(await page.locator("[aria-current=page]").count(), 1);
      for (const link of await page.getByRole("link").all())
        assert.ok((await contrast(link)) >= 4.5, `${await link.innerText()} at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.close();
    }
  }
});

test("mobile account shows sign out without duplicating navigation", async () => {
  const page = await open("nav", 375);
  await page.goto(page.url() + "&track=downstream");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  // Only the account's own page; the main navigation is not repeated here.
  assert.deepEqual(await dialog.getByRole("link").allInnerTexts(), ["Account security"]);
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
test("phones list tenders as cards linking to detail instead of the matrix", async () => {
  const page = await open("table", 390);
  assert.equal(await page.getByRole("region", { name: "Schedule matrix" }).isVisible(), false);
  const cards = page.getByRole("list", { name: "Tenders" });
  const first = cards.getByRole("link").first();
  await first.waitFor();
  assert.match(await first.getAttribute("href"), /^\/tenders\//);
  assert.equal(await page.getByRole("button", { name: /Columns/ }).isVisible(), false);
  assert.equal(await page.getByRole("combobox", { name: "Jump to milestone" }).count() === 0 ||
    !(await page.getByRole("combobox", { name: "Jump to milestone" }).isVisible()), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.close();
});
test("schedule matrix opens on desktop and contains long package names", async () => {
  for (const width of [1440]) {
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
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
  }
});
test("long statuses and editors stay inside the cell, and matrix preferences work", async () => {
  for (const width of [1024, 1440]) {
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
async function stageOrder(page) {
  return page.getByRole("button", { name: /^Drag to reorder / }).evaluateAll((handles) =>
    handles.map((h) => h.getAttribute("aria-label").replace("Drag to reorder ", "")));
}
async function mouseDrag(page, from, to) {
  // Centre the dragged row so the target is on screen on short phone viewports.
  await page
    .getByRole("button", { name: `Drag to reorder ${from}` })
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const a = await page.getByRole("button", { name: `Drag to reorder ${from}` }).boundingBox();
  const b = await page.getByRole("button", { name: `Drag to reorder ${to}` }).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + ((b.y - a.y + 6) * i) / 10);
  await page.mouse.up();
}
test("tender stages reorder by mouse and keyboard drag and save in that order", async () => {
  const page = await open("edit-reorder");
  await page.getByRole("button", { name: "Milestones", exact: true }).click();
  assert.deepEqual(await stageOrder(page), ["Stage A", "Stage B", "Stage C"]);
  await mouseDrag(page, "Stage A", "Stage C");
  await page.waitForFunction(() => document.querySelectorAll("[data-dragging]").length === 0);
  assert.deepEqual(await stageOrder(page), ["Stage B", "Stage C", "Stage A"]);
  const handle = page.getByRole("button", { name: "Drag to reorder Stage A" });
  await handle.focus();
  // Each step waits for the screen-reader announcement, as a user would.
  const live = page.locator("[role=status][aria-live]");
  await page.keyboard.press("Space");
  await page.locator("[data-dragging]").waitFor();
  // dnd-kit's keyboard sensor attaches its arrow-key listener on the next
  // task after pick-up; a person never presses that fast.
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowUp");
  await live.filter({ hasText: "is over position 2 of 3." }).waitFor({ state: "attached" });
  await page.keyboard.press("Space");
  await live.filter({ hasText: "Stage A dropped at position 2 of 3." }).waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelectorAll("[data-dragging]").length === 0);
  assert.deepEqual(await stageOrder(page), ["Stage B", "Stage A", "Stage C"]);
  await page.getByRole("button", { name: "Move Stage C up" }).click();
  assert.deepEqual(await stageOrder(page), ["Stage B", "Stage C", "Stage A"], "arrow buttons still work");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").waitFor();
  const saved = JSON.parse(await page.locator("body").getAttribute("data-saved"));
  assert.deepEqual(saved.milestoneOrder, ["b", "c", "a"]);
  await page.close();
});
test("template stages reorder by drag and submit the whole track order", async () => {
  for (const width of [1280, 375]) {
    const page = await open("milestones-reorder", width);
    await mouseDrag(page, "Stage C", "Stage A");
    await page.waitForFunction(() => document.body.dataset.reordered);
    assert.deepEqual(JSON.parse(await page.evaluate(() => document.body.dataset.reordered)), {
      track: "upstream",
      ids: ["c", "a", "b"],
    });
    assert.deepEqual(await stageOrder(page), ["Stage C", "Stage A", "Stage B"]);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.close();
  }
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
