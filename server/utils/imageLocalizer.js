const fs = require('fs');
const path = require('path');
const axios = require('axios');

const IMAGES_DIR = path.join(__dirname, '../../public/images/products');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function slugify(text) {
  if (!text) return 'product';
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
    return '.png';
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

const sharp = require('sharp');

async function downloadSingleImage(url, destWebpPath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': url
        }
      });

      if (response.status === 200 && response.data && response.data.length > 0) {
        // Always convert and compress to WebP format
        await sharp(response.data)
          .webp({ quality: 85, effort: 4 })
          .toFile(destWebpPath);

        const stats = fs.statSync(destWebpPath);
        return { success: true, size: stats.size };
      }
    } catch (err) {
      if (attempt === retries) {
        return { success: false, error: err.message };
      }
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return { success: false, error: 'Exceeded max retries' };
}

/**
 * Checks all products in the list. If any product has an external URL (http:// or https://),
 * it downloads the image, converts it to WebP format, saves it to public/images/products/,
 * and replaces photoLink with local .webp path.
 */
async function autoLocalizeProductImages(products) {
  if (!Array.isArray(products) || !products.length) return products;

  const externalItems = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const link = (p.photoLink || p.imageUrl || p.image || '').trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      externalItems.push({ product: p, index: i, url: link });
    }
  }

  if (!externalItems.length) return products;

  console.log(`[Auto-Localizer] Found ${externalItems.length} external product image(s). Downloading & converting to WebP...`);

  // Download in concurrent batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < externalItems.length; i += BATCH_SIZE) {
    const batch = externalItems.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ product, index, url }) => {
      let slug = slugify(product.productName || `product-${index + 1}`);
      let filename = `${slug}.webp`;
      let destPath = path.join(IMAGES_DIR, filename);

      // If file already exists with valid size, reuse it
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 500) {
        product.photoLink = `images/products/${filename}`;
        product.imageUrl = `images/products/${filename}`;
        product.image = `images/products/${filename}`;
        return;
      }

      const res = await downloadSingleImage(url, destPath);
      if (res.success) {
        product.photoLink = `images/products/${filename}`;
        product.imageUrl = `images/products/${filename}`;
        product.image = `images/products/${filename}`;
        console.log(`[Auto-Localizer] ✅ Downloaded & WebP Converted: ${product.productName} -> images/products/${filename}`);
      } else {
        console.warn(`[Auto-Localizer] ⚠️ Failed to download for ${product.productName}: ${res.error}`);
        product.photoLink = 'images/cctv-wholesale.webp';
        product.imageUrl = 'images/cctv-wholesale.webp';
        product.image = 'images/cctv-wholesale.webp';
      }
    }));
  }

  return products;
}

/**
 * Regenerates the ak_products_catalog_updated.csv file so it is always 100% up to date.
 */
function autoExportCatalogCsv(products) {
  try {
    const OUTPUT_CSV = path.join(__dirname, '../../public/data/ak_products_catalog_updated.csv');
    const headers = ['Product Photo/link', 'Product Name', 'Product Spec', 'Brand', 'Category', 'Price', 'Selling Price', 'Is Combo', 'Availability', 'Custom Delivery Fee'];

    const rows = products.map(p => {
      const photo = (p.photoLink || 'images/cctv-wholesale.webp').replace(/"/g, '""');
      const name = (p.productName || '').replace(/"/g, '""');
      const spec = (p.productSpec || '').replace(/"/g, '""');
      const brand = (p.brand || '').replace(/"/g, '""');
      const cat = (p.category || '').replace(/"/g, '""');
      const price = p.price || 0;
      const selling = p.sellingPrice || 0;
      const isCombo = p.isCombo ? 'TRUE' : 'FALSE';
      const inStock = p.inStock !== false ? 'In stock' : 'Out of stock';
      const fee = (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : '';

      return `"${photo}","${name}","${spec}","${brand}","${cat}",${price},${selling},${isCombo},"${inStock}","${fee}"`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    if (fs.existsSync(OUTPUT_CSV)) {
      const existing = fs.readFileSync(OUTPUT_CSV, 'utf8');
      if (existing === csvContent) {
        return; // Content unchanged, skip writing
      }
    }
    fs.writeFileSync(OUTPUT_CSV, csvContent, 'utf8');
    console.log(`[Auto-CSV] Updated public/data/ak_products_catalog_updated.csv (${products.length} products).`);
  } catch (err) {
    console.error('[Auto-CSV] Error updating CSV:', err.message);
  }
}

module.exports = {
  autoLocalizeProductImages,
  autoExportCatalogCsv
};
