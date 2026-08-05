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
  setupAuthState();
  await fetchSettings();
  await loadHeroBanners();
  await loadBrandsAndCategories();
  await fetchProducts();
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
    <a href="brand.html?name=All%20Brands" class="brand-logo-card ${activeBrand === '' ? 'active' : ''}" style="text-decoration:none;" title="All Brands">
      <span style="font-weight: 800; font-size: 0.82rem; color: var(--accent-cyan);">ALL BRANDS</span>
    </a>
  ` + storeBrands.map(b => `
    <a href="brand.html?name=${encodeURIComponent(b.name)}" class="brand-logo-card ${activeBrand.toLowerCase() === b.name.toLowerCase() ? 'active' : ''}" style="text-decoration:none;" title="${escapeHtml(b.name)}">
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
    <div class="category-scroll-card ${isComboOnly ? 'active' : ''}" onclick="filterByComboOnly()">
      <div style="font-size: 1.3rem;">🔥</div>
      <span style="color: var(--accent-orange); font-weight: 800;">Combo Packs</span>
    </div>
  ` + storeCategories.map(c => `
    <div class="category-scroll-card ${activeCategory.toLowerCase() === c.name.toLowerCase() && !isComboOnly ? 'active' : ''}" onclick="selectCategory('${escapeHtml(c.name)}')">
      <img src="${c.imageLink || 'images/cctv-wholesale.webp'}" alt="${escapeHtml(c.name)}" onerror="this.src='images/cctv-wholesale.webp'">
      <span>${escapeHtml(c.name)}</span>
    </div>
  `).join('');
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
  renderBrandLogosStrip();
  renderCatalog();
};

window.selectCategory = function(c) {
  activeCategory = c;
  isComboOnly = false;
  renderCategoryScrollRow();

  document.querySelectorAll('.rc-nav2-inner a').forEach(a => {
    a.classList.toggle('active', a.textContent.includes(c || 'All Products'));
  });

  renderCatalog();
};

window.filterByComboOnly = function() {
  isComboOnly = !isComboOnly;
  if (isComboOnly) activeCategory = '';
  renderCategoryScrollRow();
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

  const enableFreeShipping = storeSettings.enableFreeShipping !== false;
  const freeMin = storeSettings.freeShippingMinOrder || 3000;
  const stdDelivery = storeSettings.deliveryCharge !== undefined ? Number(storeSettings.deliveryCharge) : 150;

  let deliveryFee = stdDelivery;
  if (subtotal === 0) {
    deliveryFee = 0;
  } else if (enableFreeShipping && subtotal >= freeMin) {
    deliveryFee = 0;
  }

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
  
  const deliveryEl = document.getElementById('cartDeliveryFee') || document.getElementById('cartDelivery');
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

  const discountRow = document.getElementById('discountRow');
  if (discountAmount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('cartDiscount').textContent = `-₹${discountAmount.toLocaleString('en-IN')}`;
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('cartFinalTotal').textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
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
  const shouldSaveAddress = document.getElementById('chkSaveAddress').checked;

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

      savedSelect.onchange = function() {
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

function closeCheckoutModal() {
  document.getElementById('checkoutBackdrop').classList.remove('active');
}

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

window.goToHeroSlide = function(index) {
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
