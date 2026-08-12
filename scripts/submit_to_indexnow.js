/**
 * AK Infotech - Automatic IndexNow URL Submission Tool
 * 
 * Automatically synchronizes all current URLs (products, categories, brands, pages)
 * from sitemap.xml to IndexNow search engine endpoints (Bing, Yandex, Seznam, Naver, etc.)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'shop.akinfotechcctv.in';
const SITEMAP_PATH = path.join(__dirname, '../public/sitemap.xml');
const PUBLIC_DIR = path.join(__dirname, '../public');
const ROOT_DIR = path.join(__dirname, '..');

// Helper to find IndexNow Key & File
function getIndexNowKey() {
  // Check root and public directory for 32-char hex .txt files
  const searchDirs = [ROOT_DIR, PUBLIC_DIR];
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.txt') && file.length >= 32) {
          const keyCandidate = file.replace('.txt', '').trim();
          if (/^[a-f0-9]{32}$/i.test(keyCandidate)) {
            const keyFilePath = path.join(dir, file);
            const fileContent = fs.readFileSync(keyFilePath, 'utf8').trim();
            if (fileContent === keyCandidate) {
              return { key: keyCandidate, filename: file };
            }
          }
        }
      }
    }
  }

  // Fallback default key if present
  const defaultKey = '0e5eb555d3cb4d91968465645dd9b0ef';
  return { key: defaultKey, filename: `${defaultKey}.txt` };
}

function ensureKeyInPublic(keyInfo) {
  const publicDest = path.join(PUBLIC_DIR, keyInfo.filename);
  if (!fs.existsSync(publicDest)) {
    fs.writeFileSync(publicDest, keyInfo.key, 'utf8');
    console.log(`[IndexNow] Copied key verification file to public/${keyInfo.filename}`);
  }
}

function sendPostRequest(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'AK-Infotech-IndexNow/1.0'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          body: body
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

async function runIndexNowSubmission() {
  console.log('================================================================');
  console.log('       AK INFOTECH - AUTO INDEXNOW URL SUBMISSION TOOL          ');
  console.log('================================================================\n');

  // 1. Identify IndexNow Key
  const keyInfo = getIndexNowKey();
  ensureKeyInPublic(keyInfo);

  console.log(`🔑 IndexNow API Key: ${keyInfo.key}`);
  console.log(`🌐 Key Location: https://${HOST}/${keyInfo.filename}`);

  // 2. Ensure Sitemap is fresh
  console.log('\n[1/3] Refreshing static pages and sitemap.xml...');
  try {
    const serverModule = require('../server/server.js');
    if (typeof serverModule.generateStaticPages === 'function') {
      serverModule.generateStaticPages();
    }
  } catch (err) {
    console.warn('Note: Could not run SSG delta generator directly, using existing sitemap.xml.');
  }

  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error('❌ Error: public/sitemap.xml not found! Please ensure your catalog is saved.');
    process.exit(1);
  }

  // 3. Extract all URLs from sitemap.xml
  console.log('\n[2/3] Extracting URLs from public/sitemap.xml...');
  const sitemapXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());

  if (!urls.length) {
    console.error('❌ Error: No URLs found in public/sitemap.xml!');
    process.exit(1);
  }

  console.log(`✅ Total URLs discovered: ${urls.length}`);
  console.log(`   • Core Pages: ${urls.filter(u => !u.includes('/product/') && !u.includes('/brands/') && !u.includes('/categories/')).length}`);
  console.log(`   • Category Pages: ${urls.filter(u => u.includes('/categories/')).length}`);
  console.log(`   • Brand Pages: ${urls.filter(u => u.includes('/brands/')).length}`);
  console.log(`   • Product Pages: ${urls.filter(u => u.includes('/product/')).length}`);

  // 4. Submit to IndexNow endpoints
  console.log('\n[3/3] Submitting URLs to IndexNow Search Engine Endpoints...');

  const payload = {
    host: HOST,
    key: keyInfo.key,
    keyLocation: `https://${HOST}/${keyInfo.filename}`,
    urlList: urls
  };

  const endpoints = [
    { name: 'IndexNow Global Hub (IndexNow.org)', url: 'https://api.indexnow.org/indexnow' },
    { name: 'Microsoft Bing (Bing.com)', url: 'https://www.bing.com/indexnow' },
    { name: 'Yandex Search (Yandex.com)', url: 'https://yandex.com/indexnow' }
  ];

  for (const ep of endpoints) {
    try {
      process.stdout.write(`   Submitting to ${ep.name}... `);
      const res = await sendPostRequest(ep.url, payload);
      if (res.statusCode === 200 || res.statusCode === 202) {
        console.log(`✅ SUCCESS (${res.statusCode} ${res.statusMessage || 'OK'})`);
      } else {
        console.log(`⚠️ Response (${res.statusCode}: ${res.statusMessage || ''} ${res.body || ''})`);
      }
    } catch (err) {
      console.log(`❌ FAILED (${err.message})`);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 COMPLETED: Successfully submitted ${urls.length} URLs to IndexNow!`);
  console.log('   Bing, Yandex, and IndexNow partner engines will index changes.');
  console.log('================================================================\n');
}

runIndexNowSubmission();
