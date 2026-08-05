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
    renderBrandCatalog();
  } catch (err) {
    console.error('Error loading brand page:', err);
  }
}

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

function renderBrandCatalog() {
  const grid = document.getElementById('brandProductGrid');
  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3>No products found for ${escapeHtml(currentBrandName)}</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">Try searching for other items or browse all brands.</p>
        <a href="index.html" class="hero-btn" style="margin-top: 14px; padding: 8px 20px; display: inline-block; text-decoration: none;">← View All Brands</a>
      </div>`;
    return;
  }

  grid.innerHTML = filteredProducts.map(p => {
    const isAvailable = p.inStock !== false;
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
            <span class="selling-price">₹${p.sellingPrice?.toLocaleString('en-IN')}</span>
            ${p.price > p.sellingPrice ? `<span class="mrp-price">₹${p.price?.toLocaleString('en-IN')}</span>` : ''}
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
}

window.addToCart = function(productId) {
  const product = brandProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
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

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = cart.reduce((sum, i) => sum + (i.sellingPrice * i.qty), 0);

  if (badgeCount) badgeCount.textContent = totalQty;
  if (drawerCount) drawerCount.textContent = totalQty;

  if (body) {
    if (!cart.length) {
      body.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 40px;">Your cart is empty.</div>`;
    } else {
      body.innerHTML = cart.map(i => `
        <div class="cart-item">
          <img src="${i.photoLink}" class="cart-item-img" alt="${escapeHtml(i.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(i.productName)}</div>
            <div class="cart-item-price">₹${i.sellingPrice?.toLocaleString('en-IN')}</div>
            <div class="cart-qty-controls">
              <button onclick="updateQty('${i.id}', -1)">-</button>
              <span>${i.qty}</span>
              <button onclick="updateQty('${i.id}', 1)">+</button>
            </div>
          </div>
          <button class="remove-btn" onclick="removeFromCart('${i.id}')">✕</button>
        </div>
      `).join('');
    }
  }

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.type === 'PERCENT' ? (subtotal * appliedCoupon.value / 100) : appliedCoupon.value;
  }

  const freeMin = 3000;
  let deliveryFee = (subtotal >= freeMin || subtotal === 0) ? 0 : 150;
  const deliveryEl = document.getElementById('cartDelivery');

  if (deliveryEl) {
    if (subtotal === 0) {
      deliveryEl.innerHTML = `₹0`;
    } else if (deliveryFee === 0) {
      deliveryEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">FREE 🎉</span>`;
    } else {
      const needed = freeMin - subtotal;
      deliveryEl.innerHTML = `₹${deliveryFee} <small style="display:block; color:var(--text-muted); font-size:0.7rem;">Add ₹${needed.toLocaleString('en-IN')} more for FREE Delivery!</small>`;
    }
  }

  const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
}

window.updateQty = function(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  renderCart();
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => i.id !== id);
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
