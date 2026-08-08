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
  if (window.staticProductData) {
    await loadProductDetail(window.staticProductData);
  } else {
    await loadProductDetail(productId);
  }
  renderCart();
  setupEventListeners();
});

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
        <a href="index.html" class="hero-btn" style="margin-top:16px; display:inline-block;">Return to Catalog</a>
      </div>`;
    return;
  }

  // Inject dynamic SEO OpenGraph & Schema.org JSON-LD
  DbService.injectProductSEO(currentProduct);

  // Update Breadcrumb
  document.getElementById('bcCategory').textContent = currentProduct.category || 'General';
  document.getElementById('bcName').textContent = currentProduct.productName;

  const basePrice = currentProduct.sellingPrice || 0;
  const gstRate = (currentProduct.gstPercent !== undefined && currentProduct.gstPercent !== null && currentProduct.gstPercent !== '') ? Number(currentProduct.gstPercent) : 18;
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  const priceWithGst = basePrice + gstAmount;
  const savings = currentProduct.price > priceWithGst ? Math.round(((currentProduct.price - priceWithGst) / currentProduct.price) * 100) : 0;

  const isAvailable = currentProduct.inStock !== false;
  const inCartItem = cart.find(i => String(i.id) === String(currentProduct.id));
  const cartQty = inCartItem ? (inCartItem.quantity || inCartItem.qty || 0) : 0;

  detailGrid.innerHTML = `
    <div class="gallery-box">
      <img src="${currentProduct.photoLink}" alt="${escapeHtml(currentProduct.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
    </div>
    <div class="product-info-box">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <span class="badge-glow">${escapeHtml(currentProduct.brand || 'AK Infotech')}</span>
        <a href="${DbService.slugify(currentProduct.category)}.html" class="badge-glow" style="background:#f0f9ff; color:var(--accent-cyan); border-color:#bae6fd; text-decoration:none;" title="View Category Page">${escapeHtml(currentProduct.category)}</a>
        ${currentProduct.isCombo ? `<span class="badge-glow" style="background:#fff7ed; color:#c2410c; border-color:#fdba74;">🔥 Combo Package</span>` : ''}
        ${isAvailable ? `
          <span class="badge-glow" style="background:#dcfce7; color:#16a34a; border-color:#86efac;">✅ In Stock</span>
        ` : `
          <span class="badge-glow" style="background:#fee2e2; color:#dc2626; border-color:#fca5a5;">🚫 Out of Stock</span>
        `}
      </div>

      <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--text-dark); margin-bottom: 12px; line-height: 1.25;">${escapeHtml(currentProduct.productName)}</h1>

      <div class="price-row" style="margin-bottom: 16px;">
        <span class="selling-price" style="font-size: 1.8rem;">₹${priceWithGst.toLocaleString('en-IN')}</span>
        ${currentProduct.price > priceWithGst ? `<span class="mrp-price" style="font-size: 1.1rem;">₹${currentProduct.price.toLocaleString('en-IN')}</span>` : ''}
        ${savings > 0 ? `<span class="discount-tag" style="font-size: 0.85rem;">SAVE ${savings}%</span>` : ''}
      </div>

      <div style="background:#f8fafc; border:1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
        <div style="font-size:0.8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">📋 Product Overview & Specifications:</div>
        <div class="product-text-formatted" style="font-size:0.93rem; line-height:1.7; color:#334155; white-space:pre-line; word-break:break-word;">${escapeHtml(currentProduct.productSpec || currentProduct.description || 'No detailed specifications listed.')}</div>
      </div>

      ${isAvailable ? `
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; align-items: center;">
          ${cartQty > 0 ? `
            <div class="card-qty-stepper" style="height: 44px; padding: 4px;">
              <button class="qty-btn-sm" onclick="updateCartQty('${currentProduct.id}', -1)" style="width: 36px; height: 36px; font-size: 1.1rem;">-</button>
              <span class="card-qty-count" style="font-size: 1.1rem; min-width: 36px;">${cartQty}</span>
              <button class="qty-btn-sm" onclick="updateCartQty('${currentProduct.id}', 1)" style="width: 36px; height: 36px; font-size: 1.1rem;">+</button>
            </div>
            <button class="btn-view-cart" onclick="openCartDrawer()" style="padding: 12px 20px; font-size: 0.95rem; height: 44px;">
              🛒 View Cart
            </button>
          ` : `
            <button class="btn-add-cart" style="padding: 14px 24px; font-size: 0.95rem; height: 44px;" onclick="addToCart('${currentProduct.id}')">
              🛒 Add to Shopping Cart
            </button>
          `}
          <button class="btn-buy-now" onclick="buyNowDirect('${currentProduct.id}')" style="height: 44px;">
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
        <h3 class="product-name"><a href="${DbService.slugify(p.productName)}.html">${escapeHtml(p.productName)}</a></h3>
        <div class="price-row">
          <span class="selling-price">₹${p.sellingPrice.toLocaleString('en-IN')}</span>
        </div>
        <a href="${DbService.slugify(p.productName)}.html" class="btn-add-cart" style="text-decoration:none; text-align:center;">
          View Details →
        </a>
      </div>
    </div>
  `).join('');
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
  renderCart();
  if (currentProduct && String(currentProduct.id) === String(id)) {
    loadProductDetail(currentProduct.id);
  }
};

window.buyNowDirect = function (id) {
  if (currentProduct && currentProduct.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }
  addToCart(id);
  window.location.href = 'index.html?checkout=true';
};

function getItemPriceWithGst(item) {
  const basePrice = Number(item.basePrice || item.sellingPrice || 0);
  const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : 18;
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  return basePrice + gstAmount;
}

window.openCartDrawer = function () {
  cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.add('open'); drawer.classList.add('active'); }
  if (backdrop) { backdrop.classList.add('open'); backdrop.classList.add('active'); }
  renderCart();
};

window.closeCartDrawer = function () {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.remove('open'); drawer.classList.remove('active'); }
  if (backdrop) { backdrop.classList.remove('open'); backdrop.classList.remove('active'); }
};

function renderCart() {
  cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
  const cartCountEl = document.getElementById('cartCount');
  const drawerCountEl = document.getElementById('cartItemCount') || document.getElementById('cartDrawerCount');

  const totalQty = cart.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
  if (cartCountEl) cartCountEl.textContent = totalQty;
  if (drawerCountEl) drawerCountEl.textContent = totalQty;

  const itemsListEl = document.getElementById('cartItemsBody') || document.getElementById('cartItemsList');
  if (itemsListEl) {
    if (!cart.length) {
      itemsListEl.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 10px;">🛒</div>
          Your cart is empty.<br>Browse items & add to cart.
        </div>`;
    } else {
      itemsListEl.innerHTML = cart.map(item => {
        const q = item.quantity || item.qty || 1;
        const itemPriceWithGst = getItemPriceWithGst(item);
        return `
          <div class="cart-item">
            <img src="${item.photoLink}" alt="${escapeHtml(item.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:0.85rem; font-weight:700; color:var(--text-dark); margin-bottom:4px;">${escapeHtml(item.productName)}</div>
              <div class="cart-item-price" style="font-size:0.9rem; font-weight:800; color:var(--accent-cyan); font-family:var(--font-mono);">₹${itemPriceWithGst.toLocaleString('en-IN')}</div>
              <div class="cart-item-qty" style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
                <span style="font-weight: 700; font-size: 0.85rem;">${q}</span>
                <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const subtotalWithGst = cart.reduce((sum, item) => {
    const q = item.quantity || item.qty || 1;
    return sum + (getItemPriceWithGst(item) * q);
  }, 0);

  const isPayOnDelivery = (window.storeSettings && window.storeSettings.payShippingOnDelivery === true);
  const deliveryFee = (subtotalWithGst > 0 && !isPayOnDelivery) ? 150 : 0;
  const finalTotal = subtotalWithGst + deliveryFee;

  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotalWithGst.toLocaleString('en-IN')}`;

  const deliveryEl = document.getElementById('cartDelivery');
  if (deliveryEl) {
    if (subtotalWithGst === 0) {
      deliveryEl.innerHTML = `₹0`;
    } else if (isPayOnDelivery) {
      deliveryEl.innerHTML = `<span style="color: #0284c7; font-weight: 800; font-size: 0.8rem;">Calculated & Payable Upon Delivery 🚚</span>`;
    } else if (deliveryFee === 0) {
      deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">FREE 🎉</span>`;
    } else {
      deliveryEl.innerHTML = `₹${deliveryFee}`;
    }
  }

  const grandTotalEl = document.getElementById('cartGrandTotal') || document.getElementById('cartFinalTotal');
  if (grandTotalEl) grandTotalEl.textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
}

function setupEventListeners() {
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartBackdrop')?.addEventListener('click', closeCartDrawer);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
