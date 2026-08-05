// AK INFOTECH - FRONTEND APP (MY ACCOUNT MODAL, CHECKOUT Z-INDEX & GOOGLE AUTH)
import { DbService } from "./db-service.js";

const AUTHORIZED_ADMIN_EMAILS = ['akinfotecttn@gmail.com', 'akinfotechtn@gmail.com'];

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
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
let appliedCoupon = null;
let selectedPaymentMethod = 'ONLINE'; // ONLINE or COD

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  setupAuthState();
  await fetchSettings();
  await loadBrandsAndCategories();
  await fetchProducts();
  setupEventListeners();
  renderCart();
});

function setupAuthState() {
  DbService.listenAuthState((user) => {
    currentUser = user;
    renderAuthUI();
  });
}

function renderAuthUI() {
  const container = document.getElementById('authContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="user-avatar-btn" id="userProfileBtn" title="${escapeHtml(currentUser.displayName || currentUser.email)}">
        <img src="${currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="user-avatar-img" alt="User Profile">
        <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-dark); max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(currentUser.displayName?.split(' ')[0] || 'Account')}</span>
      </div>
    `;

    document.getElementById('userProfileBtn')?.addEventListener('click', () => {
      openAccountModal();
    });
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

// MY ACCOUNT & PROFILE MODAL
window.openAccountModal = function() {
  const modal = document.getElementById('accountModalBackdrop');
  const body = document.getElementById('accountModalBody');
  if (!modal || !body) return;

  modal.classList.add('active');

  if (currentUser) {
    const isAdminUser = AUTHORIZED_ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase());

    body.innerHTML = `
      <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); margin-bottom: 16px;">
        <img src="${currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid var(--accent-cyan); margin-bottom: 8px;">
        <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--text-dark);">${escapeHtml(currentUser.displayName || 'Customer Account')}</h2>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(currentUser.email)}</div>
        ${isAdminUser ? `<span class="badge-glow" style="background:#dcfce7; color:#16a34a; margin-top:6px; display:inline-block;">🟢 Verified Store Admin</span>` : ''}
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="hero-btn" style="width: 100%; justify-content: flex-start; padding: 12px 16px; background: #ffffff; color: var(--text-dark); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);" onclick="closeAccountModal(); openTrackModal();">
          📍 <strong>My Orders & Live Tracking</strong>
        </button>

        <a href="https://wa.me/919876543210?text=Hi%20AK%20Infotech%20Support," target="_blank" class="hero-btn" style="width: 100%; justify-content: flex-start; padding: 12px 16px; background: #ffffff; color: var(--text-dark); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); text-decoration: none;">
          💬 <strong>WhatsApp Customer Support</strong> (+91 9876543210)
        </a>

        ${isAdminUser ? `
          <a href="admin.html" class="hero-btn" style="width: 100%; justify-content: flex-start; padding: 12px 16px; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue)); text-decoration: none;">
            ⚙️ <strong>Open Admin Control Panel</strong>
          </a>
        ` : ''}

        <button id="accountSignOutBtn" class="pill-btn" style="width: 100%; padding: 10px; color: #ef4444; border-color: rgba(239,68,68,0.3); margin-top: 10px;">
          🚪 Sign Out
        </button>
      </div>
    `;

    document.getElementById('accountSignOutBtn')?.addEventListener('click', async () => {
      await DbService.logoutUser();
      closeAccountModal();
      alert('Signed out successfully.');
    });
  } else {
    body.innerHTML = `
      <div style="text-align: center; padding: 20px 10px;">
        <div style="font-size: 3rem; margin-bottom: 10px;">👤</div>
        <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-dark); margin-bottom: 8px;">My Account</h2>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 20px;">
          Sign in with Google to view your live order tracking history and manage your account.
        </p>

        <button class="hero-btn" id="accountGoogleLoginBtn" style="padding: 12px 24px;">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 18px; height: 18px; margin-right: 8px; vertical-align: middle;">
          Sign In with Google
        </button>
      </div>
    `;

    document.getElementById('accountGoogleLoginBtn')?.addEventListener('click', async () => {
      try {
        await DbService.loginWithGoogle();
        closeAccountModal();
      } catch (err) {
        alert(`Google Sign-In Error: ${err.message}`);
      }
    });
  }
};

window.closeAccountModal = function() {
  document.getElementById('accountModalBackdrop')?.classList.remove('active');
};

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
  renderFilterPills();
}

function renderBrandLogosStrip() {
  const container = document.getElementById('brandLogosRow');
  if (!container) return;

  container.innerHTML = `
    <div class="brand-logo-card ${activeBrand === '' ? 'active' : ''}" onclick="selectBrand('')" title="All Brands">
      <span style="font-weight: 800; font-size: 0.85rem; color: var(--accent-cyan);">ALL BRANDS</span>
    </div>
  ` + storeBrands.map(b => `
    <div class="brand-logo-card ${activeBrand === b.name ? 'active' : ''}" onclick="selectBrand('${escapeHtml(b.name)}')" title="${escapeHtml(b.name)}">
      <img src="${b.imageLink || 'images/logo.webp'}" alt="${escapeHtml(b.name)}" onerror="this.src='images/logo.webp'">
    </div>
  `).join('');
}

function renderFilterPills() {
  const brandPillsEl = document.getElementById('brandPills');
  if (brandPillsEl) {
    brandPillsEl.innerHTML = `<button class="pill-btn ${activeBrand === '' ? 'active' : ''}" onclick="selectBrand('')">All Brands</button>`;
    storeBrands.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `pill-btn ${activeBrand === b.name ? 'active' : ''}`;
      btn.textContent = b.name;
      btn.onclick = () => selectBrand(b.name);
      brandPillsEl.appendChild(btn);
    });
  }

  const catPillsEl = document.getElementById('categoryPills');
  if (catPillsEl) {
    catPillsEl.innerHTML = `<button class="pill-btn ${activeCategory === '' ? 'active' : ''}" onclick="selectCategory('')">All Categories</button>`;
    storeCategories.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `pill-btn ${activeCategory === c.name ? 'active' : ''}`;
      btn.textContent = c.name;
      btn.onclick = () => selectCategory(c.name);
      catPillsEl.appendChild(btn);
    });
  }
}

async function fetchProducts() {
  try {
    allProducts = await DbService.getProducts();
    renderCatalog();
    if (allProducts.length) {
      DbService.injectProductSEO(allProducts[0]);
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

window.selectBrand = function(b) {
  activeBrand = b;
  document.querySelectorAll('#brandPills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === (b || 'All Brands'));
  });

  document.querySelectorAll('.brand-logo-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('title') === (b || 'All Brands'));
  });

  renderCatalog();
};

window.selectCategory = function(c) {
  activeCategory = c;
  document.querySelectorAll('#categoryPills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === (c || 'All Categories'));
  });

  document.querySelectorAll('.rc-nav2-inner a').forEach(a => {
    a.classList.toggle('active', a.textContent.includes(c || 'All Products'));
  });

  renderCatalog();
};

window.filterByComboOnly = function() {
  isComboOnly = !isComboOnly;
  const comboBtn = document.getElementById('comboToggleBtn');
  if (comboBtn) {
    comboBtn.classList.toggle('active', isComboOnly);
  }
  renderCatalog();
};

// RENDER PRODUCTS CATALOG GRID
function renderCatalog() {
  const grid = document.getElementById('productGrid');
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
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.productName?.toLowerCase().includes(q) ||
      p.productSpec?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3>No matching products found</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">Try clearing search or filters to see more security items.</p>
        <button class="hero-btn" style="margin-top: 14px; padding: 8px 20px;" onclick="resetFilters()">Reset Filters</button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const savings = p.price > p.sellingPrice ? Math.round(((p.price - p.sellingPrice) / p.price) * 100) : 0;
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
          <h3 class="product-name"><a href="product.html?id=${p.id}" title="${escapeHtml(p.productName)}">${escapeHtml(p.productName)}</a></h3>

          <div class="price-row">
            <span class="selling-price">₹${p.sellingPrice.toLocaleString('en-IN')}</span>
            ${p.price > p.sellingPrice ? `<span class="mrp-price">₹${p.price.toLocaleString('en-IN')}</span>` : ''}
            ${savings > 0 ? `<span class="discount-tag">${savings}% OFF</span>` : ''}
          </div>

          <div class="card-actions">
            ${isAvailable ? `
              <button class="btn-add-cart" onclick="addToCart('${p.id}')">
                🛒 Add to Cart
              </button>
            ` : `
              <button class="btn-add-cart" disabled style="background:#cbd5e1; cursor:not-allowed; opacity:0.8;">
                🚫 Out of Stock
              </button>
            `}
            <a href="product.html?id=${p.id}" class="btn-quick-view" style="display:flex; align-items:center; justify-content:center; text-decoration:none;" title="View Single Product Page">
              👁️
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.resetFilters = function() {
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

// CART MANAGEMENT
window.addToCart = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  if (prod.inStock === false) {
    alert('Sorry, this product is currently out of stock!');
    return;
  }

  const existingIndex = cart.findIndex(item => item.id === productId);
  if (existingIndex > -1) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({ ...prod, quantity: 1 });
  }

  saveCart();
  renderCart();
  openCartDrawer();
};

window.updateCartQty = function(productId, change) {
  const index = cart.findIndex(item => item.id === productId);
  if (index > -1) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
  }
  saveCart();
  renderCart();
};

function saveCart() {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
}

function renderCart() {
  const cartCountEl = document.getElementById('cartCount');
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = totalQty;

  const itemsListEl = document.getElementById('cartItemsList');
  if (!itemsListEl) return;

  if (!cart.length) {
    itemsListEl.innerHTML = `
      <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 10px;">🛒</div>
        Your cart is empty.<br>Browse items & add to cart.
      </div>`;
  } else {
    itemsListEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.photoLink}" alt="${escapeHtml(item.productName)}" onerror="this.src='images/cctv-wholesale.webp'">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.productName)}</div>
          <div class="cart-item-price">₹${item.sellingPrice.toLocaleString('en-IN')}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
            <span style="font-weight: 700; font-size: 0.85rem;">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  let deliveryFee = subtotal >= storeSettings.freeShippingMinOrder || subtotal === 0 ? 0 : storeSettings.deliveryCharge;

  let discountAmount = 0;
  if (appliedCoupon && subtotal >= (appliedCoupon.minOrderAmount || 0)) {
    if (appliedCoupon.discountPercent) {
      discountAmount = Math.round((subtotal * appliedCoupon.discountPercent) / 100);
    } else if (appliedCoupon.discountFlat) {
      discountAmount = appliedCoupon.discountFlat;
    }
  }

  const finalTotal = Math.max(0, subtotal + deliveryFee - discountAmount);

  document.getElementById('cartSubtotal').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  document.getElementById('cartDeliveryFee').textContent = deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`;

  const discountRow = document.getElementById('discountRow');
  if (discountAmount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('cartDiscount').textContent = `-₹${discountAmount.toLocaleString('en-IN')}`;
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('cartFinalTotal').textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
}

// ORDER TRACKING MODAL
window.openTrackModal = async function() {
  document.getElementById('trackModalBackdrop').classList.add('active');
  const container = document.getElementById('userOrdersHistoryContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `<div style="text-align:center; padding:16px;">Loading your order history...</div>`;
    const userOrders = await DbService.getUserOrders(currentUser.uid);
    renderOrderTrackingCards(userOrders, container);
  } else {
    container.innerHTML = `
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 14px; border-radius: var(--radius-md); font-size: 0.88rem; color: #0369a1;">
        💡 <strong>Tip:</strong> Sign in with Google to view all your order history automatically, or type your Order ID / Phone number above to search.
      </div>
    `;
  }
};

window.closeTrackModal = function() {
  document.getElementById('trackModalBackdrop').classList.remove('active');
};

async function handleTrackSearch() {
  const queryStr = document.getElementById('trackInput').value.trim();
  const container = document.getElementById('userOrdersHistoryContainer');

  if (!queryStr) {
    alert('Please enter an Order ID or Mobile Number!');
    return;
  }

  container.innerHTML = `<div style="text-align:center; padding:16px;">Searching orders for "${escapeHtml(queryStr)}"...</div>`;
  const results = await DbService.trackOrderByIdOrPhone(queryStr);
  renderOrderTrackingCards(results, container);
}

function renderOrderTrackingCards(ordersList, container) {
  if (!ordersList || !ordersList.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 30px 10px; color: var(--text-muted);">
        🔍 No orders found. Please verify your Order ID or Phone number.
      </div>`;
    return;
  }

  container.innerHTML = ordersList.map(order => {
    const status = (order.status || 'PROCESSING').toUpperCase();
    const isStep1 = true;
    const isStep2 = status === 'SHIPPED' || status === 'OUT FOR DELIVERY' || status === 'DELIVERED';
    const isStep3 = status === 'OUT FOR DELIVERY' || status === 'DELIVERED';
    const isStep4 = status === 'DELIVERED';

    return `
      <div class="order-tracking-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 1rem; color: var(--text-dark);">Order #${order.id}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${new Date(order.createdAt).toLocaleString('en-IN')}</div>
          </div>
          <div style="text-align: right;">
            <span class="status-badge ${order.paymentMethod === 'COD' ? 'status-cod' : 'status-online'}">
              ${order.paymentMethod === 'COD' ? '💵 COD (Advance Paid)' : '💳 Paid Online'}
            </span>
            <div style="font-weight: 800; font-size: 0.95rem; margin-top: 4px; color: var(--text-dark);">Total: ₹${order.finalTotal?.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div style="font-size: 0.82rem; margin-bottom: 8px;">
          <strong>Items:</strong> ${order.items?.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
        </div>

        <div class="tracking-timeline">
          <div class="step-node ${isStep1 ? (isStep2 ? 'completed' : 'active') : ''}">
            <div class="step-dot">1</div>
            <span>Placed</span>
          </div>
          <div class="step-node ${isStep2 ? (isStep3 ? 'completed' : 'active') : ''}">
            <div class="step-dot">2</div>
            <span>Shipped</span>
          </div>
          <div class="step-node ${isStep3 ? (isStep4 ? 'completed' : 'active') : ''}">
            <div class="step-dot">3</div>
            <span>Out for Delivery</span>
          </div>
          <div class="step-node ${isStep4 ? 'completed' : ''}">
            <div class="step-dot">4</div>
            <span>Delivered</span>
          </div>
        </div>

        ${order.paymentMethod === 'COD' ? `
          <div style="font-size: 0.8rem; background: #fff7ed; border: 1px solid #fed7aa; padding: 8px; border-radius: 6px; margin-top: 10px; color: #9a3412;">
            👉 <strong>COD Split:</strong> ₹${order.advancePaid} Advance Paid | <strong>₹${order.balanceOnDelivery} Due at Delivery</strong>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// CHECKOUT & PAYMENT SELECTION
window.selectPaymentMethod = function(method) {
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

    const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    let deliveryFee = subtotal >= storeSettings.freeShippingMinOrder || subtotal === 0 ? 0 : storeSettings.deliveryCharge;
    const finalTotal = subtotal + deliveryFee;
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

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  let deliveryFee = subtotal >= storeSettings.freeShippingMinOrder || subtotal === 0 ? 0 : storeSettings.deliveryCharge;

  let discountAmount = 0;
  if (appliedCoupon && subtotal >= (appliedCoupon.minOrderAmount || 0)) {
    if (appliedCoupon.discountPercent) {
      discountAmount = Math.round((subtotal * appliedCoupon.discountPercent) / 100);
    } else if (appliedCoupon.discountFlat) {
      discountAmount = appliedCoupon.discountFlat;
    }
  }

  const finalTotal = Math.max(0, subtotal + deliveryFee - discountAmount);
  const codAdvanceFee = storeSettings.codAdvanceAmount || 1000;
  const amountToPayNow = selectedPaymentMethod === 'COD' ? Math.min(finalTotal, codAdvanceFee) : finalTotal;

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
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCatalog();
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

  const openTrackBtn = document.getElementById('openTrackModalBtn');
  if (openTrackBtn) openTrackBtn.addEventListener('click', openTrackModal);

  const closeTrackBtn = document.getElementById('closeTrackModalBtn');
  if (closeTrackBtn) closeTrackBtn.addEventListener('click', closeTrackModal);

  const btnTrackSearch = document.getElementById('btnTrackSearch');
  if (btnTrackSearch) btnTrackSearch.addEventListener('click', handleTrackSearch);

  const closeAccountBtn = document.getElementById('closeAccountModalBtn');
  if (closeAccountBtn) closeAccountBtn.addEventListener('click', closeAccountModal);

  const proceedBtn = document.getElementById('proceedCheckoutBtn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (!cart.length) {
        alert('Your cart is empty!');
        return;
      }
      openCheckoutModal();
    });
  }

  const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
  if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckoutModal);

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

window.openCartDrawer = function() {
  document.getElementById('cartDrawer').classList.add('active');
  document.getElementById('cartBackdrop').classList.add('active');
};

window.closeCartDrawer = function() {
  document.getElementById('cartDrawer').classList.remove('active');
  document.getElementById('cartBackdrop').classList.remove('active');
};

function openCheckoutModal() {
  // Close cart drawer first so screens do not overlap!
  closeCartDrawer();

  document.getElementById('checkoutBackdrop').classList.add('active');
  selectPaymentMethod('ONLINE');

  if (currentUser) {
    const custEmail = document.getElementById('custEmail');
    const custName = document.getElementById('custName');
    if (custEmail && currentUser.email) custEmail.value = currentUser.email;
    if (custName && currentUser.displayName) custName.value = currentUser.displayName;
  }
}

function closeCheckoutModal() {
  document.getElementById('checkoutBackdrop').classList.remove('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
