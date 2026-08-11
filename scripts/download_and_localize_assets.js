const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Paths
const DATA_DIR = path.join(__dirname, '../public/data');
const IMAGES_DIR = path.join(__dirname, '../public/images');
const PRODUCTS_IMG_DIR = path.join(IMAGES_DIR, 'products');
const BRANDS_IMG_DIR = path.join(IMAGES_DIR, 'brands');
const CATEGORIES_IMG_DIR = path.join(IMAGES_DIR, 'categories');

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Ensure destination directories exist
[PRODUCTS_IMG_DIR, BRANDS_IMG_DIR, CATEGORIES_IMG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function slugify(text) {
  if (!text) return 'item';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function getExtensionFromMime(mimeType, fallbackUrl = '') {
  if (!mimeType) {
    if (fallbackUrl.includes('.webp')) return '.webp';
    if (fallbackUrl.includes('.png')) return '.png';
    if (fallbackUrl.includes('.jpg') || fallbackUrl.includes('.jpeg')) return '.jpg';
    if (fallbackUrl.includes('.svg')) return '.svg';
    if (fallbackUrl.includes('.avif')) return '.avif';
    return '.jpg';
  }
  const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
  switch (cleanMime) {
    case 'image/webp': return '.webp';
    case 'image/png': return '.png';
    case 'image/jpeg':
    case 'image/jpg': return '.jpg';
    case 'image/svg+xml': return '.svg';
    case 'image/avif': return '.avif';
    case 'image/gif': return '.gif';
    default:
      if (fallbackUrl.includes('.webp')) return '.webp';
      if (fallbackUrl.includes('.png')) return '.png';
      return '.jpg';
  }
}

async function downloadImage(url, destPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': url
        }
      });

      if (response.status === 200 && response.data && response.data.length > 0) {
        fs.writeFileSync(destPath, response.data);
        return { success: true, size: response.data.length, mime: response.headers['content-type'] };
      }
    } catch (err) {
      if (attempt === retries) {
        return { success: false, error: err.response ? `HTTP ${err.response.status}` : err.message };
      }
      // Brief delay before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { success: false, error: 'Exceeded max retries' };
}

// Concurrency runner
async function processInBatches(items, batchSize, workerFn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item, idx) => workerFn(item, i + idx)));
    results.push(...batchResults);
    const percent = Math.round(((i + batch.length) / items.length) * 100);
    process.stdout.write(`\rProgress: ${i + batch.length}/${items.length} (${percent}%)`);
  }
  console.log('\n');
  return results;
}

async function main() {
  console.log('====================================================');
  console.log(' AK INFOTECH ASSET DOWNLOADER & LOCALIZER');
  console.log('====================================================\n');

  // 1. Back up database files
  console.log('📦 Creating database backups...');
  if (fs.existsSync(PRODUCTS_FILE)) {
    fs.copyFileSync(PRODUCTS_FILE, path.join(DATA_DIR, 'products.backup.json'));
  }
  if (fs.existsSync(BRANDS_FILE)) {
    fs.copyFileSync(BRANDS_FILE, path.join(DATA_DIR, 'brands.backup.json'));
  }
  if (fs.existsSync(CATEGORIES_FILE)) {
    fs.copyFileSync(CATEGORIES_FILE, path.join(DATA_DIR, 'categories.backup.json'));
  }
  console.log('✅ Backups saved (.backup.json)\n');

  const products = fs.existsSync(PRODUCTS_FILE) ? JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')) : [];
  const brands = fs.existsSync(BRANDS_FILE) ? JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf8')) : [];
  const categories = fs.existsSync(CATEGORIES_FILE) ? JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8')) : [];

  const usedProductSlugs = new Set();
  const usedBrandSlugs = new Set();
  const usedCatSlugs = new Set();

  // 2. Download Brand Logos
  console.log(`🏷️  Processing ${brands.length} Brands...`);
  for (let i = 0; i < brands.length; i++) {
    const b = brands[i];
    const imgUrl = (b.imageLink || '').trim();
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      let slug = slugify(b.name);
      if (usedBrandSlugs.has(slug)) slug = `${slug}-${b.id || i}`;
      usedBrandSlugs.add(slug);

      const ext = getExtensionFromMime(null, imgUrl);
      const filename = `${slug}${ext}`;
      const destPath = path.join(BRANDS_IMG_DIR, filename);

      const res = await downloadImage(imgUrl, destPath);
      if (res.success) {
        b.imageLink = `images/brands/${filename}`;
        console.log(`  ✅ Brand: ${b.name} -> images/brands/${filename} (${(res.size / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`  ⚠️ Brand ${b.name} failed (${res.error}), keeping fallback`);
        b.imageLink = 'images/logo.webp';
      }
    }
  }

  // 3. Download Category Icons
  console.log(`\n📂 Processing ${categories.length} Categories...`);
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const imgUrl = (c.imageLink || '').trim();
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      let slug = slugify(c.name);
      if (usedCatSlugs.has(slug)) slug = `${slug}-${c.id || i}`;
      usedCatSlugs.add(slug);

      const ext = getExtensionFromMime(null, imgUrl);
      const filename = `${slug}${ext}`;
      const destPath = path.join(CATEGORIES_IMG_DIR, filename);

      const res = await downloadImage(imgUrl, destPath);
      if (res.success) {
        c.imageLink = `images/categories/${filename}`;
        console.log(`  ✅ Category: ${c.name} -> images/categories/${filename} (${(res.size / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`  ⚠️ Category ${c.name} failed (${res.error}), using fallback`);
        c.imageLink = 'images/cctv-wholesale.webp';
      }
    }
  }

  // 4. Download Product Images
  console.log(`\n📷 Processing ${products.length} Products...`);
  let downloadedCount = 0;
  let fallbackCount = 0;

  await processInBatches(products, 15, async (p, index) => {
    const imgUrl = (p.photoLink || p.imageUrl || p.image || '').trim();
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      let slug = slugify(p.productName || `product-${index + 1}`);
      if (usedProductSlugs.has(slug)) {
        slug = `${slug}-${p.id || index + 1}`;
      }
      usedProductSlugs.add(slug);

      const ext = getExtensionFromMime(null, imgUrl);
      const filename = `${slug}${ext}`;
      const destPath = path.join(PRODUCTS_IMG_DIR, filename);

      // Check if file already exists with non-zero size
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 500) {
        p.photoLink = `images/products/${filename}`;
        p.imageUrl = `images/products/${filename}`;
        p.image = `images/products/${filename}`;
        downloadedCount++;
        return;
      }

      const res = await downloadImage(imgUrl, destPath);
      if (res.success) {
        p.photoLink = `images/products/${filename}`;
        p.imageUrl = `images/products/${filename}`;
        p.image = `images/products/${filename}`;
        downloadedCount++;
      } else {
        p.photoLink = 'images/cctv-wholesale.webp';
        p.imageUrl = 'images/cctv-wholesale.webp';
        p.image = 'images/cctv-wholesale.webp';
        fallbackCount++;
      }
    } else if (imgUrl.startsWith('images/')) {
      p.photoLink = imgUrl;
      p.imageUrl = imgUrl;
      p.image = imgUrl;
    } else {
      p.photoLink = 'images/cctv-wholesale.webp';
      p.imageUrl = 'images/cctv-wholesale.webp';
      p.image = 'images/cctv-wholesale.webp';
      fallbackCount++;
    }
  });

  console.log(`\n🎉 Product Image Summary: ${downloadedCount} downloaded successfully, ${fallbackCount} fallback placeholders.`);

  // 5. Save updated JSON files
  console.log('\n💾 Writing updated JSON database files...');
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  fs.writeFileSync(BRANDS_FILE, JSON.stringify(brands, null, 2), 'utf8');
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf8');
  console.log('✅ Database files updated with local paths!');

  console.log('\n====================================================');
  console.log(' ASSET LOCALIZATION COMPLETE');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
