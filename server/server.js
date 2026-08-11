const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { parseProductsFromCsv } = require('./utils/csvParser');
const { autoLocalizeProductImages, autoExportCatalogCsv } = require('./utils/imageLocalizer');
const ShiprocketHelper = require('./utils/shiprocket');
const nodemailer = require('nodemailer');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// High-speed Compression & Performance Middleware
app.use(compression({
  threshold: 1024, // compress anything above 1KB
  level: 6
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: true
}));

// File paths - Single Unified Data Folder (public/data)
const DATA_DIR = path.join(__dirname, '../public/data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const UPLOADS_DIR = path.join(__dirname, '../public/images/uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Utility to read JSON
function readJson(filePath, defaultData = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw || !raw.trim()) return defaultData;
    const parsed = JSON.parse(raw);
    
    if (Array.isArray(defaultData)) {
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.products)) return parsed.products;
      return defaultData;
    }
    
    return parsed || defaultData;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultData;
  }
}

// Utility to write JSON to primary products file
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    // Automatically keep CSV catalog in sync when products change
    if (filePath === PRODUCTS_FILE && Array.isArray(data)) {
      autoExportCatalogCsv(data);
    }

    // Automatically trigger Static Site Generation (SSG) if writing database files
    if (filePath === PRODUCTS_FILE || filePath === BRANDS_FILE || filePath === CATEGORIES_FILE) {
      generateStaticPages();
    }
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

function slugify(text) {
  if (!text) return '';
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

const BASE_PAGES = new Set([
  'index.html',
  'product.html',
  'brand.html',
  'category.html',
  'account.html',
  'admin.html',
  'privacy.html',
  'terms.html',
  'refund.html',
  'local-sync.html',
  'checkout.html',
  'cart.html'
]);

function adjustPaths(html) {
  return html
    .replace(/href="css\//g, 'href="../css/')
    .replace(/src="js\//g, 'src="../js/')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/href="images\//g, 'href="../images/')
    .replace(/href="index\.html/g, 'href="../index.html')
    .replace(/href="account\.html/g, 'href="../account.html')
    .replace(/href="admin\.html/g, 'href="../admin.html')
    .replace(/href="checkout\.html/g, 'href="../checkout.html')
    .replace(/href="privacy\.html/g, 'href="../privacy.html')
    .replace(/href="terms\.html/g, 'href="../terms.html')
    .replace(/href="refund\.html/g, 'href="../refund.html')
    .replace(/href="category\.html/g, 'href="../category.html')
    .replace(/href="brand\.html/g, 'href="../brand.html')
    .replace(/href="cart\.html/g, 'href="../cart.html');
}

function writeIfChanged(filePath, newContent) {
  try {
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      if (existingContent === newContent) {
        return false; // Skipped (unchanged)
      }
    }
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true; // Modified / Created
  } catch (err) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
}

function cleanOrphanedStaticPages(validProductSlugs, validBrandSlugs, validCatSlugs) {
  const publicDir = path.join(__dirname, '../public');
  let totalDeleted = 0;

  const checkDir = (subDir, validSlugs) => {
    const dirPath = path.join(publicDir, subDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      return 0;
    }
    let deleted = 0;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.html')) {
        const slug = file.replace(/\.html$/, '');
        if (!validSlugs.has(slug)) {
          try {
            fs.unlinkSync(path.join(dirPath, file));
            deleted++;
          } catch (e) {}
        }
      }
    }
    return deleted;
  };

  totalDeleted += checkDir('product', validProductSlugs);
  totalDeleted += checkDir('brands', validBrandSlugs);
  totalDeleted += checkDir('categories', validCatSlugs);
  return totalDeleted;
}

function generateStaticPages() {
  try {
    const products = readJson(PRODUCTS_FILE, []);
    const brands = readJson(BRANDS_FILE, []);
    const categories = readJson(CATEGORIES_FILE, []);

    const productTemplatePath = path.join(__dirname, '../public/product.html');
    const brandTemplatePath = path.join(__dirname, '../public/brand.html');
    const categoryTemplatePath = path.join(__dirname, '../public/category.html');

    const productTemplate = fs.existsSync(productTemplatePath) ? fs.readFileSync(productTemplatePath, 'utf8') : '';
    const brandTemplate = fs.existsSync(brandTemplatePath) ? fs.readFileSync(brandTemplatePath, 'utf8') : '';
    const categoryTemplate = fs.existsSync(categoryTemplatePath) ? fs.readFileSync(categoryTemplatePath, 'utf8') : '';

    let writtenProducts = 0;
    let skippedProducts = 0;
    const validProductSlugs = new Set();

    // 1. Incremental Product pages
    if (productTemplate) {
      const prodDir = path.join(__dirname, '../public/product');
      if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true });

      for (const p of products) {
        if (!p.productName) continue;
        const slug = slugify(p.productName);
        validProductSlugs.add(slug);
        const fileName = `${slug}.html`;
        const filePath = path.join(prodDir, fileName);

        const injectScript = `<script>window.staticProductData = ${JSON.stringify(p)};</script>`;
        let html = productTemplate.replace('</head>', `${injectScript}\n</head>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${p.productName} | AK Infotech Security Store</title>`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${p.productSpec || p.productName}">`);
        html = adjustPaths(html);

        if (writeIfChanged(filePath, html)) {
          writtenProducts++;
        } else {
          skippedProducts++;
        }
      }
    }

    // 2. Incremental Brand pages
    let writtenBrands = 0;
    let skippedBrands = 0;
    const validBrandSlugs = new Set();
    if (brandTemplate) {
      const brandDir = path.join(__dirname, '../public/brands');
      if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

      for (const b of brands) {
        if (!b.name) continue;
        const slug = slugify(b.name);
        validBrandSlugs.add(slug);
        const fileName = `${slug}.html`;
        const filePath = path.join(brandDir, fileName);

        const injectScript = `<script>window.staticBrandData = ${JSON.stringify(b)};</script>`;
        let html = brandTemplate.replace('</head>', `${injectScript}\n</head>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${b.name} CCTV Security Products | AK Infotech</title>`);
        html = adjustPaths(html);

        if (writeIfChanged(filePath, html)) {
          writtenBrands++;
        } else {
          skippedBrands++;
        }
      }
    }

    // 3. Incremental Category pages
    let writtenCats = 0;
    let skippedCats = 0;
    const validCatSlugs = new Set();
    if (categoryTemplate) {
      const catDir = path.join(__dirname, '../public/categories');
      if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });

      const allCats = [...categories];
      if (!allCats.some(c => c.name.toLowerCase().includes('combo'))) {
        allCats.push({ id: 'cat-combo', name: 'Combo Packs', imageLink: 'images/categories/generic.png' });
      }

      for (const c of allCats) {
        if (!c.name) continue;
        const slug = slugify(c.name);
        validCatSlugs.add(slug);
        const fileName = `${slug}.html`;
        const filePath = path.join(catDir, fileName);

        const injectScript = `<script>window.staticCategoryData = ${JSON.stringify(c)};</script>`;
        let html = categoryTemplate.replace('</head>', `${injectScript}\n</head>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>Shop ${c.name} Security Systems | AK Infotech</title>`);
        html = adjustPaths(html);

        if (writeIfChanged(filePath, html)) {
          writtenCats++;
        } else {
          skippedCats++;
        }
      }
    }

    // 4. Clean only deleted/orphaned files
    const deletedCount = cleanOrphanedStaticPages(validProductSlugs, validBrandSlugs, validCatSlugs);

    // 5. Generate sitemap.xml and robots.txt incrementally
    generateSitemapAndRobots(products, brands, categories);

    console.log(`[SSG-Delta] Static Pages -> Products: ${writtenProducts} modified, ${skippedProducts} unchanged | Brands: ${writtenBrands} modified | Categories: ${writtenCats} modified | Deleted: ${deletedCount}`);
  } catch (err) {
    console.error('[SSG] Generation error:', err.message);
  }
}

function generateSitemapAndRobots(products, brands, categories) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Read siteUrl from settings if possible, otherwise use fallback
    const settings = readJson(SETTINGS_FILE, {});
    const siteUrl = (settings.baseUrl || 'https://shop.akinfotechcctv.in').replace(/\/$/, '');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Root / Core pages
    const corePages = [
      'index.html',
      'product.html',
      'brand.html',
      'category.html',
      'account.html',
      'cart.html',
      'checkout.html',
      'privacy.html',
      'terms.html',
      'refund.html'
    ];
    for (const page of corePages) {
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/${page}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${page === 'index.html' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    }

    // 2. Product pages
    for (const p of products) {
      if (!p.productName) continue;
      const slug = slugify(p.productName);
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/product/${slug}.html</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // 3. Brand pages
    for (const b of brands) {
      if (!b.name) continue;
      const slug = slugify(b.name);
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/brands/${slug}.html</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }

    // 4. Category pages
    const allCats = [...categories];
    if (!allCats.some(c => c.name.toLowerCase().includes('combo'))) {
      allCats.push({ id: 'cat-combo', name: 'Combo Packs' });
    }
    for (const c of allCats) {
      if (!c.name) continue;
      const slug = slugify(c.name);
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/categories/${slug}.html</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    
    writeIfChanged(path.join(__dirname, '../public/sitemap.xml'), xml);

    // Generate robots.txt
    let robots = `User-agent: *\n`;
    robots += `Allow: /\n`;
    robots += `Disallow: /admin.html\n`;
    robots += `Disallow: /local-sync.html\n`;
    robots += `Sitemap: ${siteUrl}/sitemap.xml\n`;

    writeIfChanged(path.join(__dirname, '../public/robots.txt'), robots);

  } catch (err) {
    console.error('[SSG] Error generating sitemap/robots:', err.message);
  }
}

// ---------------------------------------------------------
// PRODUCTS API
// ---------------------------------------------------------
app.get('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const { brand, category, isCombo, search } = req.query;

  let filtered = [...products];

  if (brand) {
    filtered = filtered.filter(p => p.brand?.toLowerCase() === brand.toLowerCase());
  }

  if (category) {
    filtered = filtered.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }

  if (isCombo === 'true') {
    filtered = filtered.filter(p => p.isCombo || p.category?.toLowerCase().includes('combo'));
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.productName?.toLowerCase().includes(q) ||
      p.productSpec?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }

  // Calculate unique brands & categories for dynamic UI filters
  const allBrands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  const allCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  res.json({
    success: true,
    total: filtered.length,
    brands: allBrands,
    categories: allCategories,
    products: filtered
  });
});

// BULK SAVE - called by local-sync.js when adding/editing single products
app.post('/api/products/bulk-save', async (req, res) => {
  try {
    let products = req.body.products;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Expected { products: [...] }' });
    }
    
    // Automatically download any external images locally
    products = await autoLocalizeProductImages(products);

    const ok = writeJson(PRODUCTS_FILE, products);
    if (!ok) {
      return res.status(500).json({ success: false, message: 'Failed to write products.json' });
    }
    console.log(`[bulk-save] Saved ${products.length} products to disk.`);
    return res.json({ success: true, message: `Saved ${products.length} products.`, total: products.length });
  } catch (err) {
    console.error('[bulk-save] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  if (Array.isArray(req.body.products)) {
    let prods = await autoLocalizeProductImages(req.body.products);
    writeJson(PRODUCTS_FILE, prods);
    return res.json({ success: true, message: 'Products saved successfully.', total: prods.length });
  }

  const products = readJson(PRODUCTS_FILE, []);
  let newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    photoLink: req.body.photoLink || 'images/cctv-wholesale.webp',
    productName: req.body.productName,
    productSpec: req.body.productSpec || '',
    brand: req.body.brand || 'Generic',
    category: req.body.category || 'General',
    price: parseFloat(req.body.price) || 0,
    sellingPrice: parseFloat(req.body.sellingPrice) || 0,
    inStock: req.body.inStock !== false,
    isCombo: req.body.isCombo === true || req.body.category?.toLowerCase().includes('combo')
  };

  if (!newProduct.productName || !newProduct.sellingPrice) {
    return res.status(400).json({ success: false, message: 'Product name and selling price are required.' });
  }

  // Auto download image if external
  const localized = await autoLocalizeProductImages([newProduct]);
  newProduct = localized[0];

  products.unshift(newProduct);
  writeJson(PRODUCTS_FILE, products);

  res.json({ success: true, message: 'Product added successfully.', product: newProduct, total: products.length });
});

app.put('/api/products/:id', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  products[index] = {
    ...products[index],
    photoLink: req.body.photoLink ?? products[index].photoLink,
    productName: req.body.productName ?? products[index].productName,
    productSpec: req.body.productSpec ?? products[index].productSpec,
    brand: req.body.brand ?? products[index].brand,
    category: req.body.category ?? products[index].category,
    price: parseFloat(req.body.price) ?? products[index].price,
    sellingPrice: parseFloat(req.body.sellingPrice) ?? products[index].sellingPrice,
    inStock: req.body.inStock ?? products[index].inStock,
    isCombo: req.body.isCombo ?? (req.body.category?.toLowerCase().includes('combo') || false),
    isFeatured: req.body.isFeatured ?? products[index].isFeatured
  };

  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: 'Product updated.', product: products[index] });
});

app.delete('/api/products/:id', (req, res) => {
  let products = readJson(PRODUCTS_FILE, []);
  const initialLen = products.length;
  products = products.filter(p => p.id !== req.params.id);

  if (products.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: 'Product deleted.' });
});

app.post('/api/products/bulk-save', (req, res) => {
  const products = req.body?.products || req.body || [];
  if (!Array.isArray(products)) {
    return res.status(400).json({ success: false, message: 'Invalid products array.' });
  }
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: `Successfully saved ${products.length} products to local JSON!`, total: products.length });
});

// ---------------------------------------------------------
// BRANDS API (LOCAL)
// ---------------------------------------------------------
app.get('/api/brands', (req, res) => {
  const brands = readJson(BRANDS_FILE, []);
  res.json({ success: true, brands });
});

app.post('/api/brands', (req, res) => {
  const brands = readJson(BRANDS_FILE, []);
  const newBrand = {
    id: req.body.id || `brand-${Date.now()}`,
    name: req.body.name,
    imageLink: req.body.imageLink || 'images/brands/generic.png',
    description: req.body.description || ''
  };

  if (!newBrand.name) {
    return res.status(400).json({ success: false, message: 'Brand name is required.' });
  }

  // Check if exists
  const existingIndex = brands.findIndex(b => b.id === newBrand.id || b.name.toLowerCase() === newBrand.name.toLowerCase());
  if (existingIndex !== -1) {
    brands[existingIndex] = { ...brands[existingIndex], ...newBrand };
  } else {
    brands.unshift(newBrand);
  }

  writeJson(BRANDS_FILE, brands);
  res.json({ success: true, message: 'Brand saved successfully.', brand: newBrand });
});

app.post('/api/brands/bulk-save', (req, res) => {
  const brands = req.body.brands || req.body || [];
  if (!Array.isArray(brands)) {
    return res.status(400).json({ success: false, message: 'Invalid brands array.' });
  }
  writeJson(BRANDS_FILE, brands);
  res.json({ success: true, message: `Saved ${brands.length} brands.`, total: brands.length });
});

app.delete('/api/brands/:id', (req, res) => {
  let brands = readJson(BRANDS_FILE, []);
  brands = brands.filter(b => b.id !== req.params.id);
  writeJson(BRANDS_FILE, brands);
  res.json({ success: true, message: 'Brand deleted.' });
});

// ---------------------------------------------------------
// CATEGORIES API (LOCAL)
// ---------------------------------------------------------
app.get('/api/categories', (req, res) => {
  const categories = readJson(CATEGORIES_FILE, []);
  res.json({ success: true, categories });
});

app.post('/api/categories', (req, res) => {
  const categories = readJson(CATEGORIES_FILE, []);
  const newCat = {
    id: req.body.id || `cat-${Date.now()}`,
    name: req.body.name,
    imageLink: req.body.imageLink || 'images/categories/generic.png',
    description: req.body.description || ''
  };

  if (!newCat.name) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }

  // Check if exists
  const existingIndex = categories.findIndex(c => c.id === newCat.id || c.name.toLowerCase() === newCat.name.toLowerCase());
  if (existingIndex !== -1) {
    categories[existingIndex] = { ...categories[existingIndex], ...newCat };
  } else {
    categories.unshift(newCat);
  }

  writeJson(CATEGORIES_FILE, categories);
  res.json({ success: true, message: 'Category saved successfully.', category: newCat });
});

app.post('/api/categories/bulk-save', (req, res) => {
  const categories = req.body.categories || req.body || [];
  if (!Array.isArray(categories)) {
    return res.status(400).json({ success: false, message: 'Invalid categories array.' });
  }
  writeJson(CATEGORIES_FILE, categories);
  res.json({ success: true, message: `Saved ${categories.length} categories.`, total: categories.length });
});

app.delete('/api/categories/:id', (req, res) => {
  let categories = readJson(CATEGORIES_FILE, []);
  categories = categories.filter(c => c.id !== req.params.id);
  writeJson(CATEGORIES_FILE, categories);
  res.json({ success: true, message: 'Category deleted.' });
});

// ---------------------------------------------------------
// IMAGE UPLOAD API (LOCAL)
// ---------------------------------------------------------
app.post('/api/upload', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ success: false, message: 'Filename and base64Data are required.' });
    }

    // Remove metadata prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const extension = path.extname(filename) || '.png';
    const baseName = path.basename(filename, extension);
    const safeName = `${Date.now()}-${baseName.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;

    const destPath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(destPath, buffer);

    const relativeUrl = `images/uploads/${safeName}`;
    res.json({ success: true, url: relativeUrl, message: 'Image uploaded successfully.' });
  } catch (err) {
    console.error('Image Upload Error:', err.message);
    res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
  }
});

// ---------------------------------------------------------
// GOOGLE SHEETS & CSV SYNC API
// ---------------------------------------------------------
app.post('/api/sync-google-sheet', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const sheetUrl = req.body.sheetUrl || settings.googleSheetUrl;

    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: 'No Google Sheet URL provided.' });
    }

    const parsedProducts = await parseProductsFromCsv(sheetUrl);

    // Merge existing features (like isFeatured) to imported products
    const existingProducts = readJson(PRODUCTS_FILE, []);
    let mergedProducts = parsedProducts.map(p => {
      const match = existingProducts.find(ep => String(ep.id) === String(p.id) || (ep.productName && p.productName && String(ep.productName).trim().toLowerCase() === String(p.productName).trim().toLowerCase()));
      if (match) {
        return {
          ...p,
          isFeatured: match.isFeatured === true
        };
      }
      return p;
    });

    // Automatically download any new external images locally and map them
    mergedProducts = await autoLocalizeProductImages(mergedProducts);

    // Save imported products to store (auto-triggers SSG and CSV export)
    writeJson(PRODUCTS_FILE, mergedProducts);

    // Update settings with current URL & sync timestamp
    settings.googleSheetUrl = sheetUrl;
    settings.lastSyncedAt = new Date().toISOString();
    writeJson(SETTINGS_FILE, settings);

    res.json({
      success: true,
      message: `Successfully synced ${parsedProducts.length} products from Google Sheet!`,
      totalSynced: parsedProducts.length,
      lastSyncedAt: settings.lastSyncedAt,
      sampleProduct: parsedProducts[0]
    });
  } catch (err) {
    console.error('Google Sheet Sync Error:', err.message);
    res.status(500).json({
      success: false,
      message: `Google Sheet Sync Failed: ${err.message}. Make sure your sheet is published as CSV (File -> Share -> Publish to Web -> CSV).`
    });
  }
});

app.post('/api/upload-csv', async (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText) {
      return res.status(400).json({ success: false, message: 'CSV content missing.' });
    }

    const parsedProducts = await parseProductsFromCsv(csvText);
    const existingProducts = readJson(PRODUCTS_FILE, []);
    let mergedProducts = parsedProducts.map(p => {
      const match = existingProducts.find(ep => String(ep.id) === String(p.id) || (ep.productName && p.productName && String(ep.productName).trim().toLowerCase() === String(p.productName).trim().toLowerCase()));
      if (match) {
        return {
          ...p,
          isFeatured: match.isFeatured === true
        };
      }
      return p;
    });

    // Automatically download any new external images locally and map them
    mergedProducts = await autoLocalizeProductImages(mergedProducts);

    writeJson(PRODUCTS_FILE, mergedProducts);

    res.json({
      success: true,
      message: `Successfully imported ${parsedProducts.length} products from CSV string!`,
      totalSynced: parsedProducts.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `CSV Parsing Failed: ${err.message}` });
  }
});

// ---------------------------------------------------------
// SETTINGS API
// ---------------------------------------------------------
app.get('/api/settings', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  res.json({ success: true, settings });
});

app.put('/api/settings', (req, res) => {
  const currentSettings = readJson(SETTINGS_FILE, {});
  const updatedSettings = {
    ...currentSettings,
    storeName: req.body.storeName || currentSettings.storeName,
    tagline: req.body.tagline || currentSettings.tagline,
    deliveryCharge: parseFloat(req.body.deliveryCharge) ?? currentSettings.deliveryCharge,
    freeShippingMinOrder: parseFloat(req.body.freeShippingMinOrder) ?? currentSettings.freeShippingMinOrder,
    codAdvanceAmount: parseFloat(req.body.codAdvanceAmount) ?? 1000,
    googleSheetUrl: req.body.googleSheetUrl ?? currentSettings.googleSheetUrl,
    razorpay: {
      keyId: req.body.razorpay?.keyId || currentSettings.razorpay?.keyId || '',
      keySecret: req.body.razorpay?.keySecret || currentSettings.razorpay?.keySecret || ''
    },
    shiprocket: {
      email: req.body.shiprocket?.email || currentSettings.shiprocket?.email || '',
      password: req.body.shiprocket?.password || currentSettings.shiprocket?.password || '',
      channelId: req.body.shiprocket?.channelId || currentSettings.shiprocket?.channelId || ''
    },
    discountCoupons: req.body.discountCoupons || currentSettings.discountCoupons || []
  };

  writeJson(SETTINGS_FILE, updatedSettings);
  res.json({ success: true, message: 'Settings saved successfully.', settings: updatedSettings });
});

// ---------------------------------------------------------
// RAZORPAY PAYMENT API (Online Payments & COD ₹1,000 Advance)
// ---------------------------------------------------------
app.post('/api/payment/create-razorpay-order', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const { amount, paymentType, customerDetails } = req.body;

    // Amount should be passed in INR, converted to paise (* 100)
    const orderAmountInPaise = Math.round((parseFloat(amount) || 0) * 100);

    if (orderAmountInPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order amount.' });
    }

    const razorpayKeyId = settings.razorpay?.keyId || 'rzp_test_sampleKey123';
    const razorpayKeySecret = settings.razorpay?.keySecret || 'sampleSecretKey456';

    // If live key is provided, instantiate real Razorpay SDK instance
    let razorpayOrderId = `order_sim_${Date.now()}`;

    if (razorpayKeyId && !razorpayKeyId.includes('sampleKey')) {
      try {
        const instance = new Razorpay({
          key_id: razorpayKeyId,
          key_secret: razorpayKeySecret
        });

        const options = {
          amount: orderAmountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: {
            paymentType: paymentType || 'ONLINE',
            customerPhone: customerDetails?.phone || ''
          }
        };

        const rzpOrder = await instance.orders.create(options);
        razorpayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.warn('Razorpay SDK notice (using fallback order ID):', rzpErr.message);
      }
    }

    res.json({
      success: true,
      razorpayOrderId,
      amount: orderAmountInPaise,
      currency: 'INR',
      keyId: razorpayKeyId,
      paymentType,
      isSimulation: razorpayKeyId.includes('sampleKey')
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/payment/verify-razorpay', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const keySecret = settings.razorpay?.keySecret || 'sampleSecretKey456';

  // If using simulation mode, approve automatically
  if (razorpay_order_id.startsWith('order_sim_') || keySecret.includes('sampleSecret')) {
    return res.json({
      success: true,
      verified: true,
      paymentId: razorpay_payment_id || `pay_sim_${Date.now()}`
    });
  }

  // Real signature verification logic
  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    return res.json({ success: isValid, verified: isValid, paymentId: razorpay_payment_id });
  } catch (err) {
    return res.status(400).json({ success: false, verified: false, message: err.message });
  }
});

// ---------------------------------------------------------
// ORDERS & SHIPROCKET DISPATCH API
// ---------------------------------------------------------
app.get('/api/orders', (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  res.json({ success: true, total: orders.length, orders });
});

app.post('/api/orders', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const orders = readJson(ORDERS_FILE, []);

    const {
      customerName,
      phone,
      email,
      address,
      pincode,
      city,
      state,
      items,
      paymentMethod, // 'ONLINE' or 'COD'
      paymentId,
      razorpayOrderId,
      couponApplied,
      subtotal,
      deliveryFee,
      discountAmount,
      finalTotal
    } = req.body;

    if (!customerName || !phone || !address || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'Missing required order details.' });
    }

    // Calculate tiered COD advance
    let codAdvanceFee = finalTotal;
    let remainingBalanceAtDelivery = 0;
    if (paymentMethod === 'COD') {
      if (finalTotal < 1000) {
        codAdvanceFee = finalTotal;
        remainingBalanceAtDelivery = 0;
      } else if (finalTotal <= 3000) {
        codAdvanceFee = 500;
        remainingBalanceAtDelivery = Math.max(0, finalTotal - 500);
      } else if (finalTotal <= 10000) {
        codAdvanceFee = 1000;
        remainingBalanceAtDelivery = Math.max(0, finalTotal - 1000);
      } else {
        codAdvanceFee = Math.round(finalTotal * 0.10);
        remainingBalanceAtDelivery = Math.max(0, finalTotal - codAdvanceFee);
      }
    }

    const newOrder = {
      id: `AK-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toISOString(),
      customerName,
      phone,
      email: email || '',
      address,
      pincode,
      city: city || 'Chennai',
      state: state || 'Tamil Nadu',
      items,
      subtotal: parseFloat(subtotal) || 0,
      deliveryFee: parseFloat(deliveryFee) || 0,
      discountAmount: parseFloat(discountAmount) || 0,
      finalTotal: parseFloat(finalTotal) || 0,
      paymentMethod, // ONLINE or COD
      paymentStatus: paymentMethod === 'COD' 
        ? (remainingBalanceAtDelivery === 0 ? 'PAID_ONLINE' : `ADVANCE_PAID_₹${codAdvanceFee}`) 
        : 'PAID_ONLINE',
      paymentId: paymentId || `pay_sim_${Date.now()}`,
      razorpayOrderId: razorpayOrderId || '',
      advancePaid: paymentMethod === 'COD' ? codAdvanceFee : finalTotal,
      balanceOnDelivery: paymentMethod === 'COD' ? remainingBalanceAtDelivery : 0,
      status: 'PROCESSING',
      shiprocket: null
    };

    // Dispatch to Shiprocket API
    const shiprocketHelper = new ShiprocketHelper(settings.shiprocket?.email, settings.shiprocket?.password);
    const shiprocketRes = await shiprocketHelper.createShiprocketOrder(newOrder, settings);
    newOrder.shiprocket = shiprocketRes;

    orders.unshift(newOrder);
    writeJson(ORDERS_FILE, orders);

    res.json({
      success: true,
      message: paymentMethod === 'COD'
        ? `COD Order Placed! ₹${codAdvanceFee} Advance Paid successfully. Balance ₹${remainingBalanceAtDelivery} payable on delivery.`
        : 'Order Placed Successfully via Online Payment!',
      order: newOrder
    });
  } catch (err) {
    console.error('Order placement error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ORDER EMAIL NOTIFICATION ENDPOINT
app.post('/api/send-order-email', async (req, res) => {
  try {
    const order = req.body || {};
    if (!order || !order.id) {
      return res.status(400).json({ success: false, message: 'Missing order details.' });
    }

    const localSettings = readJson(SETTINGS_FILE, {});
    const settings = order.settings || localSettings || {};

    const smtpHost = settings.smtpHost || localSettings.smtpHost || process.env.SMTP_HOST || 'smtp.zoho.in';
    const smtpPort = parseInt(settings.smtpPort || localSettings.smtpPort || process.env.SMTP_PORT || '465');
    const smtpUser = settings.smtpUser || localSettings.smtpUser || process.env.SMTP_USER || 'admin@akinfotechcctv.in';
    const smtpPass = settings.smtpPass || localSettings.smtpPass || process.env.SMTP_PASS || '';
    const rawSender = settings.smtpSender || localSettings.smtpSender || process.env.SMTP_SENDER || 'AK Infotech';
    const adminRecipientsStr = settings.smtpRecipients || localSettings.smtpRecipients || process.env.SMTP_RECIPIENTS || 'akinfotechtn@gmail.com, admin@akinfotechcctv.in';

    if (!smtpPass) {
      console.warn("SMTP Password is missing. Cannot send order email.");
      return res.status(200).json({ success: false, message: 'SMTP Password missing in store settings.' });
    }

    // Format Sender (From Header) so Zoho/Gmail SMTP won't reject it
    const sender = rawSender.includes('<') ? rawSender : `"${rawSender}" <${smtpUser}>`;

    // Recipient list: Admin emails + Customer email
    const recipientList = adminRecipientsStr.split(',').map(s => s.trim()).filter(Boolean);
    const customerEmail = (order.email || order.userEmail || order.customerEmail || '').trim();
    if (customerEmail && !recipientList.some(e => e.toLowerCase() === customerEmail.toLowerCase())) {
      recipientList.push(customerEmail);
    }
    const recipients = recipientList.join(', ');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    let computedSubtotalWithGst = 0;
    const itemsHtml = (order.items || []).map(item => {
      const basePrice = Number(item.sellingPrice || 0);
      const gstPercent = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
      const gstAmount = Math.round((basePrice * gstPercent) / 100);
      const itemPriceWithGst = basePrice + gstAmount;
      const qty = Number(item.quantity || item.qty || 1);
      const itemTotalWithGst = itemPriceWithGst * qty;
      computedSubtotalWithGst += itemTotalWithGst;

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">
            <img src="${item.photoLink}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 8px;">
            <strong>${item.productName}</strong>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${itemPriceWithGst.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${itemTotalWithGst.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const emailSubject = `🎉 New Order Placed: ${order.id} (₹${(order.finalTotal || 0).toLocaleString('en-IN')})`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0ea5e9; margin: 0 0 4px 0;">AK INFOTECH</h2>
          <p style="color: #64748b; font-size: 0.9rem; margin: 0;">New Order Notification Manager</p>
        </div>
        
        <h3 style="color: #0f172a; margin-top: 0;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Order ID:</strong></td>
            <td style="padding: 6px 0; text-align: right;"><strong>${order.id}</strong></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Date & Time:</strong></td>
            <td style="padding: 6px 0; text-align: right;">${new Date().toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Method:</strong></td>
            <td style="padding: 6px 0; text-align: right;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${order.paymentMethod || 'COD'}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Status:</strong></td>
            <td style="padding: 6px 0; text-align: right;">${order.paymentStatus || 'PENDING'}</td>
          </tr>
        </table>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Customer Details</h3>
        <p style="font-size: 0.9rem; line-height: 1.5; color: #334155; margin: 0 0 20px 0;">
          <strong>Name:</strong> ${order.customerName || order.name || 'N/A'}<br>
          <strong>Phone:</strong> ${order.phone || order.custPhone || 'N/A'}<br>
          <strong>Email:</strong> ${order.email || 'N/A'}<br>
          <strong>Address:</strong> ${order.address || ''}, ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}
        </p>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Item Name</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1; width: 60px;">Qty</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Price</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 10px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Subtotal (incl. GST):</td>
            <td style="padding: 6px 0; text-align: right;">₹${computedSubtotalWithGst.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Delivery Charges:</td>
            <td style="padding: 6px 0; text-align: right;">${order.deliveryFee === 0 ? '<span style="color:#16a34a; font-weight:bold;">FREE</span>' : `₹${(order.deliveryFee || 0).toLocaleString('en-IN')}`}</td>
          </tr>
          ${order.discountAmount ? `
          <tr>
            <td style="padding: 6px 0; color: #16a34a;">Discount Code Applied:</td>
            <td style="padding: 6px 0; text-align: right; color: #16a34a;">-₹${(order.discountAmount || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #e2e8f0; font-size: 1.1rem; font-weight: bold;">
            <td style="padding: 10px 0; color: #0f172a;">Grand Total Payable:</td>
            <td style="padding: 10px 0; text-align: right; color: #0284c7;">₹${(order.finalTotal || 0).toLocaleString('en-IN')}</td>
          </tr>
          ${order.paymentMethod === 'COD' ? `
          <tr style="font-size: 0.9rem; color: #64748b;">
            <td style="padding: 6px 0;">Advance Paid Online:</td>
            <td style="padding: 6px 0; text-align: right;">₹${(order.advancePaid || 0).toLocaleString('en-IN')}</td>
          </tr>
          <tr style="font-size: 0.95rem; font-weight: bold; color: #b45309; background: #fffbe6; border: 1px dashed #ffe58f;">
            <td style="padding: 8px;">Balance Payable at Delivery:</td>
            <td style="padding: 8px; text-align: right;">₹${(order.balanceOnDelivery || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <a href="https://wa.me/919500673207" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">
            💬 Contact Store on WhatsApp
          </a>
        </div>
      </div>
    `;

    if (transporter) {
      await transporter.sendMail({
        from: sender,
        to: recipients,
        subject: emailSubject,
        html: emailBody
      });
      console.log(`✉️ Successful order email sent for order ${order.id} to ${recipients}`);
      return res.json({ success: true, message: 'Email sent successfully via Nodemailer SMTP!' });
    }

    res.json({ success: true, message: 'SMTP not configured, order received.' });
  } catch (err) {
    console.error('Email sending error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Shiprocket Full Proxy API (Fixes CORS on client-side requests)
app.post('/api/shiprocket', async (req, res) => {
  try {
    const { action, email, password, token, payload, shipment_id, courier_id, pickup_postcode, delivery_postcode, weight, cod } = req.body || {};

    if (action === 'login') {
      const loginRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await loginRes.json();
      return res.status(loginRes.status).json(data);
    }

    if (action === 'create_order') {
      const orderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await orderRes.json();
      return res.status(orderRes.status).json(data);
    }

    if (action === 'get_couriers') {
      const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=${pickup_postcode || '603202'}&delivery_postcode=${delivery_postcode || '600001'}&weight=${weight || 0.5}&cod=${cod ? 1 : 0}`;
      const courierRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await courierRes.json();
      return res.status(courierRes.status).json(data);
    }

    if (action === 'generate_awb') {
      const awbRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id, courier_id })
      });
      const data = await awbRes.json();
      return res.status(awbRes.status).json(data);
    }

    if (action === 'generate_label') {
      const labelRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id: [shipment_id] })
      });
      const data = await labelRes.json();
      return res.status(labelRes.status).json(data);
    }

    if (action === 'cancel_order') {
      const { ids, awbs } = req.body || {};
      let cancelRes;
      if (awbs && awbs.length) {
        cancelRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ awbs })
        });
      } else {
        const orderIds = ids ? (Array.isArray(ids) ? ids : [ids]) : [];
        cancelRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ids: orderIds })
        });
      }
      const data = await cancelRes.json();
      return res.status(cancelRes.status).json(data);
    }

    return res.status(400).json({ success: false, message: `Unknown Shiprocket action: ${action}` });
  } catch (err) {
    console.error("Shiprocket proxy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------
// DEPLOY TO GITHUB
// ---------------------------------------------------------
const { execSync } = require('child_process');

app.post('/api/deploy', (req, res) => {
  try {
    const repoRoot = path.join(__dirname, '..');

    // Read token from local .deploy.env file (gitignored)
    let token = process.env.GITHUB_TOKEN || '';
    const deployEnvPath = path.join(__dirname, '.deploy.env');
    if (!token && fs.existsSync(deployEnvPath)) {
      const lines = fs.readFileSync(deployEnvPath, 'utf8').split('\n');
      for (const line of lines) {
        const [key, val] = line.trim().split('=');
        if (key === 'GITHUB_TOKEN' && val) { token = val.trim(); break; }
      }
    }

    if (!token) {
      return res.status(400).json({ success: false, message: 'No GITHUB_TOKEN found. Add it to server/.deploy.env' });
    }

    const authUrl = `https://${token}@github.com/akinfotechtn/ecom.git`;
    const safeUrl = `https://github.com/akinfotechtn/ecom.git`;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Update ecom remote with authenticated URL (stored in local .git/config only, never committed)
    try {
      execSync(`git remote set-url ecom ${authUrl}`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (e) {
      execSync(`git remote add ecom ${authUrl}`, { cwd: repoRoot, stdio: 'pipe' });
    }

    // Stage all changes
    execSync('git add .', { cwd: repoRoot, stdio: 'pipe' });

    let committed = true;
    try {
      execSync(`git commit -m "[Deploy] Products updated - ${timestamp}"`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (e) {
      committed = false; // nothing new to commit
    }

    // Push via ecom remote so VS Code tracking ref updates
    execSync('git push ecom main', { cwd: repoRoot, stdio: 'pipe' });

    // Reset ecom remote to safe URL (without token)
    try {
      execSync(`git remote set-url ecom ${safeUrl}`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (e) {}

    const msg = committed
      ? `✅ Committed & pushed to GitHub at ${timestamp}`
      : `✅ Pushed existing commits to GitHub at ${timestamp}`;

    return res.json({ success: true, message: msg });
  } catch (err) {
    console.error('[deploy] Error:', err.message);
    // Reset ecom remote to safe URL on error too
    try {
      execSync(`git remote set-url ecom https://github.com/akinfotechtn/ecom.git`, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    } catch (_) { }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Ak Info Ecom Server is running on port ${PORT}`);
  console.log(` Storefront UI: http://localhost:${PORT}`);
  console.log(` Admin Portal : http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);

  // Build static pages on startup
  generateStaticPages();
});
