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

document.addEventListener('DOMContentLoaded', async () => {
  setupAuthState();
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
  const container = document.getElementById('authContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <a href="account.html" class="user-avatar-btn" title="${escapeHtml(currentUser.displayName || currentUser.email)}">
        <img src="${currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="user-avatar-img" alt="User Profile">
        <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-dark); max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(currentUser.displayName?.split(' ')[0] || 'Account')}</span>
      </a>
    `;
  } else {
    container.innerHTML = `
      <button class="nav-btn" id="googleLoginBtn">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 16px; height: 16px;">
        <span>Sign In</span>
      </button>
    `;

    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
      try {
        await DbService.loginWithGoogle();
      } catch (err) {
        alert(`Google Sign-In Notice: ${err.message}`);
      }
    });
  }
}

function parseBrandUrl() {
  const params = new URLSearchParams(window.location.search);
  currentBrandName = params.get('name') || params.get('brand') || '';
  if (!currentBrandName) {
    currentBrandName = 'All Brands';
  }
}

async function loadBrandData() {
  try {
    const brands = await DbService.getBrands();
    brandInfo = brands.find(b => b.name?.toLowerCase() === currentBrandName.toLowerCase());

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

  const allCategories = await DbService.getCategories();
  section.style.display = 'block';

  let html = `
    <button class="category-chip active" data-cat="all" onclick="filterBrandCategory('all', this)" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; border: 1.5px solid var(--accent-cyan); background: #f0f9ff; font-weight: 800; font-size: 0.85rem; color: var(--accent-cyan); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
      <span>🏷️ All Categories (${brandProducts.length})</span>
    </button>
  `;

  availableCatNames.forEach(catName => {
    const catObj = allCategories.find(c => c.name?.toLowerCase() === catName.toLowerCase());
    const imgUrl = catObj?.imageLink || 'images/cctv-wholesale.webp';
    const count = brandProducts.filter(p => p.category?.toLowerCase() === catName.toLowerCase()).length;

    html += `
      <button class="category-chip" data-cat="${escapeHtml(catName)}" onclick="filterBrandCategory('${escapeHtml(catName)}', this)" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; border: 1px solid #cbd5e1; background: #ffffff; font-weight: 700; font-size: 0.85rem; color: var(--text-dark); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
        <img src="${imgUrl}" alt="${escapeHtml(catName)}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 50%; background: #f8fafc; padding: 2px;" onerror="this.src='images/cctv-wholesale.webp'">
        <span>${escapeHtml(catName)} (${count})</span>
      </button>
    `;
  });

  grid.innerHTML = html;
}

window.filterBrandCategory = function(catName, btn) {
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
    heroLogo.src = brandInfo?.imageLink || 'images/logo.webp';
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

window.changeBrandPage = function(newPage) {
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
            ${isAvailable ? `
              <button class="btn-add-cart" onclick="addToCart('${p.id}')">🛒 Add to Cart</button>
            ` : `
              <button class="btn-add-cart" disabled style="background: #94a3b8; cursor: not-allowed;">Out of Stock</button>
            `}
            <a href="product.html?id=${p.id}" class="btn-quick-view" style="text-decoration:none; text-align:center;">View</a>
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
  let html = `
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeBrandPage(${currentPage - 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
      ← Prev
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    html += `
      <button class="pagination-btn" onclick="changeBrandPage(${i})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-color)'}; background: ${isActive ? 'var(--accent-cyan)' : '#ffffff'}; color: ${isActive ? '#ffffff' : 'var(--text-dark)'}; font-weight: 700; cursor: pointer;">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeBrandPage(${currentPage + 1})" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

window.addToCart = async function(productId) {
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
  openCartDrawer();
};

function saveCart() {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
}

function renderCart() {
  const badgeCount = document.getElementById('cartCount');
  const drawerCount = document.getElementById('cartItemCount');
  const body = document.getElementById('cartItemsBody');
  const subtotalEl = document.getElementById('cartSubtotal');
  const grandTotalEl = document.getElementById('cartGrandTotal');

  const totalQty = cart.reduce((sum, i) => sum + (i.quantity || i.qty || 1), 0);
  const subtotal = cart.reduce((sum, i) => sum + (i.sellingPrice * (i.quantity || i.qty || 1)), 0);

  if (badgeCount) badgeCount.textContent = totalQty;
  if (drawerCount) drawerCount.textContent = totalQty;

  if (body) {
    if (!cart.length) {
      body.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 40px;">Your cart is empty.</div>`;
    } else {
      body.innerHTML = cart.map(i => {
        const q = i.quantity || i.qty || 1;
        return `
          <div class="cart-item">
            <img src="${i.photoLink}" class="cart-item-img" alt="${escapeHtml(i.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
            <div class="cart-item-info">
              <div class="cart-item-title">${escapeHtml(i.productName)}</div>
              <div class="cart-item-price">₹${i.sellingPrice?.toLocaleString('en-IN')}</div>
              <div class="cart-qty-controls">
                <button onclick="updateQty('${i.id}', -1)">-</button>
                <span>${q}</span>
                <button onclick="updateQty('${i.id}', 1)">+</button>
              </div>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${i.id}')">✕</button>
          </div>
        `;
      }).join('');
    }
  }

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.type === 'PERCENT' ? (subtotal * appliedCoupon.value / 100) : appliedCoupon.value;
  }

  const enableFreeShipping = (window.storeSettings && window.storeSettings.enableFreeShipping !== false);
  const freeMin = (window.storeSettings && window.storeSettings.freeShippingMinOrder) || 3000;
  const stdDelivery = (window.storeSettings && window.storeSettings.deliveryCharge !== undefined) ? Number(window.storeSettings.deliveryCharge) : 150;

  let deliveryFee = stdDelivery;
  if (subtotal === 0) {
    deliveryFee = 0;
  } else if (enableFreeShipping && subtotal >= freeMin) {
    deliveryFee = 0;
  }

  const deliveryEl = document.getElementById('cartDelivery');
  if (deliveryEl) {
    if (subtotal === 0) {
      deliveryEl.innerHTML = `₹0`;
    } else if (deliveryFee === 0) {
      deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">FREE 🎉</span>`;
    } else if (enableFreeShipping) {
      const needed = freeMin - subtotal;
      deliveryEl.innerHTML = `₹${stdDelivery} <small style="display:block; color:var(--text-muted); font-size:0.7rem;">Add ₹${needed.toLocaleString('en-IN')} more for FREE Delivery!</small>`;
    } else {
      deliveryEl.innerHTML = `₹${stdDelivery} <small style="display:block; color:var(--text-muted); font-size:0.7rem;">Delivery charge applies to all orders</small>`;
    }
  }

  const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
}

window.updateQty = function(id, delta) {
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
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => String(i.id) !== String(id));
  saveCart();
  renderCart();
};

window.openCartDrawer = function() {
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartBackdrop')?.classList.add('active');
};

window.closeCartDrawer = function() {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartBackdrop')?.classList.remove('active');
};

function setupEventListeners() {
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartBackdrop')?.addEventListener('click', closeCartDrawer);

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

  document.getElementById('proceedCheckoutBtn')?.addEventListener('click', () => {
    if (!cart.length) {
      alert('Your cart is empty!');
      return;
    }
    closeCartDrawer();
    openCheckoutModal();
  });
}

function openCheckoutModal() {
  const backdrop = document.getElementById('checkoutBackdrop');
  if (!backdrop) return;

  backdrop.classList.add('active');

  const savedGroup = document.getElementById('savedAddressGroup');
  const savedSelect = document.getElementById('savedAddressSelect');

  if (currentUser) {
    const custEmail = document.getElementById('custEmail');
    const custName = document.getElementById('custName');
    if (custEmail && currentUser.email) custEmail.value = currentUser.email;
    if (custName && currentUser.displayName) custName.value = currentUser.displayName;

    if (userAddresses && userAddresses.length) {
      savedGroup.style.display = 'block';
      savedSelect.innerHTML = `<option value="">-- Choose a saved delivery address --</option>` +
        userAddresses.map(a => `<option value="${a.id}">${escapeHtml(a.fullName)} - ${escapeHtml(a.street)}, ${escapeHtml(a.pincode)}</option>`).join('');

      savedSelect.onchange = function() {
        const found = userAddresses.find(a => a.id === this.value);
        if (found) {
          document.getElementById('custName').value = found.fullName;
          document.getElementById('custPhone').value = found.phone;
          document.getElementById('custAddress').value = found.street;
          document.getElementById('custPincode').value = found.pincode;
          document.getElementById('custCityState').value = found.cityState;
        }
      };

      if (userAddresses[0]) {
        savedSelect.value = userAddresses[0].id;
        savedSelect.dispatchEvent(new Event('change'));
      }
    }
  }
}

window.closeCheckoutModal = function() {
  document.getElementById('checkoutBackdrop')?.classList.remove('active');
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
