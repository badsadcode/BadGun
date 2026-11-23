#!/usr/bin/env node
// Batch-render recipes to PNG with the preview page and headless Chromium (Playwright).
//   node tools/render.mjs jobs.json
// jobs.json: [{ "out": "a.png", "recipe": {...}, "view": "side"|"three-quarter", "bg": "15171b"|"none", "width": 1600, "height": 800, "scale": 1 }]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const port = 5000 + Math.floor(Math.random() * 1000);
const server = spawn(process.execPath, [new URL('./serve.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port) } });
await new Promise((r) => server.stdout.once('data', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const job of jobs) {
    const { out, recipe, view = 'three-quarter', bg = '15171b', width = 1600, height = 800, scale = 1 } = job;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.goto(`http://localhost:${port}/tools/preview/index.html?shot=1&view=${view}&bg=${bg}#${encodeURIComponent(JSON.stringify(recipe))}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out, omitBackground: bg === 'none' });
    await page.close();
    console.log('wrote', out);
  }
} finally {
  await browser.close();
  server.kill();
}
