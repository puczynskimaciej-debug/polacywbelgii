import { chromium } from "playwright-core";
import { readFile, mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const siteRoot = path.resolve('_site');
const staticServer = process.env.TEST_BASE_URL ? null : createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(siteRoot, `.${pathname}`);
    if (filename !== siteRoot && !filename.startsWith(`${siteRoot}${path.sep}`)) { response.writeHead(403).end(); return; }
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(await readFile(filename));
  } catch { response.writeHead(404).end(); }
});
if (staticServer) await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${staticServer.address().port}`;
const executablePath = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDirectory = process.env.RESPONSIVE_OUTPUT_DIR ? path.resolve(process.env.RESPONSIVE_OUTPUT_DIR) : path.resolve(".local", "responsive-audit");
const viewports = [
  { name: "small-phone", width: 360, height: 740 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small-laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 }
];
const publicPages = ["/", "/artykuly/", "/artykuly/test/", "/kontakt/"];
const failures = [];
const results = [];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  for (const pagePath of publicPages) {
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "networkidle" });
    await auditPage(page, `${viewport.name}:${pagePath}`);
  }

  if (viewport.width <= 768) {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.locator(".nav-toggle").click();
    await expectVisible(page, ".main-nav.is-open", `${viewport.name}: mobile navigation`);
    await page.screenshot({ path: path.join(outputDirectory, `${viewport.name}-public-menu.png`), fullPage: false });
  }

  await configureCmsMock(page);
  await page.goto(`${baseUrl}/admin/`, { waitUntil: "networkidle" });
  await expectVisible(page, "#app-view", `${viewport.name}: CMS application`);
  await auditPage(page, `${viewport.name}:CMS dashboard`);

  for (const panel of ["home", "articles", "contact", "media", "history", "users"]) {
    if (viewport.width <= 800) await openCmsMobileMenu(page);
    await page.locator(`[data-view="${panel}"]`).click();
    await expectVisible(page, `[data-panel="${panel}"].is-active`, `${viewport.name}: CMS ${panel}`);
    await auditPage(page, `${viewport.name}:CMS ${panel}`);
  }

  if (viewport.width <= 800) await openCmsMobileMenu(page);
  await page.locator('[data-view="articles"]').click();
  await page.locator('[data-panel="articles"] [data-action="new-article"]').click();
  await expectDialogFits(page, "#article-dialog", viewport, `${viewport.name}: article editor`);
  await page.locator('#article-form [name="title"]').fill("Responsywny artykuł testowy");
  await page.locator('#article-form [name="description"]').fill("Opis podglądu na różnych ekranach.");
  await page.locator('#article-form [name="body"]').fill("## Nagłówek testowy\n\nTo jest **bezpieczny** podgląd treści.");
  await page.locator('[data-action="preview-article"]').click();
  await expectDialogFits(page, "#preview-dialog", viewport, `${viewport.name}: article preview`);
  await expectVisible(page, "#article-preview h1", `${viewport.name}: preview content`);
  await page.screenshot({ path: path.join(outputDirectory, `${viewport.name}-cms-preview.png`), fullPage: false });
  await page.locator("#preview-dialog [data-close]").click();
  await page.locator("#article-dialog [data-close]").first().click();

  if (viewport.width <= 800) await openCmsMobileMenu(page);
  await page.locator('[data-view="users"]').click();
  await page.locator('[data-action="new-user"]').click();
  await expectDialogFits(page, "#user-dialog", viewport, `${viewport.name}: user dialog`);
  await page.locator("#user-dialog [data-close]").first().click();

  await context.close();
}

await browser.close();
if (staticServer) await new Promise(resolve => staticServer.close(resolve));
console.log(JSON.stringify({ testedViewports: viewports, checks: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;

async function auditPage(page, label) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    documentHeight: document.documentElement.scrollHeight
  }));
  const overflow = dimensions.documentWidth - dimensions.viewportWidth;
  results.push({ label, ...dimensions, overflow });
  if (overflow > 1) failures.push(`${label}: horizontal overflow ${overflow}px`);

  const clipped = await page.locator("button, a, input, select, textarea").evaluateAll((elements) =>
    elements.filter((element) => {
      if (innerWidth <= 800 && element.closest(".sidebar") && !element.closest(".sidebar").classList.contains("is-open")) return false;
      if (element.closest('.top-carousel,.listing-standard-grid')) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.right < -1 || box.left > innerWidth + 1);
    }).length
  );
  if (clipped) failures.push(`${label}: ${clipped} interactive elements outside viewport`);
}

async function expectVisible(page, selector, label) {
  try { await page.locator(selector).waitFor({ state: "visible", timeout: 3000 }); }
  catch { failures.push(`${label}: ${selector} is not visible`); }
}

async function expectDialogFits(page, selector, viewport, label) {
  const dialog = page.locator(selector);
  await dialog.waitFor({ state: "visible" });
  const box = await dialog.boundingBox();
  if (!box) return failures.push(`${label}: dialog has no bounding box`);
  if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
    failures.push(`${label}: dialog exceeds viewport (${Math.round(box.width)}x${Math.round(box.height)})`);
  }
}

async function openCmsMobileMenu(page) {
  const sidebar = page.locator(".sidebar");
  const isOpen = await sidebar.evaluate((element) => element.classList.contains("is-open"));
  if (!isOpen && await page.locator("#menu-toggle").isVisible()) {
    await page.locator("#menu-toggle").click();
  }
}

async function configureCmsMock(page) {
  const home = await readFile(path.resolve("src", "_data", "home.json"), "utf8");
  const site = await readFile(path.resolve("src", "_data", "site.json"), "utf8");
  const articleNames = ["test.md", "test-praca.md", "test-weekend.md"];
  const articles = Object.fromEntries(await Promise.all(articleNames.map(async (name) => [name, await readFile(path.resolve("src", "content", "articles", name), "utf8")])));

  const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Administrator', email: 'admin@example.com', role: 'admin', active: true, mustChangePassword: false, version: 1 };
  await page.route('**/api/cms-auth?*', async route => {
    const action = new URL(route.request().url()).searchParams.get('action');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(action === 'users' ? { users: [user] } : { user }) });
  });
  await page.route('**/api/cms-content?*', async route => {
    const url = new URL(route.request().url());
    const filename = url.searchParams.get('path');
    const json = (payload, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
    if (filename === 'src/_data/home.json') return json(githubFile('home.json', home));
    if (filename === 'src/_data/site.json') return json(githubFile('site.json', site));
    if (filename === 'src/content/articles') return json(articleNames.map(name => ({ type: 'file', name, path: `src/content/articles/${name}`, sha: `sha-${name}` })));
    for (const [name, content] of Object.entries(articles)) if (filename === `src/content/articles/${name}`) return json(githubFile(name, content));
    if (filename === 'src/Images/uploads') return json([]);
    if (url.searchParams.get('action') === 'history') return json([{ sha: '1234567890abcdef', html_url: 'https://github.com/example/commit/123', commit: { message: 'CMS: testowa zmiana treści', author: { name: 'Test Administrator', date: '2026-07-25T12:00:00Z' } } }]);
    return json({ message: `Unhandled mock: ${filename}` }, 404);
  });
}

function githubFile(name, text) {
  return { name, path: name, sha: `sha-${name}`, encoding: "base64", content: Buffer.from(text, "utf8").toString("base64") };
}
