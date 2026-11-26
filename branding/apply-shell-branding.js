/**
 * Optional in-place patch when client/dist/index.html is writable.
 * Prefer fs-title-preload.js for stock images (often not writable under UID:GID).
 */
const fs = require('fs');

const indexPath = process.env.INFOBHAN_INDEX_HTML || '/app/client/dist/index.html';
const title = process.env.APP_TITLE || 'Infobhan AI';
const description =
  process.env.APP_DESCRIPTION || 'Infobhan AI — secure AI chat for your organization';

function log(message, data) {
  // #region agent log
  try {
    fs.appendFileSync(
      '/app/debug-2a1742.log',
      JSON.stringify({
        sessionId: '2a1742',
        runId: 'post-fix',
        hypothesisId: 'G',
        location: 'branding/apply-shell-branding.js',
        message,
        data,
        timestamp: Date.now(),
      }) + '\n',
    );
  } catch (_) {
    /* optional */
  }
  // #endregion
  console.log(`[infobhan-branding] ${message}`);
}

try {
  if (!fs.existsSync(indexPath)) {
    log('skip: missing index.html', { indexPath });
    process.exit(0);
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  const beforeTitle = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  html = html.replace(
    /(<meta\s+name=["']description["']\s+content=["'])[^"']*(["'])/i,
    `$1${description.replace(/"/g, '&quot;')}$2`,
  );
  fs.writeFileSync(indexPath, html);
  const afterTitle = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
  log(`shell title: ${beforeTitle} -> ${afterTitle}`, { beforeTitle, afterTitle, wrote: true });
} catch (err) {
  log(`could not patch shell (preload will still brand): ${err && err.message}`, {
    wrote: false,
    error: err && err.message,
  });
  process.exit(0);
}
