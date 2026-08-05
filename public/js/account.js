// AK INFOTECH - DEDICATED USER ACCOUNT & ADDRESSES JS
import { DbService } from "./db-service.js";

const AUTHORIZED_ADMIN_EMAILS = ['akinfotecttn@gmail.com', 'akinfotechtn@gmail.com'];

let currentUser = null;
let userAddresses = [];
let userOrders = [];
let cart = JSON.parse(localStorage.getItem('ak_cart') || '[]');

document.addEventListener('DOMContentLoaded', () => {
  setupAuthState();
  setupEventListeners();
  renderCart();
});

function setupAuthState() {
  DbService.listenAuthState(async (user) => {
    currentUser = user;
    const loggedOutGate = document.getElementById('accountLoggedOutGate');
    const dashboard = document.getElementById('accountDashboard');

    if (user) {
      loggedOutGate.style.display = 'none';
      dashboard.style.display = 'block';

      document.getElementById('userAvatarImg').src = user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
      document.getElementById('userDisplayName').textContent = user.displayName || 'Customer Account';
      document.getElementById('userEmailAddress').textContent = user.email;

      const isAdmin = AUTHORIZED_ADMIN_EMAILS.includes((user.email || '').toLowerCase());
      const adminBadgeTag = document.getElementById('adminBadgeTag');
      const adminShortcutBtn = document.getElementById('adminShortcutTabBtn');

      if (isAdmin) {
        adminBadgeTag.innerHTML = `<span class="badge-glow" style="background:#dcfce7; color:#16a34a;">🟢 Authorized Store Admin</span>`;
        adminShortcutBtn.style.display = 'inline-block';
      } else {
        adminBadgeTag.innerHTML = '';
        adminShortcutBtn.style.display = 'none';
      }

      await loadUserOrders(user.uid);
      await loadUserAddresses(user.uid);
    } else {
      loggedOutGate.style.display = 'block';
      dashboard.style.display = 'none';
    }
  });

  document.getElementById('btnGoogleSignIn')?.addEventListener('click', async () => {
    try {
      await DbService.loginWithGoogle();
    } catch (err) {
      alert(`Google Sign-In Notice: ${err.message}`);
    }
  });

  document.getElementById('btnUserLogout')?.addEventListener('click', async () => {
    await DbService.logoutUser();
    alert('Logged out successfully.');
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
  container.innerHTML = `<div style="text-align:center; padding:16px;">Loading your orders...</div>`;

  userOrders = await DbService.getUserOrders(uid);

  if (!userOrders || !userOrders.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
        No orders placed yet.<br>
        <a href="index.html" class="hero-btn" style="margin-top: 14px; display: inline-block;">Browse Catalog</a>
      </div>`;
    return;
  }

  container.innerHTML = userOrders.map(order => {
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

        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">
          📍 <strong>Ship to:</strong> ${escapeHtml(order.customerName)}, ${escapeHtml(order.address)}, ${escapeHtml(order.city)} - ${escapeHtml(order.pincode)}
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

function renderCart() {
  const cartCountEl = document.getElementById('cartCount');
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCountEl) cartCountEl.textContent = totalQty;

  const totalAmt = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const cartFinalTotal = document.getElementById('cartFinalTotal');
  if (cartFinalTotal) cartFinalTotal.textContent = `₹${totalAmt.toLocaleString('en-IN')}`;
}

function setupEventListeners() {
  const addressForm = document.getElementById('addressForm');
  if (addressForm) addressForm.addEventListener('submit', handleAddressSubmit);

  document.getElementById('openCartBtn')?.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartBackdrop')?.classList.add('active');
  });

  document.getElementById('closeCartBtn')?.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartBackdrop')?.classList.remove('active');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
