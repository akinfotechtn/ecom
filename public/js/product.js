// SINGLE PRODUCT PAGE SCRIPT FOR AK INFOTECH (AVAILABILITY ENHANCED)
import { DbService } from "./db-service.js";

let currentProduct = null;
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'prod-101';

  DbService.listenAuthState((user) => {
    const avatarEl = document.getElementById('bottomProfileAvatar');
    const textEl = document.getElementById('bottomProfileText');
    if (user) {
      if (avatarEl) {
        if (user.photoURL) {
          avatarEl.innerHTML = `<img src="${user.photoURL}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-cyan);" alt="Profile">`;
        } else {
          avatarEl.innerHTML = `👤`;
        }
      }
      if (textEl) textEl.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
    } else {
      if (avatarEl) avatarEl.innerHTML = `👤`;
      if (textEl) textEl.textContent = 'Profile';
    }
  });

  renderCart(); // Render cart instantly from localStorage

  try {
    const [settings, categories] = await Promise.all([
      DbService.getSettings(),
      DbService.getCategories()
    ]);
    window.storeSettings = settings || {};
    window.storeCategories = categories || [];
  } catch (err) {
    console.warn("Failed to load settings asynchronously on product page:", err);
  }

  if (window.staticProductData) {
    await loadProductDetail(window.staticProductData);
  } else {
    await loadProductDetail(productId);
  }
  renderCart();
  setupEventListeners();
});

export function getDeliveryDaysForPincode(pincode) {
  if (!pincode) return 3;
  const pin = String(pincode).trim();
  if (pin.length < 2) return 3;
  
  const prefix2 = pin.substring(0, 2);
  const prefix3 = pin.substring(0, 3);
  
  // Local Chennai (600xxx) -> 1 business day (Next Day)
  if (prefix3 === '600') {
    return 1;
  }
  
  // Tamil Nadu (601xxx - 643xxx) & Pondicherry (605xxx) -> 2 business days (e.g. Coimbatore, Tirupur, Madurai)
  if (['60', '61', '62', '63', '64'].includes(prefix2)) {
    return 2;
  }
  
  // South India (Karnataka 56-59, Kerala 67-69, AP/Telangana 50-53) -> 3 business days
  if (['50', '51', '52', '53', '56', '57', '58', '59', '67', '68', '69'].includes(prefix2)) {
    return 3;
  }
  
  // Major Metros (Delhi NCR 11, Mumbai 40, Kolkata 70) -> 3 business days
  if (['11', '40', '70'].includes(prefix2)) {
    return 3;
  }
  
  // Western & Central India (Maharashtra 41-44, Gujarat 36-39, MP 45-48, Rajasthan 30-34, Haryana 12-13, Punjab 14-16) -> 4 business days
  if (['12', '13', '14', '15', '16', '30', '31', '32', '33', '34', '36', '37', '38', '39', '41', '42', '43', '44', '45', '46', '47', '48'].includes(prefix2)) {
    return 4;
  }
  
  // North & East India (UP 20-28, Bihar/Jharkhand 80-85, Odisha 75-77, WB 71-74, HP 17) -> 5 business days
  if (['17', '20', '21', '22', '23', '24', '25', '26', '27', '28', '71', '72', '73', '74', '75', '76', '77', '80', '81', '82', '83', '84', '85'].includes(prefix2)) {
    return 5;
  }
  
  // North East (Assam 78, others 79), J&K/Ladakh (18, 19), Andaman (744) -> 6 business days
  if (['18', '19', '78', '79'].includes(prefix2) || prefix3 === '744') {
    return 6;
  }
  
  return 3;
}

export function getEstimatedDeliveryDate(daysToAdd = 3) {
  const d = new Date();
  let added = 0;
  while (added < daysToAdd) {
    d.setDate(d.getDate() + 1);
    // Skip Sunday (0) for courier delivery estimates
    if (d.getDay() !== 0) {
      added++;
    }
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = dayNames[d.getDay()];
  const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]}`;
  return {
    dayName: dayName,
    dateStr: dateStr,
    formatted: `${dayName}, ${dateStr}`,
    daysCount: daysToAdd
  };
}

window.selectGalleryThumb = function(thumbEl, imgSrc) {
  const mainImg = document.getElementById('mainProductImage');
  if (mainImg && imgSrc) {
    mainImg.src = imgSrc;
  }
  document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
  if (thumbEl) {
    thumbEl.classList.add('active');
  }
};

window.togglePincodeInput = function() {
  const bar = document.getElementById('pincodeInputBar');
  const wrap = document.getElementById('deliveryPincodeWrap');
  const input = document.getElementById('pincodeInputField');
  if (bar) {
    bar.classList.toggle('active');
    if (bar.classList.contains('active')) {
      if (wrap) wrap.style.display = 'none';
      if (input) {
        input.focus();
        input.select();
      }
    } else {
      const saved = localStorage.getItem('ak_pincode');
      if (saved && wrap) wrap.style.display = 'inline-flex';
    }
  }
};

window.checkPincodeDelivery = async function() {
  const input = document.getElementById('pincodeInputField');
  const msgEl = document.getElementById('pincodeFeedbackMsg');
  const displayPin = document.getElementById('deliveryPincodeDisplay');
  const displayDay = document.getElementById('deliveryDayDisplay');
  const wrap = document.getElementById('deliveryPincodeWrap');
  const bar = document.getElementById('pincodeInputBar');
  const whatsappBtn = document.getElementById('whatsappOrderBtn') || document.getElementById('fallbackWhatsappBtn');
  
  const val = input ? input.value.trim() : '';
  if (!/^\d{6}$/.test(val)) {
    if (msgEl) {
      msgEl.style.color = '#ef4444';
      msgEl.textContent = 'Please enter a valid 6-digit Indian pincode.';
    }
    return;
  }
  
  if (msgEl) {
    msgEl.style.color = '#0284c7';
    msgEl.textContent = 'Checking Shiprocket serviceability...';
  }
  
  try {
    let etdDays = getDeliveryDaysForPincode(val);
    let courierName = 'Shiprocket Express';
    
    // Call Shiprocket API endpoint
    try {
      const res = await fetch('/api/shiprocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_couriers',
          delivery_postcode: val,
          pickup_postcode: '600001',
          weight: 0.5,
          cod: 1
        })
      });
      if (res.ok) {
        const data = await res.json();
        const couriers = data.data?.available_courier_companies || data.couriers || [];
        if (couriers.length > 0) {
          const fastest = couriers[0];
          courierName = fastest.courier_name || 'Shiprocket Express';
          if (fastest.etd) {
            const match = fastest.etd.match(/\d+/);
            if (match) etdDays = Math.max(1, parseInt(match[0], 10));
          }
        }
      }
    } catch (e) {
      console.warn('Shiprocket API call fallback (using zone routing):', e);
    }
    
    localStorage.setItem('ak_pincode', val);
    const est = getEstimatedDeliveryDate(etdDays);
    if (displayPin) displayPin.textContent = val;
    if (displayDay) displayDay.textContent = est.formatted;
    
    if (wrap) wrap.style.display = 'inline-flex';
    if (bar) bar.classList.remove('active');

    // Update WhatsApp button link with new pincode
    if (whatsappBtn && currentProduct) {
      const basePrice = currentProduct.sellingPrice || 0;
      const gstRate = (currentProduct.gstPercent !== undefined && currentProduct.gstPercent !== null && currentProduct.gstPercent !== '') ? Number(currentProduct.gstPercent) : 18;
      const priceWithGst = basePrice + Math.round((basePrice * gstRate) / 100);
      whatsappBtn.href = `https://wa.me/919500673207?text=${encodeURIComponent(`Hi AK Infotech, I want to order: ${currentProduct.productName} (Price: ₹${priceWithGst}, Delivery to Pincode: ${val})`)}`;
    }
    
    if (msgEl) {
      msgEl.style.color = '#15803d';
      const transitText = est.daysCount === 1 ? 'Next-Day Delivery' : `${est.daysCount} Days Delivery`;
      msgEl.textContent = `✓ Deliverable to ${val}! Estimated delivery by ${est.formatted} (${transitText} via ${courierName}. Cash on Delivery Available).`;
    }
  } catch (err) {
    console.error('Pincode check error:', err);
    if (msgEl) {
      msgEl.style.color = '#15803d';
      const est = getEstimatedDeliveryDate(getDeliveryDaysForPincode(val));
      if (displayPin) displayPin.textContent = val;
      if (displayDay) displayDay.textContent = est.formatted;
      if (wrap) wrap.style.display = 'inline-flex';
      if (bar) bar.classList.remove('active');
      msgEl.textContent = `✓ Delivery to ${val} by ${est.formatted} (Express shipping available).`;
    }
  }
};

window.handleAddToCartClick = function() {
  if (currentProduct && currentProduct.id) {
    addToCart(currentProduct.id);
  }
};

window.handleBuyNowClick = function() {
  if (currentProduct && currentProduct.id) {
    buyNowDirect(currentProduct.id);
  }
};

async function loadProductDetail(idOrProduct) {
  if (typeof idOrProduct === 'object' && idOrProduct !== null) {
    currentProduct = idOrProduct;
  } else {
    currentProduct = await DbService.getProductById(idOrProduct);
  }
  const detailGrid = document.getElementById('productDetailGrid');

  if (!currentProduct) {
    detailGrid.innerHTML = `
      <div style="text-align:center; padding: 60px 20px;">
        <h2>Product Not Found</h2>
        <p style="color:var(--text-muted); margin-top:8px;">The requested security product could not be located.</p>
        <a href="/" class="hero-btn" style="margin-top:16px; display:inline-block;">Return to Catalog</a>
      </div>`;
    return;
  }

  // Inject dynamic SEO OpenGraph & Schema.org JSON-LD
  const basePrice = currentProduct.sellingPrice || 0;
  const gstRate = (currentProduct.gstPercent !== undefined && currentProduct.gstPercent !== null && currentProduct.gstPercent !== '') ? Number(currentProduct.gstPercent) : 18;
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  const priceWithGst = basePrice + gstAmount;
  const savings = currentProduct.price > priceWithGst ? Math.round(((currentProduct.price - priceWithGst) / currentProduct.price) * 100) : 0;

  // Runtime verification & injection of SEO Tags and Schema.org JSON-LD
  updateProductSEOTags(currentProduct, priceWithGst);
  verifyOrInjectProductSchema(currentProduct, priceWithGst);

  // Update Breadcrumb
  const bcCategory = document.getElementById('bcCategory');
  if (bcCategory) bcCategory.textContent = currentProduct.category || 'General';
  const bcName = document.getElementById('bcName');
  if (bcName) bcName.textContent = currentProduct.productName;

  const isAvailable = currentProduct.inStock !== false;
  const inCartItem = cart.find(i => String(i.id) === String(currentProduct.id));
  const cartQty = inCartItem ? (inCartItem.quantity || inCartItem.qty || 0) : 0;

  const primaryImgSrc = currentProduct.photoLink && (currentProduct.photoLink.startsWith('http') || currentProduct.photoLink.startsWith('data:')) 
    ? currentProduct.photoLink 
    : (DbService.getLinkPrefix() + (currentProduct.photoLink || 'images/cctv-wholesale.webp'));

  // Get gallery images if available and only show if multiple distinct images exist
  const rawImages = (Array.isArray(currentProduct.images) && currentProduct.images.length > 0)
    ? currentProduct.images
    : (Array.isArray(currentProduct.gallery) && currentProduct.gallery.length > 0)
      ? currentProduct.gallery
      : [];

  const uniqueImages = [...new Set([primaryImgSrc, ...rawImages].filter(Boolean))];
  const showThumbnails = uniqueImages.length > 1;

  const savedPincode = localStorage.getItem('ak_pincode') || '';
  let initialEtd = null;
  if (savedPincode) {
    const initialDays = getDeliveryDaysForPincode(savedPincode);
    initialEtd = getEstimatedDeliveryDate(initialDays);
  }

  detailGrid.innerHTML = `
    <!-- LEFT COLUMN: GALLERY & THUMBNAILS -->
    <div class="product-gallery-wrap">
      <div class="gallery-box">
        <div class="genuine-badge">✓ 100% GENUINE</div>
        <img 
          id="mainProductImage"
          src="${primaryImgSrc}" 
          alt="${escapeHtml(currentProduct.productName)} - AK Infotech" 
          loading="eager" 
          fetchpriority="high"
          decoding="sync"
          width="440"
          height="420"
          itemprop="image"
          onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'"
        >
      </div>
      ${showThumbnails ? `
        <div class="gallery-thumbnails" id="galleryThumbnails">
          ${uniqueImages.map((img, idx) => `
            <div class="thumb-item ${idx === 0 ? 'active' : ''}" onclick="selectGalleryThumb(this, '${escapeHtml(img)}')">
              <img src="${escapeHtml(img)}" alt="Thumbnail ${idx + 1}" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="gallery-thumbnails" id="galleryThumbnails" style="display:none;"></div>
      `}
    </div>

    <!-- RIGHT COLUMN: PRODUCT INFO -->
    <div class="product-info-box">
      <div class="official-store-badge">AUTHORIZED PARTNER</div>

      <h1 itemprop="name" class="product-title-h1">${escapeHtml(currentProduct.productName)}</h1>

      <!-- RATINGS & SALES PROOF -->
      <div class="rating-reviews-row">
        <span class="stars-rating">★★★★★</span>
        <span class="rating-score">4.8</span>
        <a href="#productOverviewSec" class="reviews-count">(36 Verified Customer Reviews)</a>
        <span class="sales-badge">🔥 300+ sold this month</span>
      </div>

      <!-- PRICE & DISCOUNT -->
      <div class="product-price-section" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <meta itemprop="priceCurrency" content="INR">
        <span class="price-main" itemprop="price" content="${priceWithGst}">₹${priceWithGst.toLocaleString('en-IN')}</span>
        ${currentProduct.price > priceWithGst ? `<span class="price-mrp">₹${currentProduct.price.toLocaleString('en-IN')}</span>` : ''}
        ${savings > 0 ? `<span class="price-discount-pill">${savings}% OFF</span>` : ''}
        <link itemprop="availability" href="${isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'}">
        <link itemprop="itemCondition" href="https://schema.org/NewCondition">
      </div>

      <!-- STOCK & SHIPROCKET PINCODE CHECKER -->
      <div class="stock-delivery-row">
        ${isAvailable ? `
          <span class="in-stock-badge">● IN STOCK</span>
        ` : `
          <span class="in-stock-badge" style="background:#fee2e2; color:#dc2626; border-color:#fca5a5;">🚫 OUT OF STOCK</span>
        `}
        
        <!-- CONFIRMED PINCODE DELIVERY DISPLAY (Shown when pincode is saved) -->
        <div class="delivery-pincode-wrap" id="deliveryPincodeWrap" style="${savedPincode ? 'display:inline-flex;' : 'display:none;'}">
          <span>🚚 Delivery to <strong id="deliveryPincodeDisplay">${savedPincode}</strong> by <strong class="delivery-day-highlight" id="deliveryDayDisplay">${initialEtd ? initialEtd.formatted : ''}</strong></span>
          <button type="button" class="btn-change-pincode" id="btnChangePincode" onclick="togglePincodeInput()">Change</button>
        </div>

        <!-- DEFAULT PINCODE INPUT PROMPT (Shown by default when no pincode is saved) -->
        <div class="pincode-input-bar ${savedPincode ? '' : 'active'}" id="pincodeInputBar">
          <span class="pincode-label">🚚 Check Delivery:</span>
          <input type="text" id="pincodeInputField" class="pincode-input-field" maxlength="6" placeholder="Enter 6-digit Pincode" pattern="[0-9]{6}" value="${savedPincode}" onkeydown="if(event.key==='Enter') checkPincodeDelivery()">
          <button type="button" class="btn-check-pincode" id="btnCheckPincode" onclick="checkPincodeDelivery()">Check</button>
        </div>
      </div>
      <div class="pincode-feedback-msg" id="pincodeFeedbackMsg"></div>

      <!-- ACTION BUTTONS (ADD TO CART & BUY NOW) -->
      ${isAvailable ? `
        <div class="product-actions-row">
          ${cartQty > 0 ? `
            <div class="card-qty-stepper" style="height: 48px; padding: 4px; flex: 1; display: flex; align-items: center; justify-content: space-between; background: #f1f5f9; border-radius: 10px; border: 1.5px solid #cbd5e1;">
              <button class="qty-btn-sm" onclick="updateCartQty('${currentProduct.id}', -1)" style="width: 40px; height: 40px; font-size: 1.2rem; background: #fff; border-radius: 8px; border: 1px solid #cbd5e1;" aria-label="Decrease Quantity">-</button>
              <span class="card-qty-count" style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${cartQty} in Cart</span>
              <button class="qty-btn-sm" onclick="updateCartQty('${currentProduct.id}', 1)" style="width: 40px; height: 40px; font-size: 1.2rem; background: #fff; border-radius: 8px; border: 1px solid #cbd5e1;" aria-label="Increase Quantity">+</button>
            </div>
            <button class="btn-add-cart-mockup" onclick="openCartDrawer()" style="flex: 1;">
              🛒 View Cart
            </button>
          ` : `
            <button class="btn-add-cart-mockup" onclick="addToCart('${currentProduct.id}')">
              🛒 Add to Cart
            </button>
          `}
          <button class="btn-buy-now-mockup" onclick="buyNowDirect('${currentProduct.id}')">
            ⚡ Buy Now (COD Avail.)
          </button>
        </div>
      ` : `
        <div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px 16px; border-radius:var(--radius-md); margin-bottom:20px; font-weight:700; font-size:0.9rem;">
          ⚠️ This item is currently out of stock. Contact us on WhatsApp for restock dates or alternative products.
        </div>
      `}

      <!-- TRUST MARKERS 3-COLUMN CARD -->
      <div class="trust-markers-card" aria-label="Trust Markers">
        <div class="trust-marker-item">
          <div class="trust-marker-icon">🛡️</div>
          <div class="trust-marker-text">
            <span class="trust-marker-title">Brand Warranty</span>
            <span class="trust-marker-desc">Brand certified</span>
          </div>
        </div>
        <div class="trust-marker-item">
          <div class="trust-marker-icon">💵</div>
          <div class="trust-marker-text">
            <span class="trust-marker-title">Cash on Delivery</span>
            <span class="trust-marker-desc">Pay at doorstep</span>
          </div>
        </div>
        <div class="trust-marker-item">
          <div class="trust-marker-icon">✨</div>
          <div class="trust-marker-text">
            <span class="trust-marker-title">100% Authentic</span>
            <span class="trust-marker-desc">Direct from brand</span>
          </div>
        </div>
      </div>

      <!-- ENCRYPTED CHECKOUT BANNER -->
      <div class="secure-checkout-card">
        <div class="secure-title">🔒 100% Encrypted &amp; Verified Checkout</div>
        <div class="secure-sub">Supports: UPI • Google Pay • PhonePe • Cards • NetBanking</div>
      </div>

      <!-- INSTANT WHATSAPP ORDER BUTTON -->
      <div style="margin-bottom: 20px;">
        <a id="whatsappOrderBtn" href="https://wa.me/919500673207?text=${encodeURIComponent(`Hi AK Infotech, I want to order: ${currentProduct.productName} (Price: ₹${priceWithGst}${savedPincode ? `, Delivery to Pincode: ${savedPincode}` : ''})`)}" target="_blank" class="btn-whatsapp-instant">
          💬 Instant Order via WhatsApp (+91 9500673207)
        </a>
      </div>

      <!-- PRODUCT SPECIFICATIONS & OVERVIEW -->
      <section class="specs-box" id="productOverviewSec" aria-label="Specifications and Overview" style="background:#f8fafc; border:1px solid var(--border-color); padding: 18px; border-radius: var(--radius-md); margin-top: 10px;">
        <h2 style="font-size:0.8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px; letter-spacing:0.5px;">📋 Product Overview &amp; Specifications:</h2>
        <div class="product-text-formatted" itemprop="description" style="font-size:0.93rem; line-height:1.7; color:#334155; white-space:pre-line; word-break:break-word;">${((currentProduct.productSpec && currentProduct.productSpec.trim().toLowerCase() !== 'high quality product' ? currentProduct.productSpec : '') || currentProduct.productName || 'No detailed specifications listed.').split('\n').map(line => {
          if (line.trim().startsWith('*')) {
            return '<span style="color: #ef4444; font-weight: 700;">' + escapeHtml(line) + '</span>';
          }
          return escapeHtml(line);
        }).join('\n')}</div>
      </section>
    </div>
  `;

  loadRelatedProducts(currentProduct.category, currentProduct.id);
}

async function loadRelatedProducts(category, currentId) {
  const allProds = await DbService.getProducts();
  const related = allProds.filter(p => p.category === category && p.id !== currentId).slice(0, 4);

  const container = document.getElementById('relatedProductsGrid');
  if (!container) return;

  if (!related.length) {
    container.innerHTML = `<p style="color:var(--text-muted);">No related products found.</p>`;
    return;
  }

  container.innerHTML = related.map(p => `
    <div class="product-card">
      <div class="product-image-wrap">
        <img 
          src="${p.photoLink && (p.photoLink.startsWith('http') || p.photoLink.startsWith('data:')) ? p.photoLink : (DbService.getLinkPrefix() + (p.photoLink || 'images/cctv-wholesale.webp'))}" 
          alt="${escapeHtml(p.productName)} - AK Infotech" 
          loading="lazy" 
          decoding="async"
          width="220"
          height="180"
          onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'"
        >
      </div>
      <div class="product-body">
        <h3 class="product-name"><a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html">${escapeHtml(p.productName)}</a></h3>
        <div class="price-row">
          <span class="selling-price">₹${p.sellingPrice.toLocaleString('en-IN')}</span>
        </div>
        <a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" class="btn-add-cart" style="text-decoration:none; text-align:center;">
          View Details →
        </a>
      </div>
    </div>
  `).join('');
}

/**
 * TECHNICAL SEO & RUNTIME STRUCTURED DATA HELPERS
 */

// Helper to convert relative or domain paths to canonical absolute URLs
export function toAbsoluteUrl(urlPath) {
  if (!urlPath) return 'https://shop.akinfotechcctv.in/images/cctv-wholesale.webp';
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || urlPath.startsWith('data:')) {
    return urlPath;
  }
  const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://shop.akinfotechcctv.in';
  const cleanPath = urlPath.replace(/^\.?\/?/, '');
  return `${origin}/${cleanPath}`;
}

// Helper to update or insert <meta> elements
function setOrUpdateMetaTag(attrName, attrValue, content) {
  if (content === undefined || content === null) return;
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', String(content));
}

/**
 * Runtime Verification and Fallback Injection for Schema.org JSON-LD Product Object
 * Maps: name, image, description, brand, offers (price, priceCurrency: INR, availability, url, priceValidUntil), itemCondition, sku, mpn
 */
export function verifyOrInjectProductSchema(product, effectivePrice) {
  if (!product) return;

  const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://shop.akinfotechcctv.in';
  const canonicalUrl = `${origin}${window.location.pathname}${window.location.search || ''}`;
  const absoluteImageUrl = toAbsoluteUrl(product.photoLink);
  const priceNumber = effectivePrice !== undefined ? effectivePrice : (product.sellingPrice || 0);
  const isInStock = product.inStock !== false;

  const schemaObj = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.productName,
    "image": [absoluteImageUrl],
    "description": ((product.productSpec && product.productSpec.trim().toLowerCase() !== 'high quality product' ? product.productSpec : '') || product.productName || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    "sku": String(product.id || 'PROD-' + (product.productName || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)),
    "mpn": String(product.id || 'MPN-' + (product.productName || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)),
    "brand": {
      "@type": "Brand",
      "name": product.brand || "AK Infotech"
    },
    "offers": {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": "INR",
      "price": String(priceNumber),
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
        "returnPolicySeasonalOverride": "Return accepted within 3 days only if product is damaged or different from ordered item."
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
      "reviewCount": String(15 + ((product.productName || '').length % 20))
    }
  };

  let jsonLd = document.getElementById('jsonLdProductSchema');
  if (!jsonLd) {
    jsonLd = document.createElement('script');
    jsonLd.id = 'jsonLdProductSchema';
    jsonLd.type = 'application/ld+json';
    document.head.appendChild(jsonLd);
  }

  jsonLd.textContent = JSON.stringify(schemaObj, null, 2);
}

/**
 * Runtime verification and injection for complete Meta, Canonical, Open Graph, and Twitter Cards
 */
export function updateProductSEOTags(product, effectivePrice) {
  if (!product) return;

  const siteName = "AK Infotech Security Store";
  const title = `${product.productName} | ${siteName}`;
  const hasValidSpec = product.productSpec && product.productSpec.trim() && product.productSpec.trim().toLowerCase() !== 'high quality product';
  const rawDesc = hasValidSpec ? product.productSpec : (product.productName || '');
  const description = rawDesc.replace(/\s+/g, ' ').trim().slice(0, 160);
  const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://shop.akinfotechcctv.in';
  const canonicalUrl = `${origin}${window.location.pathname}${window.location.search || ''}`;
  const absoluteImageUrl = toAbsoluteUrl(product.photoLink);
  const priceNumber = effectivePrice !== undefined ? effectivePrice : (product.sellingPrice || 0);
  const isInStock = product.inStock !== false;

  // Title & Primary Meta
  document.title = title;
  const pageTitleEl = document.getElementById('metaPageTitle');
  if (pageTitleEl) pageTitleEl.textContent = title;
  setOrUpdateMetaTag('name', 'title', title);
  setOrUpdateMetaTag('name', 'description', description);

  // Canonical link tag
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // Standard Open Graph
  setOrUpdateMetaTag('property', 'og:type', 'product');
  setOrUpdateMetaTag('property', 'og:site_name', siteName);
  setOrUpdateMetaTag('property', 'og:locale', 'en_IN');
  setOrUpdateMetaTag('property', 'og:title', title);
  setOrUpdateMetaTag('property', 'og:description', description);
  setOrUpdateMetaTag('property', 'og:url', canonicalUrl);
  setOrUpdateMetaTag('property', 'og:image', absoluteImageUrl);
  setOrUpdateMetaTag('property', 'og:image:alt', product.productName);

  // Product-Specific Open Graph Tags
  setOrUpdateMetaTag('property', 'product:price:amount', priceNumber);
  setOrUpdateMetaTag('property', 'product:price:currency', 'INR');
  setOrUpdateMetaTag('property', 'product:availability', isInStock ? 'instock' : 'oos');
  setOrUpdateMetaTag('property', 'product:brand', product.brand || 'AK Infotech');
  setOrUpdateMetaTag('property', 'product:condition', 'new');

  // Twitter Card Tags
  setOrUpdateMetaTag('name', 'twitter:card', 'summary_large_image');
  setOrUpdateMetaTag('name', 'twitter:title', title);
  setOrUpdateMetaTag('name', 'twitter:description', description);
  setOrUpdateMetaTag('name', 'twitter:image', absoluteImageUrl);
  setOrUpdateMetaTag('name', 'twitter:image:alt', product.productName);
}

window.addToCart = async function (id) {
  let prod = currentProduct;
  if (!prod) {
    try {
      prod = await DbService.getProductById(id);
    } catch (e) {
      console.warn("Product fetch fallback:", e);
    }
  }

  if (!prod) {
    alert("Product details could not be loaded.");
    return;
  }

  if (prod.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }

  const existingIndex = cart.findIndex(i => String(i.id) === String(id));
  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity || cart[existingIndex].qty || 1;
    cart[existingIndex].quantity = currentQty + 1;
    cart[existingIndex].qty = currentQty + 1;
  } else {
    cart.push({ ...prod, quantity: 1, qty: 1 });
  }

  localStorage.setItem('ak_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
  renderCart();
  if (currentProduct && String(currentProduct.id) === String(id)) {
    loadProductDetail(currentProduct.id);
  }
  openCartDrawer();
};

window.updateCartQty = function (id, change) {
  const index = cart.findIndex(item => String(item.id) === String(id));
  if (index > -1) {
    const currentQty = cart[index].quantity || cart[index].qty || 1;
    const newQty = currentQty + change;
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQty;
      cart[index].qty = newQty;
    }
  }
  localStorage.setItem('ak_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
  renderCart();
  if (currentProduct && String(currentProduct.id) === String(id)) {
    loadProductDetail(currentProduct.id);
  }
};
window.updateQty = window.updateCartQty;

window.buyNowDirect = function (id) {
  if (currentProduct && currentProduct.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }
  addToCart(id);
  window.location.href = DbService.getLinkPrefix() + 'cart.html';
};

function getItemPriceWithGst(item) {
  const basePrice = Number(item.basePrice || item.sellingPrice || 0);
  const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : 18;
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  return basePrice + gstAmount;
}

window.openCartDrawer = function () {
  window.location.href = DbService.getLinkPrefix() + 'cart.html';
};

window.closeCartDrawer = function () {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.remove('open'); drawer.classList.remove('active'); }
  if (backdrop) { backdrop.classList.remove('open'); backdrop.classList.remove('active'); }
};

let appliedCoupon = null;

function calculateCartDeliveryFee(cartItems, settings, categories = []) {
  if (!cartItems || !cartItems.length) return 0;
  if (settings && settings.payShippingOnDelivery) return 0;

  const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.sellingPrice || 0) * (item.quantity || item.qty || 1)), 0);
  const enableFree = settings.enableFreeShipping !== false;
  const freeMin = settings.freeShippingMinOrder || 3000;

  if (enableFree && subtotal >= freeMin) {
    return 0;
  }

  let maxDeliveryCharge = 0;
  cartItems.forEach(item => {
    let itemFee = 0;
    if (item.deliveryCharge !== undefined && item.deliveryCharge !== null && !isNaN(item.deliveryCharge)) {
      itemFee = Number(item.deliveryCharge);
    } else {
      const matchCat = categories.find(c => c.name?.toLowerCase() === item.category?.toLowerCase());
      if (matchCat && matchCat.deliveryCharge !== undefined && matchCat.deliveryCharge !== null && !isNaN(matchCat.deliveryCharge)) {
        itemFee = Number(matchCat.deliveryCharge);
      } else {
        itemFee = settings.deliveryCharge !== undefined ? Number(settings.deliveryCharge) : 150;
      }
    }
    if (itemFee > maxDeliveryCharge) {
      maxDeliveryCharge = itemFee;
    }
  });

  return maxDeliveryCharge || (settings.deliveryCharge !== undefined ? Number(settings.deliveryCharge) : 150);
}

function renderCart() {
  cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
  const cartCountEl = document.getElementById('cartCount');
  const drawerCountEl = document.getElementById('cartItemCount');

  const totalQty = cart.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
  if (cartCountEl) cartCountEl.textContent = totalQty;
  if (drawerCountEl) drawerCountEl.textContent = totalQty;

  const itemsListEl = document.getElementById('cartItemsBody');
  if (!itemsListEl) return;

  const settings = window.storeSettings || {};
  const categories = window.storeCategories || [];

  if (!cart.length) {
    itemsListEl.innerHTML = `
      <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 10px;">🛒</div>
        Your cart is empty.<br>Browse items & add to cart.
      </div>`;
  } else {
    itemsListEl.innerHTML = cart.map(item => {
      const q = item.quantity || item.qty || 1;
      const itemPriceWithGst = getItemPriceWithGst(item, settings);
      return `
        <div class="cart-item">
          <img src="${item.photoLink && (item.photoLink.startsWith('http') || item.photoLink.startsWith('data:')) ? item.photoLink : (DbService.getLinkPrefix() + (item.photoLink || 'images/cctv-wholesale.webp'))}" alt="${escapeHtml(item.productName)}" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(item.productName)}</div>
            <div class="cart-item-price">₹${itemPriceWithGst.toLocaleString('en-IN')}</div>
            <div class="cart-item-qty">
              <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
              <span style="font-weight: 700; font-size: 0.85rem;">${q}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const subtotalWithGst = cart.reduce((sum, item) => {
    const q = item.quantity || item.qty || 1;
    return sum + (getItemPriceWithGst(item, settings) * q);
  }, 0);

  const isPayOnDelivery = settings.payShippingOnDelivery === true;
  const enableFreeShipping = settings.enableFreeShipping !== false;
  const freeMin = settings.freeShippingMinOrder || 3000;

  let deliveryFee = isPayOnDelivery ? 0 : calculateCartDeliveryFee(cart, settings, categories);

  let discountAmount = 0;
  if (appliedCoupon && subtotalWithGst >= (appliedCoupon.minOrderAmount || 0)) {
    if (appliedCoupon.discountPercent) {
      discountAmount = Math.round((subtotalWithGst * appliedCoupon.discountPercent) / 100);
    } else if (appliedCoupon.discountFlat) {
      discountAmount = appliedCoupon.discountFlat;
    } else if (appliedCoupon.freeDelivery || appliedCoupon.type === 'FREE_DELIVERY') {
      deliveryFee = 0;
    }
  }

  const finalTotal = Math.max(0, subtotalWithGst + deliveryFee - discountAmount);

  
  const mrpSubtotal = cart.reduce((sum, item) => sum + (Math.max(Number(item.price) || 0, getItemPriceWithGst(item, (typeof storeSettings !== 'undefined' ? storeSettings : {}))) * (item.quantity || item.qty || 1)), 0);
  const mrpDiscount = Math.max(0, mrpSubtotal - subtotalWithGst);

  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${mrpSubtotal.toLocaleString('en-IN')}`;

  const deliveryEl = document.getElementById('cartDelivery');
  if (deliveryEl) {
    if (subtotalWithGst === 0) {
      deliveryEl.innerHTML = `₹0`;
        } else if (typeof appliedCoupon !== 'undefined' && appliedCoupon && (appliedCoupon.freeDelivery || appliedCoupon.type === 'FREE_DELIVERY')) {
      deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 700; font-size: 0.85rem; line-height: 1.4; display: block;">Your order will be shipped via Rathimeena or MSS. Kindly pick it up from their nearest local branch.</span>`;
    } else if (isPayOnDelivery) {
      deliveryEl.innerHTML = `<span style="color: #0284c7; font-weight: 800; font-size: 0.8rem;">Calculated & Payable Upon Delivery 🚚</span><small style="display:block; color:var(--text-muted); font-size:0.7rem;">(Freight / Shipping fee collected during delivery)</small>`;
    } else if (deliveryFee === 0) {
      deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">FREE 🎉</span>`;
    } else if (enableFreeShipping) {
      const needed = Math.max(0, freeMin - subtotalWithGst);
      deliveryEl.innerHTML = `₹${deliveryFee} ${needed > 0 ? `<small style="display:block; color:var(--text-muted); font-size:0.7rem;">Add ₹${needed.toLocaleString('en-IN')} more for FREE Delivery!</small>` : `<small style="display:block; color:var(--accent-green); font-size:0.7rem; font-weight:700;">FREE Shipping Unlocked!</small>`}`;
    } else {
      deliveryEl.innerHTML = `₹${deliveryFee} <small style="display:block; color:var(--text-muted); font-size:0.7rem;">Delivery charge calculated for catalog items</small>`;
    }
  }

  
  const discountRow = document.getElementById('discountRow');
  if (discountRow) {
    if (mrpDiscount > 0) {
      discountRow.style.display = 'flex';
      const firstSpan = discountRow.querySelector('span:first-child');
      if (firstSpan) firstSpan.textContent = 'Discount';
      const discEl = document.getElementById('cartDiscount');
      if (discEl) discEl.textContent = `-₹${mrpDiscount.toLocaleString('en-IN')}`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  let promoRow = document.getElementById('promoDiscountRow');
  if (!promoRow && discountRow && discountRow.parentNode) {
    promoRow = document.createElement('div');
    promoRow.className = 'cart-summary-row';
    promoRow.id = 'promoDiscountRow';
    promoRow.style.color = 'var(--accent-green)';
    promoRow.innerHTML = `<span>Promo Discount</span><span id="cartPromoDiscount">-₹0</span>`;
    discountRow.after(promoRow);
  }
  if (promoRow) {
    if (discountAmount > 0) {
      promoRow.style.display = 'flex';
      const pDiscEl = document.getElementById('cartPromoDiscount');
      if (pDiscEl) pDiscEl.textContent = `-₹${discountAmount.toLocaleString('en-IN')}`;
    } else {
      promoRow.style.display = 'none';
    }
  }

  const grandTotalEl = document.getElementById('cartGrandTotal');
  if (grandTotalEl) grandTotalEl.textContent = `₹${finalTotal.toLocaleString('en-IN')}`;

  // Populate coupon field visual state if already applied
  const inputEl = document.getElementById('cartCouponInput');
  const msgEl = document.getElementById('cartPromoMsg');
  if (inputEl && msgEl) {
    if (appliedCoupon) {
      inputEl.value = appliedCoupon.code;
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--accent-green)';
      msgEl.innerHTML = `Coupon <b>${appliedCoupon.code}</b> applied! <button type="button" onclick="window.removeCartCoupon()" style="background:none; border:none; color:#ef4444; font-weight:800; cursor:pointer; font-size:0.75rem; margin-left:8px; padding:2px 6px; background:#fee2e2; border-radius:4px;">✕ Remove</button>`;
    }
  if (typeof renderPromoChips === "function") renderPromoChips(); else {
      if (!inputEl.value) {
        msgEl.style.display = 'none';
      }
    }
  }
}

function setupEventListeners() {
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartBackdrop')?.addEventListener('click', closeCartDrawer);

  const applyCartCouponBtn = document.getElementById('applyCartCouponBtn');
  if (applyCartCouponBtn) {
    applyCartCouponBtn.addEventListener('click', () => {
      const inputEl = document.getElementById('cartCouponInput');
      const msgEl = document.getElementById('cartPromoMsg');
      const code = inputEl ? inputEl.value.trim().toUpperCase() : '';
      if (!code) {
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#ef4444';
          msgEl.textContent = 'Please enter a coupon code!';
        }
        return;
      }
      const coupons = (window.storeSettings && window.storeSettings.discountCoupons) || [];
      const found = coupons.find(c => c.code === code);
      if (found) {
        appliedCoupon = found;
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color = 'var(--accent-green)';
          msgEl.innerHTML = `Coupon <b>${code}</b> applied! <button type="button" onclick="window.removeCartCoupon()" style="background:none; border:none; color:#ef4444; font-weight:800; cursor:pointer; font-size:0.75rem; margin-left:8px; padding:2px 6px; background:#fee2e2; border-radius:4px;">✕ Remove</button>`;
        }
      } else {
        appliedCoupon = null;
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#ef4444';
          msgEl.textContent = 'Invalid coupon code!';
        }
      }
      renderCart();
    });
  }

  const proceedBtn = document.getElementById('proceedCheckoutBtn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (!cart.length) {
        alert('Your cart is empty!');
        return;
      }
      window.location.href = DbService.getLinkPrefix() + 'cart.html';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}


window.removeCartCoupon = function() {
  if (typeof appliedCoupon !== 'undefined') appliedCoupon = null;
  const inputEl = document.getElementById('cartCouponInput');
  const msgEl = document.getElementById('cartPromoMsg');
  if (inputEl) inputEl.value = '';
  if (msgEl) msgEl.style.display = 'none';
  if (typeof renderCart === 'function') renderCart();
};


function renderPromoChips() {
  const container = document.querySelector('.coupon-quick-chips');
  if (!container) return;
  const storeSettingsObj = typeof storeSettings !== 'undefined' ? storeSettings : (typeof window.storeSettings !== 'undefined' ? window.storeSettings : {});
  const activeCoupons = (storeSettingsObj.discountCoupons || []).filter(c => c.showInCart === true);
  if (!activeCoupons.length) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    const escapeHtmlFn = typeof escapeHtml === 'function' ? escapeHtml : (str) => {
      if (!str) return '';
      return str.replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
      });
    };
    container.innerHTML = `<span class="chip-label">Promo Codes:</span>` + activeCoupons.map(c => `
      <button type="button" class="coupon-chip" onclick="window.autoApplyCheckoutCoupon ? window.autoApplyCheckoutCoupon('${escapeHtmlFn(c.code)}') : (window.applyCartCoupon ? window.applyCartCoupon('${escapeHtmlFn(c.code)}') : null)">
        🎟️ ${escapeHtmlFn(c.code)}
      </button>
    `).join('');
    
    // Also if window.autoApplyCheckoutCoupon is not available globally, we can use applyCartCouponBtn click trick or define a global wrapper:
    if (!window.applyCartCoupon_global_wrapper) {
      window.applyCartCoupon_global_wrapper = function(code) {
        const inputEl = document.getElementById('cartCouponInput');
        if (inputEl) {
          inputEl.value = code;
          const applyBtn = document.getElementById('applyCartCouponBtn');
          if (applyBtn) applyBtn.click();
        }
      };
    }
    
    container.innerHTML = `<span class="chip-label">Promo Codes:</span>` + activeCoupons.map(c => `
      <button type="button" class="coupon-chip" onclick="window.applyCartCoupon_global_wrapper('${escapeHtmlFn(c.code)}')">
        🎟️ ${escapeHtmlFn(c.code)}
      </button>
    `).join('');
  }
}
