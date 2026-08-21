const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("http://localhost:3000/login");
  await page.click("text=Mike");
  await page.fill('input[name="pin"]', "12345678");
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  await page.goto("http://localhost:3000/admin");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "_diag-admin.png", fullPage: true });

  // click the first parlay's delete button to open the confirm modal (don't confirm)
  const deleteBtn = page.locator("main button", { hasText: "Delete" }).first();
  if (await deleteBtn.count()) {
    await deleteBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "_diag-admin-modal.png", fullPage: true });
    await page.keyboard.press("Escape");
  }

  // check a parlay page's share button renders
  const firstParlayLink = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll("a")).find((a) => /\/parlays\//.test(a.href));
    return link ? link.href : null;
  });

  console.log("ERRORS:", JSON.stringify(errors));
  console.log("FIRST_PARLAY_LINK:", firstParlayLink);

  await browser.close();
})();
