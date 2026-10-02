const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const candidatePaths = [
      path.join(process.cwd(), 'public', 'sitemap-catalog.xml'),
      path.join(__dirname, '..', 'public', 'sitemap-catalog.xml'),
      path.join(process.cwd(), 'public', 'sitemap.xml'),
      path.join(__dirname, '..', 'public', 'sitemap.xml'),
      path.join(__dirname, 'sitemap-catalog.xml'),
      path.join(__dirname, 'sitemap.xml')
    ];

    let xml = '';
    let mtime = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        xml = fs.readFileSync(p, 'utf8');
        try {
          const stats = fs.statSync(p);
          mtime = stats.mtime;
        } catch (e) {}
        break;
      }
    }

    if (!xml) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(404).send('Sitemap not found');
    }

    const etag = 'W/"' + crypto.createHash('md5').update(xml).digest('hex') + '"';
    const lastModified = (mtime || new Date('2026-09-29')).toUTCString();

    // Headers: clean XML response without Content-Disposition attachment or inline wrapper
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Content-Length', Buffer.byteLength(xml, 'utf8'));

    if (typeof res.removeHeader === 'function') {
      res.removeHeader('Content-Disposition');
    }

    // Support conditional caching (prevents crawler timeout & saves bandwidth)
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch.includes(etag))) {
      return res.status(304).end();
    }
    if (ifModifiedSince && mtime && new Date(ifModifiedSince) >= mtime) {
      return res.status(304).end();
    }

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap route error:', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Error serving sitemap: ' + (err.message || String(err)));
  }
};
