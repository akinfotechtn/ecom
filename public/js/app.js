// AK INFOTECH - FRONTEND APP (CHECKOUT SAVED ADDRESSES & ACCOUNT PAGE LINKING)
import { DbService } from "./db-service.js";

let allProducts = [];
let storeBrands = [];
let storeCategories = [];
let storeSettings = {
  deliveryCharge: 150,
  freeShippingMinOrder: 3000,
  codAdvanceAmount: 1000,
  discountCoupons: []
};

let activeBrand = '';
let activeCategory = '';
let isComboOnly = false;
let searchQuery = '';

let currentUser = null;
let userAddresses = [];
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
let appliedCoupon = null;
let selectedPaymentMethod = 'ONLINE'; // ONLINE or COD

let heroBanners = [];
let currentHeroIndex = 0;
let heroAutoScrollTimer = null;

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  renderCart(); // Render cart instantly from localStorage
  setupAuthState();
  try {
    await fetchSettings();
    renderCart();
  } catch (e) {
    console.error("fetchSettings error:", e);
  }
  await loadHeroBanners();
  await loadBrandsAndCategories();
  await fetchProducts();
  setupEventListeners();
  renderCart();

  // Check if checkout redirect exists
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'true') {
    setTimeout(() => {
      if (!currentUser) {
        window.openAuthChoiceModal();
      } else {
        openCheckoutModal();
      }
    }, 1200);
  }
});

function setupAuthState() {
  DbService.listenAuthState(async (user) => {
    currentUser = user;
    renderAuthUI();
    if (user) {
      userAddresses = await DbService.getUserAddresses(user.uid);
    }
  });
}

function renderAuthUI() {
  const avatarEl = document.getElementById('bottomProfileAvatar');
  const textEl = document.getElementById('bottomProfileText');

  if (currentUser) {
    if (avatarEl) {
      if (currentUser.photoURL) {
        avatarEl.innerHTML = `<img src="${currentUser.photoURL}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-cyan);" alt="Profile">`;
      } else {
        avatarEl.innerHTML = `👤`;
      }
    }
    if (textEl) {
      textEl.textContent = currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Profile';
    }
  } else {
    if (avatarEl) avatarEl.innerHTML = `👤`;
    if (textEl) textEl.textContent = 'Profile';
  }
}

async function fetchSettings() {
  try {
    storeSettings = await DbService.getSettings();
  } catch (err) {
    console.warn('Could not load settings:', err);
  }
}

async function loadBrandsAndCategories() {
  storeBrands = await DbService.getBrands();
  storeCategories = await DbService.getCategories();
  renderBrandLogosStrip();
  renderCategoryScrollRow();
}

function renderBrandLogosStrip() {
  const container = document.getElementById('brandLogosRow');
  if (!container) return;

  container.innerHTML = `
    <a href="${DbService.getLinkPrefix()}brand.html?name=All%20Brands" class="brand-logo-card ${activeBrand === '' ? 'active' : ''}" style="text-decoration:none;" title="All Brands">
      <span style="font-weight: 800; font-size: 0.82rem; color: var(--accent-cyan);">ALL BRANDS</span>
    </a>
  ` + storeBrands.map(b => `
    <a href="${DbService.getLinkPrefix()}brands/${DbService.slugify(b.name)}.html" class="brand-logo-card ${activeBrand.toLowerCase() === b.name.toLowerCase() ? 'active' : ''}" style="text-decoration:none;" title="${escapeHtml(b.name)}">
      <img src="${b.imageLink || 'images/logo.webp'}" alt="${escapeHtml(b.name)}" onerror="this.src='images/logo.webp'">
      <span>${escapeHtml(b.name)}</span>
    </a>
  `).join('');
}

function renderCategoryScrollRow() {
  const container = document.getElementById('categoryScrollRow');
  if (!container) return;

  container.innerHTML = `
    <div class="category-scroll-card ${activeCategory === '' && !isComboOnly ? 'active' : ''}" onclick="selectCategory('')">
      <div style="font-size: 1.2rem;">🏠</div>
      <span>All Categories</span>
    </div>
    <a href="${DbService.getLinkPrefix()}categories/combo-packs.html" class="category-scroll-card" style="text-decoration:none;">
      <div style="font-size: 1.3rem;">🔥</div>
      <span style="color: var(--accent-orange); font-weight: 800;">Combo Packs</span>
    </a>
  ` + storeCategories.map(c => `
    <a href="${DbService.getLinkPrefix()}categories/${DbService.slugify(c.name)}.html" class="category-scroll-card ${activeCategory.toLowerCase() === c.name.toLowerCase() && !isComboOnly ? 'active' : ''}" style="text-decoration:none;">
      <img src="${c.imageLink || 'images/cctv-wholesale.webp'}" alt="${escapeHtml(c.name)}" onerror="this.src='images/cctv-wholesale.webp'">
      <span>${escapeHtml(c.name)}</span>
    </a>
  `).join('');
}

async function fetchProducts() {
  try {
    allProducts = await DbService.getProducts();
    renderCatalog();
    renderFeaturedProducts();
    if (allProducts.length) {
      DbService.injectProductSEO(allProducts[0]);
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

window.selectBrand = function (b) {
  activeBrand = b;
  renderBrandLogosStrip();
  renderCatalog();
};

window.selectCategory = function (c) {
  if (c) {
    window.location.href = DbService.getLinkPrefix() + 'categories/' + DbService.slugify(c) + '.html';
  } else {
    activeCategory = '';
    isComboOnly = false;
    renderCategoryScrollRow();
    renderCatalog();
  }
};

window.filterByComboOnly = function () {
  isComboOnly = !isComboOnly;
  if (isComboOnly) activeCategory = '';
  renderCategoryScrollRow();
  renderCatalog();
};

const ITEMS_PER_PAGE = 12;
let currentPage = 1;

window.changePage = function (newPage) {
  currentPage = newPage;
  renderCatalog();
  const mainSec = document.querySelector('.catalog-section');
  if (mainSec) mainSec.scrollIntoView({ behavior: 'smooth' });
};

// RENDER PRODUCTS CATALOG GRID
function renderCatalog() {
  const grid = document.getElementById('productGrid');
  const paginationBar = document.getElementById('homepagePaginationBar');
  if (!grid) return;

  let filtered = [...allProducts];

  if (activeBrand) {
    filtered = filtered.filter(p => p.brand?.toLowerCase() === activeBrand.toLowerCase());
  }

  if (activeCategory) {
    filtered = filtered.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());
  }

  if (isComboOnly) {
    filtered = filtered.filter(p => p.isCombo || p.category?.toLowerCase().includes('combo'));
  }

  if (searchQuery) {
    const rawTokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    filtered = filtered.filter(p => {
      const comboText = p.isCombo ? 'combo kit pack set special offer' : '';
      const stockText = p.inStock !== false ? 'in stock available in-stock' : 'out of stock unavailable out-of-stock';
      const searchText = `
        ${p.productName || ''} 
        ${p.productSpec || ''} 
        ${p.brand || ''} 
        ${p.category || ''} 
        ${p.id || ''} 
        ₹${p.price || ''} 
        ₹${p.sellingPrice || ''} 
        ${p.price || ''} 
        ${p.sellingPrice || ''} 
        ${comboText} 
        ${stockText}
      `.toLowerCase();

      return rawTokens.every(token => searchText.includes(token));
    });
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3>No matching products found</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">Try clearing search or filters to see more security items.</p>
        <button class="hero-btn" style="margin-top: 14px; padding: 8px 20px;" onclick="resetFilters()">Reset Filters</button>
      </div>`;
    if (paginationBar) paginationBar.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProducts = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  grid.innerHTML = pageProducts.map(p => {
    const basePrice = p.sellingPrice || 0;
    const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : (storeSettings.defaultGstPercent !== undefined ? storeSettings.defaultGstPercent : 18);
    const gstAmount = Math.round((basePrice * gstRate) / 100);
    const priceWithGst = basePrice + gstAmount;
    const savings = p.price > priceWithGst ? Math.round(((p.price - priceWithGst) / p.price) * 100) : 0;
    const isAvailable = p.inStock !== false;
    const inCartItem = cart.find(i => String(i.id) === String(p.id));
    const cartQty = inCartItem ? (inCartItem.quantity || inCartItem.qty || 0) : 0;

    return `
      <div class="product-card ${!isAvailable ? 'out-of-stock-card' : ''}">
        <a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" class="product-image-wrap">
          <img src="${p.photoLink}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='images/cctv-wholesale.webp'">
          <span class="brand-badge">${escapeHtml(p.brand || 'AK Infotech')}</span>
          ${p.isCombo ? `<span class="combo-badge">🔥 COMBO</span>` : ''}
          ${!isAvailable ? `<span style="position: absolute; bottom: 8px; left: 8px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px;">OUT OF STOCK</span>` : ''}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" title="${escapeHtml(p.productName)}">${escapeHtml(p.productName)}</a></h3>

          <div class="price-row">
            <span class="selling-price">₹${priceWithGst.toLocaleString('en-IN')}</span>
            ${p.price > priceWithGst ? `<span class="mrp-price">₹${p.price.toLocaleString('en-IN')}</span>` : ''}
            ${savings > 0 ? `<span class="discount-tag">${savings}% OFF</span>` : ''}
          </div>

          <div class="card-actions">
            ${!isAvailable ? `
              <button class="btn-add-cart" disabled style="background:#cbd5e1; cursor:not-allowed; opacity:0.8;">
                🚫 Out of Stock
              </button>
            ` : (cartQty > 0 ? `
              <div class="card-cart-qty-wrap">
                <div class="card-qty-stepper">
                  <button class="qty-btn-sm" onclick="event.stopPropagation(); updateCartQty('${p.id}', -1)">-</button>
                  <span class="card-qty-count">${cartQty}</span>
                  <button class="qty-btn-sm" onclick="event.stopPropagation(); updateCartQty('${p.id}', 1)">+</button>
                </div>
                <button class="btn-view-cart" onclick="event.stopPropagation(); openCartDrawer()">
                  🛒 View Cart
                </button>
              </div>
            ` : `
              <button class="btn-add-cart" onclick="addToCart('${p.id}')">
                🛒 Add to Cart
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  renderPaginationControls(paginationBar, totalPages);
}

function renderPaginationControls(container, totalPages) {
  if (!container) return;
  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.gap = '8px';

  let html = `
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
      ← Prev
    </button>
  `;

  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="changePage(1)" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">1</button>`;
    if (startPage > 2) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    html += `
      <button class="pagination-btn" onclick="changePage(${i})" style="padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-color)'}; background: ${isActive ? 'var(--accent-cyan)' : '#ffffff'}; color: ${isActive ? '#ffffff' : 'var(--text-dark)'}; font-weight: 700; cursor: pointer;">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
    html += `<button class="pagination-btn" onclick="changePage(${totalPages})" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">${totalPages}</button>`;
  }

  html += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

window.resetFilters = function () {
  activeBrand = '';
  activeCategory = '';
  isComboOnly = false;
  searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const comboBtn = document.getElementById('comboToggleBtn');
  if (comboBtn) comboBtn.classList.remove('active');
  selectBrand('');
  selectCategory('');
};

// CART MANAGEMENT (PERMANENT BULLETPROOF FIX)
window.addToCart = async function (productId) {
  let prod = allProducts.find(p => String(p.id) === String(productId));

  if (!prod) {
    try {
      prod = await DbService.getProductById(productId);
    } catch (e) {
      console.warn("Async product fetch fallback:", e);
    }
  }

  if (!prod) {
    alert("Product details could not be loaded. Please refresh the page.");
    return;
  }

  if (prod.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }

  const existingIndex = cart.findIndex(item => String(item.id) === String(productId));
  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity || cart[existingIndex].qty || 1;
    cart[existingIndex].quantity = currentQty + 1;
    cart[existingIndex].qty = currentQty + 1;
  } else {
    cart.push({ ...prod, quantity: 1, qty: 1 });
  }

  saveCart();
  renderCart();
  if (typeof renderCatalog === 'function') renderCatalog();
  openCartDrawer();
};

window.updateCartQty = function (productId, change) {
  const index = cart.findIndex(item => String(item.id) === String(productId));
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
  saveCart();
  renderCart();
  if (typeof renderCatalog === 'function') renderCatalog();
};

function saveCart() {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
}

function renderCart() {
  const cartCountEl = document.getElementById('cartCount');
  const drawerCountEl = document.getElementById('cartItemCount');
  const totalQty = cart.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);

  if (cartCountEl) cartCountEl.textContent = totalQty;
  if (drawerCountEl) drawerCountEl.textContent = totalQty;

  const itemsListEl = document.getElementById('cartItemsBody') || document.getElementById('cartItemsList');
  if (!itemsListEl) return;

  if (!cart.length) {
    itemsListEl.innerHTML = `
      <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 10px;">🛒</div>
        Your cart is empty.<br>Browse items & add to cart.
      </div>`;
  } else {
    itemsListEl.innerHTML = cart.map(item => {
      const q = item.quantity || item.qty || 1;
      const itemPriceWithGst = getItemPriceWithGst(item, storeSettings);
      return `
        <div class="cart-item">
          <img src="${item.photoLink}" alt="${escapeHtml(item.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
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
    return sum + (getItemPriceWithGst(item, storeSettings) * q);
  }, 0);

  const isPayOnDelivery = storeSettings.payShippingOnDelivery === true;
  const enableFreeShipping = storeSettings.enableFreeShipping !== false;
  const freeMin = storeSettings.freeShippingMinOrder || 3000;

  // Category-wise & Product-specific custom delivery charge calculation
  let deliveryFee = isPayOnDelivery ? 0 : calculateCartDeliveryFee(cart, storeSettings, storeCategories);

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

  const gstEl = document.getElementById('cartGstAmount');
  if (gstEl) gstEl.style.display = 'none';

  const deliveryEl = document.getElementById('cartDelivery') || document.getElementById('cartDeliveryFee');
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

  const grandTotalEl = document.getElementById('cartGrandTotal') || document.getElementById('cartFinalTotal');
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
    } else {
      // Clear visual state if no coupon is active
      if (!inputEl.value) {
        msgEl.style.display = 'none';
      }
    }
  }

  renderPromoChips();
}

function getItemPriceWithGst(item, settings = storeSettings) {
  const basePrice = Number(item.sellingPrice || 0);
  const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  return basePrice + gstAmount;
}

function calculateCartGstAmount(cartItems, settings) {
  if (!cartItems || !cartItems.length) return 0;
  const defaultGst = settings.defaultGstPercent !== undefined ? settings.defaultGstPercent : 18;

  let totalGst = 0;
  cartItems.forEach(item => {
    const q = item.quantity || item.qty || 1;
    const itemSellingPrice = item.sellingPrice || 0;
    const itemGstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '')
      ? Number(item.gstPercent)
      : defaultGst;

    const itemGst = Math.round(((itemSellingPrice * q) * itemGstRate) / 100);
    totalGst += itemGst;
  });

  return totalGst;
}

function renderPromoChips() {
  const container = document.querySelector('.coupon-quick-chips');
  if (!container) return;

  const activeCoupons = (storeSettings.discountCoupons || []).filter(c => c.showInCart === true);
  if (!activeCoupons.length) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    container.innerHTML = `<span class="chip-label">Promo Codes:</span>` + activeCoupons.map(c => `
      <button type="button" class="coupon-chip" onclick="autoApplyCoupon('${escapeHtml(c.code)}')">
        🎟️ ${escapeHtml(c.code)}
      </button>
    `).join('');
  }
}

window.applyCartCoupon = function(code) {
  const inputEl = document.getElementById('cartCouponInput');
  const msgEl = document.getElementById('cartPromoMsg');
  if (!code) code = inputEl ? inputEl.value.trim().toUpperCase() : '';
  
  if (!code) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.innerHTML = 'Please enter a coupon code!';
    }
    return;
  }
  const found = storeSettings.discountCoupons?.find(c => c.code === code);
  if (found) {
    appliedCoupon = found;
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--accent-green)';
      msgEl.innerHTML = `Coupon <b>${code}</b> applied! <button type="button" onclick="removeCartCoupon()" style="background:none; border:none; color:#ef4444; font-weight:800; cursor:pointer; font-size:0.75rem; margin-left:8px; padding:2px 6px; background:#fee2e2; border-radius:4px;">✕ Remove</button>`;
    }
    if (inputEl) inputEl.value = code;
  } else {
    appliedCoupon = null;
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.innerHTML = 'Invalid coupon code!';
    }
  }
  renderCart();
};

window.removeCartCoupon = function() {
  appliedCoupon = null;
  const inputEl = document.getElementById('cartCouponInput');
  const msgEl = document.getElementById('cartPromoMsg');
  if (inputEl) inputEl.value = '';
  if (msgEl) msgEl.style.display = 'none';
  renderCart();
};

window.autoApplyCoupon = function(code) {
  window.applyCartCoupon(code);
};

function calculateCartDeliveryFee(cartItems, settings, categories = []) {
  if (!cartItems || !cartItems.length) return 0;
  if (settings && settings.payShippingOnDelivery) return 0;

  const subtotal = cartItems.reduce((sum, item) => sum + (item.sellingPrice * (item.quantity || item.qty || 1)), 0);
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

// Fix: Checkout autoApplyCoupon renamed to avoid conflict
window.autoApplyCheckoutCoupon = function (code) {
  const input = document.getElementById('couponCodeInput');
  if (input) {
    input.value = code;
    const applyBtn = document.getElementById('applyCouponBtn');
    if (applyBtn) applyBtn.click();
  }
};

// CHECKOUT & PAYMENT SELECTION
window.selectPaymentMethod = function (method) {
  selectedPaymentMethod = method;
  const optOnline = document.getElementById('optOnline');
  const optCOD = document.getElementById('optCOD');
  const codBanner = document.getElementById('codAdvanceBanner');

  if (method === 'ONLINE') {
    optOnline.className = 'payment-option-card selected';
    optCOD.className = 'payment-option-card';
    codBanner.style.display = 'none';
  } else {
    optOnline.className = 'payment-option-card';
    optCOD.className = 'payment-option-card selected cod-selected';
    codBanner.style.display = 'block';

    const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * (item.quantity || item.qty || 1)), 0);
    let deliveryFee = calculateCartDeliveryFee(cart, storeSettings, storeCategories);
    let gstAmount = calculateCartGstAmount(cart, storeSettings);
    const finalTotal = subtotal + gstAmount + deliveryFee;
    const advanceFee = storeSettings.codAdvanceAmount || 1000;
    const remaining = Math.max(0, finalTotal - advanceFee);

    document.getElementById('codBalanceText').textContent = `₹${remaining.toLocaleString('en-IN')}`;
  }
};

// CHECKOUT SUBMIT
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (!cart.length) {
    alert('Your cart is empty!');
    return;
  }

  const custName = document.getElementById('custName').value.trim();
  const custPhone = document.getElementById('custPhone').value.trim();
  const custEmail = document.getElementById('custEmail').value.trim();
  const custAddress = document.getElementById('custAddress').value.trim();
  const custPincode = document.getElementById('custPincode').value.trim();
  const custCityState = document.getElementById('custCityState').value.trim();
  const shouldSaveAddress = (document.getElementById('saveAddressToAccount') || document.getElementById('chkSaveAddress'))?.checked ?? false;

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * (item.quantity || item.qty || 1)), 0);
  let deliveryFee = calculateCartDeliveryFee(cart, storeSettings, storeCategories);
  let gstAmount = calculateCartGstAmount(cart, storeSettings);

  let discountAmount = 0;
  if (appliedCoupon && subtotal >= (appliedCoupon.minOrderAmount || 0)) {
    if (appliedCoupon.discountPercent) {
      discountAmount = Math.round((subtotal * appliedCoupon.discountPercent) / 100);
    } else if (appliedCoupon.discountFlat) {
      discountAmount = appliedCoupon.discountFlat;
    } else if (appliedCoupon.freeDelivery || appliedCoupon.type === 'FREE_DELIVERY') {
      deliveryFee = 0;
    }
  }

  const finalTotal = Math.max(0, subtotal + gstAmount + deliveryFee - discountAmount);
  const codAdvanceFee = storeSettings.codAdvanceAmount || 1000;
  const amountToPayNow = selectedPaymentMethod === 'COD' ? Math.min(finalTotal, codAdvanceFee) : finalTotal;

  // Save address to user account if requested
  if (currentUser && shouldSaveAddress) {
    try {
      await DbService.addUserAddress(currentUser.uid, {
        fullName: custName,
        phone: custPhone,
        street: custAddress,
        pincode: custPincode,
        cityState: custCityState
      });
    } catch (err) {
      console.warn("Address save warning:", err);
    }
  }

  const submitBtn = document.getElementById('payOrderSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing Payment...';

  try {
    const rzpKeyId = storeSettings.razorpay?.keyId || 'rzp_test_sampleKey123';
    const isTestMode = rzpKeyId.includes('sampleKey') || rzpKeyId.includes('test');

    const options = {
      key: rzpKeyId,
      amount: Math.round(amountToPayNow * 100),
      currency: 'INR',
      name: 'AK INFOTECH',
      description: selectedPaymentMethod === 'COD'
        ? `₹${codAdvanceFee} Mandatory COD Advance Payment`
        : 'Full Order Payment',
      handler: async function (response) {
        const remainingBalance = selectedPaymentMethod === 'COD' ? Math.max(0, finalTotal - codAdvanceFee) : 0;

        const orderPayload = {
          customerName: custName,
          phone: custPhone,
          email: custEmail || (currentUser ? currentUser.email : ''),
          userUid: currentUser ? currentUser.uid : null,
          address: custAddress,
          pincode: custPincode,
          city: custCityState.split(',')[0]?.trim() || 'Chennai',
          state: custCityState.split(',')[1]?.trim() || 'Tamil Nadu',
          items: cart,
          paymentMethod: selectedPaymentMethod,
          paymentStatus: selectedPaymentMethod === 'COD' ? `ADVANCE_PAID_₹${codAdvanceFee}` : 'PAID_ONLINE',
          paymentId: response.razorpay_payment_id || `pay_sim_${Date.now()}`,
          razorpayOrderId: response.razorpay_order_id || '',
          subtotal,
          deliveryFee,
          discountAmount,
          finalTotal,
          advancePaid: selectedPaymentMethod === 'COD' ? codAdvanceFee : finalTotal,
          balanceOnDelivery: remainingBalance,
          status: 'PROCESSING'
        };

        const savedOrder = await DbService.createOrder(orderPayload);
        try {
          fetch('/api/send-order-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...savedOrder,
              settings: storeSettings
            })
          }).catch(e => console.warn("Email notify failed:", e));
        } catch (e) {
          console.warn("Email notify trigger error:", e);
        }
        alert(`🎉 Order Placed Successfully!\nOrder ID: ${savedOrder.id}\n${selectedPaymentMethod === 'COD' ? `₹${codAdvanceFee} Advance Paid. Balance ₹${remainingBalance} payable on delivery.` : 'Full Amount Paid Online.'}`);

        cart = [];
        saveCart();
        renderCart();
        closeCheckoutModal();
      },
      prefill: {
        name: custName,
        email: custEmail || (currentUser ? currentUser.email : ''),
        contact: custPhone
      },
      theme: { color: '#06b6d4' }
    };

    if (isTestMode) {
      if (confirm(`[TEST SIMULATION MODE]\nClick OK to simulate successful Razorpay Payment of ₹${amountToPayNow} (${selectedPaymentMethod === 'COD' ? '₹1,000 COD Advance' : 'Full Online Payment'}).`)) {
        options.handler({ razorpay_payment_id: `pay_sim_${Date.now()}` });
      }
    } else {
      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    }
  } catch (err) {
    alert(`Checkout Error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pay & Place Order →';
  }
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');

  if (searchInput && searchDropdown) {
    let searchDebounce;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounce);

      if (!q) {
        closeSearchDropdown();
        // Reset catalog filter when cleared
        searchQuery = '';
        renderCatalog();
        return;
      }

      searchDebounce = setTimeout(() => {
        renderSearchDropdown(q);
      }, 180);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // On Enter: apply filter to main catalog and close dropdown
        searchQuery = searchInput.value;
        renderCatalog();
        closeSearchDropdown();
        // Scroll to products
        const catalogSection = document.getElementById('catalogSection') || document.getElementById('productsGrid');
        if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'Escape') {
        closeSearchDropdown();
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchBoxWrapper')) {
        closeSearchDropdown();
      }
    });

    // Re-open dropdown on focus if there's content
    searchInput.addEventListener('focus', (e) => {
      const q = e.target.value.trim();
      if (q.length > 0) renderSearchDropdown(q);
    });
  }

  const comboBtn = document.getElementById('comboToggleBtn');
  if (comboBtn) comboBtn.addEventListener('click', filterByComboOnly);

  const openCartBtn = document.getElementById('openCartBtn');
  if (openCartBtn) openCartBtn.addEventListener('click', openCartDrawer);

  const closeCartBtn = document.getElementById('closeCartBtn');
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);

  const cartBackdrop = document.getElementById('cartBackdrop');
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);

  const proceedBtn = document.getElementById('proceedCheckoutBtn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (!cart.length) {
        alert('Your cart is empty!');
        return;
      }
      closeCartDrawer();
      if (!currentUser) {
        window.openAuthChoiceModal();
      } else {
        openCheckoutModal();
      }
    });
  }

  const applyCartCouponBtn = document.getElementById('applyCartCouponBtn');
  if (applyCartCouponBtn) {
    applyCartCouponBtn.addEventListener('click', () => {
      window.applyCartCoupon();
    });
  }

  const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
  if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckoutModal);

  const checkoutBackdrop = document.getElementById('checkoutBackdrop');
  if (checkoutBackdrop) {
    checkoutBackdrop.addEventListener('click', (e) => {
      if (e.target.id === 'checkoutBackdrop') window.closeCheckoutModal();
    });
  }

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  const applyCouponBtn = document.getElementById('applyCouponBtn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', () => {
      const code = document.getElementById('couponInput').value.trim().toUpperCase();
      const found = storeSettings.discountCoupons?.find(c => c.code === code);
      if (found) {
        appliedCoupon = found;
        alert(`Coupon ${code} applied successfully!`);
      } else {
        alert('Invalid coupon code!');
        appliedCoupon = null;
      }
      renderCart();
    });
  }
}

window.openCartDrawer = function () {
  document.getElementById('cartDrawer').classList.add('active');
  document.getElementById('cartBackdrop').classList.add('active');
};

window.closeCartDrawer = function () {
  document.getElementById('cartDrawer').classList.remove('active');
  document.getElementById('cartBackdrop').classList.remove('active');
};

window.openAuthChoiceModal = function () {
  const modal = document.getElementById('authChoiceBackdrop');
  if (modal) {
    modal.classList.add('open');
    modal.classList.add('active');
  }
};

window.closeAuthChoiceModal = function () {
  const modal = document.getElementById('authChoiceBackdrop');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('active');
  }
};

window.checkoutWithGoogle = async function () {
  try {
    closeAuthChoiceModal();
    await DbService.loginWithGoogle();
    setTimeout(() => {
      openCheckoutModal();
    }, 1200);
  } catch (err) {
    alert("Sign In Error: " + (err.message || err));
  }
};

window.checkoutAsGuest = function () {
  closeAuthChoiceModal();
  openCheckoutModal();
};

async function openCheckoutModal() {
  closeCartDrawer();
  document.getElementById('checkoutBackdrop').classList.add('active');
  selectPaymentMethod('ONLINE');

  const savedGroup = document.getElementById('savedAddressGroup');
  const savedSelect = document.getElementById('savedAddressSelect');

  if (currentUser) {
    const custEmail = document.getElementById('custEmail');
    const custName = document.getElementById('custName');
    if (custEmail && currentUser.email) custEmail.value = currentUser.email;
    if (custName && currentUser.displayName) custName.value = currentUser.displayName;

    userAddresses = await DbService.getUserAddresses(currentUser.uid);

    if (userAddresses && userAddresses.length) {
      savedGroup.style.display = 'block';
      savedSelect.innerHTML = `<option value="">-- Choose a saved delivery address --</option>` +
        userAddresses.map((a, idx) => `<option value="${a.id}">${escapeHtml(a.fullName)} - ${escapeHtml(a.street)}, ${escapeHtml(a.pincode)}</option>`).join('');

      savedSelect.onchange = function () {
        const selectedId = this.value;
        const found = userAddresses.find(a => a.id === selectedId);
        if (found) {
          document.getElementById('custName').value = found.fullName;
          document.getElementById('custPhone').value = found.phone;
          document.getElementById('custAddress').value = found.street;
          document.getElementById('custPincode').value = found.pincode;
          document.getElementById('custCityState').value = found.cityState;
        }
      };

      // Pre-fill default address
      if (userAddresses[0]) {
        savedSelect.value = userAddresses[0].id;
        savedSelect.dispatchEvent(new Event('change'));
      }
    } else {
      savedGroup.style.display = 'none';
    }
  } else {
    savedGroup.style.display = 'none';
  }
}

window.closeCheckoutModal = function () {
  document.getElementById('checkoutBackdrop')?.classList.remove('active');
};

// HERO AUTO-SCROLL SLIDER
async function loadHeroBanners() {
  heroBanners = await DbService.getHeroBanners();
  renderHeroSlider();
  startHeroAutoScroll();
}

function renderHeroSlider() {
  const headerSection = document.getElementById('heroHeaderSection');
  const wrap = document.getElementById('heroSliderWrap');
  const dotsEl = document.getElementById('heroSliderDots');

  if (!wrap) return;

  if (!heroBanners || !heroBanners.length) {
    if (headerSection) headerSection.style.display = 'none';
    wrap.innerHTML = '';
    if (dotsEl) dotsEl.innerHTML = '';
    return;
  }

  if (headerSection) headerSection.style.display = 'block';

  wrap.innerHTML = heroBanners.map((b, idx) => {
    const hasText = b.tag || b.title || b.subtitle || b.btnText;
    return `
      <div class="hero-slide ${idx === currentHeroIndex ? 'active' : ''}">
        <img class="hero-slide-img" src="${b.imageUrl}" alt="Hero Banner">
        <div class="hero-slide-overlay ${hasText ? '' : 'no-text'}">
          <div class="hero-content">
            ${b.tag ? `<span class="hero-tag">${escapeHtml(b.tag)}</span>` : ''}
            ${b.title ? `<h1 class="hero-title">${escapeHtml(b.title)}</h1>` : ''}
            ${b.subtitle ? `<p class="hero-subtitle">${escapeHtml(b.subtitle)}</p>` : ''}
            ${b.btnText ? `<a href="${b.btnLink || 'javascript:void(0)'}" class="hero-btn">${escapeHtml(b.btnText)}</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (dotsEl) {
    dotsEl.innerHTML = heroBanners.map((_, idx) => `
      <div class="hero-dot ${idx === currentHeroIndex ? 'active' : ''}" onclick="goToHeroSlide(${idx})"></div>
    `).join('');
  }
}

window.goToHeroSlide = function (index) {
  currentHeroIndex = index;
  renderHeroSlider();
  resetHeroAutoScroll();
};

function nextHeroSlide() {
  if (!heroBanners.length) return;
  currentHeroIndex = (currentHeroIndex + 1) % heroBanners.length;
  renderHeroSlider();
}

function startHeroAutoScroll() {
  if (heroAutoScrollTimer) clearInterval(heroAutoScrollTimer);
  heroAutoScrollTimer = setInterval(nextHeroSlide, 4000);
}

function resetHeroAutoScroll() {
  startHeroAutoScroll();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// ── LIVE SEARCH AUTOCOMPLETE ──────────────────────────────────────────────────
function renderSearchDropdown(q) {
  const dropdown = document.getElementById('searchDropdown');
  const searchInput = document.getElementById('searchInput');
  if (!dropdown || !searchInput) return;

  const tokens = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

  // Filter products
  const matched = allProducts.filter(p => {
    const text = `${p.productName || ''} ${p.brand || ''} ${p.category || ''} ${p.productSpec || ''}`.toLowerCase();
    return tokens.every(t => text.includes(t));
  });

  if (matched.length === 0) {
    dropdown.innerHTML = `<div class="search-dropdown-empty">No products found for "<strong>${escapeHtml(q)}</strong>"</div>`;
    dropdown.style.display = 'block';
    return;
  }

  const top6 = matched.slice(0, 6);
  const total = matched.length;

  const itemsHtml = [
    `<div class="search-dropdown-header">Products</div>`,
    ...top6.map(p => {
      const inStock = p.inStock !== false;
      const priceWithGst = getItemPriceWithGst(p, storeSettings);
      return `<a class="search-dropdown-item" href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html">
        <img src="${escapeHtml(p.photoLink || 'images/logo.webp')}" alt="${escapeHtml(p.productName)}" onerror="this.src='images/logo.webp'">
        <div class="sdi-info">
          <div class="sdi-name">${escapeHtml(p.productName || '')}</div>
          <div class="sdi-brand">${escapeHtml(p.brand || '')}</div>
          <div class="sdi-stock ${inStock ? 'in-stock' : 'out-stock'}">● ${inStock ? 'Available' : 'Out of Stock'}</div>
        </div>
        <div class="sdi-price">
          <span class="sdi-price-main">₹${priceWithGst.toLocaleString('en-IN')}</span>
          <span class="sdi-price-sub">Incl. GST</span>
        </div>
      </a>`;
    }),
    total > 6 ? `<div class="search-dropdown-footer" onclick="applySearchFromDropdown('${escapeHtml(q).replace(/'/g, "\\'")}')">See all ${total} results &nbsp;›</div>` : ''
  ].join('');

  dropdown.innerHTML = itemsHtml;
  dropdown.style.display = 'block';
}

function closeSearchDropdown() {
  const dropdown = document.getElementById('searchDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

window.applySearchFromDropdown = function (q) {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = q;
  searchQuery = q;
  renderCatalog();
  closeSearchDropdown();
  const catalogSection = document.getElementById('catalogSection') || document.getElementById('productsGrid');
  if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ---------------------------------------------------------
// HOMEPAGE FEATURED PRODUCTS SECTION WITH FILTERS
// ---------------------------------------------------------
window.renderFeaturedProducts = function () {
  const grid = document.getElementById('featuredGrid');
  const section = document.getElementById('featuredSection');
  if (!grid || !section) return;

  // Filter products by isFeatured flag
  let featuredList = (allProducts || []).filter(p => p.isFeatured === true);

  if (!featuredList.length) {
    section.style.display = 'none';
    return;
  }

  // Show the featured section container
  section.style.display = 'block';

  grid.innerHTML = featuredList.map(p => {
    const basePrice = p.sellingPrice || 0;
    const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : (storeSettings.defaultGstPercent !== undefined ? storeSettings.defaultGstPercent : 18);
    const gstAmount = Math.round((basePrice * gstRate) / 100);
    const priceWithGst = basePrice + gstAmount;
    const savings = p.price > priceWithGst ? Math.round(((p.price - priceWithGst) / p.price) * 100) : 0;
    const isAvailable = p.inStock !== false;
    const inCartItem = cart.find(i => String(i.id) === String(p.id));
    const cartQty = inCartItem ? (inCartItem.quantity || inCartItem.qty || 0) : 0;

    return `
      <div class="product-card ${!isAvailable ? 'out-of-stock-card' : ''}">
        <a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" class="product-image-wrap">
          <img src="${p.photoLink}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='images/cctv-wholesale.webp'">
          <span class="brand-badge">${escapeHtml(p.brand || 'AK Infotech')}</span>
          ${p.isCombo ? `<span class="combo-badge">🔥 COMBO</span>` : ''}
          ${!isAvailable ? `<span style="position: absolute; bottom: 8px; left: 8px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px;">OUT OF STOCK</span>` : ''}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" title="${escapeHtml(p.productName)}">${escapeHtml(p.productName)}</a></h3>

          <div class="price-row">
            <span class="selling-price">₹${priceWithGst.toLocaleString('en-IN')}</span>
            ${p.price > priceWithGst ? `<span class="mrp-price">₹${p.price.toLocaleString('en-IN')}</span>` : ''}
            ${savings > 0 ? `<span class="discount-tag">${savings}% OFF</span>` : ''}
          </div>

          <div class="card-actions">
            ${!isAvailable ? `
              <button class="btn-add-cart" disabled style="background:#cbd5e1; cursor:not-allowed; opacity:0.8;">
                🚫 Out of Stock
              </button>
            ` : (cartQty > 0 ? `
              <div class="card-cart-qty-wrap">
                <div class="card-qty-stepper">
                  <button class="qty-btn-sm" onclick="event.stopPropagation(); updateCartQty('${p.id}', -1)">-</button>
                  <span class="card-qty-count">${cartQty}</span>
                  <button class="qty-btn-sm" onclick="event.stopPropagation(); updateCartQty('${p.id}', 1)">+</button>
                </div>
                <button class="btn-view-cart" onclick="event.stopPropagation(); openCartDrawer()">
                  🛒 View Cart
                </button>
              </div>
            ` : `
              <button class="btn-add-cart" onclick="addToCart('${p.id}')">
                🛒 Add to Cart
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }).join('');
};
