const fs = require('fs');
const path = require('path');

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
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        xml = fs.readFileSync(p, 'utf8');
        break;
      }
    }

    if (!xml) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(404).send('Sitemap not found');
    }

    // Serve plain XML response directly without any Content-Disposition attachment or inline wrapper
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    if (typeof res.removeHeader === 'function') {
      res.removeHeader('Content-Disposition');
    }

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', Buffer.byteLength(xml, 'utf8'));
      return res.status(200).end();
    }

    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap route error:', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Error serving sitemap: ' + (err.message || String(err)));
  }
};
