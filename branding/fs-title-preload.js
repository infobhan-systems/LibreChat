/**
 * Stock-image safe: rewrite SPA shell title/meta/favicon URLs when index.html is read.
 * Does not require a writable client/dist (UID/GID often cannot patch the image files).
 */
const fs = require('fs');

const title = process.env.APP_TITLE || 'Infobhan AI';
const description =
  process.env.APP_DESCRIPTION || 'Infobhan AI — secure AI chat for your organization';
const cacheBust = process.env.INFOBHAN_ASSET_V || 'infobhan';

function brandHtml(html) {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  out = out.replace(
    /(<meta\s+name=["']description["']\s+content=["'])[^"']*(["'])/i,
    `$1${description.replace(/"/g, '&quot;')}$2`,
  );
  // Bust long-lived favicon / apple-touch caches after rebrand mounts.
  out = out.replace(
    /(href=["'])(assets\/(?:favicon[^"']+|apple-touch-icon[^"']+|icon-[^"']+|maskable-icon[^"']+))(["'])/gi,
    `$1$2?v=${cacheBust}$3`,
  );
  return out;
}

function looksLikeSpaShell(html) {
  return (
    typeof html === 'string' &&
    html.includes('<div id="root">') &&
    /<title>/i.test(html) &&
    /favicon/i.test(html)
  );
}

function debugLog(message, data) {
  // #region agent log
  try {
    const line =
      JSON.stringify({
        sessionId: '2a1742',
        runId: 'post-fix',
        hypothesisId: 'A,F,G',
        location: 'branding/fs-title-preload.js',
        message,
        data,
        timestamp: Date.now(),
      }) + '\n';
    fs.appendFileSync('/app/debug-2a1742.log', line);
  } catch (_) {
    /* host log mount optional */
  }
  try {
    fetch('http://127.0.0.1:7415/ingest/2fe0b457-50fa-426a-b6b7-bf9ada7ea33a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2a1742' },
      body: JSON.stringify({
        sessionId: '2a1742',
        runId: 'post-fix',
        hypothesisId: 'A,F,G',
        location: 'branding/fs-title-preload.js',
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (_) {
    /* ingest optional */
  }
  // #endregion
}

const origReadFileSync = fs.readFileSync;
fs.readFileSync = function patchedReadFileSync(file, options) {
  const data = origReadFileSync.apply(this, arguments);
  const filePath = typeof file === 'string' ? file : file && file.toString ? file.toString() : '';
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('index.html')) {
    return data;
  }

  const encoding = typeof options === 'string' ? options : options && options.encoding;
  if (encoding) {
    if (!looksLikeSpaShell(data)) {
      return data;
    }
    const branded = brandHtml(data);
    const before = (data.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
    const after = (branded.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
    debugLog('branded index.html (string)', { filePath: normalized, before, after, title });
    return branded;
  }

  if (Buffer.isBuffer(data)) {
    const asString = data.toString('utf8');
    if (!looksLikeSpaShell(asString)) {
      return data;
    }
    const branded = brandHtml(asString);
    const before = (asString.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
    const after = (branded.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
    debugLog('branded index.html (buffer)', { filePath: normalized, before, after, title });
    return Buffer.from(branded, 'utf8');
  }

  return data;
};

debugLog('preload installed', { title, cacheBust });
