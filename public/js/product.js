// SINGLE PRODUCT PAGE SCRIPT FOR AK INFOTECH (AVAILABILITY ENHANCED)
import { DbService } from "./db-service.js";

let currentProduct = null;
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'prod-101';

  await loadProductDetail(productId);
  renderCart();
  setupEventListeners();
});

async function loadProductDetail(id) {
  currentProduct = await DbService.getProductById(id);
  const detailGrid = document.getElementById('productDetailGrid');

  if (!currentProduct) {
    detailGrid.innerHTML = `
      <div style="text-align:center; padding: 60px 20px;">
        <h2>Product Not Found</h2>
        <p style="color:var(--text-muted); margin-top:8px;">The requested security product could not be located.</p>
        <a href="index.html" class="hero-btn" style="margin-top:16px; display:inline-block;">Return to Catalog</a>
      </div>`;
    return;
  }

  // Inject dynamic SEO OpenGraph & Schema.org JSON-LD
  DbService.injectProductSEO(currentProduct);

  // Update Breadcrumb
  document.getElementById('bcCategory').textContent = currentProduct.category || 'General';
  document.getElementById('bcName').textContent = currentProduct.productName;

  const savings = currentProduct.price > currentProduct.sellingPrice 
    ? Math.round(((currentProduct.price - currentProduct.sellingPrice) / currentProduct.price) * 100) 
    : 0;

  const isAvailable = currentProduct.inStock !== false;

  detailGrid.innerHTML = `
    <div class="gallery-box">
      <img src="${currentProduct.photoLink}" alt="${escapeHtml(currentProduct.productName)}" id="mainGalleryImg" onerror="this.src='images/cctv-wholesale.webp'">
    </div>

    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
        <span class="badge-glow">${escapeHtml(currentProduct.brand || 'AK Infotech')}</span>
        <span class="badge-glow" style="background:#f0f9ff; color:var(--accent-cyan); border-color:#bae6fd;">${escapeHtml(currentProduct.category)}</span>
        ${currentProduct.isCombo ? `<span class="badge-glow" style="background:#fff7ed; color:#c2410c; border-color:#fdba74;">🔥 Combo Package</span>` : ''}
        ${isAvailable ? `
          <span class="badge-glow" style="background:#dcfce7; color:#16a34a; border-color:#86efac;">✅ In Stock</span>
        ` : `
          <span class="badge-glow" style="background:#fee2e2; color:#dc2626; border-color:#fca5a5;">🚫 Out of Stock</span>
        `}
      </div>

      <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--text-dark); margin-bottom: 12px; line-height: 1.25;">${escapeHtml(currentProduct.productName)}</h1>

      <div class="price-row" style="margin-bottom: 16px;">
        <span class="selling-price" style="font-size: 1.8rem;">₹${currentProduct.sellingPrice.toLocaleString('en-IN')}</span>
        ${currentProduct.price > currentProduct.sellingPrice ? `<span class="mrp-price" style="font-size: 1.1rem;">₹${currentProduct.price.toLocaleString('en-IN')}</span>` : ''}
        ${savings > 0 ? `<span class="discount-tag" style="font-size: 0.85rem;">SAVE ${savings}%</span>` : ''}
      </div>

      <div style="background:#f8fafc; border:1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 20px;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); uppercase; margin-bottom:6px;">Product Specifications:</div>
        <div style="font-size:0.9rem; line-height:1.5;">${escapeHtml(currentProduct.productSpec)}</div>
      </div>

      ${isAvailable ? `
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;">
          <button class="btn-add-cart" style="padding: 14px 28px; font-size: 0.95rem;" onclick="addToCart('${currentProduct.id}')">
            🛒 Add to Shopping Cart
          </button>
          <button class="btn-buy-now" onclick="buyNowDirect('${currentProduct.id}')">
            ⚡ Buy Now (COD / Online)
          </button>
        </div>
      ` : `
        <div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px 16px; border-radius:var(--radius-md); margin-bottom:24px; font-weight:700; font-size:0.9rem;">
          ⚠️ This item is currently out of stock. Contact us on WhatsApp for restock dates or alternative products.
        </div>
      `}

      <div style="margin-top: 16px;">
        <a href="https://wa.me/919876543210?text=${encodeURIComponent(`Hi AK Infotech, I am inquiring about: ${currentProduct.productName} (Price: ₹${currentProduct.sellingPrice})`)}" target="_blank" class="btn-whatsapp-quote">
          💬 Enquire via WhatsApp Quote
        </a>
      </div>
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
        <img src="${p.photoLink}" alt="${escapeHtml(p.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
      </div>
      <div class="product-body">
        <h3 class="product-name"><a href="product.html?id=${p.id}">${escapeHtml(p.productName)}</a></h3>
        <div class="price-row">
          <span class="selling-price">₹${p.sellingPrice.toLocaleString('en-IN')}</span>
        </div>
        <a href="product.html?id=${p.id}" class="btn-add-cart" style="text-decoration:none; text-align:center;">
          View Details →
        </a>
      </div>
    </div>
  `).join('');
}

window.addToCart = function(id) {
  if (currentProduct && currentProduct.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }

  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += 1;
  } else if (currentProduct) {
    cart.push({ ...currentProduct, quantity: 1 });
  }
  localStorage.setItem('ak_cart', JSON.stringify(cart));
  renderCart();
  alert('Item added to cart!');
};

window.buyNowDirect = function(id) {
  if (currentProduct && currentProduct.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }
  addToCart(id);
  window.location.href = 'index.html?checkout=true';
};

function renderCart() {
  const cartCountEl = document.getElementById('cartCount');
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = totalQty;

  const totalAmt = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const cartFinalTotal = document.getElementById('cartFinalTotal');
  if (cartFinalTotal) cartFinalTotal.textContent = `₹${totalAmt.toLocaleString('en-IN')}`;
}

function setupEventListeners() {
  document.getElementById('openCartBtn')?.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartBackdrop')?.classList.add('active');
  });

  document.getElementById('closeCartBtn')?.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartBackdrop')?.classList.remove('active');
  });

  document.getElementById('cartBackdrop')?.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartBackdrop')?.classList.remove('active');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
