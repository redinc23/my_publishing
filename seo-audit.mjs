// Ad-hoc SEO/accessibility sweep for key public pages.
const BASE = 'http://localhost:3001';
const paths = process.argv.slice(2);

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
}

function findMeta(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of tags) {
    if ((attr(t, key) || '').toLowerCase() === value.toLowerCase()) {
      return attr(t, 'content');
    }
  }
  return null;
}

const GENERIC_TITLES = ['home', 'untitled', 'document', 'next.js', 'react app', 'index'];

async function audit(path) {
  const url = BASE + path;
  let html, status;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    status = res.status;
    html = await res.text();
  } catch (e) {
    return { path, error: String(e) };
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const titleOk = !!title && !GENERIC_TITLES.includes(title.toLowerCase());

  const metaDesc = findMeta(html, 'name', 'description');
  const ogTitle = findMeta(html, 'property', 'og:title');
  const ogDesc = findMeta(html, 'property', 'og:description');
  const ogImage = findMeta(html, 'property', 'og:image');

  let canonical = null;
  for (const t of html.match(/<link\b[^>]*>/gi) || []) {
    if ((attr(t, 'rel') || '').toLowerCase() === 'canonical') canonical = attr(t, 'href');
  }

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const badImgs = [];
  for (const t of imgs) {
    const alt = attr(t, 'alt');
    if (alt === null || alt.trim() === '') {
      // empty alt="" is valid for decorative images, but flag per instructions
      badImgs.push((attr(t, 'src') || t.slice(0, 120)) + (alt === '' ? ' [alt=""]' : ' [no alt]'));
    }
  }

  const htmlTag = html.match(/<html\b[^>]*>/i);
  const lang = htmlTag ? attr(htmlTag[0], 'lang') : null;

  return {
    path,
    status,
    title,
    titleOk,
    metaDesc,
    canonical,
    ogTitle,
    ogDesc,
    ogImage,
    h1Count,
    imgTotal: imgs.length,
    badImgs,
    lang,
  };
}

const results = [];
for (const p of paths) {
  results.push(await audit(p));
}
console.log(JSON.stringify(results, null, 2));
