const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function generatePermanentProductId(productName) {
  const slug = slugify(productName);
  const rawId = `prod-${slug}`;
  if (rawId.length <= 50) return rawId;
  const hash = crypto.createHash('md5').update(rawId).digest('hex').slice(0, 8);
  const truncated = rawId.slice(0, 41).replace(/-+$/, '');
  return `${truncated}-${hash}`.slice(0, 50);
}

/**
 * Standardize Google Sheet CSV exports.
 */
function normalizeGoogleSheetUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  if (cleanUrl.includes('output=csv') || cleanUrl.includes('format=csv')) {
    return cleanUrl;
  }

  if (cleanUrl.includes('/edit')) {
    cleanUrl = cleanUrl.replace(/\/edit.*$/, '/export?format=csv');
  } else if (cleanUrl.includes('/pubhtml')) {
    cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
  } else if (cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)) {
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/export') && !cleanUrl.endsWith('/pub')) {
      cleanUrl += '/export?format=csv';
    } else {
      cleanUrl += '?format=csv';
    }
  }

  return cleanUrl;
}

function parseMarginPercentage(rawStr) {
  if (!rawStr) return 0;
  const str = String(rawStr).trim();
  if (!str) return 0;

  const hasPercent = str.includes('%');
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return 0;

  if (hasPercent) {
    return num;
  }
  if (num > 0 && num <= 1) {
    return num * 100;
  }
  return num;
}

function roundPriceTo10s(val) {
  if (isNaN(val) || val <= 0) return 0;
  if (val < 10) return Math.round(val);
  return Math.round(val / 10) * 10;
}

/**
 * Parses raw CSV string or fetches from Google Sheet CSV URL
 */
async function parseProductsFromCsv(csvTextOrUrl) {
  let csvData = csvTextOrUrl;

  if (csvTextOrUrl.startsWith('http://') || csvTextOrUrl.startsWith('https://')) {
    const formattedUrl = normalizeGoogleSheetUrl(csvTextOrUrl);
    const response = await axios.get(formattedUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AkInfoEcom/1.0'
      }
    });
    csvData = response.data;
  }

  if (typeof csvData !== 'string' || !csvData.trim()) {
    throw new Error('CSV content is empty or invalid.');
  }

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  if (!records || !records.length) {
    throw new Error('No product records found in CSV.');
  }

  const parsedProducts = records.map((row, index) => {
    const findValue = (keys) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          rk => rk.toLowerCase().trim() === k.toLowerCase().trim()
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const rawName = findValue(['Product Name', 'Name', 'Title', 'Product']);
    const rawPrice = findValue(['Price', 'MRP', 'Regular Price']);
    const rawSellingPrice = findValue(['Selling Price', 'Sale Price', 'Offer Price', 'Discounted Price']);

    // Skip empty row or row with no valid product name
    if (!rawName || !rawName.trim()) {
      return null;
    }
    const trimmedName = rawName.trim();
    if (trimmedName.toLowerCase() === 'product name' || (trimmedName.toLowerCase().startsWith('product #') && (!rawPrice || rawPrice === '0' || rawPrice === ''))) {
      return null;
    }

    let photoLink = findValue(['Product Photo/link', 'Product Photo', 'Photo', 'Image Link', 'Image', 'Photo Link']) || 'images/cctv-wholesale.webp';
    const productName = trimmedName;
    const productSpec = findValue(['Product Spec', 'Spec', 'Specification', 'Description', 'Details']) || 'High quality product';
    const brand = findValue(['Brand', 'Manufacturer', 'Make']) || 'Generic';
    const category = findValue(['Category', 'Type', 'Department']) || 'General';

    // Smart Local Image Preservation: If local image already exists for this product, prioritize it
    const slug = slugify(productName);
    const possibleExts = ['.webp', '.png', '.jpg', '.jpeg', '.avif', '.svg'];
    for (const ext of possibleExts) {
      const localRelPath = `images/products/${slug}${ext}`;
      const localFullPath = path.join(__dirname, '../../public', localRelPath);
      if (fs.existsSync(localFullPath)) {
        photoLink = localRelPath;
        break;
      }
    }

    let rawDealerMargin = findValue([
      'Dealer Extra Margin %',
      'Dealer Extra Margin Percent',
      'Dealer Extra Margin',
      'Dealer Margin %',
      'Dealer Margin',
      'Extra Margin %',
      'Extra Margin',
      'Margin %'
    ]);

    if (!rawDealerMargin) {
      const keys = Object.keys(row);
      if (keys.length > 7) {
        const val7 = row[keys[7]];
        if (val7 !== undefined && val7 !== null) {
          rawDealerMargin = String(val7).trim();
        }
      }
    }

    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
    const baseSellingPrice = parseFloat(rawSellingPrice.replace(/[^0-9.]/g, '')) || price;
    const dealerMarginPercent = parseMarginPercentage(rawDealerMargin);

    let finalSellingPrice = baseSellingPrice;
    if (dealerMarginPercent > 0) {
      finalSellingPrice = baseSellingPrice + (baseSellingPrice * (dealerMarginPercent / 100));
    }
    finalSellingPrice = roundPriceTo10s(finalSellingPrice);

    const finalPrice = Math.max(price, finalSellingPrice) || finalSellingPrice;

    const comboVal = findValue(['Is Combo', 'Is it Combo', 'IsCombo', 'Combo']).toLowerCase();
    const isCombo = comboVal === 'yes' || comboVal === 'true' || comboVal === '1' || category.toLowerCase().includes('combo') || productName.toLowerCase().includes('combo');

    const availVal = findValue(['Availability', 'Stock', 'In Stock', 'Stock Status']).toLowerCase();
    const inStock = !(availVal.includes('out') || availVal === 'false' || availVal === '0' || availVal === 'no');

    return {
      id: generatePermanentProductId(productName),
      photoLink,
      productName,
      productSpec,
      brand,
      category,
      price: finalPrice,
      sellingPrice: finalSellingPrice,
      baseSellingPrice: baseSellingPrice,
      dealerMarginPercent: dealerMarginPercent,
      inStock,
      isCombo
    };
  }).filter(Boolean);

  return parsedProducts;
}

module.exports = {
  normalizeGoogleSheetUrl,
  parseProductsFromCsv,
  generatePermanentProductId,
  slugify
};
