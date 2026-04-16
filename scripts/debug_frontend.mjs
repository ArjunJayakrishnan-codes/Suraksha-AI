import { chromium } from "playwright";
import fs from "fs";
import path from "path";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleLogs = [];
  page.on("console", (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  // Capture page errors
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push({
      error: err.toString(),
      stack: err.stack,
    });
  });

  try {
    console.log("Navigating to http://localhost:8080...");
    await page.goto("http://localhost:8080", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the app to render
    console.log("Waiting for app to render...");
    await page.waitForTimeout(3000);

    // Check if the root element exists and has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById("root");
      return {
        exists: !!root,
        html: root ? root.innerHTML.substring(0, 200) : null,
        children: root ? root.children.length : 0,
      };
    });

    console.log("Root element:", rootContent);

    // Check for error boundaries or error messages
    const errorText = await page.evaluate(() => {
      const body = document.body;
      return {
        bodyText: body.innerText.substring(0, 500),
        bodyHTML: body.innerHTML.substring(0, 500),
      };
    });

    // Take a screenshot
    await page.screenshot({
      path: "playwright_debug_screenshot.png",
      fullPage: true,
    });

    // Output results
    const output = {
      url: "http://localhost:8080",
      timestamp: new Date().toISOString(),
      console: consoleLogs,
      errors: pageErrors,
      rootElement: rootContent,
      bodyContent: errorText,
    };

    fs.writeFileSync(
      "playwright_debug.json",
      JSON.stringify(output, null, 2)
    );
    console.log("Debug output saved to playwright_debug.json");
  } catch (err) {
    console.error("Playwright error:", err);
    fs.writeFileSync(
      "playwright_debug_error.json",
      JSON.stringify({ error: err.toString(), stack: err.stack }, null, 2)
    );
  } finally {
    await browser.close();
  }
})();
