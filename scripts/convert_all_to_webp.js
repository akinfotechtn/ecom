const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DATA_DIR = path.join(__dirname, '../public/data');
const IMAGES_DIR = path.join(__dirname, '../public/images');
const PRODUCTS_IMG_DIR = path.join(IMAGES_DIR, 'products');
const BRANDS_IMG_DIR = path.join(IMAGES_DIR, 'brands');
const CATEGORIES_IMG_DIR = path.join(IMAGES_DIR, 'categories');

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

async function convertFileToWebp(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const webpPath = path.join(dir, `${base}.webp`);

  if (ext === '.webp') {
    return { converted: false, webpPath, originalPath: filePath };
  }

  try {
    await sharp(filePath)
      .webp({ quality: 85, effort: 4 })
      .toFile(webpPath);

    // Delete old non-webp file
    if (fs.existsSync(webpPath) && fs.statSync(webpPath).size > 0) {
      try { fs.unlinkSync(filePath); } catch (e) {}
      return { converted: true, webpPath, originalPath: filePath };
    }
  } catch (err) {
    console.error(`  ❌ Failed converting ${path.basename(filePath)}:`, err.message);
  }
  return { converted: false, webpPath: filePath, originalPath: filePath };
}

async function convertDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath)) return 0;
  console.log(`\n🔄 Converting ${label} images in ${dirPath}...`);
  const files = fs.readdirSync(dirPath);
  let count = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fullPath = path.join(dirPath, f);
    const ext = path.extname(f).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.avif', '.gif', '.tif', '.tiff'].includes(ext)) {
      const res = await convertFileToWebp(fullPath);
      if (res.converted) count++;
    }
  }
  console.log(`✅ Converted ${count} ${label} images to .webp`);
  return count;
}

function updateExtensionToWebp(urlOrPath) {
  if (!urlOrPath) return 'images/cctv-wholesale.webp';
  return urlOrPath.replace(/\.(png|jpg|jpeg|avif|gif|tif|tiff)$/i, '.webp');
}

async function main() {
  console.log('====================================================');
  console.log(' ALL IMAGES -> WEBP FORMAT CONVERTER');
  console.log('====================================================');

  // 1. Convert physical files on disk
  await convertDirectory(PRODUCTS_IMG_DIR, 'Products');
  await convertDirectory(BRANDS_IMG_DIR, 'Brands');
  await convertDirectory(CATEGORIES_IMG_DIR, 'Categories');

  // 2. Update Database JSON files
  console.log('\n📝 Updating products.json to .webp references...');
  if (fs.existsSync(PRODUCTS_FILE)) {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    products.forEach(p => {
      p.photoLink = updateExtensionToWebp(p.photoLink);
      p.imageUrl = updateExtensionToWebp(p.imageUrl || p.photoLink);
      p.image = updateExtensionToWebp(p.image || p.photoLink);
    });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`✅ Updated ${products.length} products to .webp`);
  }

  console.log('\n📝 Updating brands.json to .webp references...');
  if (fs.existsSync(BRANDS_FILE)) {
    const brands = JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf8'));
    brands.forEach(b => {
      b.imageLink = updateExtensionToWebp(b.imageLink);
    });
    fs.writeFileSync(BRANDS_FILE, JSON.stringify(brands, null, 2), 'utf8');
    console.log(`✅ Updated ${brands.length} brands to .webp`);
  }

  console.log('\n📝 Updating categories.json to .webp references...');
  if (fs.existsSync(CATEGORIES_FILE)) {
    const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
    categories.forEach(c => {
      c.imageLink = updateExtensionToWebp(c.imageLink);
    });
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf8');
    console.log(`✅ Updated ${categories.length} categories to .webp`);
  }

  // 3. Export updated CSV
  console.log('\n📝 Regenerating ak_products_catalog_updated.csv...');
  const { autoExportCatalogCsv } = require('../server/utils/imageLocalizer');
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  autoExportCatalogCsv(products);

  console.log('\n====================================================');
  console.log(' WEBP CONVERSION COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

main().catch(console.error);
