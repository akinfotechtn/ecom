// AK INFOTECH - DYNAMIC BRAND PAGE HANDLER
import { DbService } from "./db-service.js";

let currentBrandName = '';
let brandInfo = null;
let brandProducts = [];
let filteredProducts = [];
let currentUser = null;
let userAddresses = [];
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
let appliedCoupon = null;
let selectedPaymentMethod = 'ONLINE';

let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
  renderCart(); // Render cart instantly from localStorage
  setupAuthState();

  try {
    const [settings, categories] = await Promise.all([
      DbService.getSettings(),
      DbService.getCategories()
    ]);
    window.storeSettings = settings || {};
    allCategories = categories || [];
  } catch (err) {
    console.warn("Failed to load settings asynchronously on brand page:", err);
  }

  parseBrandUrl();
  await loadBrandData();
  setupEventListeners();
  renderCart();
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

function parseBrandUrl() {
  if (window.staticBrandData) {
    brandInfo = window.staticBrandData;
    currentBrandName = brandInfo.name;
  } else {
    const params = new URLSearchParams(window.location.search);
    currentBrandName = params.get('name') || params.get('brand') || '';
    if (!currentBrandName) {
      currentBrandName = 'All Brands';
    }
  }
}

async function loadBrandData() {
  try {
    if (window.staticBrandData) {
      brandInfo = window.staticBrandData;
      currentBrandName = brandInfo.name;
    } else {
      const brands = await DbService.getBrands();
      brandInfo = brands.find(b => b.name?.toLowerCase() === currentBrandName.toLowerCase());
    }

    const allProds = await DbService.getProducts();

    if (currentBrandName.toLowerCase() === 'all brands' || !currentBrandName) {
      brandProducts = allProds;
    } else {
      brandProducts = allProds.filter(p => p.brand?.toLowerCase() === currentBrandName.toLowerCase());
    }

    filteredProducts = [...brandProducts];

    renderBrandHero();
    await renderBrandCategories();
    renderBrandCatalog();
  } catch (err) {
    console.error('Error loading brand page:', err);
  }
}

async function renderBrandCategories() {
  const section = document.getElementById('brandCategoriesSection');
  const grid = document.getElementById('brandCategoriesGrid');
  const titleName = document.getElementById('brandCategoriesTitleName');
  if (!section || !grid) return;

  const displayName = brandInfo?.name || currentBrandName || 'Brand';
  if (titleName) {
    titleName.textContent = displayName;
  }

  const availableCatNames = [...new Set(brandProducts.map(p => p.category).filter(Boolean))];

  if (!availableCatNames.length) {
    section.style.display = 'none';
    return;
  }

  if (!allCategories || !allCategories.length) {
    allCategories = await DbService.getCategories();
  }
  section.style.display = 'block';

  let html = `
    <button class="category-chip active" data-cat="all" onclick="filterBrandCategory('all', this)" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; border: 1.5px solid var(--accent-cyan); background: #f0f9ff; font-weight: 800; font-size: 0.85rem; color: var(--accent-cyan); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
      <span>🏷️ All Categories (${brandProducts.length})</span>
    </button>
  `;

  availableCatNames.forEach(catName => {
    const catObj = allCategories.find(c => c.name?.toLowerCase() === catName.toLowerCase());
    let imgUrl = catObj?.imageLink || 'images/cctv-wholesale.webp';
    if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
      imgUrl = DbService.getLinkPrefix() + imgUrl;
    }
    const count = brandProducts.filter(p => p.category?.toLowerCase() === catName.toLowerCase()).length;

    html += `
      <button class="category-chip" data-cat="${escapeHtml(catName)}" onclick="filterBrandCategory('${escapeHtml(catName)}', this)" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; border: 1px solid #cbd5e1; background: #ffffff; font-weight: 700; font-size: 0.85rem; color: var(--text-dark); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
        <img src="${imgUrl}" alt="${escapeHtml(catName)}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 50%; background: #f8fafc; padding: 2px;" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
        <span>${escapeHtml(catName)} (${count})</span>
      </button>
    `;
  });

  grid.innerHTML = html;
}

window.filterBrandCategory = function (catName, btn) {
  const chips = document.querySelectorAll('#brandCategoriesGrid .category-chip');
  chips.forEach(c => {
    c.style.borderColor = '#cbd5e1';
    c.style.background = '#ffffff';
    c.style.color = 'var(--text-dark)';
  });

  if (btn) {
    btn.style.borderColor = 'var(--accent-cyan)';
    btn.style.background = '#f0f9ff';
    btn.style.color = 'var(--accent-cyan)';
  }

  if (catName === 'all') {
    filteredProducts = [...brandProducts];
  } else {
    filteredProducts = brandProducts.filter(p => p.category?.toLowerCase() === catName.toLowerCase());
  }

  renderBrandCatalog();
};

function renderBrandHero() {
  const titleEl = document.getElementById('brandPageTitle');
  const breadcrumbEl = document.getElementById('breadcrumbBrandName');
  const heroLogo = document.getElementById('brandHeroLogo');
  const heroName = document.getElementById('brandHeroName');
  const heroSub = document.getElementById('brandHeroSub');
  const badgeEl = document.getElementById('brandItemCountBadge');
  const catalogTitle = document.getElementById('brandCatalogTitle');

  const displayName = brandInfo?.name || currentBrandName || 'Brand Store';

  if (titleEl) titleEl.textContent = `${displayName} Products | AK Infotech Security Store`;
  if (breadcrumbEl) breadcrumbEl.textContent = displayName;
  if (heroName) heroName.textContent = displayName;
  if (catalogTitle) catalogTitle.textContent = `${displayName} Products`;

  if (heroLogo) {
    let logoUrl = brandInfo?.imageLink || 'images/logo.webp';
    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
      logoUrl = DbService.getLinkPrefix() + logoUrl;
    }
    heroLogo.src = logoUrl;
    heroLogo.alt = displayName;
  }

  if (heroSub) {
    heroSub.textContent = `Authorized Wholesale & Retail ${displayName} Distributor`;
  }

  if (badgeEl) {
    badgeEl.textContent = `📦 ${brandProducts.length} Products Available`;
  }
}

const ITEMS_PER_PAGE = 12;
let currentPage = 1;

window.changeBrandPage = function (newPage) {
  currentPage = newPage;
  renderBrandCatalog();
  const mainSec = document.querySelector('.catalog-section');
  if (mainSec) mainSec.scrollIntoView({ behavior: 'smooth' });
};

function renderBrandCatalog() {
  const grid = document.getElementById('brandProductGrid');
  const paginationBar = document.getElementById('brandPaginationBar');
  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3>No products found for ${escapeHtml(currentBrandName)}</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">Try searching for other items or browse all brands.</p>
        <a href="index.html" class="hero-btn" style="margin-top: 14px; padding: 8px 20px; display: inline-block; text-decoration: none;">← View All Brands</a>
      </div>`;
    if (paginationBar) paginationBar.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  grid.innerHTML = pageProducts.map(p => {
    const isAvailable = p.inStock !== false;
    const basePrice = p.sellingPrice || 0;
    const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : 18;
    const gstAmount = Math.round((basePrice * gstRate) / 100);
    const priceWithGst = basePrice + gstAmount;

    const inCartItem = cart.find(i => String(i.id) === String(p.id));
    const cartQty = inCartItem ? (inCartItem.quantity || inCartItem.qty || 0) : 0;

    return `
      <div class="product-card ${!isAvailable ? 'out-of-stock-card' : ''}">
        <a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html" class="product-image-wrap">
          <img src="${p.photoLink && (p.photoLink.startsWith('http') || p.photoLink.startsWith('data:')) ? p.photoLink : (DbService.getLinkPrefix() + (p.photoLink || 'images/cctv-wholesale.webp'))}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='${DbService.getLinkPrefix()}images/cctv-wholesale.webp'">
          <span class="brand-badge">${escapeHtml(p.brand || 'AK Infotech')}</span>
          ${p.isCombo ? `<span class="combo-badge">🔥 COMBO</span>` : ''}
          ${!isAvailable ? `<span style="position: absolute; bottom: 8px; left: 8px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px;">OUT OF STOCK</span>` : ''}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html">${escapeHtml(p.productName)}</a></h3>

          <div class="price-row">
            <span class="selling-price">₹${priceWithGst.toLocaleString('en-IN')}</span>
            ${p.price > priceWithGst ? `<span class="mrp-price">₹${p.price?.toLocaleString('en-IN')}</span>` : ''}
          </div>

          <div class="card-actions">
            ${!isAvailable ? `
              <button class="btn-add-cart" disabled style="background: #94a3b8; cursor: not-allowed;">Out of Stock</button>
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
              <button class="btn-add-cart" onclick="addToCart('${p.id}')">🛒 Add to Cart</button>
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
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeBrandPage(${currentPage - 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
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
    html += `<button class="pagination-btn" onclick="changeBrandPage(1)" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">1</button>`;
    if (startPage > 2) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    html += `
      <button class="pagination-btn" onclick="changeBrandPage(${i})" style="padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-color)'}; background: ${isActive ? 'var(--accent-cyan)' : '#ffffff'}; color: ${isActive ? '#ffffff' : 'var(--text-dark)'}; font-weight: 700; cursor: pointer;">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
    html += `<button class="pagination-btn" onclick="changeBrandPage(${totalPages})" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">${totalPages}</button>`;
  }

  html += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeBrandPage(${currentPage + 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

window.addToCart = async function (productId) {
  let product = brandProducts.find(p => String(p.id) === String(productId));

  if (!product) {
    try {
      product = await DbService.getProductById(productId);
    } catch (e) {
      console.warn("Async product fetch fallback:", e);
    }
  }

  if (!product) {
    alert("Product details could not be loaded. Please refresh the page.");
    return;
  }

  if (product.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }

  const existingIndex = cart.findIndex(item => String(item.id) === String(productId));
  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity || cart[existingIndex].qty || 1;
    cart[existingIndex].quantity = currentQty + 1;
    cart[existingIndex].qty = currentQty + 1;
  } else {
    cart.push({ ...product, quantity: 1, qty: 1 });
  }

  saveCart();
  renderCart();
  if (typeof renderBrandCatalog === 'function') renderBrandCatalog();
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
  if (typeof renderBrandCatalog === 'function') renderBrandCatalog();
};
window.updateQty = window.updateCartQty;

function saveCart() {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
}

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

function getItemPriceWithGst(item, settings = window.storeSettings || {}) {
  const basePrice = Number(item.sellingPrice || 0);
  const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  return basePrice + gstAmount;
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
  const categories = allCategories || [];

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

window.updateQty = function (id, delta) {
  const item = cart.find(i => String(i.id) === String(id));
  if (!item) return;

  const currentQty = item.quantity || item.qty || 1;
  const newQty = currentQty + delta;
  if (newQty <= 0) {
    cart = cart.filter(i => String(i.id) !== String(id));
  } else {
    item.quantity = newQty;
    item.qty = newQty;
  }
  saveCart();
  renderCart();
  if (typeof renderBrandCatalog === 'function') renderBrandCatalog();
};

window.removeFromCart = function (id) {
  cart = cart.filter(i => String(i.id) !== String(id));
  saveCart();
  renderCart();
};

window.openCartDrawer = function () {
  window.location.href = DbService.getLinkPrefix() + 'cart.html';
};

window.closeCartDrawer = function () {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.remove('open'); drawer.classList.remove('active'); }
  if (backdrop) { backdrop.classList.remove('open'); backdrop.classList.remove('active'); }
};

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

  const searchInput = document.getElementById('brandSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        filteredProducts = [...brandProducts];
      } else {
        const tokens = q.split(/\s+/);
        filteredProducts = brandProducts.filter(p => {
          const text = `${p.productName} ${p.productSpec} ${p.category} ${p.price}`.toLowerCase();
          return tokens.every(t => text.includes(t));
        });
      }
      renderBrandCatalog();
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
