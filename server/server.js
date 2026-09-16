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
  'cart.html',
  'order-success.html'
]);

function adjustPaths(html) {
  return html
    .replace(/href="css\//g, 'href="../css/')
    .replace(/src="js\//g, 'src="../js/')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/href="images\//g, 'href="../images/')
    .replace(/this\.src='images\//g, "this.src='../images/")
    .replace(/href="index\.html"/g, 'href="/"')
    .replace(/href="index\.html\b/g, 'href="/"')
    .replace(/href="\.\.\/index\.html"/g, 'href="/"')
    .replace(/href="sitemap\.html"/g, 'href="../sitemap.html"')
    .replace(/href="account\.html/g, 'href="../account.html')
    .replace(/href="admin\.html/g, 'href="../admin.html')
    .replace(/href="checkout\.html/g, 'href="../checkout.html')
    .replace(/href="privacy\.html/g, 'href="../privacy.html')
    .replace(/href="terms\.html/g, 'href="../terms.html')
    .replace(/href="refund\.html/g, 'href="../refund.html')
    .replace(/href="contact\.html/g, 'href="../contact.html')
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateStaticPages() {
  try {
    const products = readJson(PRODUCTS_FILE, []);
    const brands = readJson(BRANDS_FILE, []);
    const categories = readJson(CATEGORIES_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});
    const siteUrl = (settings.baseUrl || 'https://shop.akinfotechcctv.in').replace(/\/$/, '');

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

        const prodTitle = `${p.productName} | AK Infotech Security Store`;
        const prodDesc = (p.productSpec || `Buy ${p.productName} at wholesale price ₹${p.sellingPrice || ''} from AK Infotech Chennai. Fast delivery & COD available.`).slice(0, 160);
        const prodCanonical = `${siteUrl}/product/${slug}.html`;
        
        let photoUrl = p.photoLink || 'images/cctv-wholesale.webp';
        const absolutePhotoUrl = (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))
          ? photoUrl
          : `${siteUrl}/${photoUrl.replace(/^\.?\/?/, '')}`;

        const basePrice = Number(p.sellingPrice || 0);
        const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
        const gstAmount = Math.round((basePrice * gstRate) / 100);
        const priceWithGst = basePrice + gstAmount;
        const sellingPrice = priceWithGst;
        const mrpPrice = p.price || 0;
        const brandName = p.brand || 'AK Infotech';
        const categoryName = p.category || 'Security Equipment';
        const isInStock = p.inStock !== false;

        // Structured Data (JSON-LD) Object
        const schemaObj = {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": p.productName,
          "image": [absolutePhotoUrl],
          "description": (p.productSpec || `Buy ${p.productName} online with Cash on Delivery (COD) & manufacturer warranty from AK Infotech.`).slice(0, 300),
          "sku": String(p.id || 'PROD-' + slug.slice(0, 12)),
          "mpn": String(p.id || 'MPN-' + slug.slice(0, 12)),
          "brand": {
            "@type": "Brand",
            "name": brandName
          },
          "offers": {
            "@type": "Offer",
            "url": prodCanonical,
            "priceCurrency": "INR",
            "price": String(sellingPrice),
            "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            "itemCondition": "https://schema.org/NewCondition",
            "availability": isInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "acceptedPaymentMethod": [
              "https://schema.org/Cash",
              "https://schema.org/CreditCard"
            ],
            "hasMerchantReturnPolicy": {
              "@type": "MerchantReturnPolicy",
              "applicableCountry": "IN",
              "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
              "merchantReturnDays": 3,
              "returnMethod": "https://schema.org/ReturnByMail",
              "returnFees": "https://schema.org/FreeReturn",
              "returnPolicySeasonalOverride": "Return accepted within 3 days only if product is damaged in transit or different from ordered item."
            },
            "shippingDetails": {
              "@type": "OfferShippingDetails",
              "shippingRate": {
                "@type": "MonetaryAmount",
                "value": "0.00",
                "currency": "INR"
              },
              "shippingDestination": [{
                "@type": "DefinedRegion",
                "addressCountry": "IN"
              }],
              "deliveryTime": {
                "@type": "ShippingDeliveryTime",
                "handlingTime": {
                  "@type": "QuantitativeValue",
                  "minValue": 0,
                  "maxValue": 1,
                  "unitCode": "DAY"
                },
                "transitTime": {
                  "@type": "QuantitativeValue",
                  "minValue": 3,
                  "maxValue": 7,
                  "unitCode": "DAY"
                }
              }
            },
            "seller": {
              "@type": "Organization",
              "name": "AK Infotech"
            }
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": String(15 + (slug.length % 25))
          }
        };

        const breadcrumbsObj = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": `${siteUrl}/`
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": categoryName,
              "item": `${siteUrl}/categories/${slugify(categoryName)}.html`
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": p.productName,
              "item": prodCanonical
            }
          ]
        };

        const injectScript = `<script>window.staticProductData = ${JSON.stringify(p)};</script>`;
        let html = productTemplate.replace('</head>', `${injectScript}\n</head>`);
        html = html.replace(/<title id="metaPageTitle">.*?<\/title>/, `<title id="metaPageTitle">${escapeHtml(prodTitle)}</title>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(prodTitle)}</title>`);
        html = html.replace(/<meta name="title" id="metaTitle" content=".*?"\s*\/?>/, `<meta name="title" id="metaTitle" content="${escapeHtml(prodTitle)}">`);
        html = html.replace(/<meta name="description" id="metaDescription" content=".*?"\s*\/?>/, `<meta name="description" id="metaDescription" content="${escapeHtml(prodDesc)}">`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${escapeHtml(prodDesc)}">`);
        
        // Canonical tag
        if (html.includes('<link rel="canonical"')) {
          html = html.replace(/<link rel="canonical"( id="canonicalLink")? href=".*?"\s*\/?>/, `<link rel="canonical" id="canonicalLink" href="${prodCanonical}">`);
        } else {
          html = html.replace('</head>', `<link rel="canonical" id="canonicalLink" href="${prodCanonical}">\n</head>`);
        }

        // Open Graph Tags
        html = html.replace(/<meta property="og:title" id="ogTitle" content=".*?"\s*\/?>/, `<meta property="og:title" id="ogTitle" content="${escapeHtml(prodTitle)}">`);
        html = html.replace(/<meta property="og:description" id="ogDescription" content=".*?"\s*\/?>/, `<meta property="og:description" id="ogDescription" content="${escapeHtml(prodDesc)}">`);
        html = html.replace(/<meta property="og:url" id="ogUrl" content=".*?"\s*\/?>/, `<meta property="og:url" id="ogUrl" content="${prodCanonical}">`);
        html = html.replace(/<meta property="og:image" id="ogImage" content=".*?"\s*\/?>/, `<meta property="og:image" id="ogImage" content="${escapeHtml(absolutePhotoUrl)}">`);
        html = html.replace(/<meta property="og:image:alt" id="ogImageAlt" content=".*?"\s*\/?>/, `<meta property="og:image:alt" id="ogImageAlt" content="${escapeHtml(p.productName)}">`);
        html = html.replace(/<meta property="product:price:amount" id="ogPriceAmount" content=".*?"\s*\/?>/, `<meta property="product:price:amount" id="ogPriceAmount" content="${sellingPrice}">`);
        html = html.replace(/<meta property="product:availability" id="ogAvailability" content=".*?"\s*\/?>/, `<meta property="product:availability" id="ogAvailability" content="${isInStock ? 'instock' : 'oos'}">`);
        html = html.replace(/<meta property="product:brand" id="ogBrand" content=".*?"\s*\/?>/, `<meta property="product:brand" id="ogBrand" content="${escapeHtml(brandName)}">`);

        // Twitter Card Tags
        html = html.replace(/<meta name="twitter:title" id="twitterTitle" content=".*?"\s*\/?>/, `<meta name="twitter:title" id="twitterTitle" content="${escapeHtml(prodTitle)}">`);
        html = html.replace(/<meta name="twitter:description" id="twitterDescription" content=".*?"\s*\/?>/, `<meta name="twitter:description" id="twitterDescription" content="${escapeHtml(prodDesc)}">`);
        html = html.replace(/<meta name="twitter:image" id="twitterImage" content=".*?"\s*\/?>/, `<meta name="twitter:image" id="twitterImage" content="${escapeHtml(absolutePhotoUrl)}">`);
        html = html.replace(/<meta name="twitter:image:alt" id="twitterImageAlt" content=".*?"\s*\/?>/, `<meta name="twitter:image:alt" id="twitterImageAlt" content="${escapeHtml(p.productName)}">`);

        // Structured Data (JSON-LD): Product + Breadcrumbs
        html = html.replace(/<script type="application\/ld\+json" id="jsonLdProductSchema">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="jsonLdProductSchema">\n${JSON.stringify(schemaObj, null, 2)}\n  </script>`);
        if (html.includes('id="jsonLdBreadcrumbs"')) {
          html = html.replace(/<script type="application\/ld\+json" id="jsonLdBreadcrumbs">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="jsonLdBreadcrumbs">\n${JSON.stringify(breadcrumbsObj, null, 2)}\n  </script>`);
        } else {
          html = html.replace('</head>', `<script type="application/ld+json" id="jsonLdBreadcrumbs">\n${JSON.stringify(breadcrumbsObj, null, 2)}\n  </script>\n</head>`);
        }

        // Pre-render Crawler SSR Fallback elements inside detail-grid
        html = html.replace(/id="mainProductImage"\s+src=".*?"\s+alt=".*?"/, `id="mainProductImage" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(p.productName)} - AK Infotech"`);
        html = html.replace(/id="fallbackProductTitle"[\s\S]*?<\/h1>/, `id="fallbackProductTitle" style="font-size: 1.6rem; font-weight: 800; color: var(--text-dark); margin-bottom: 12px; line-height: 1.25;">${escapeHtml(p.productName)}</h1>`);
        html = html.replace(/id="fallbackBrandBadge".*?>.*?<\/span>/, `id="fallbackBrandBadge"><a href="../brands/${slugify(brandName)}.html" style="color:inherit; text-decoration:none;">${escapeHtml(brandName)}</a></span>`);
        html = html.replace(/id="fallbackCategoryBadge".*?>.*?<\/span>/, `id="fallbackCategoryBadge" style="background:#f0f9ff; color:var(--accent-cyan); border-color:#bae6fd;"><a href="../categories/${slugify(categoryName)}.html" style="color:inherit; text-decoration:none;">${escapeHtml(categoryName)}</a></span>`);
        html = html.replace(/id="fallbackSellingPrice".*?>.*?<\/span>/, `id="fallbackSellingPrice" style="font-size: 1.8rem;">₹${Number(sellingPrice).toLocaleString('en-IN')}</span>`);
        html = html.replace(/id="fallbackProductSpec".*?>[\s\S]*?<\/div>/, `id="fallbackProductSpec" style="font-size:0.93rem; line-height:1.7; color:#334155; white-space:pre-line; word-break:break-word;">${escapeHtml(p.productSpec || prodDesc)}</div>`);
        html = html.replace(/id="bcCategory">.*?<\/span>/, `id="bcCategory"><a href="../categories/${slugify(categoryName)}.html" style="color:inherit; text-decoration:underline;">${escapeHtml(categoryName)}</a></span>`);
        html = html.replace(/id="bcName">.*?<\/span>/, `id="bcName">${escapeHtml(p.productName)}</span>`);

        // Pre-render 4-6 related products from same category or brand
        const related = products.filter(item => item.productName !== p.productName && (
          (item.category && item.category.toLowerCase().trim() === categoryName.toLowerCase().trim()) ||
          (item.brand && item.brand.toLowerCase().trim() === brandName.toLowerCase().trim())
        )).slice(0, 6);

        if (related.length > 0) {
          const relatedCards = related.map(rp => {
            const rSlug = slugify(rp.productName);
            const rImg = rp.photoLink && (rp.photoLink.startsWith('http') || rp.photoLink.startsWith('data:'))
              ? rp.photoLink
              : `../${(rp.photoLink || 'images/cctv-wholesale.webp').replace(/^\/+/, '').replace(/^\.\.\//, '')}`;
            const rBasePrice = Number(rp.sellingPrice || 0);
            const rGst = (rp.gstPercent !== undefined && rp.gstPercent !== null && rp.gstPercent !== '') ? Number(rp.gstPercent) : 18;
            const rPrice = rBasePrice + Math.round((rBasePrice * rGst) / 100);
            return `
              <div class="product-card">
                <a href="../product/${rSlug}.html" class="product-image-wrap">
                  <img src="${escapeHtml(rImg)}" alt="${escapeHtml(rp.productName)}" loading="lazy" onerror="this.src='../images/cctv-wholesale.webp'">
                  <span class="brand-badge">${escapeHtml(rp.brand || 'AK Infotech')}</span>
                </a>
                <div class="product-info" style="padding: 12px;">
                  <h3 class="product-name" style="font-size: 0.9rem;"><a href="../product/${rSlug}.html" style="color: var(--text-dark); text-decoration: none;">${escapeHtml(rp.productName)}</a></h3>
                  <div class="product-price" style="font-weight: 800; color: var(--accent-cyan); margin-top: 6px;">₹${rPrice.toLocaleString('en-IN')}</div>
                </div>
              </div>`;
          }).join('\n');
          html = html.replace(/<div class="product-grid" id="relatedProductsGrid"><\/div>/, `<div class="product-grid" id="relatedProductsGrid">${relatedCards}</div>`);
        }

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

      const allBrands = [...brands];
      const seenBrandNames = new Set(brands.map(b => (b.name || '').toLowerCase().trim()));
      for (const p of products) {
        if (!p.brand) continue;
        const bNorm = p.brand.toLowerCase().trim();
        if (!seenBrandNames.has(bNorm)) {
          seenBrandNames.add(bNorm);
          allBrands.push({
            id: `brand-${slugify(p.brand)}`,
            name: p.brand.trim(),
            imageLink: 'images/logo.webp'
          });
        }
      }

      for (const b of allBrands) {
        if (!b.name) continue;
        const slug = slugify(b.name);
        validBrandSlugs.add(slug);
        const fileName = `${slug}.html`;
        const filePath = path.join(brandDir, fileName);

        const brandTitle = `${b.name} CCTV Security Products | AK Infotech`;
        const brandDesc = `Shop 100% genuine ${b.name} CCTV cameras, DVR/NVR, surveillance systems, and accessories at wholesale & retail prices at AK Infotech Chennai.`;
        const brandCanonical = `${siteUrl}/brands/${slug}.html`;

        const injectScript = `<script>window.staticBrandData = ${JSON.stringify(b)};</script>`;
        let html = brandTemplate.replace('</head>', `${injectScript}\n</head>`);
        
        // Title & Meta Description
        html = html.replace(/<title id="brandPageTitle">.*?<\/title>/, `<title id="brandPageTitle">${escapeHtml(brandTitle)}</title>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(brandTitle)}</title>`);
        html = html.replace(/<meta name="description" id="brandPageMeta" content=".*?"\s*\/?>/, `<meta name="description" id="brandPageMeta" content="${escapeHtml(brandDesc)}">`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${escapeHtml(brandDesc)}">`);
        
        // Canonical tag
        if (html.includes('<link rel="canonical"')) {
          html = html.replace(/<link rel="canonical" href=".*?"\s*\/?>/, `<link rel="canonical" href="${brandCanonical}">`);
        } else {
          html = html.replace('</head>', `<link rel="canonical" href="${brandCanonical}">\n</head>`);
        }

        // Distinct Static H1, Hero Sub, Logo and Breadcrumb for search engine crawlers
        html = html.replace(/<h1 class="brand-hero-title" id="brandHeroName">.*?<\/h1>/, `<h1 class="brand-hero-title" id="brandHeroName">${escapeHtml(b.name)} Products</h1>`);
        html = html.replace(/<p class="brand-hero-sub" id="brandHeroSub">.*?<\/p>/, `<p class="brand-hero-sub" id="brandHeroSub">Authorized Wholesale & Retail ${escapeHtml(b.name)} Security Equipment</p>`);
        html = html.replace(/<strong id="breadcrumbBrandName".*?>.*?<\/strong>/, `<strong id="breadcrumbBrandName" style="color: var(--text-dark);">${escapeHtml(b.name)}</strong>`);
        if (b.imageLink) {
          const isExt = /^https?:\/\//i.test(b.imageLink) || b.imageLink.startsWith('//') || b.imageLink.startsWith('data:');
          const imgClean = isExt ? b.imageLink : `../${b.imageLink.replace(/^\/+/, '').replace(/^\.\.\//, '')}`;
          html = html.replace(/<img id="brandHeroLogo" src=".*?" alt=".*?"/g, `<img id="brandHeroLogo" src="${escapeHtml(imgClean)}" alt="${escapeHtml(b.name)} Logo"`);
        }

        // Pre-render static crawlable product cards for this brand
        const bNameLower = (b.name || '').toLowerCase().trim();
        const bProducts = products.filter(p => (p.brand || '').toLowerCase().trim() === bNameLower);
        if (bProducts.length > 0) {
          const bCards = bProducts.map(p => {
            const pSlug = slugify(p.productName);
            const pImg = p.photoLink && (p.photoLink.startsWith('http') || p.photoLink.startsWith('data:'))
              ? p.photoLink
              : `../${(p.photoLink || 'images/cctv-wholesale.webp').replace(/^\/+/, '').replace(/^\.\.\//, '')}`;
            const basePrice = Number(p.sellingPrice || 0);
            const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
            const pPrice = basePrice + Math.round((basePrice * gstRate) / 100);
            return `
              <div class="product-card">
                <a href="../product/${pSlug}.html" class="product-image-wrap">
                  <img src="${escapeHtml(pImg)}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='../images/cctv-wholesale.webp'">
                  <span class="brand-badge">${escapeHtml(p.brand || b.name)}</span>
                </a>
                <div class="product-info" style="padding: 12px;">
                  <h3 class="product-name" style="font-size: 0.9rem;"><a href="../product/${pSlug}.html" style="color: var(--text-dark); text-decoration: none;">${escapeHtml(p.productName)}</a></h3>
                  <div class="product-price" style="font-weight: 800; color: var(--accent-cyan); margin-top: 6px;">₹${pPrice.toLocaleString('en-IN')}</div>
                </div>
              </div>`;
          }).join('\n');
          html = html.replace(/<div class="product-grid" id="brandProductGrid">[\s\S]*?<\/div>\s*<\/div>/, `<div class="product-grid" id="brandProductGrid">${bCards}</div>`);
        }

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
      if (!allCats.some(c => c.name && c.name.toLowerCase().includes('combo'))) {
        allCats.push({ id: 'cat-combo', name: 'Combo Packs', imageLink: 'images/categories/combo-packs.webp' });
      }
      const seenCatNames = new Set(allCats.map(c => (c.name || '').toLowerCase().trim()));
      for (const p of products) {
        if (!p.category) continue;
        const cNorm = p.category.toLowerCase().trim();
        if (!seenCatNames.has(cNorm)) {
          seenCatNames.add(cNorm);
          allCats.push({
            id: `cat-${slugify(p.category)}`,
            name: p.category.trim(),
            imageLink: 'images/categories/cctv-wholesale.webp'
          });
        }
      }

      for (const c of allCats) {
        if (!c.name) continue;
        const slug = slugify(c.name);
        validCatSlugs.add(slug);
        const fileName = `${slug}.html`;
        const filePath = path.join(catDir, fileName);

        const catTitle = `Shop ${c.name} Security Systems | AK Infotech`;
        const catDesc = `Explore top wholesale & retail ${c.name} security equipment, CCTV cameras, accessories, and IT solutions at AK Infotech Chennai. Fast delivery & COD available.`;
        const catCanonical = `${siteUrl}/categories/${slug}.html`;

        const injectScript = `<script>window.staticCategoryData = ${JSON.stringify(c)};</script>`;
        let html = categoryTemplate.replace('</head>', `${injectScript}\n</head>`);
        
        // Title & Meta Description
        html = html.replace(/<title id="categoryPageTitle">.*?<\/title>/, `<title id="categoryPageTitle">${escapeHtml(catTitle)}</title>`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(catTitle)}</title>`);
        html = html.replace(/<meta name="description" id="categoryPageMeta" content=".*?"\s*\/?>/, `<meta name="description" id="categoryPageMeta" content="${escapeHtml(catDesc)}">`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${escapeHtml(catDesc)}">`);
        
        // Canonical tag
        if (html.includes('<link rel="canonical"')) {
          html = html.replace(/<link rel="canonical" href=".*?"\s*\/?>/, `<link rel="canonical" href="${catCanonical}">`);
        } else {
          html = html.replace('</head>', `<link rel="canonical" href="${catCanonical}">\n</head>`);
        }

        // Distinct Static H1, Hero Sub, Logo and Breadcrumb for search engine crawlers
        html = html.replace(/<h1 class="category-hero-title" id="categoryHeroName">.*?<\/h1>/, `<h1 class="category-hero-title" id="categoryHeroName">${escapeHtml(c.name)} Products</h1>`);
        html = html.replace(/<p class="category-hero-sub" id="categoryHeroSub">.*?<\/p>/, `<p class="category-hero-sub" id="categoryHeroSub">Explore top wholesale & retail ${escapeHtml(c.name)} security equipment</p>`);
        html = html.replace(/<strong id="breadcrumbCategoryName".*?>.*?<\/strong>/, `<strong id="breadcrumbCategoryName" style="color: var(--text-dark);">${escapeHtml(c.name)}</strong>`);
        if (c.imageLink) {
          const isExt = /^https?:\/\//i.test(c.imageLink) || c.imageLink.startsWith('//') || c.imageLink.startsWith('data:');
          const imgClean = isExt ? c.imageLink : `../${c.imageLink.replace(/^\/+/, '').replace(/^\.\.\//, '')}`;
          html = html.replace(/<img id="categoryHeroLogo" src=".*?" alt=".*?"/g, `<img id="categoryHeroLogo" src="${escapeHtml(imgClean)}" alt="${escapeHtml(c.name)} Icon"`);
        }

        // Pre-render static crawlable product cards for this category
        const cNameLower = (c.name || '').toLowerCase().trim();
        const isCombo = cNameLower.includes('combo');
        const cProducts = isCombo
          ? products.filter(p => p.isCombo || (p.category || '').toLowerCase().includes('combo') || (p.productName || '').toLowerCase().includes('combo'))
          : products.filter(p => {
              if (!p.category) return false;
              const pCat = p.category.toLowerCase().trim();
              return pCat === cNameLower || pCat.includes(cNameLower) || cNameLower.includes(pCat);
            });

        if (cProducts.length > 0) {
          const cCards = cProducts.map(p => {
            const pSlug = slugify(p.productName);
            const pImg = p.photoLink && (p.photoLink.startsWith('http') || p.photoLink.startsWith('data:'))
              ? p.photoLink
              : `../${(p.photoLink || 'images/cctv-wholesale.webp').replace(/^\/+/, '').replace(/^\.\.\//, '')}`;
            const basePrice = Number(p.sellingPrice || 0);
            const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
            const pPrice = basePrice + Math.round((basePrice * gstRate) / 100);
            return `
              <div class="product-card">
                <a href="../product/${pSlug}.html" class="product-image-wrap">
                  <img src="${escapeHtml(pImg)}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='../images/cctv-wholesale.webp'">
                  <span class="brand-badge">${escapeHtml(p.brand || 'AK Infotech')}</span>
                  ${p.isCombo ? `<span class="combo-badge">🔥 COMBO</span>` : ''}
                </a>
                <div class="product-info" style="padding: 12px;">
                  <h3 class="product-name" style="font-size: 0.9rem;"><a href="../product/${pSlug}.html" style="color: var(--text-dark); text-decoration: none;">${escapeHtml(p.productName)}</a></h3>
                  <div class="product-price" style="font-weight: 800; color: var(--accent-cyan); margin-top: 6px;">₹${pPrice.toLocaleString('en-IN')}</div>
                </div>
              </div>`;
          }).join('\n');
          html = html.replace(/<div class="product-grid" id="categoryProductGrid">[\s\S]*?<\/div>\s*<\/div>/, `<div class="product-grid" id="categoryProductGrid">${cCards}</div>`);
        }

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

    // 5. Generate complete HTML Sitemap & Directory
    generateHtmlSitemap(products, brands, categories);

    // 6. Generate sitemap.xml and robots.txt incrementally
    generateSitemapAndRobots(products, brands, categories);

    console.log(`[SSG-Delta] Static Pages -> Products: ${writtenProducts} modified, ${skippedProducts} unchanged | Brands: ${writtenBrands} modified | Categories: ${writtenCats} modified | Deleted: ${deletedCount}`);
  } catch (err) {
    console.error('[SSG] Generation error:', err.message);
  }
}

function generateHtmlSitemap(products, brands, categories) {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const siteUrl = (settings.baseUrl || 'https://shop.akinfotechcctv.in').replace(/\/$/, '');
    const sitemapPath = path.join(__dirname, '../public/sitemap.html');

    // Group products by category
    const catMap = new Map();
    for (const c of categories) {
      if (c.name) catMap.set(c.name.trim(), []);
    }
    if (!catMap.has('Combo Packs')) {
      catMap.set('Combo Packs', []);
    }

    const unassigned = [];
    for (const p of products) {
      if (!p.productName) continue;
      if (p.isCombo || (p.category && p.category.toLowerCase().includes('combo'))) {
        if (!catMap.has('Combo Packs')) catMap.set('Combo Packs', []);
        catMap.get('Combo Packs').push(p);
      } else if (p.category && catMap.has(p.category.trim())) {
        catMap.get(p.category.trim()).push(p);
      } else if (p.category) {
        let found = false;
        for (const [key, list] of catMap.entries()) {
          if (key.toLowerCase() === p.category.toLowerCase().trim()) {
            list.push(p);
            found = true;
            break;
          }
        }
        if (!found) {
          catMap.set(p.category.trim(), [p]);
        }
      } else {
        unassigned.push(p);
      }
    }
    if (unassigned.length > 0) {
      catMap.set('General Security Products', unassigned);
    }

    let catNavHtml = '';
    for (const [catName, prodList] of catMap.entries()) {
      const slug = slugify(catName);
      catNavHtml += `<li><a href="categories/${slug}.html"><strong>${escapeHtml(catName)}</strong> <span style="color:#64748b;">(${prodList.length})</span></a></li>\n`;
    }

    let brandNavHtml = '';
    for (const b of brands) {
      if (!b.name) continue;
      const bSlug = slugify(b.name);
      const bCount = products.filter(p => (p.brand || '').toLowerCase().trim() === b.name.toLowerCase().trim()).length;
      brandNavHtml += `<li><a href="brands/${bSlug}.html"><strong>${escapeHtml(b.name)}</strong> <span style="color:#64748b;">(${bCount})</span></a></li>\n`;
    }

    let prodSectionsHtml = '';
    for (const [catName, prodList] of catMap.entries()) {
      if (prodList.length === 0) continue;
      const slug = slugify(catName);
      prodSectionsHtml += `
      <section style="margin-bottom: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span>📂 <a href="categories/${slug}.html" style="color: #0f172a; text-decoration: none;">${escapeHtml(catName)}</a></span>
          <a href="categories/${slug}.html" style="font-size: 0.82rem; color: #0284c7; text-decoration: none; font-weight: 700;">View Category Page →</a>
        </h2>
        <ul style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; list-style: none; padding: 0; margin: 0;">
          ${prodList.map(p => {
            const pSlug = slugify(p.productName);
            const basePrice = Number(p.sellingPrice || 0);
            const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
            const price = basePrice + Math.round((basePrice * gstRate) / 100);
            return `<li style="padding: 6px 0; border-bottom: 1px solid #f8fafc; font-size: 0.88rem; line-height: 1.4;">
              <a href="product/${pSlug}.html" style="color: #1e293b; text-decoration: none; font-weight: 600;">${escapeHtml(p.productName)}</a>
              <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">${escapeHtml(p.brand || 'AK Infotech')} · <strong style="color: #059669;">₹${price.toLocaleString('en-IN')}</strong></div>
            </li>`;
          }).join('\n')}
        </ul>
      </section>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete CCTV & Security Products Catalog Directory | AK Infotech</title>
  <meta name="description" content="Complete directory and HTML sitemap of all 915+ CCTV cameras, DVR/NVR recorders, biometric devices, PoE switches, and cables available at AK Infotech Chennai.">
  <link rel="canonical" href="${siteUrl}/sitemap.html">
  <link rel="icon" type="image/webp" href="images/logo.webp">
  <link rel="stylesheet" href="css/style.css">
  <style>
    .sitemap-container { max-width: 1200px; margin: 20px auto 60px; padding: 0 20px; }
    .sitemap-grid-nav { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; list-style: none; padding: 0; margin: 0; }
    .sitemap-grid-nav li a { display: block; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b; text-decoration: none; font-size: 0.85rem; transition: all 0.2s; }
    .sitemap-grid-nav li a:hover { background: #e0f2fe; border-color: #0284c7; color: #0284c7; }
  </style>
</head>
<body>
  <!-- HEADER -->
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="images/logo.webp" alt="AK Infotech" class="logo-img">
        <div class="logo-text">
          <span class="logo-title">AK INFOTECH</span>
          <span class="logo-sub">Wholesale CCTV & IT Hub</span>
        </div>
      </a>
      <div class="header-actions">
        <a href="/" class="nav-btn" style="text-decoration: none; font-weight: 700;">🏠 Store Home</a>
        <a href="contact.html" class="nav-btn" style="text-decoration: none;">📞 Contact</a>
      </div>
    </div>
  </header>

  <!-- MAIN SITEMAP CONTENT -->
  <main class="sitemap-container">
    <nav class="breadcrumb" style="margin-bottom: 20px;">
      <a href="/">Home</a> &gt; <span>HTML Sitemap & Complete Catalog</span>
    </nav>

    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 32px 24px; border-radius: 16px; margin-bottom: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <h1 style="font-size: 2rem; font-weight: 900; margin: 0 0 10px 0; color: #ffffff;">Complete Security Equipment Catalog & Sitemap</h1>
      <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin: 0; max-width: 800px;">
        Browse our complete inventory of ${products.length}+ CCTV surveillance cameras, DVRs, NVRs, biometric attendance machines, smart door locks, cables, and accessories. Fast dispatch across India via Shiprocket with Cash on Delivery (COD).
      </p>
    </div>

    <!-- 1. CATEGORIES DIRECTORY -->
    <section style="margin-bottom: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px;">
      <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
        📂 Browse by Category (${catMap.size} Categories)
      </h2>
      <ul class="sitemap-grid-nav">
        ${catNavHtml}
      </ul>
    </section>

    <!-- 2. BRANDS DIRECTORY -->
    <section style="margin-bottom: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px;">
      <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
        🏷️ Browse by Brand (${brands.length} Brands)
      </h2>
      <ul class="sitemap-grid-nav">
        ${brandNavHtml}
      </ul>
    </section>

    <!-- 3. ALL PRODUCTS BY CATEGORY -->
    <div style="margin-top: 40px;">
      <h2 style="font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-bottom: 20px;">📦 Complete Products Directory (${products.length} Products)</h2>
      ${prodSectionsHtml}
    </div>
  </main>

  <!-- FOOTER -->
  <footer class="site-footer" style="background: #0f172a; color: #94a3b8; padding: 40px 20px 80px; margin-top: 50px; border-top: 1px solid #1e293b;">
    <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
      <p style="margin-bottom: 12px;"><a href="/" style="color: #38bdf8; text-decoration: none; font-weight: 700;">🏠 Home</a> · <a href="contact.html" style="color: #cbd5e1; text-decoration: none;">Contact</a> · <a href="privacy.html" style="color: #cbd5e1; text-decoration: none;">Privacy Policy</a> · <a href="terms.html" style="color: #cbd5e1; text-decoration: none;">Terms of Service</a> · <a href="refund.html" style="color: #cbd5e1; text-decoration: none;">Refund Policy</a></p>
      <p style="font-size: 0.82rem; color: #64748b;">&copy; 2026 AK Infotech. Authorized Wholesale Security Equipment Hub, Mount Road, Chennai - 600002.</p>
    </div>
  </footer>
</body>
</html>`;

    writeIfChanged(sitemapPath, html);
    console.log('[SSG] HTML Sitemap generated at public/sitemap.html');
  } catch (err) {
    console.error('[SSG] HTML Sitemap generation error:', err.message);
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

    // 1. Root / Core pages (Excluded: cart, checkout, account, order-success, product.html for crawl budget efficiency)
    const corePages = [
      '', // Root Homepage https://shop.akinfotechcctv.in/
      'sitemap.html',
      'contact.html',
      'privacy.html',
      'terms.html',
      'refund.html'
    ];
    for (const page of corePages) {
      const loc = page ? `${siteUrl}/${page}` : `${siteUrl}/`;
      xml += `  <url>\n`;
      xml += `    <loc>${loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
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
    robots += `Disallow: /cart.html\n`;
    robots += `Disallow: /checkout.html\n`;
    robots += `Disallow: /order-success.html\n`;
    robots += `Disallow: /account.html\n`;
    robots += `Disallow: /product.html\n\n`;

    // AI & Search Crawlers (Generative Engine Optimization - GEO)
    robots += `User-agent: GPTBot\nAllow: /\nDisallow: /admin.html\nDisallow: /local-sync.html\nDisallow: /cart.html\nDisallow: /checkout.html\nDisallow: /product.html\n\n`;
    robots += `User-agent: PerplexityBot\nAllow: /\nDisallow: /admin.html\nDisallow: /local-sync.html\nDisallow: /product.html\n\n`;
    robots += `User-agent: ClaudeBot\nAllow: /\nDisallow: /admin.html\nDisallow: /local-sync.html\nDisallow: /product.html\n\n`;
    robots += `User-agent: Google-Extended\nAllow: /\n\n`;

    robots += `Sitemap: ${siteUrl}/sitemap.xml\n`;
    robots += `# Generative Engine Optimization Knowledge Base:\n`;
    robots += `# ${siteUrl}/llms.txt\n`;

    writeIfChanged(path.join(__dirname, '../public/robots.txt'), robots);

    // 6. Generate Google Shopping XML Feed
    generateGoogleShoppingFeed(products);

  } catch (err) {
    console.error('[SSG] Error generating sitemap/robots:', err.message);
  }
}

function generateGoogleShoppingFeed(products) {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const siteUrl = (settings.baseUrl || 'https://shop.akinfotechcctv.in').replace(/\/$/, '');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n`;
    xml += `  <channel>\n`;
    xml += `    <title><![CDATA[AK Infotech - CCTV Security Systems & Cameras]]></title>\n`;
    xml += `    <link>${siteUrl}</link>\n`;
    xml += `    <description><![CDATA[Authorized Wholesale & Retail Security Systems Distributor in Chennai. 4K CCTV Cameras, DVR/NVR, Biometrics, PoE Switches & IT Accessories.]]></description>\n`;

    for (const p of products) {
      if (!p.productName) continue;
      const slug = slugify(p.productName);
      const rawId = (p.id || slug).trim();
      let googleOfferId = rawId;
      if (googleOfferId.length > 50) {
        const hash = crypto.createHash('md5').update(rawId).digest('hex').slice(0, 8);
        const truncated = rawId.slice(0, 41).replace(/-+$/, '');
        googleOfferId = `${truncated}-${hash}`.slice(0, 50);
      }

      const base = Number(p.sellingPrice || p.price || 0);
      const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
      const finalPrice = (base + Math.round((base * gstRate) / 100)).toFixed(2);
      const mrpRaw = Number(p.price || 0);
      const mrpPrice = mrpRaw > 0 ? mrpRaw.toFixed(2) : finalPrice;
      const photo = p.photoLink ? (p.photoLink.startsWith('http') ? p.photoLink : `${siteUrl}/${p.photoLink.replace(/^\//, '')}`) : `${siteUrl}/images/logo.webp`;
      
      let cleanDesc = (p.productSpec || `${p.productName} by ${p.brand || 'AK Infotech'}. Authorized wholesale price in Chennai. Fast courier dispatch and warranty.`)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const cleanTitle = p.productName.trim().replace(/\s+/g, ' ');

      xml += `    <item>\n`;
      xml += `      <g:id><![CDATA[${googleOfferId}]]></g:id>\n`;
      xml += `      <g:title><![CDATA[${cleanTitle}]]></g:title>\n`;
      xml += `      <g:description><![CDATA[${cleanDesc}]]></g:description>\n`;
      xml += `      <g:link>${siteUrl}/product/${slug}.html</g:link>\n`;
      xml += `      <g:image_link>${photo}</g:image_link>\n`;
      xml += `      <g:availability>${p.inStock === false ? 'out_of_stock' : 'in_stock'}</g:availability>\n`;
      if (Number(mrpPrice) > Number(finalPrice)) {
        xml += `      <g:price>${mrpPrice} INR</g:price>\n`;
        xml += `      <g:sale_price>${finalPrice} INR</g:sale_price>\n`;
      } else {
        xml += `      <g:price>${finalPrice} INR</g:price>\n`;
      }
      xml += `      <g:brand><![CDATA[${p.brand || 'AK Infotech'}]]></g:brand>\n`;
      xml += `      <g:condition>new</g:condition>\n`;
      xml += `      <g:identifier_exists>no</g:identifier_exists>\n`;
      xml += `      <g:shipping>\n`;
      xml += `        <g:country>IN</g:country>\n`;
      xml += `        <g:service>Cash on Delivery / Standard Courier</g:service>\n`;
      xml += `        <g:price>150.00 INR</g:price>\n`;
      xml += `      </g:shipping>\n`;
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    writeIfChanged(path.join(__dirname, '../public/google-feed.xml'), xml);
    console.log(`[Google Feed] Generated public/google-feed.xml with ${products.length} products`);
  } catch (err) {
    console.error('[Google Feed] Error generating XML feed:', err.message);
  }
}

// ---------------------------------------------------------
// GOOGLE SHOPPING FEED API
// ---------------------------------------------------------
app.get('/api/google-shopping-feed.xml', (req, res) => {
  const feedPath = path.join(__dirname, '../public/google-feed.xml');
  if (fs.existsSync(feedPath)) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.sendFile(feedPath);
  }
  const products = readJson(PRODUCTS_FILE, []);
  generateGoogleShoppingFeed(products);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  return res.sendFile(path.join(__dirname, '../public/google-feed.xml'));
});

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

    // Merge existing features (like isFeatured, custom images, exact IDs) to imported products
    const existingProducts = readJson(PRODUCTS_FILE, []);
    let mergedProducts = parsedProducts.map(p => {
      const match = existingProducts.find(ep => 
        (ep.id && p.id && String(ep.id).trim().toLowerCase() === String(p.id).trim().toLowerCase()) || 
        (ep.productName && p.productName && String(ep.productName).trim().toLowerCase() === String(p.productName).trim().toLowerCase())
      );
      if (match) {
        return {
          ...p,
          id: match.id || p.id,
          isFeatured: match.isFeatured === true,
          photoLink: (match.photoLink && !match.photoLink.includes('cctv-wholesale.webp')) ? match.photoLink : p.photoLink
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
      const match = existingProducts.find(ep => 
        (ep.id && p.id && String(ep.id).trim().toLowerCase() === String(p.id).trim().toLowerCase()) || 
        (ep.productName && p.productName && String(ep.productName).trim().toLowerCase() === String(p.productName).trim().toLowerCase())
      );
      if (match) {
        return {
          ...p,
          id: match.id || p.id,
          isFeatured: match.isFeatured === true,
          photoLink: (match.photoLink && !match.photoLink.includes('cctv-wholesale.webp')) ? match.photoLink : p.photoLink
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

    const SITE_URL = 'https://shop.akinfotechcctv.in';
    const getAbsoluteImageUrl = (photoLink) => {
      if (!photoLink) return `${SITE_URL}/images/logo.webp`;
      if (photoLink.startsWith('http://') || photoLink.startsWith('https://') || photoLink.startsWith('data:')) {
        return photoLink;
      }
      return `${SITE_URL}/${photoLink.replace(/^\/+/, '')}`;
    };

    let computedSubtotalWithGst = 0;
    const itemsHtml = (order.items || []).map(item => {
      const basePrice = Number(item.sellingPrice || 0);
      const gstPercent = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
      const gstAmount = Math.round((basePrice * gstPercent) / 100);
      const itemPriceWithGst = basePrice + gstAmount;
      const qty = Number(item.quantity || item.qty || 1);
      const itemTotalWithGst = itemPriceWithGst * qty;
      computedSubtotalWithGst += itemTotalWithGst;

      const itemImgUrl = getAbsoluteImageUrl(item.photoLink || item.image || item.photo);
      const itemName = item.productName || item.name || 'Product';
      const noteVal = item.notes || item.itemNotes || '';
      const itemNoteHtml = noteVal 
        ? `<div style="margin-top: 4px; font-size: 0.78rem; color: #0284c7; background: #e0f2fe; border-left: 3px solid #0284c7; padding: 3px 6px; border-radius: 0 4px 4px 0; display: inline-block;">📝 <strong>Note:</strong> ${escapeHtml(noteVal)}</div>` 
        : '';

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; vertical-align: middle;">
            <table style="border-collapse: collapse; border: none;">
              <tr>
                <td style="padding: 0 8px 0 0; vertical-align: middle;">
                  <img src="${itemImgUrl}" alt="${escapeHtml(itemName)}" width="40" height="40" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid #e2e8f0; background: #ffffff; display: block;">
                </td>
                <td style="padding: 0; vertical-align: middle;">
                  <strong style="color: #0f172a; font-size: 0.9rem;">${escapeHtml(itemName)}</strong>
                  ${itemNoteHtml}
                </td>
              </tr>
            </table>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; vertical-align: middle;">${qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; vertical-align: middle;">₹${itemPriceWithGst.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; vertical-align: middle; font-weight: bold;">₹${itemTotalWithGst.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const emailSubject = `🎉 New Order Placed: ${order.id} (₹${(order.finalTotal || 0).toLocaleString('en-IN')})`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px;">
          <img src="${SITE_URL}/images/logo.webp" alt="AK Infotech" width="44" height="44" style="max-height: 44px; width: auto; margin-bottom: 6px; display: inline-block;">
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
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Read optional token from local .deploy.env file (gitignored) or environment variable
    let token = (process.env.GITHUB_TOKEN || '').trim();
    const deployEnvPath = path.join(__dirname, '.deploy.env');
    if (!token && fs.existsSync(deployEnvPath)) {
      const lines = fs.readFileSync(deployEnvPath, 'utf8').split('\n');
      for (const line of lines) {
        const [key, val] = line.trim().split('=');
        if (key === 'GITHUB_TOKEN' && val) {
          token = val.trim();
          break;
        }
      }
    }

    // Ensure remote URLs are configured
    const userRepoUrl = 'https://akinfotechtn@github.com/akinfotechtn/ecom.git';
    try {
      execSync(`git remote set-url origin ${userRepoUrl}`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (_) {
      try { execSync(`git remote add origin ${userRepoUrl}`, { cwd: repoRoot, stdio: 'pipe' }); } catch (_) {}
    }
    try {
      execSync(`git remote set-url ecom ${userRepoUrl}`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (_) {
      try { execSync(`git remote add ecom ${userRepoUrl}`, { cwd: repoRoot, stdio: 'pipe' }); } catch (_) {}
    }

    // Stage all changes
    execSync('git add .', { cwd: repoRoot, stdio: 'pipe' });

    let committed = true;
    try {
      execSync(`git commit -m "[Deploy] Products updated - ${timestamp}"`, { cwd: repoRoot, stdio: 'pipe' });
    } catch (e) {
      committed = false; // nothing new to commit
    }

    let pushSuccess = false;
    let lastError = null;

    // 1. If a valid token is provided, push with token (bypassing interactive prompts)
    if (token) {
      try {
        const tokenAuthUrl = `https://x-access-token:${token}@github.com/akinfotechtn/ecom.git`;
        execSync(`git -c credential.helper= push ${tokenAuthUrl} main`, {
          cwd: repoRoot,
          stdio: 'pipe',
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
        });
        pushSuccess = true;
      } catch (tokenErr) {
        console.warn('[deploy] Token push failed, falling back to saved credentials:', tokenErr.message);
        lastError = tokenErr;
      }
    }

    // 2. Primary / Fallback: push using the saved Windows Credential Manager authentication (akinfotechtn)
    if (!pushSuccess) {
      try {
        execSync('git push origin main', {
          cwd: repoRoot,
          stdio: 'pipe',
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
        });
        pushSuccess = true;
      } catch (originErr) {
        // Retry with ecom remote
        try {
          execSync('git push ecom main', {
            cwd: repoRoot,
            stdio: 'pipe',
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
          });
          pushSuccess = true;
        } catch (ecomErr) {
          const detail = (ecomErr.stderr ? ecomErr.stderr.toString() : ecomErr.message) || (originErr.stderr ? originErr.stderr.toString() : originErr.message);
          throw new Error(`Git push failed: ${detail}`);
        }
      }
    }

    const msg = committed
      ? `✅ Committed & pushed to GitHub at ${timestamp}`
      : `✅ Pushed existing commits to GitHub at ${timestamp}`;

    return res.json({ success: true, message: msg });
  } catch (err) {
    console.error('[deploy] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Ak Info Ecom Server is running on port ${PORT}`);
    console.log(` Storefront UI: http://localhost:${PORT}`);
    console.log(` Admin Portal : http://localhost:${PORT}/admin.html`);
    console.log(`====================================================`);

    // Build static pages on startup
    generateStaticPages();
  });
}

module.exports = { app, generateStaticPages };
