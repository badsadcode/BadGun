// Renders devlog/*.md into designed HTML pages for the website (site/devlog/).
// The Markdown stays the source of truth: it reads fine on GitHub too.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const SITE = 'https://badsadcode.github.io/BadGun/';
const REPO = 'https://github.com/badsadcode/BadGun';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const prettyDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const STYLE = `
:root { --bg:#101216; --panel:#171a20; --line:#262a33; --ink:#ece9e2; --dim:#9aa0aa; --orange:#ff6b3d; --yellow:#ffd23d; --pink:#ff5fc0; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0; color: var(--ink); font: 18px/1.7 'Inter', system-ui, sans-serif; background:
  radial-gradient(1000px 600px at 85% -10%, rgba(255,107,61,.12), transparent 60%),
  radial-gradient(800px 500px at -10% 30%, rgba(66,226,255,.06), transparent 60%), var(--bg); background-attachment: fixed; }
a { color: var(--yellow); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: #fff; }
nav { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(10px); background: rgba(16,18,22,.78); border-bottom: 1px solid var(--line); }
nav .in { max-width: 1100px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; gap: 22px; }
nav .logo { font: 700 22px 'Space Grotesk', sans-serif; color: var(--ink); text-decoration: none; letter-spacing: -.5px; margin-right: auto; }
nav .logo b { color: var(--orange); }
nav a.link { color: var(--dim); text-decoration: none; font: 600 15px 'Space Grotesk', sans-serif; }
nav a.link:hover, nav a.link.on { color: var(--ink); }
nav a.cta { background: var(--orange); color: #1a0d08; text-decoration: none; font: 700 14px 'Space Grotesk', sans-serif; padding: 8px 14px; border-radius: 10px; }
nav a.cta:hover { filter: brightness(1.1); color: #1a0d08; }
main { max-width: 1100px; margin: 0 auto; padding: 0 20px 80px; }
h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; letter-spacing: -1px; line-height: 1.1; }
.kicker { font: 700 13px 'JetBrains Mono', monospace; letter-spacing: 3px; text-transform: uppercase; color: var(--orange); }

/* index */
.hero { padding: 72px 0 36px; }
.hero h1 { font-size: clamp(44px, 7vw, 84px); margin: 14px 0 16px; letter-spacing: -3px; }
.hero h1 em { font-style: normal; color: var(--orange); }
.hero p { color: var(--dim); font-size: 21px; max-width: 640px; margin: 0; }
.entries { display: grid; gap: 28px; margin-top: 36px; }
.entry { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 32px; align-items: center; text-decoration: none; color: inherit;
  background: var(--panel); border: 1px solid var(--line); border-radius: 26px; padding: 18px; transition: transform .15s, border-color .15s; }
.entry:hover { transform: translateY(-3px); border-color: rgba(255,107,61,.6); color: inherit; }
.entry img { width: 100%; display: block; border-radius: 16px; }
.entry h2 { font-size: 36px; margin: 10px 0 10px; }
.entry p { color: var(--dim); margin: 0 0 16px; }
.entry .read { font: 700 15px 'Space Grotesk', sans-serif; color: var(--orange); }
.meta { font: 500 13px 'JetBrains Mono', monospace; color: var(--dim); letter-spacing: 1px; }
.play { margin-top: 48px; padding: 32px; border-radius: 26px; border: 1px dashed rgba(255,210,61,.4); display: flex; gap: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.play h3 { margin: 0 0 4px; font-size: 26px; }
.play p { margin: 0; color: var(--dim); }

/* article */
article { max-width: 780px; margin: 0 auto; padding-top: 40px; }
article .head { margin: 8px 0 26px; }
article > p:first-of-type img, article .cover { border-radius: 22px; }
article h1 { font-size: clamp(36px, 6vw, 58px); margin: 18px 0 6px; letter-spacing: -2px; }
article h2 { font-size: 32px; margin: 64px 0 14px; }
article h2::before { content: ''; display: block; width: 44px; height: 4px; border-radius: 4px; background: var(--orange); margin-bottom: 18px; }
article p, article li { color: #d9d6cf; }
article strong { color: #fff; }
article img { max-width: 100%; height: auto; display: block; margin: 8px auto; border-radius: 18px; }
article blockquote { margin: 26px 0; padding: 18px 24px; border-left: 4px solid var(--yellow); background: rgba(255,210,61,.06); border-radius: 0 16px 16px 0; font-size: 20px; }
article blockquote p { margin: 0; color: var(--ink); }
article hr { border: 0; height: 1px; background: var(--line); margin: 48px 0; }
article code { font: 15px 'JetBrains Mono', monospace; background: #1d2027; padding: 2px 6px; border-radius: 6px; }
article ul { padding-left: 22px; }
article li { margin: 6px 0; }
article sub { font-size: 15px; color: var(--dim); }
.pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 56px; flex-wrap: wrap; }
.pager a { flex: 1; min-width: 220px; text-decoration: none; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 16px 20px; color: var(--ink); font-family: 'Space Grotesk', sans-serif; }
.pager a:hover { border-color: var(--orange); }
.pager small { display: block; color: var(--dim); font: 500 12px 'JetBrains Mono', monospace; letter-spacing: 1px; }
footer { text-align: center; color: #636974; font-size: 14px; padding: 40px 20px 60px; border-top: 1px solid var(--line); }
footer b { color: var(--orange); }
@media (max-width: 760px) {
  body { font-size: 17px; }
  nav .in { gap: 14px; padding: 10px 16px; }
  nav a.link.hide { display: none; }
  main { padding: 0 16px 60px; }
  .hero { padding: 44px 0 20px; }
  .entry { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 12px; }
  .entry h2 { font-size: 28px; }
  article h2 { font-size: 27px; margin-top: 48px; }
}`;

function page({ title, description, image, body, active, depth }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎺</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head><body>
<nav><div class="in">
  <a class="logo" href="${up}">Bad<b>Gun</b></a>
  <a class="link ${active === 'devlog' ? 'on' : ''}" href="${up}devlog/">Devlog</a>
  <a class="link hide" href="${REPO}">GitHub</a>
  <a class="cta" href="${up}">🎲 Playground</a>
</div></nav>
<main>${body}</main>
<footer>Made at <b>Bad Ideas Works</b>, where bad ideas receive suspiciously serious engineering.</footer>
</body></html>`;
}

/** Rewrite Markdown links that point at repo files so they work on the site. */
function fixLinks(html, slugs) {
  return html
    .replace(/href="README\.md"/g, 'href="./"')
    .replace(/href="\.\.\/README\.md"/g, `href="${REPO}"`)
    .replace(/href="(\d{3}-[a-z0-9-]+)\.md"/g, (m, slug) => (slugs.includes(slug) ? `href="${slug}.html"` : m))
    .replace(/<p align="center">\s*<a href="\.\/">← All devlogs<\/a>[\s\S]*?<\/p>/, '');
}

export function buildDevlog(rootUrl, outUrl) {
  const entries = JSON.parse(readFileSync(new URL('devlog/entries.json', rootUrl), 'utf8'));
  const slugs = entries.map((e) => e.slug);
  const out = new URL('devlog/', outUrl);
  mkdirSync(out, { recursive: true });
  cpSync(new URL('devlog/assets/', rootUrl), new URL('assets/', out), { recursive: true, filter: (src) => !src.includes('/source') });

  // Article pages.
  entries.forEach((e, i) => {
    let md = readFileSync(new URL(`devlog/${e.slug}.md`, rootUrl), 'utf8');
    md = md.replace(/^# .*\n/m, ''); // the title is rendered in the page header instead
    const html = fixLinks(marked.parse(md), slugs);
    // Move the cover (first image block) above the title.
    const coverMatch = html.match(/^\s*<p align="center">[\s\S]*?<\/p>/);
    const cover = coverMatch ? coverMatch[0] : '';
    const rest = coverMatch ? html.slice(coverMatch[0].length) : html;
    const prev = entries[i - 1], next = entries[i + 1];
    const pager = `<div class="pager">${prev ? `<a href="${prev.slug}.html"><small>← DEVLOG #${prev.number}</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html" style="text-align:right"><small>DEVLOG #${next.number} →</small>${esc(next.title)}</a>` : `<a href="./" style="text-align:right"><small>ALL ENTRIES →</small>The devlog</a>`}</div>`;
    const body = `<article>${cover}<div class="head"><div class="kicker">Devlog #${e.number} · <span class="meta">${prettyDate(e.date)}</span></div><h1>${esc(e.title)}</h1></div>${rest}${pager}</article>`;
    writeFileSync(new URL(`${e.slug}.html`, out), page({
      title: `${e.title} · BadGun Devlog #${e.number}`, description: e.summary, image: `${SITE}devlog/${e.cover}`, body, active: 'devlog', depth: 1,
    }));
  });

  // Index page (newest first).
  const cards = [...entries].reverse().map((e) => `
    <a class="entry" href="${e.slug}.html">
      <img src="${e.cover}" alt="${esc(e.title)}" loading="lazy">
      <div><div class="meta">#${e.number} · ${prettyDate(e.date)}</div><h2>${esc(e.title)}</h2><p>${esc(e.summary)}</p><span class="read">Read it →</span></div>
    </a>`).join('');
  const body = `
    <section class="hero"><div class="kicker">Bad Ideas Works · Behind the scenes</div>
      <h1>The BadGun <em>Devlog</em></h1>
      <p>Stories from building a factory that designs video game weapons. Written for humans, not just programmers. Expect pictures, honesty, and the occasional trumpet.</p>
    </section>
    <section class="entries">${cards}</section>
    <section class="play"><div><h3>Want to make your own?</h3><p>Press a button, get a weapon. Download it as a 3D file.</p></div><a class="cta" style="background:var(--orange);color:#1a0d08;text-decoration:none;font:700 16px 'Space Grotesk';padding:12px 18px;border-radius:12px" href="../">🎲 Open the playground</a></section>`;
  writeFileSync(new URL('index.html', out), page({
    title: 'The BadGun Devlog', description: 'Behind the scenes of BadGun, the procedural video game weapon factory.', image: `${SITE}devlog/${entries[entries.length - 1].cover}`, body, active: 'devlog', depth: 1,
  }));
  return entries.length;
}
