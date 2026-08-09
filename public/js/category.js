import { DbService } from './db-service.js';

let currentCategoryName = '';
let categoryProducts = [];
let filteredProducts = [];
let allCategories = [];
let allBrands = [];
let storeSettings = {};
let appliedCoupon = null;
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

const ITEMS_PER_PAGE = 12;
let currentPage = 1;

function normalizeStr(str) {
  let s = (str || '').toLowerCase().trim();
  s = s.replace(/wifi/g, 'wireless').replace(/wi-fi/g, 'wireless');
  return s.replace(/[^a-z0-9]/g, '');
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.staticCategoryData) {
    currentCategoryName = window.staticCategoryData.name;
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    currentCategoryName = urlParams.get('name') || urlParams.get('cat') || urlParams.get('category') || '';
  }

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

  setupCartDrawer();
  renderCart();

  try {
    const [prods, categories, brands, settings] = await Promise.all([
      DbService.getProducts(),
      DbService.getCategories(),
      DbService.getBrands(),
      DbService.getSettings()
    ]);

    allCategories = categories || [];
    allBrands = brands || [];
    storeSettings = settings || {};

    if (currentCategoryName) {
      const targetLower = currentCategoryName.toLowerCase().trim();
      const targetNorm = normalizeStr(currentCategoryName);

      if (targetLower.includes('combo')) {
        categoryProducts = prods.filter(p => p.isCombo || (p.category || '').toLowerCase().includes('combo') || (p.productName || '').toLowerCase().includes('combo'));
      } else {
        categoryProducts = prods.filter(p => {
          if (!p.category) return false;
          const catLower = p.category.toLowerCase().trim();
          const catNorm = normalizeStr(p.category);

          // 1. Exact string match (case insensitive)
          if (catLower === targetLower) return true;

          // 2. Exact normalized match
          if (catNorm === targetNorm) return true;

          // 3. Product category contains target category (e.g. "PC UPS & Power" contains "PC UPS")
          if (catNorm.includes(targetNorm) && targetNorm.length >= 3) return true;

          return false;
        });
      }

      // 4. Fallback if no exact category match: check if product name or spec specifically mentions target category tokens
      if (!categoryProducts.length) {
        const rawTokens = targetLower.split(/[\s\/\-]+/).filter(t => t.length > 1);
        categoryProducts = prods.filter(p => {
          const text = `${p.category || ''} ${p.productName || ''} ${p.brand || ''}`.toLowerCase();
          return rawTokens.every(token => text.includes(token));
        });
      }
    } else {
      categoryProducts = [...prods];
    }

    filteredProducts = [...categoryProducts];

    renderCategoryHero();
    renderCategoryBrandsSection();
    renderCategoryCatalog();
    renderCart();

  } catch (err) {
    console.error('Error initializing Category page:', err);
    const grid = document.getElementById('categoryProductGrid');
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ef4444;">Failed to load category products. Please try refreshing.</div>`;
    }
  }

  const searchInput = document.getElementById('categorySearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        filteredProducts = [...categoryProducts];
      } else {
        filteredProducts = categoryProducts.filter(p => {
          return (p.productName || '').toLowerCase().includes(q) ||
            (p.brand || '').toLowerCase().includes(q) ||
            (p.productSpec || '').toLowerCase().includes(q);
        });
      }
      currentPage = 1;
      renderCategoryCatalog();
    });
  }
});

function renderCategoryHero() {
  const titleEl = document.getElementById('categoryPageTitle');
  const breadcrumbEl = document.getElementById('breadcrumbCategoryName');
  const heroLogo = document.getElementById('categoryHeroLogo');
  const heroName = document.getElementById('categoryHeroName');
  const heroSub = document.getElementById('categoryHeroSub');
  const badgeEl = document.getElementById('categoryItemCountBadge');
  const catalogTitle = document.getElementById('categoryCatalogTitle');

  const displayName = currentCategoryName || 'All Categories';

  if (titleEl) titleEl.textContent = `${displayName} | AK Infotech Security Store`;
  if (breadcrumbEl) breadcrumbEl.textContent = displayName;
  if (heroName) heroName.textContent = displayName;
  if (catalogTitle) catalogTitle.textContent = `${displayName} Catalog`;

  const matchCat = allCategories.find(c => c.name && c.name.toLowerCase() === displayName.toLowerCase());
  if (matchCat && matchCat.imageLink) {
    if (heroLogo) heroLogo.src = matchCat.imageLink;
  }

  if (heroSub) {
    heroSub.textContent = `Official Wholesale & Retail ${displayName} Equipment`;
  }

  if (badgeEl) {
    badgeEl.textContent = `📦 ${categoryProducts.length} Products Available`;
  }
}

function renderCategoryBrandsSection() {
  const section = document.getElementById('categoryBrandsSection');
  const titleName = document.getElementById('categoryBrandsTitleName');
  const grid = document.getElementById('categoryBrandsGrid');

  if (!section || !grid) return;

  section.style.display = 'block';
  if (titleName) titleName.textContent = currentCategoryName || 'Category';

  const brandCounts = {};
  categoryProducts.forEach(p => {
    const b = p.brand ? p.brand.trim() : 'AK Infotech';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  const categoryBrandsList = Object.keys(brandCounts).length ? Object.keys(brandCounts) : allBrands.map(b => b.name);

  let html = `
    <button class="brand-chip active" data-brand="all" onclick="filterCategoryBrand('all', this)" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; border: 1px solid var(--accent-cyan); background: #f0f9ff; font-weight: 700; font-size: 0.85rem; color: var(--accent-cyan); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
      <span>🏷️ All Brands (${categoryProducts.length})</span>
    </button>
  `;

  categoryBrandsList.forEach(bName => {
    const count = brandCounts[bName] || 0;
    const matchBrand = allBrands.find(b => b.name && b.name.toLowerCase().trim() === bName.toLowerCase().trim());
    const logoUrl = matchBrand?.imageLink || matchBrand?.logoLink || 'images/logo.webp';

    html += `
      <button class="brand-chip" data-brand="${escapeHtml(bName)}" onclick="filterCategoryBrand('${escapeHtml(bName)}', this)" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; border: 1px solid #cbd5e1; background: #ffffff; font-weight: 700; font-size: 0.85rem; color: var(--text-dark); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
        <img src="${logoUrl}" alt="${escapeHtml(bName)}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 50%; background: #ffffff; padding: 2px;" onerror="this.src='images/logo.webp'">
        <span>${escapeHtml(bName)} ${count ? `(${count})` : ''}</span>
      </button>
    `;
  });

  grid.innerHTML = html;
}

window.filterCategoryBrand = function (bName, btn) {
  const chips = document.querySelectorAll('#categoryBrandsGrid .brand-chip');
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

  if (bName === 'all') {
    filteredProducts = [...categoryProducts];
  } else {
    filteredProducts = categoryProducts.filter(p => (p.brand || 'AK Infotech').toLowerCase() === bName.toLowerCase());
  }

  currentPage = 1;
  renderCategoryCatalog();
};

function renderCategoryCatalog() {
  const grid = document.getElementById('categoryProductGrid');
  const paginationBar = document.getElementById('categoryPaginationBar');
  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3>No products found for ${escapeHtml(currentCategoryName || 'this category')}</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">Try searching for other security items or browse all categories.</p>
        <a href="index.html" class="hero-btn" style="margin-top: 14px; padding: 8px 20px; display: inline-block; text-decoration: none;">← View All Categories</a>
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
    const gstRate = (p.gstPercent !== undefined && p.gstPercent !== null && p.gstPercent !== '') ? Number(p.gstPercent) : (storeSettings.defaultGstPercent !== undefined ? storeSettings.defaultGstPercent : 18);
    const gstAmount = Math.round((basePrice * gstRate) / 100);
    const priceWithGst = basePrice + gstAmount;

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
          <h3 class="product-name"><a href="${DbService.getLinkPrefix()}product/${DbService.slugify(p.productName)}.html">${escapeHtml(p.productName)}</a></h3>

          <div class="price-row">
            <span class="selling-price">₹${priceWithGst.toLocaleString('en-IN')}</span>
            ${p.price > priceWithGst ? `<span class="mrp-price">₹${p.price?.toLocaleString('en-IN')}</span>` : ''}
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
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeCategoryPage(${currentPage - 1})">
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
    html += `<button class="pagination-btn" onclick="changeCategoryPage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    html += `
      <button class="pagination-btn ${isActive ? 'active' : ''}" onclick="changeCategoryPage(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="color: var(--text-muted); font-weight: 700;">...</span>`;
    }
    html += `<button class="pagination-btn" onclick="changeCategoryPage(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeCategoryPage(${currentPage + 1})">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

window.changeCategoryPage = function (newPage) {
  currentPage = newPage;
  renderCategoryCatalog();
  window.scrollTo({ top: 300, behavior: 'smooth' });
};

// CART DRAWER MANAGEMENT
function setupCartDrawer() {
  const openCartBtn = document.getElementById('openCartBtn');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const backdrop = document.getElementById('cartBackdrop');

  if (openCartBtn) openCartBtn.addEventListener('click', openCartDrawer);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
  if (backdrop) backdrop.addEventListener('click', closeCartDrawer);

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
      const coupons = storeSettings.discountCoupons || [];
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
      window.location.href = 'index.html?checkout=true';
    });
  }
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

window.addToCart = async function (productId) {
  let prod = categoryProducts.find(p => String(p.id) === String(productId));
  if (!prod) {
    try {
      prod = await DbService.getProductById(productId);
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

  const basePrice = prod.sellingPrice || 0;
  const gstRate = (prod.gstPercent !== undefined && prod.gstPercent !== null && prod.gstPercent !== '') ? Number(prod.gstPercent) : (storeSettings.defaultGstPercent !== undefined ? storeSettings.defaultGstPercent : 18);
  const priceWithGst = basePrice + Math.round((basePrice * gstRate) / 100);

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
  if (typeof renderCategoryCatalog === 'function') renderCategoryCatalog();
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
  if (typeof renderCategoryCatalog === 'function') renderCategoryCatalog();
};

function saveCart() {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
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

function getItemPriceWithGst(item, settings = storeSettings) {
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

  const settings = storeSettings || {};
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
    } else if (isPayOnDelivery) {
      deliveryEl.innerHTML = `<span style="color: #0284c7; font-weight: 800; font-size: 0.8rem;">Calculated & Payable Upon Delivery 🚚</span><small style="display:block; color:var(--text-muted); font-size:0.7rem;">(Freight / Shipping fee collected during delivery)</small>`;
    } else if (deliveryFee === 0) {
      if (typeof appliedCoupon !== 'undefined' && appliedCoupon && (appliedCoupon.freeDelivery || appliedCoupon.type === 'FREE_DELIVERY')) {
        deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800; font-size: 0.8rem;">We will parcel your product in Rathi meena or MSS. You should Pickup from there</span>`;
      } else {
        deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">FREE 🎉</span>`;
      }
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
