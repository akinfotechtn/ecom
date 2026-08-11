/**
 * Google Merchant Center - Direct API Product Uploader
 * 
 * Account Merchant ID: 5444372321
 * Target Country: IN (India)
 * Target Currency: INR
 * 
 * Usage:
 * 1. Place your Google Cloud Service Account JSON key as `google-service-account.json` in the root folder.
 * 2. In Google Merchant Center (merchants.google.com) -> Settings -> People & Access -> Invite the Service Account email as Admin/Standard.
 * 3. Run: `node scripts/upload_to_google_merchant.js`
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const MERCHANT_ID = '5444372321';
const KEY_FILE = path.join(__dirname, '../google-service-account.json');
const PRODUCTS_FILE = path.join(__dirname, '../public/data/products.json');
const SETTINGS_FILE = path.join(__dirname, '../public/data/settings.json');

function slugify(text) {
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

async function uploadProducts() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error('❌ Missing Service Account Key file: google-service-account.json');
    console.log('\nFollow these steps to upload via API:');
    console.log('1. Go to Google Cloud Console (https://console.cloud.google.com)');
    console.log('2. Enable "Google Content API for Shopping" (Merchant API)');
    console.log('3. Create a Service Account & download the JSON Key');
    console.log('4. Save it as "google-service-account.json" in this project root directory');
    console.log('5. In Google Merchant Center (ID: 5444372321) -> Settings -> People & Access -> Add the Service Account email');
    console.log('6. Re-run: node scripts/upload_to_google_merchant.js\n');
    console.log('💡 TIP: You can also use the automatic live feed URL in Merchant Center:');
    console.log('   https://shop.akinfotechcctv.in/google-feed.xml\n');
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/content']
  });

  const authClient = await auth.getClient();
  const content = google.content({ version: 'v2.1', auth: authClient });

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8') || '[]');
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8') || '{}');
  const siteUrl = (settings.baseUrl || 'https://shop.akinfotechcctv.in').replace(/\/$/, '');

  console.log(`🚀 Starting Google Merchant Center API Upload for ${products.length} products to Merchant ID: ${MERCHANT_ID}...`);

  // Batch insert in chunks of 250 (Google Content API batch limit)
  const CHUNK_SIZE = 250;
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const entries = chunk.map((p, idx) => {
      const slug = slugify(p.productName);
      const base = Number(p.sellingPrice || p.price || 0);
      const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
      const finalPrice = (base + Math.round((base * gstRate) / 100)).toFixed(2);
      const photo = p.photoLink ? (p.photoLink.startsWith('http') ? p.photoLink : `${siteUrl}/${p.photoLink.replace(/^\//, '')}`) : `${siteUrl}/images/logo.webp`;
      const description = p.productSpec || `${p.productName} by ${p.brand || 'AK Infotech'}. Authorized wholesale price in Chennai. Fast courier dispatch and warranty.`;

      return {
        batchId: i + idx + 1,
        merchantId: MERCHANT_ID,
        method: 'insert',
        product: {
          offerId: p.id || slug,
          title: p.productName,
          description: description,
          link: `${siteUrl}/product/${slug}.html`,
          imageLink: photo,
          contentLanguage: 'en',
          targetCountry: 'IN',
          channel: 'online',
          availability: p.inStock === false ? 'out of stock' : 'in stock',
          condition: 'new',
          brand: p.brand || 'AK Infotech',
          price: {
            value: finalPrice,
            currency: 'INR'
          },
          shipping: [
            {
              country: 'IN',
              service: 'Standard Delivery',
              price: {
                value: '0.00',
                currency: 'INR'
              }
            }
          ]
        }
      };
    });

    try {
      console.log(`📦 Sending Batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} items)...`);
      const res = await content.products.custombatch({
        requestBody: { entries }
      });

      const errors = (res.data.entries || []).filter(e => e.errors);
      if (errors.length > 0) {
        console.warn(`⚠️ Batch had ${errors.length} item errors. Sample:`, errors[0].errors);
      } else {
        console.log(`✅ Batch ${Math.floor(i / CHUNK_SIZE) + 1} uploaded successfully!`);
      }
    } catch (err) {
      console.error(`❌ Batch upload failed:`, err.message);
    }
  }

  console.log('🎉 Google Merchant Center API sync process complete!');
}

if (require.main === module) {
  uploadProducts().catch(console.error);
}

module.exports = { uploadProducts };
