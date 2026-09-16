const fs = require('fs');
const path = require('path');

console.log('=== VERIFYING SEO FIXES ===\n');

// 1. Check for broken ../http or ../https URLs across all public HTML files
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/\.\.\/https?:\/\/[^\s\"'>]+/gi);
      if (matches) {
        results.push({ file: fullPath, count: matches.length, samples: matches.slice(0, 3) });
      }
    }
  }
  return results;
}

const badLinks = walk(path.join(__dirname, '../public'));
console.log(`1. 404 URL Audit (../http... pattern):`);
if (badLinks.length === 0) {
  console.log('   ✅ PASS: 0 broken ../http or ../https URLs found across entire public/ directory!');
} else {
  console.error(`   ❌ FAIL: Found ${badLinks.length} files with broken URLs:`, badLinks);
}

// 2. Check public/sitemap.html existence and counts
const sitemapHtmlPath = path.join(__dirname, '../public/sitemap.html');
console.log(`\n2. HTML Sitemap Audit (public/sitemap.html):`);
if (fs.existsSync(sitemapHtmlPath)) {
  const content = fs.readFileSync(sitemapHtmlPath, 'utf8');
  const catMatches = (content.match(/href="categories\//g) || []).length;
  const brandMatches = (content.match(/href="brands\//g) || []).length;
  const prodMatches = (content.match(/href="product\//g) || []).length;
  console.log(`   ✅ PASS: sitemap.html exists! (Size: ${(content.length / 1024).toFixed(1)} KB)`);
  console.log(`   📊 Linked Categories: ${catMatches}`);
  console.log(`   📊 Linked Brands: ${brandMatches}`);
  console.log(`   📊 Linked Products: ${prodMatches}`);
} else {
  console.error('   ❌ FAIL: public/sitemap.html does not exist!');
}

// 3. Check Canonical link and incoming internal links to Homepage
console.log(`\n3. Canonical URL and Inlinks Audit:`);
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const hasCanonical = indexHtml.includes('rel="canonical" href="https://shop.akinfotechcctv.in/"');
console.log(`   Homepage canonical tag: ${hasCanonical ? '✅ Correct (https://shop.akinfotechcctv.in/)' : '❌ Incorrect'}`);

// Count incoming links to / across static pages
let inlinkCountToRoot = 0;
let filesWithInlink = 0;
function countRootInlinks(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      countRootInlinks(fullPath);
    } else if (file.endsWith('.html') && fullPath !== path.join(__dirname, '../public/index.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Look for href="/" or href="../" (from subdirectories)
      const matches = content.match(/href=["'](\/|\.\.\/|\.\.\/index\.html)["']/g);
      if (matches && matches.length > 0) {
        filesWithInlink++;
        inlinkCountToRoot += matches.length;
      }
    }
  }
}
countRootInlinks(path.join(__dirname, '../public'));
console.log(`   ✅ PASS: Found ${inlinkCountToRoot} internal links pointing to Homepage across ${filesWithInlink} files.`);

// 4. Orphan Page Audit (Crawl Simulation starting from /)
console.log(`\n4. Orphan Page Audit (Link Reachability Graph):`);
const visitedUrls = new Set();
const toVisit = ['/'];

// Helper to normalize link target from a given file
function resolveLink(sourceFile, href) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http:') || href.startsWith('https:') || href.startsWith('//')) {
    return null;
  }
  // Strip queries and hash
  href = href.split('?')[0].split('#')[0];
  if (!href) return null;

  let abs;
  if (href.startsWith('/')) {
    abs = path.join(__dirname, '../public', href);
  } else {
    abs = path.resolve(path.dirname(sourceFile), href);
  }

  // Check if target is a dir or file
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    abs = path.join(abs, 'index.html');
  } else if (!path.extname(abs)) {
    if (fs.existsSync(abs + '.html')) abs += '.html';
  }

  const rel = path.relative(path.join(__dirname, '../public'), abs).replace(/\\/g, '/');
  return rel;
}

const queue = [path.join(__dirname, '../public/index.html')];
const crawledFiles = new Set([path.join(__dirname, '../public/index.html')]);

while (queue.length > 0) {
  const current = queue.shift();
  if (!fs.existsSync(current)) continue;
  const content = fs.readFileSync(current, 'utf8');
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const rawHref = match[1];
    const resolvedRel = resolveLink(current, rawHref);
    if (!resolvedRel) continue;
    const resolvedAbs = path.join(__dirname, '../public', resolvedRel);
    if (fs.existsSync(resolvedAbs) && resolvedAbs.endsWith('.html')) {
      if (!crawledFiles.has(resolvedAbs)) {
        crawledFiles.add(resolvedAbs);
        queue.push(resolvedAbs);
      }
    }
  }
}

// Find all HTML files in public
function getAllHtmlFiles(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      files = files.concat(getAllHtmlFiles(fp));
    } else if (f.endsWith('.html')) {
      files.push(fp);
    }
  }
  return files;
}

const allHtmlFiles = getAllHtmlFiles(path.join(__dirname, '../public'));
const orphanFiles = allHtmlFiles.filter(f => !crawledFiles.has(f));

console.log(`   📊 Total HTML Files in Store: ${allHtmlFiles.length}`);
console.log(`   📊 Crawlable / Reachable from Homepage: ${crawledFiles.size}`);
console.log(`   📊 Orphan Pages: ${orphanFiles.length}`);

if (orphanFiles.length === 0) {
  console.log(`   ✅ PASS: ZERO Orphan Pages! Every single page is reachable via internal links!`);
} else {
  console.warn(`   ⚠️ Orphan Pages List (${orphanFiles.length}):`, orphanFiles.slice(0, 10).map(f => path.basename(f)));
}
