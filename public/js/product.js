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
      <img src="${currentProduct.photoLink && (currentProduct.photoLink.startsWith('http') || currentProduct.photoLink.startsWith('data:')) ? currentProduct.photoLink : (DbService.getLinkPrefix() + (currentProduct.photoLink || 'images/cctv-wholesale.webp'))}" alt="${escapeHtml(currentProduct.productName)}" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
    </div>
    <div class="product-info-box">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <span class="badge-glow">${escapeHtml(currentProduct.brand || 'AK Infotech')}</span>
        <a href="${DbService.getLinkPrefix()}categories/${DbService.slugify(currentProduct.category)}.html" class="badge-glow" style="background:#f0f9ff; color:var(--accent-cyan); border-color:#bae6fd; text-decoration:none;" title="View Category Page">${escapeHtml(currentProduct.category)}</a>
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
        <div class="product-text-formatted" style="font-size:0.93rem; line-height:1.7; color:#334155; white-space:pre-line; word-break:break-word;">${(currentProduct.productSpec || currentProduct.description || 'No detailed specifications listed.').split('\n').map(line => {
          if (line.trim().startsWith('*')) {
            return '<span style="color: #ef4444; font-weight: 700;">' + escapeHtml(line) + '</span>';
          }
          return escapeHtml(line);
        }).join('\n')}</div>
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
        <a href="https://wa.me/919500673207?text=${encodeURIComponent(`Hi AK Infotech, I am inquiring about: ${currentProduct.productName} (Price: ₹${currentProduct.sellingPrice})`)}" target="_blank" class="btn-whatsapp-quote">
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
        <img src="${p.photoLink && (p.photoLink.startsWith('http') || p.photoLink.startsWith('data:')) ? p.photoLink : (DbService.getLinkPrefix() + (p.photoLink || 'images/cctv-wholesale.webp'))}" alt="${escapeHtml(p.productName)}" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
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
