// AK INFOTECH - DEDICATED USER ACCOUNT & ADDRESSES JS
import { DbService } from "./db-service.js";

const AUTHORIZED_ADMIN_EMAILS = ['akinfotechtn@gmail.com', 'admin@akinfotechcctv.in'];

let currentUser = null;
let userAddresses = [];
let userOrders = [];
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

let appliedCoupon = null;
let storeSettings = {};
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupAuthState();
  setupEventListeners();
  renderCart();

  try {
    const [settings, categories] = await Promise.all([
      DbService.getSettings(),
      DbService.getCategories()
    ]);
    storeSettings = settings || {};
    allCategories = categories || [];
    renderCart();
  } catch (err) {
    console.warn("Failed to load settings asynchronously on account page:", err);
  }
});

function setupAuthState() {
  DbService.listenAuthState(async (user) => {
    currentUser = user;
    const loggedOutGate = document.getElementById('accountLoggedOutGate');
    const dashboard = document.getElementById('accountDashboard');

    const bottomAvatarEl = document.getElementById('bottomProfileAvatar');
    const bottomTextEl = document.getElementById('bottomProfileText');

    if (user) {
      loggedOutGate.style.display = 'none';
      dashboard.style.display = 'block';

      if (bottomAvatarEl) {
        if (user.photoURL) {
          bottomAvatarEl.innerHTML = `<img src="${user.photoURL}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-cyan);" alt="Profile">`;
        } else {
          bottomAvatarEl.innerHTML = `👤`;
        }
      }
      if (bottomTextEl) {
        bottomTextEl.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
      }

      document.getElementById('userAvatarImg').src = user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
      document.getElementById('userDisplayName').textContent = user.displayName || 'Customer Account';
      document.getElementById('userEmailAddress').textContent = user.email;

      const isAdmin = AUTHORIZED_ADMIN_EMAILS.includes((user.email || '').toLowerCase());
      const adminBadgeTag = document.getElementById('adminBadgeTag');
      const adminShortcutBtn = document.getElementById('adminShortcutTabBtn');

      if (isAdmin) {
        if (adminBadgeTag) adminBadgeTag.innerHTML = `<span class="badge-glow" style="background:#dcfce7; color:#16a34a;">🟢 Authorized Store Admin</span>`;
        if (adminShortcutBtn) adminShortcutBtn.style.display = 'inline-block';
      } else {
        if (adminBadgeTag) adminBadgeTag.innerHTML = '';
        if (adminShortcutBtn) adminShortcutBtn.style.display = 'none';
      }

      try {
        await loadUserOrders(user.uid);
      } catch (err) {
        console.error("Failed to load user orders:", err);
      }

      try {
        await loadUserAddresses(user.uid);
      } catch (err) {
        console.error("Failed to load user addresses:", err);
      }
    } else {
      loggedOutGate.style.display = 'block';
      dashboard.style.display = 'none';
    }
  });

  document.getElementById('btnGoogleSignIn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    try {
      btn.innerHTML = `<span style="font-weight:800;">⏳ Opening Google Sign In...</span>`;
      btn.disabled = true;
      await DbService.loginWithGoogle();
      // If popup flow: onAuthStateChanged fires, UI updates automatically.
      // If redirect flow: page navigates away here — no further code runs.
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      // Only show errors for genuine failures — not user-cancelled popups
      if (err.code && ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked'].includes(err.code)) {
        // User closed popup or it was redirected — silently reset
        return;
      }
      const msgEl = document.getElementById('loginErrorMsg');
      if (msgEl) {
        msgEl.textContent = `Sign-in failed: ${err.message || err}`;
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
      } else {
        alert(`Sign-In Error: ${err.message || err}`);
      }
    }
  });

  document.getElementById('btnUserLogout')?.addEventListener('click', async () => {
    await DbService.logoutUser();
  });
}

window.switchAccountTab = function(tabId, btn) {
  document.querySelectorAll('.account-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
};

// 1. ORDERS HISTORY & TRACKING
async function loadUserOrders(uid) {
  const container = document.getElementById('userOrdersContainer');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">⏳ Loading your orders...</div>`;

  try {
    // Use currentUser (tracked by listenAuthState) — auth is not imported in this file
    const userEmail = currentUser ? currentUser.email : '';
    const userName = currentUser ? (currentUser.displayName || '') : '';
    userOrders = await DbService.getUserOrders(uid, userEmail, userName);

    if (!userOrders || !userOrders.length) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
          No orders placed yet.<br>
          <a href="index.html" class="hero-btn" style="margin-top: 14px; display: inline-block;">Browse Catalog</a>
        </div>`;
      return;
    }

    container.innerHTML = userOrders.map(order => generateOrderTrackingHtml(order)).join('');
  } catch (err) {
    console.error("loadUserOrders error:", err);
    container.innerHTML = `
      <div style="text-align:center; padding: 30px 10px; background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; color:#9a3412;">
        <div style="font-size:1.8rem; margin-bottom:8px;">⚠️</div>
        <strong>Could not load orders.</strong><br>
        <span style="font-size:0.85rem;">This may be due to a temporary Firestore quota limit or network issue. Please try again in a moment.</span><br>
        <button class="hero-btn" onclick="loadUserOrders('${uid}')" style="margin-top:14px; padding:8px 20px;">🔄 Retry</button>
      </div>`;
  }
}

// 2. SAVED DELIVERY ADDRESSES (CRUD)
async function loadUserAddresses(uid) {
  const container = document.getElementById('userAddressesContainer');
  userAddresses = await DbService.getUserAddresses(uid);

  if (!userAddresses || !userAddresses.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 30px 10px; color: var(--text-muted); background: #f8fafc; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
        📍 No saved delivery addresses yet.<br>
        Click "+ Add New Address" above to save your shipping details for faster checkout.
      </div>`;
    return;
  }

  container.innerHTML = userAddresses.map((addr, idx) => `
    <div class="address-card ${idx === 0 ? 'default' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-dark);">
          ${escapeHtml(addr.fullName)} <span style="font-weight: 400; font-size: 0.85rem; color: var(--text-muted);">(${escapeHtml(addr.phone)})</span>
        </div>
        ${idx === 0 ? `<span class="badge-glow" style="background: #dcfce7; color: #16a34a;">Default Address</span>` : ''}
      </div>

      <div style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 10px; line-height: 1.4;">
        ${escapeHtml(addr.street)}<br>
        ${escapeHtml(addr.cityState)} - <strong>${escapeHtml(addr.pincode)}</strong>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn-action-sm" onclick="editAddress('${addr.id}')">✏️ Edit</button>
        <button class="btn-action-sm" style="color: #ef4444;" onclick="deleteAddress('${addr.id}')">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

window.openAddAddressModal = function() {
  document.getElementById('editAddressId').value = '';
  document.getElementById('addressModalTitle').textContent = 'Add Delivery Address';
  document.getElementById('addressForm').reset();
  if (currentUser) {
    document.getElementById('addrFullName').value = currentUser.displayName || '';
  }
  document.getElementById('addressModalBackdrop').classList.add('active');
};

window.editAddress = function(id) {
  const addr = userAddresses.find(a => a.id === id);
  if (!addr) return;

  document.getElementById('editAddressId').value = addr.id;
  document.getElementById('addressModalTitle').textContent = 'Edit Delivery Address';
  document.getElementById('addrFullName').value = addr.fullName;
  document.getElementById('addrPhone').value = addr.phone;
  document.getElementById('addrStreet').value = addr.street;
  document.getElementById('addrPincode').value = addr.pincode;
  document.getElementById('addrCityState').value = addr.cityState;

  document.getElementById('addressModalBackdrop').classList.add('active');
};

window.closeAddressModal = function() {
  document.getElementById('addressModalBackdrop').classList.remove('active');
};

async function handleAddressSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = document.getElementById('editAddressId').value;
  const payload = {
    fullName: document.getElementById('addrFullName').value.trim(),
    phone: document.getElementById('addrPhone').value.trim(),
    street: document.getElementById('addrStreet').value.trim(),
    pincode: document.getElementById('addrPincode').value.trim(),
    cityState: document.getElementById('addrCityState').value.trim()
  };

  try {
    if (id) {
      await DbService.updateUserAddress(currentUser.uid, id, payload);
      alert('✅ Delivery address updated successfully!');
    } else {
      await DbService.addUserAddress(currentUser.uid, payload);
      alert('✅ Delivery address saved successfully!');
    }
    closeAddressModal();
    await loadUserAddresses(currentUser.uid);
  } catch (err) {
    alert(`Failed to save address: ${err.message}`);
  }
}

window.deleteAddress = async function(id) {
  if (!confirm('Are you sure you want to delete this delivery address?')) return;
  if (!currentUser) return;

  try {
    await DbService.deleteUserAddress(currentUser.uid, id);
    await loadUserAddresses(currentUser.uid);
  } catch (err) {
    alert(`Failed to delete address: ${err.message}`);
  }
};

window.saveCart = function () {
  localStorage.setItem('ak_cart', JSON.stringify(cart));
};

window.updateCartQty = function (productId, change) {
  const index = cart.findIndex(item => String(item.id) === String(productId));
  if (index !== -1) {
    const currentQty = cart[index].quantity || cart[index].qty || 1;
    const newQty = currentQty + change;
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQty;
      cart[index].qty = newQty;
    }
    saveCart();
    renderCart();
  }
};

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
    const type = appliedCoupon.type;
    if (type === 'FREE_DELIVERY') {
      deliveryFee = 0;
      discountAmount = 0;
    } else if (type === 'FLAT') {
      discountAmount = Number(appliedCoupon.discountFlat || appliedCoupon.value || 0);
    } else if (type === 'PERCENTAGE') {
      const pct = Number(appliedCoupon.discountPercent || appliedCoupon.value || 0);
      discountAmount = Math.round((subtotalWithGst * pct) / 100);
    } else {
      if (appliedCoupon.discountPercent) {
        discountAmount = Math.round((subtotalWithGst * Number(appliedCoupon.discountPercent)) / 100);
      } else if (appliedCoupon.discountFlat) {
        discountAmount = Number(appliedCoupon.discountFlat);
      }
    }
  }

  const finalTotal = Math.max(0, subtotalWithGst + deliveryFee - discountAmount);

  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotalWithGst.toLocaleString('en-IN')}`;

  const deliveryEl = document.getElementById('cartDelivery');
  if (deliveryEl) {
    if (subtotalWithGst === 0) {
      deliveryEl.innerHTML = `₹0`;
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
    if (discountAmount > 0) {
      discountRow.style.display = 'flex';
      const discEl = document.getElementById('cartDiscount');
      if (discEl) discEl.textContent = `-₹${discountAmount.toLocaleString('en-IN')}`;
    } else {
      discountRow.style.display = 'none';
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
      msgEl.textContent = `Coupon ${appliedCoupon.code} applied!`;
    } else {
      if (!inputEl.value) {
        msgEl.style.display = 'none';
      }
    }
  }
}

window.openCartDrawer = function () {
  cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartBackdrop')?.classList.add('active');
  renderCart();
};

window.closeCartDrawer = function () {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartBackdrop')?.classList.remove('active');
};

function setupEventListeners() {
  const addressForm = document.getElementById('addressForm');
  if (addressForm) addressForm.addEventListener('submit', handleAddressSubmit);

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
      const coupons = storeSettings.discountCoupons || [];
      const found = coupons.find(c => c.code === code);
      if (found) {
        appliedCoupon = found;
        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.color = 'var(--accent-green)';
          msgEl.textContent = `Coupon ${code} applied successfully!`;
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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function generateOrderTrackingHtml(order) {
  if (!order) return '';
  const status = (order.status || 'PROCESSING').toUpperCase();
  const isStep1 = true;
  const isStep2 = status === 'SHIPPED' || status === 'OUT FOR DELIVERY' || status === 'DELIVERED';
  const isStep3 = status === 'OUT FOR DELIVERY' || status === 'DELIVERED';
  const isStep4 = status === 'DELIVERED';

  const orderIdStr = escapeHtml(order.id || 'N/A');
  const totalAmt = Number(order.finalTotal || order.total || order.totalAmount || order.grandTotal || 0);

  let dateFormatted = 'N/A';
  if (order.createdAt) {
    try {
      dateFormatted = new Date(order.createdAt).toLocaleString('en-IN');
      if (dateFormatted === 'Invalid Date') dateFormatted = String(order.createdAt);
    } catch (e) { dateFormatted = String(order.createdAt); }
  }

  const itemsList = (order.items && Array.isArray(order.items) && order.items.length)
    ? order.items.map(i => `${escapeHtml(i.productName || i.name || 'Item')} (x${i.quantity || i.qty || 1})`).join(', ')
    : 'Order Items';

  const custName = escapeHtml(order.customerName || order.name || order.fullName || 'Customer');
  const addressStr = escapeHtml(order.address || order.street || '');
  const cityStr = escapeHtml(order.city || order.cityState || '');
  const pincodeStr = escapeHtml(order.pincode || '');

  const shiprocketTrackingHtml = order.awbCode ? `
    <div style="font-size: 0.8rem; background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px; border-radius: 8px; margin-top: 10px; color: #0369a1;">
      🚚 <strong>Live Tracking:</strong> Courier: <strong>${escapeHtml(order.courierName || 'Shiprocket')}</strong> | AWB: <strong>${escapeHtml(order.awbCode)}</strong>
      <div style="margin-top: 6px;">
        <a href="https://shiprocket.co/tracking/${order.awbCode}" target="_blank" class="hero-btn" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; display: inline-block; border-radius: 4px;">Track Package 🔗</a>
      </div>
    </div>
  ` : '';

  const advancePaid = Number(order.advancePaid || 1000);
  const balanceOnDelivery = Math.max(0, totalAmt - advancePaid);

  return `
    <div class="order-tracking-card" style="border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; margin-bottom: 12px; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
        <div>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-dark);">Order #${orderIdStr}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${dateFormatted}</div>
        </div>
        <div style="text-align: right;">
          <span class="status-badge ${order.paymentMethod === 'COD' ? 'status-cod' : 'status-online'}">
            ${order.paymentMethod === 'COD' ? '💵 COD (Advance Paid)' : '💳 Paid Online'}
          </span>
          <div style="font-weight: 800; font-size: 0.95rem; margin-top: 4px; color: var(--text-dark);">Total: ₹${totalAmt.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div style="font-size: 0.82rem; margin-bottom: 8px;">
        <strong>Items:</strong> ${itemsList}
      </div>

      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">
        📍 <strong>Ship to:</strong> ${custName}${addressStr ? `, ${addressStr}` : ''}${cityStr ? `, ${cityStr}` : ''}${pincodeStr ? ` - ${pincodeStr}` : ''}
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
          👉 <strong>COD Split:</strong> ₹${advancePaid.toLocaleString('en-IN')} Advance Paid | <strong>₹${balanceOnDelivery.toLocaleString('en-IN')} Due at Delivery</strong>
        </div>
      ` : ''}

      ${shiprocketTrackingHtml}
    </div>
  `;
}

window.handleGuestTracking = async function(event) {
  if (event && event.preventDefault) event.preventDefault();
  const orderId = document.getElementById('guestOrderId').value.trim();
  const phone = document.getElementById('guestPhone').value.trim();
  const container = document.getElementById('guestOrderDetailsContainer');

  if (!orderId || !phone) {
    alert("Please fill in both the Order ID and Phone Number.");
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `<div style="text-align:center; padding:16px;">🔍 Searching database for guest order...</div>`;

  try {
    const order = await DbService.getGuestOrder(orderId, phone);
    if (order) {
      container.innerHTML = `
        <h3 style="font-size: 1.05rem; font-weight: 800; color: #0284c7; margin-bottom: 14px; border-bottom: 1.5px solid #bae6fd; padding-bottom: 6px;">📦 Guest Order Status</h3>
        ${generateOrderTrackingHtml(order)}
      `;
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding: 16px; color: #ef4444; font-weight: 700;">
          ❌ No matching order found.<br>
          <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">Please double check your Order ID and Phone Number.</span>
        </div>
      `;
    }
  } catch (err) {
    console.error("Guest tracking error:", err);
    container.innerHTML = `<div style="text-align:center; padding: 16px; color: #ef4444;">Error looking up order. Please try again.</div>`;
  }
};
