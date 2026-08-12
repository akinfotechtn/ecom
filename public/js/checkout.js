/**
 * AK Infotech - Shared Cart/Checkout Logic (v2)
 * Works on both cart.html and checkout.html
 * Cart items are stored as full product objects:
 *   item.id, item.productName, item.photoLink,
 *   item.sellingPrice, item.gstPercent, item.quantity/qty
 */

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getCart() {
    try { return JSON.parse(localStorage.getItem('ak_cart') || '[]'); }
    catch (e) { return []; }
}

/**
 * Save cart ONLY via localStorage. Never call window.saveCart() —
 * that would overwrite with app.js's stale local `cart` variable.
 */
function saveCartData(cartArr) {
    localStorage.setItem('ak_cart', JSON.stringify(cartArr));
    // Also update window.cart reference so other scripts stay in sync
    window.cart = cartArr;
    // Update the badge count on the page
    _updateBadge();
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartArr }));
}

function _updateBadge() {
    const cart = getCart();
    const total = cart.reduce((s, i) => s + getQty(i), 0);
    ['cartCount', 'cartItemCount', 'mobileCartCount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = total;
    });
}

function getSettings() {
    // Use window.storeSettings set by app.js, or sensible defaults
    return window.storeSettings || { deliveryCharge: 150, freeShippingMinOrder: 3000, discountCoupons: [] };
}

function getAppliedCoupon() {
    if (window.appliedCoupon) return window.appliedCoupon;
    try {
        var saved = localStorage.getItem('ak_applied_coupon');
        if (saved) {
            window.appliedCoupon = JSON.parse(saved);
            return window.appliedCoupon;
        }
    } catch (e) {}
    return null;
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

function getItemPrice(item) {
    const base = Number(item.sellingPrice || item.price || 0);
    const gstRate = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '')
        ? Number(item.gstPercent) : 18;
    return base + Math.round((base * gstRate) / 100);
}

function getQty(item) {
    return Number(item.quantity || item.qty || 1);
}

function fmt(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

// ─── RENDER CART ITEMS ───────────────────────────────────────────────────────

function renderCartItems(containerId, editable) {
    // Default editable to true
    if (editable === undefined) editable = true;

    var container = document.getElementById(containerId);
    if (!container) return;

    var cart = getCart();

    if (!cart.length) {
        container.innerHTML =
            '<div style="text-align:center; padding: 60px 20px; color: var(--text-muted);">' +
            '<div style="font-size: 4rem; margin-bottom: 16px; opacity:0.4;">🛒</div>' +
            '<div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">Your cart is empty</div>' +
            '<div style="font-size: 0.9rem; margin-bottom: 24px;">Looks like you haven\'t added anything yet!</div>' +
            '<a href="index.html" style="display:inline-block; background:var(--accent-cyan); color:white; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.95rem;">Browse Products</a>' +
            '</div>';
        renderSummary();
        return;
    }

    var html = '';
    for (var i = 0; i < cart.length; i++) {
        var item = cart[i];
        var qty = getQty(item);
        var unitPrice = getItemPrice(item);
        var total = unitPrice * qty;
        var name = item.productName || item.name || 'Product';
        var img = item.photoLink || item.image || 'images/cctv-wholesale.webp';
        var idx = i; // capture for onclick
        var noteVal = item.notes || item.itemNotes || '';

        var qtyControls = '';
        var noteHtml = '';

        if (editable) {
            qtyControls =
                '<div style="display:flex; align-items:center; gap:0; border:1.5px solid var(--border-color); border-radius:8px; overflow:hidden; width:fit-content;">' +
                '<button onclick="cartChangeQty(' + idx + ', -1)" style="padding:6px 14px; background:#f8fafc; border:none; border-right:1.5px solid var(--border-color); cursor:pointer; font-size:1rem; font-weight:700; color:var(--text-dark);">−</button>' +
                '<span style="padding:6px 18px; font-weight:700; font-size:0.95rem; min-width:20px; text-align:center;">' + qty + '</span>' +
                '<button onclick="cartChangeQty(' + idx + ', 1)" style="padding:6px 14px; background:#f8fafc; border:none; border-left:1.5px solid var(--border-color); cursor:pointer; font-size:1rem; font-weight:700; color:var(--text-dark);">+</button>' +
                '</div>' +
                '<button onclick="cartRemoveItem(' + idx + ')" style="background:none; border:none; color:#ef4444; font-size:0.82rem; font-weight:700; cursor:pointer; padding:4px 8px; border-radius:4px;">✕ Remove</button>';

            noteHtml =
                '<div style="margin-top:10px; width:100%;">' +
                '<input type="text" placeholder="📝 Add instructions/notes (e.g. Lens 2.8mm/3.6mm, Dome/Bullet, color, etc.)..." ' +
                'value="' + escapeHtml(noteVal) + '" ' +
                'onchange="window.cartChangeItemNote(' + idx + ', this.value)" ' +
                'onblur="window.cartChangeItemNote(' + idx + ', this.value)" ' +
                'style="width:100%; padding:7px 10px; font-size:0.82rem; border:1.5px dashed #cbd5e1; border-radius:6px; background:#f8fafc; color:var(--text-dark); box-sizing:border-box;">' +
                '</div>';
        } else {
            qtyControls = '<div style="color:var(--text-muted); font-size:0.85rem;">Qty: ' + qty + '</div>';
            if (noteVal) {
                noteHtml =
                    '<div style="margin-top:6px; font-size:0.8rem; color:#0369a1; background:#f0f9ff; border-left:3px solid #0284c7; padding:4px 8px; border-radius:0 4px 4px 0;">' +
                    '📝 <strong>Note:</strong> ' + escapeHtml(noteVal) +
                    '</div>';
            }
        }

        html +=
            '<div style="display:flex; gap:16px; padding:18px 0; border-bottom:1px solid var(--border-color); align-items:flex-start;">' +
            '<img src="' + img + '" alt="' + name + '" onerror="this.src=\'images/cctv-wholesale.webp\'" ' +
            'style="width:90px; height:90px; object-fit:contain; border:1px solid var(--border-color); border-radius:10px; background:#fafafa; flex-shrink:0;">' +
            '<div style="flex:1; min-width:0;">' +
            '<div style="font-weight:700; font-size:0.97rem; color:var(--text-dark); margin-bottom:6px; line-height:1.4;">' + name + '</div>' +
            '<div style="font-weight:800; font-size:1.05rem; color:var(--accent-cyan); margin-bottom:10px;">' +
            fmt(unitPrice) + ' <span style="color:var(--text-muted); font-size:0.78rem; font-weight:400;">× ' + qty + ' = ' + fmt(total) + '</span>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' + qtyControls + '</div>' +
            noteHtml +
            '</div>' +
            '</div>';
    }

    container.innerHTML = html;
    renderSummary();
}

// ─── CART MUTATIONS (called from onclick in HTML) ────────────────────────────

window.cartChangeItemNote = function (index, noteText) {
    var cart = getCart();
    if (index < 0 || index >= cart.length) return;
    cart[index].notes = (noteText || '').trim();
    cart[index].itemNotes = cart[index].notes;
    saveCartData(cart);
};

window.cartChangeQty = function (index, delta) {
    var cart = getCart();
    if (index < 0 || index >= cart.length) return;
    var newQty = getQty(cart[index]) + delta;
    if (newQty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].quantity = newQty;
        cart[index].qty = newQty;
    }
    saveCartData(cart);
    _refreshAll();
};

window.cartRemoveItem = function (index) {
    var cart = getCart();
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    saveCartData(cart);
    _refreshAll();
};

function _refreshAll() {
    if (document.getElementById('cartItemsContainer')) {
        renderCartItems('cartItemsContainer', true);
        // update label
        var cart = getCart();
        var label = document.getElementById('cartItemCountLabel');
        if (label) label.textContent = cart.length + ' item' + (cart.length !== 1 ? 's' : '');
    }
    if (document.getElementById('checkoutItemsContainer')) {
        renderCartItems('checkoutItemsContainer', false);
    }
    renderSummary();
    renderPromoChipsUI();
    _updateBadge();
}

// ─── SUMMARY ────────────────────────────────────────────────────────────────

function renderSummary() {
    var cart = getCart();
    var settings = getSettings();
    var coupon = getAppliedCoupon();

    var subtotal = 0;
    for (var i = 0; i < cart.length; i++) {
        subtotal += getItemPrice(cart[i]) * getQty(cart[i]);
    }

    // Delivery calculation (Free Shipping via coupon, or Calculated & Payable Upon Delivery)
    var isFreeDelivery = false;
    var promoDiscount = 0;

    if (coupon && subtotal >= (coupon.minOrderAmount || 0)) {
        if (coupon.discountPercent) {
            promoDiscount = Math.round(subtotal * coupon.discountPercent / 100);
        } else if (coupon.discountFlat) {
            promoDiscount = coupon.discountFlat;
        }
        
        const code = String(coupon.code || '').toUpperCase().trim();
        if (coupon.freeDelivery === true || 
            coupon.type === 'FREE_DELIVERY' || 
            coupon.type === 'FREE_SHIPPING' || 
            code === 'SHIP' || 
            code === 'FREESHIP' || 
            code === 'FREESHIPPING' ||
            (!coupon.discountPercent && !coupon.discountFlat)) {
            isFreeDelivery = true;
        }
    }

    var grandTotal = Math.max(0, subtotal - promoDiscount);

    _setEl('summSubtotal', fmt(subtotal));
    _setEl('summTotal', fmt(grandTotal));

    // Update dynamic COD advance rules
    updateCodDisplay(grandTotal, isFreeDelivery);

    // Delivery display
    var delivEl = document.getElementById('summDelivery');
    if (delivEl) {
        if (cart.length === 0) {
            delivEl.textContent = '—';
        } else if (isFreeDelivery) {
            delivEl.innerHTML = '<span style="color:#16a34a; font-size:0.82rem; line-height:1.4; display:block; font-weight:700;">' +
                'You got Free Shipping! Your order will be shipped via Rathimeena or MSS Cargo.<br>' +
                'Kindly pick it up from their nearest local branch.</span>';
        } else {
            delivEl.innerHTML = '<span style="color: #0284c7; font-weight: 800; font-size: 0.8rem;">Calculated & Payable Upon Delivery 🚚</span>' +
                '<small style="display:block; color:var(--text-muted); font-size:0.7rem;">(Freight / Shipping fee collected during delivery)</small>';
        }
    }

    // Promo row
    var promoRow = document.getElementById('summPromoRow');
    var promoAmt = document.getElementById('summPromoAmt');
    if (promoRow) {
        if (promoDiscount > 0) {
            promoRow.style.display = 'flex';
            if (promoAmt) promoAmt.textContent = '−' + fmt(promoDiscount);
        } else {
            promoRow.style.display = 'none';
        }
    }

    var msg = document.getElementById('couponMsg') || document.getElementById('checkoutPromoMsg');
    if (msg) {
        if (coupon) {
            if (subtotal >= (coupon.minOrderAmount || 0)) {
                _couponMsg(msg, '✓ Coupon "' + coupon.code + '" applied!', true);
            } else {
                _couponMsg(msg, 'Coupon "' + coupon.code + '" requires min order of ' + fmt(coupon.minOrderAmount) + '.', false);
            }
        } else if (!msg.innerHTML.includes('Invalid') && !msg.innerHTML.includes('expired') && !msg.innerHTML.includes('enter')) {
            msg.innerHTML = '';
            msg.style.display = 'none';
        }
    }
}

// ─── ADVANCE PAYMENT RULES ───────────────────────────────────────────────────
/**
 * 1. Below ₹1,000 (₹1 to ₹999): Full Payment (100% upfront) -> Advance = Total, Balance = 0
 * 2. ₹1,000 to ₹3,000: Fixed Advance ₹500 -> Advance = 500, Balance = Total - 500
 * 3. ₹3,001 to ₹10,000: Fixed Advance ₹1,000 -> Advance = 1000, Balance = Total - 1000
 * 4. Above ₹10,000 (₹10,001+): 10% of Total Order Value -> Advance = 10% of Total, Balance = Total - Advance
 */
function getCodAdvanceDetails(totalAmount, isFreeDelivery) {
    var total = Math.max(0, Math.round(Number(totalAmount) || 0));
    var suffix = isFreeDelivery ? '' : ' + Courier Extra';

    if (total <= 0) {
        return {
            advance: 0,
            balance: 0,
            subText: '100% Upfront Payment',
            termsAdvanceText: '₹0',
            termsBalanceText: '₹0' + suffix
        };
    }

    // 1. Below ₹1,000 (₹1 to ₹999): Full Payment (100% upfront)
    if (total < 1000) {
        return {
            advance: total,
            balance: 0,
            subText: 'Pay ' + fmt(total) + ' (100% Full Payment)',
            termsAdvanceText: fmt(total) + ' (100% Full Payment)',
            termsBalanceText: '₹0' + suffix
        };
    }

    // 2. ₹1,000 to ₹3,000: Fixed Advance ₹500
    if (total <= 3000) {
        var bal = Math.max(0, total - 500);
        return {
            advance: 500,
            balance: bal,
            subText: 'Pay ₹500 Advance',
            termsAdvanceText: '₹500',
            termsBalanceText: fmt(bal) + suffix
        };
    }

    // 3. ₹3,001 to ₹10,000: Fixed Advance ₹1,000
    if (total <= 10000) {
        var bal = Math.max(0, total - 1000);
        return {
            advance: 1000,
            balance: bal,
            subText: 'Pay ₹1,000 Advance',
            termsAdvanceText: '₹1,000',
            termsBalanceText: fmt(bal) + suffix
        };
    }

    // 4. Above ₹10,000 (₹10,001+): 10% of Total Order Value
    var advance = Math.round(total * 0.10);
    var bal = Math.max(0, total - advance);
    return {
        advance: advance,
        balance: bal,
        subText: 'Pay 10% Advance (' + fmt(advance) + ')',
        termsAdvanceText: fmt(advance) + ' (10%)',
        termsBalanceText: fmt(bal) + suffix
    };
}

function updateCodDisplay(totalAmount, isFreeDelivery) {
    var coupon = getAppliedCoupon();
    var cart = getCart();
    var subtotal = 0;
    for (var i = 0; i < cart.length; i++) {
        subtotal += getItemPrice(cart[i]) * getQty(cart[i]);
    }

    if (coupon && subtotal >= (coupon.minOrderAmount || 0)) {
        const code = String(coupon.code || '').toUpperCase().trim();
        if (coupon.freeDelivery === true || 
            coupon.type === 'FREE_DELIVERY' || 
            coupon.type === 'FREE_SHIPPING' || 
            code === 'SHIP' || 
            code === 'FREESHIP' || 
            code === 'FREESHIPPING' ||
            (!coupon.discountPercent && !coupon.discountFlat)) {
            isFreeDelivery = true;
        }
    }

    var cod = getCodAdvanceDetails(totalAmount, isFreeDelivery);
    var codSub = document.getElementById('codCardSub');
    if (codSub) codSub.textContent = cod.subText;

    var codAdvEl = document.getElementById('codAdvanceText');
    if (codAdvEl) codAdvEl.textContent = cod.termsAdvanceText;

    var codBalEl = document.getElementById('codBalanceText');
    if (codBalEl) codBalEl.textContent = cod.termsBalanceText;
}

window.getCodAdvanceDetails = getCodAdvanceDetails;
window.updateCodDisplay = updateCodDisplay;

function _setEl(id, val) {
    var el = document.getElementById(id);
    if (el && val !== null) el.textContent = val;
}

// ─── COUPON ──────────────────────────────────────────────────────────────────

window.applyCoupon = function () {
    var input = document.getElementById('couponInput') || document.getElementById('checkoutCouponInput');
    var msg = document.getElementById('couponMsg') || document.getElementById('checkoutPromoMsg');
    if (!input || !msg) return;

    var code = input.value.trim().toUpperCase();
    if (!code) { _couponMsg(msg, 'Please enter a coupon code.', false); return; }

    var settings = getSettings();
    var coupons = settings.discountCoupons || [];
    var c = null;
    for (var i = 0; i < coupons.length; i++) {
        if (coupons[i].code.toUpperCase() === code && coupons[i].isActive !== false) {
            c = coupons[i];
            break;
        }
    }

    if (!c) {
        _couponMsg(msg, 'Invalid or expired coupon code.', false);
        window.appliedCoupon = null;
        localStorage.removeItem('ak_applied_coupon');
    } else {
        window.appliedCoupon = c;
        localStorage.setItem('ak_applied_coupon', JSON.stringify(c));
        input.value = '';
        _couponMsg(msg, '✓ Coupon "' + c.code + '" applied!', true);
    }
    renderSummary();
    renderPromoChipsUI();
};

window.removeCoupon = function () {
    window.appliedCoupon = null;
    localStorage.removeItem('ak_applied_coupon');
    var msg = document.getElementById('couponMsg') || document.getElementById('checkoutPromoMsg');
    if (msg) {
        msg.innerHTML = '';
        msg.style.display = 'none';
    }
    renderSummary();
    renderPromoChipsUI();
};

function _couponMsg(el, text, success) {
    if (success) {
        el.innerHTML = text + ' <button onclick="removeCoupon()" style="background:none; border:none; color:#ef4444; font-weight:800; cursor:pointer; font-size:0.75rem; margin-left:8px; padding:2px 6px; background:#fee2e2; border-radius:4px;">✕ Remove</button>';
    } else {
        el.textContent = text;
    }
    el.style.color = success ? '#10b981' : '#ef4444';
    el.style.display = 'block';
}

// ─── PROMO CHIPS (Show in Cart) ───────────────────────────────────────────────

function renderPromoChipsUI() {
    var container = document.getElementById('couponChips');
    if (!container) return;

    var settings = getSettings();
    var coupons = settings.discountCoupons || [];
    
    // Calculate subtotal to check eligibility
    var cart = getCart();
    var subtotal = 0;
    for (var i = 0; i < cart.length; i++) {
        subtotal += getItemPrice(cart[i]) * getQty(cart[i]);
    }

    var visible = [];
    for (var i = 0; i < coupons.length; i++) {
        var c = coupons[i];
        if (c.showInCart && c.isActive !== false && subtotal >= (c.minOrderAmount || 0)) {
            visible.push(c);
        }
    }

    if (!visible.length) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    var html = '';
    for (var j = 0; j < visible.length; j++) {
        var c = visible[j];
        var label = c.discountPercent ? '−' + c.discountPercent + '%'
            : c.discountFlat ? '−₹' + c.discountFlat
            : 'Free Delivery';
        var inputId = document.getElementById('couponInput') ? 'couponInput' : 'checkoutCouponInput';
        var btnClick = 'document.getElementById(\'' + inputId + '\').value=\'' + c.code + '\'; applyCoupon();';
        html += '<button onclick="' + btnClick + '" ' +
            'style="padding:4px 12px; border:1.5px dashed var(--accent-cyan); border-radius:20px; background:#f0f9ff; color:var(--accent-cyan); font-size:0.78rem; font-weight:700; cursor:pointer; margin-right:6px; margin-bottom:6px;">' +
            c.code + ' ' + label + '</button>';
    }
    container.innerHTML = html;
}

// Re-render chips when storeSettings become available (set by app.js)
function _waitForSettings() {
    if (window.storeSettings) {
        renderPromoChipsUI();
        renderSummary();
    } else {
        // Poll until app.js has loaded settings (max 5s)
        var attempts = 0;
        var interval = setInterval(function () {
            attempts++;
            if (window.storeSettings || attempts > 25) {
                clearInterval(interval);
                renderPromoChipsUI();
                renderSummary();
            }
        }, 200);
    }
}

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    // Cart page
    if (document.getElementById('cartItemsContainer')) {
        renderCartItems('cartItemsContainer', true);
        // Update item count label
        var cart = getCart();
        var label = document.getElementById('cartItemCountLabel');
        if (label) label.textContent = cart.length + ' item' + (cart.length !== 1 ? 's' : '');
    }

    // Checkout page (read-only item list in sidebar)
    if (document.getElementById('checkoutItemsContainer')) {
        renderCartItems('checkoutItemsContainer', false);
    }

    _updateBadge();
    renderSummary();
    _waitForSettings();
});
