const axios = require('axios');
const { parse } = require('csv-parse/sync');

/**
 * Standardize Google Sheet CSV exports.
 */
function normalizeGoogleSheetUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  if (cleanUrl.includes('/edit')) {
    cleanUrl = cleanUrl.replace(/\/edit.*$/, '/export?format=csv');
  } else if (cleanUrl.includes('/pubhtml')) {
    cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
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

    const photoLink = findValue(['Product Photo/link', 'Product Photo', 'Photo', 'Image Link', 'Image', 'Photo Link']) || 'images/cctv-wholesale.webp';
    const productName = findValue(['Product Name', 'Name', 'Title', 'Product']) || `Product #${index + 1}`;
    const productSpec = findValue(['Product Spec', 'Spec', 'Specification', 'Description', 'Details']) || 'High quality product';
    const brand = findValue(['Brand', 'Manufacturer', 'Make']) || 'Generic';
    const category = findValue(['Category', 'Type', 'Department']) || 'General';

    const rawPrice = findValue(['Price', 'MRP', 'Regular Price']) || '0';
    const rawSellingPrice = findValue(['Selling Price', 'Sale Price', 'Offer Price', 'Discounted Price']) || rawPrice;
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
      finalSellingPrice = Math.round(finalSellingPrice * 100) / 100;
    }

    const finalPrice = Math.max(price, finalSellingPrice) || finalSellingPrice;

    const comboVal = findValue(['Is Combo', 'Is it Combo', 'IsCombo', 'Combo']).toLowerCase();
    const isCombo = comboVal === 'yes' || comboVal === 'true' || comboVal === '1' || category.toLowerCase().includes('combo') || productName.toLowerCase().includes('combo');

    const availVal = findValue(['Availability', 'Stock', 'In Stock', 'Stock Status']).toLowerCase();
    const inStock = !(availVal.includes('out') || availVal === 'false' || availVal === '0' || availVal === 'no');

    return {
      id: `gs-${Date.now()}-${index + 1}`,
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
  });

  return parsedProducts;
}

module.exports = {
  normalizeGoogleSheetUrl,
  parseProductsFromCsv
};
