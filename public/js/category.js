import { DbService } from './db-service.js';

let currentCategoryName = '';
let categoryProducts = [];
let filteredProducts = [];
let allCategories = [];
let allBrands = [];
let storeSettings = {};
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

const ITEMS_PER_PAGE = 12;
let currentPage = 1;

function normalizeStr(str) {
  let s = (str || '').toLowerCase().trim();
  s = s.replace(/wifi/g, 'wireless').replace(/wi-fi/g, 'wireless');
  return s.replace(/[^a-z0-9]/g, '');
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentCategoryName = urlParams.get('name') || urlParams.get('cat') || urlParams.get('category') || '';

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

window.filterCategoryBrand = function(bName, btn) {
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
        <a href="product.html?id=${p.id}" class="product-image-wrap">
          <img src="${p.photoLink}" alt="${escapeHtml(p.productName)}" loading="lazy" onerror="this.src='images/cctv-wholesale.webp'">
          <span class="brand-badge">${escapeHtml(p.brand || 'AK Infotech')}</span>
          ${p.isCombo ? `<span class="combo-badge">🔥 COMBO</span>` : ''}
          ${!isAvailable ? `<span style="position: absolute; bottom: 8px; left: 8px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px;">OUT OF STOCK</span>` : ''}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="product.html?id=${p.id}">${escapeHtml(p.productName)}</a></h3>
          <p class="product-spec">${escapeHtml(p.productSpec)}</p>

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

window.changeCategoryPage = function(newPage) {
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
}

window.openCartDrawer = function() {
  cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.add('open'); drawer.classList.add('active'); }
  if (backdrop) { backdrop.classList.add('open'); backdrop.classList.add('active'); }
  renderCart();
};

window.closeCartDrawer = function() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer) { drawer.classList.remove('open'); drawer.classList.remove('active'); }
  if (backdrop) { backdrop.classList.remove('open'); backdrop.classList.remove('active'); }
};

window.addToCart = async function(productId) {
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

window.updateCartQty = function(productId, change) {
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

function getItemPriceWithGst(item, settings = storeSettings) {
  const basePrice = Number(item.basePrice || item.sellingPrice || 0);
  const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') ? Number(item.gstPercent) : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
  const gstAmount = Math.round((basePrice * gstRate) / 100);
  return basePrice + gstAmount;
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer') || document.getElementById('cartItemsBody');
  const countEl = document.getElementById('cartCount');
  const drawerCountEl = document.getElementById('cartDrawerCount') || document.getElementById('cartItemCount');

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
  if (countEl) countEl.textContent = totalItems;
  if (drawerCountEl) drawerCountEl.textContent = totalItems;

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `<div class="empty-cart-msg">Your shopping cart is currently empty.</div>`;
  } else {
    container.innerHTML = cart.map(item => {
      const q = item.quantity || item.qty || 1;
      const itemPriceWithGst = getItemPriceWithGst(item, storeSettings);
      return `
        <div class="cart-item">
          <img src="${item.photoLink}" alt="${escapeHtml(item.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(item.productName)}</div>
            <div class="cart-item-price">₹${itemPriceWithGst.toLocaleString('en-IN')}</div>
            <div class="cart-qty-controls">
              <button onclick="updateCartQty('${item.id}', -1)">-</button>
              <span>${q}</span>
              <button onclick="updateCartQty('${item.id}', 1)">+</button>
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

  const deliveryFee = subtotalWithGst > 0 ? (storeSettings.deliveryCharge || 150) : 0;
  const finalTotal = subtotalWithGst + deliveryFee;

  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotalWithGst.toLocaleString('en-IN')}`;

  const deliveryEl = document.getElementById('cartDelivery');
  if (deliveryEl) deliveryEl.textContent = deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`;

  const grandTotalEl = document.getElementById('cartGrandTotal') || document.getElementById('cartFinalTotal');
  if (grandTotalEl) grandTotalEl.textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
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
