/**
 * Patch the stock librechat-admin-panel /app/dist chrome to InfobhanAI.
 * Safe to re-run: only stock LibreChat Admin strings and assets are rewritten.
 *
 * Navbar logo note: the panel loads the mark via <img src="/assets/librechat-*.svg">.
 * Nested PNG-inside-SVG often does not paint in <img>, so we serve a real PNG and
 * retarget those URLs in the JS bundles.
 */
const fs = require('fs');
const path = require('path');

const DIST = process.env.ADMIN_PANEL_DIST || '/app/dist';
const LOGO_PNG =
  process.env.ADMIN_TITLE_LOGO || '/branding/admin-title-logo.png';
const PRODUCT = 'InfobhanAI Admin Panel';
const SHORT = 'InfobhanAI Admin';
/** Public URL served from dist/client (same origin as /assets/*.js). */
const LOGO_PUBLIC_PATH = '/assets/infobhan-title-logo.png';

function log(message, data) {
  const line = data ? `${message} ${JSON.stringify(data)}` : message;
  console.log(`[infobhan-admin-branding] ${line}`);
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function brandText(content) {
  let next = content;
  let changed = false;

  // Client chunks use template literals; SSR/server chunks use unquoted keys + "values".
  const replacements = [
    ['LibreChat Admin Panel', PRODUCT],
    ['"short_name":"LibreChat Admin"', `"short_name":"${SHORT}"`],
    ['"short_name": "LibreChat Admin"', `"short_name": "${SHORT}"`],
    ['LibreChat Admin', SHORT],
    ['com_auth_title:`Admin Panel`', `com_auth_title:\`${PRODUCT}\``],
    ['com_auth_title: "Admin Panel"', `com_auth_title: "${PRODUCT}"`],
    ['"com_auth_title":"Admin Panel"', `"com_auth_title":"${PRODUCT}"`],
    ['"com_auth_title": "Admin Panel"', `"com_auth_title": "${PRODUCT}"`],
    ['com_a11y_logo_alt:`LibreChat logo`', 'com_a11y_logo_alt:`InfobhanAI logo`'],
    ['com_a11y_logo_alt: "LibreChat logo"', 'com_a11y_logo_alt: "InfobhanAI logo"'],
    ['"com_a11y_logo_alt":"LibreChat logo"', '"com_a11y_logo_alt":"InfobhanAI logo"'],
    ['"com_a11y_logo_alt": "LibreChat logo"', '"com_a11y_logo_alt": "InfobhanAI logo"'],
  ];

  for (const [from, to] of replacements) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
      changed = true;
    }
  }
  return { next, changed };
}

function retargetLogoUrls(content) {
  const next = content
    // Vite-hashed sidebar import: /assets/librechat-XXXX.svg
    .replace(/\/assets\/librechat-[A-Za-z0-9_-]+\.svg/g, LOGO_PUBLIC_PATH)
    // Public copy
    .replace(/\/librechat-logo\.svg/g, LOGO_PUBLIC_PATH);
  return { next, changed: next !== content };
}

function patchTextAssets(dist, { retargetLogo }) {
  const textExt = new Set(['.js', '.mjs', '.cjs', '.html', '.json', '.css', '.svg', '.txt', '.map']);
  let patched = 0;
  for (const file of walkFiles(dist)) {
    const ext = path.extname(file).toLowerCase();
    if (!textExt.has(ext)) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const branded = brandText(content);
    const retargeted = retargetLogo
      ? retargetLogoUrls(branded.next)
      : { next: branded.next, changed: false };
    if (!branded.changed && !retargeted.changed) continue;
    fs.writeFileSync(file, retargeted.next, 'utf8');
    patched += 1;
    log('patched text', {
      file: path.relative(dist, file),
      brand: branded.changed,
      logoUrl: retargeted.changed,
    });
  }
  return patched;
}

function installPngLogo(dist, pngBytes) {
  const targets = [
    path.join(dist, 'client', 'assets', 'infobhan-title-logo.png'),
    path.join(dist, 'client', 'infobhan-title-logo.png'),
    path.join(dist, 'assets', 'infobhan-title-logo.png'),
  ];
  let wrote = 0;
  for (const file of targets) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, pngBytes);
      wrote += 1;
      log('wrote png logo', { file: path.relative(dist, file) });
    } catch (err) {
      log('could not write png logo', {
        file: path.relative(dist, file),
        error: err && err.message,
      });
    }
  }
  return wrote;
}

function patchFavicon(dist, pngBytes) {
  const names = ['favicon.ico', 'favicon.png'];
  let wrote = 0;
  for (const file of walkFiles(dist)) {
    const base = path.basename(file).toLowerCase();
    if (!names.includes(base)) continue;
    fs.writeFileSync(file, pngBytes);
    wrote += 1;
    log('replaced favicon', { file: path.relative(dist, file) });
  }
  return wrote;
}

try {
  if (!fs.existsSync(DIST)) {
    log('skip: missing dist', { DIST });
    process.exit(0);
  }

  let logoCount = 0;
  let favCount = 0;
  const hasLogo = fs.existsSync(LOGO_PNG);
  if (hasLogo) {
    const pngBytes = fs.readFileSync(LOGO_PNG);
    logoCount = installPngLogo(DIST, pngBytes);
    favCount = patchFavicon(DIST, pngBytes);
  } else {
    log('skip logo/favicon: missing title logo', { LOGO_PNG });
  }

  // Title/manifest always; retarget navbar <img> src only when PNG was installed.
  const textCount = patchTextAssets(DIST, { retargetLogo: hasLogo && logoCount > 0 });
  log('done', {
    textCount,
    logoCount,
    favCount,
    product: PRODUCT,
    logoPublicPath: LOGO_PUBLIC_PATH,
  });
} catch (err) {
  log(`branding failed (continuing start): ${err && err.message}`, {
    error: err && err.message,
  });
  process.exit(0);
}
