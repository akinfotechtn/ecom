document.addEventListener('DOMContentLoaded', () => {
    // Wait for app.js to initialize window.cart
    setTimeout(() => {
        renderCheckoutCart();
    }, 500);
});

// Custom event listener for when cart updates in app.js
window.addEventListener('cartUpdated', () => {
    renderCheckoutCart();
});

function renderCheckoutCart() {
    const container = document.getElementById('checkoutCartItems');
    if (!container) return;

    if (!window.cart || window.cart.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Your cart is empty. <br><br><a href="index.html" style="color: var(--accent-cyan); text-decoration: underline;">Continue Shopping</a></div>';
        updateCheckoutSummary();
        return;
    }

    container.innerHTML = window.cart.map((item, index) => {
        const product = window.allProducts.find(p => p.id === item.productId) || { name: 'Unknown', price: 0, image: 'images/placeholder.webp' };
        
        let originalPrice = Number(product.price);
        let salePrice = product.salePrice ? Number(product.salePrice) : originalPrice;
        
        let priceDisplay = `<div class="checkout-item-price">₹${salePrice.toLocaleString('en-IN')}</div>`;
        if (product.salePrice && Number(product.salePrice) < Number(product.price)) {
            priceDisplay = `
              <div class="checkout-item-price">
                ₹${salePrice.toLocaleString('en-IN')}
                <span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.8rem; font-weight: 400; margin-left: 6px;">₹${originalPrice.toLocaleString('en-IN')}</span>
              </div>
            `;
        }

        return `
            <div class="checkout-item">
                <img src="${product.image}" alt="${product.name}">
                <div class="checkout-item-details">
                    <div class="checkout-item-title">${product.name}</div>
                    ${priceDisplay}
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                        <div style="display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                            <button onclick="updateCartQty(${index}, -1)" style="padding: 4px 10px; background: #f8fafc; border: none; border-right: 1px solid var(--border-color); cursor: pointer;">-</button>
                            <span style="padding: 4px 14px; font-weight: 700; font-size: 0.9rem;">${item.quantity}</span>
                            <button onclick="updateCartQty(${index}, 1)" style="padding: 4px 10px; background: #f8fafc; border: none; border-left: 1px solid var(--border-color); cursor: pointer;">+</button>
                        </div>
                        <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Remove</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateCheckoutSummary();
}

window.updateCartQty = function(index, delta) {
    if (!window.cart[index]) return;
    const newQty = window.cart[index].quantity + delta;
    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }
    window.cart[index].quantity = newQty;
    window.saveCart();
    renderCheckoutCart();
};

window.removeFromCart = function(index) {
    window.cart.splice(index, 1);
    window.saveCart();
    renderCheckoutCart();
};

function updateCheckoutSummary() {
    let subtotal = 0;
    if (window.cart && window.cart.length > 0) {
        window.cart.forEach(item => {
            const p = window.allProducts.find(x => x.id === item.productId);
            if (p) {
                const price = p.salePrice ? Number(p.salePrice) : Number(p.price);
                subtotal += price * item.quantity;
            }
        });
    }

    const elSubtotal = document.getElementById('checkoutSubtotal');
    if (elSubtotal) elSubtotal.innerText = '₹' + subtotal.toLocaleString('en-IN');

    const gst = Math.round(subtotal * 0.18);
    const elGst = document.getElementById('checkoutGst');
    if (elGst) elGst.innerText = '₹' + gst.toLocaleString('en-IN');

    // Promo
    let discount = 0;
    const discountRow = document.getElementById('checkoutDiscountRow');
    const elDiscount = document.getElementById('checkoutDiscount');
    let isFreeDelivery = false;
    
    if (window.appliedCoupon) {
        if (window.appliedCoupon.type === 'PERCENTAGE') {
            discount = Math.floor(subtotal * (window.appliedCoupon.value / 100));
        } else if (window.appliedCoupon.type === 'FLAT') {
            discount = window.appliedCoupon.value;
        } else if (window.appliedCoupon.type === 'FREE_DELIVERY') {
            isFreeDelivery = true;
        }
        
        if (discountRow) discountRow.style.display = 'flex';
        if (elDiscount) elDiscount.innerText = '-₹' + discount.toLocaleString('en-IN');
        
        const msg = document.getElementById('checkoutPromoMsg');
        if (msg) {
            msg.style.display = 'block';
            msg.style.color = '#10b981';
            msg.innerText = 'Coupon applied successfully!';
        }
    } else {
        if (discountRow) discountRow.style.display = 'none';
        const msg = document.getElementById('checkoutPromoMsg');
        if (msg) msg.style.display = 'none';
    }

    let delivery = subtotal > 0 ? 150 : 0;
    if (isFreeDelivery && subtotal > 0) delivery = 0;
    
    const elDelivery = document.getElementById('checkoutDelivery');
    if (elDelivery) {
        if (isFreeDelivery && subtotal > 0) {
            elDelivery.innerHTML = '<div style="color:#ef4444; font-size:0.9rem; line-height: 1.4; margin-top: 4px;">Free Delivery!<br>We will parcel your product in Rathi meena or MSS. You should Pickup from there.</div>';
        } else {
            elDelivery.innerText = '₹' + delivery.toLocaleString('en-IN');
        }
    }

    const grandTotal = subtotal + gst + delivery - discount;
    const elTotal = document.getElementById('checkoutGrandTotal');
    if (elTotal) elTotal.innerText = '₹' + Math.max(0, grandTotal).toLocaleString('en-IN');
}

window.applyCheckoutCoupon = function() {
    const code = document.getElementById('checkoutCouponInput').value.trim().toUpperCase();
    const msg = document.getElementById('checkoutPromoMsg');
    
    if (!code) {
        msg.style.display = 'block';
        msg.style.color = '#ef4444';
        msg.innerText = 'Please enter a coupon code';
        return;
    }
    
    DbService.getCoupons().then(coupons => {
        const coupon = coupons.find(c => c.code.toUpperCase() === code && c.isActive);
        if (!coupon) {
            msg.style.display = 'block';
            msg.style.color = '#ef4444';
            msg.innerText = 'Invalid or expired coupon code';
            window.appliedCoupon = null;
        } else {
            window.appliedCoupon = coupon;
            document.getElementById('checkoutCouponInput').value = '';
        }
        updateCheckoutSummary();
    });
};

window.removePromoCode = function() {
    window.appliedCoupon = null;
    updateCheckoutSummary();
};

window.checkoutWithGoogle = function() {
    window.signInWithGoogle().then(() => {
        document.getElementById('checkoutAuthChoice').style.display = 'none';
        document.getElementById('checkoutFormContainer').style.display = 'block';
        
        // Auto-fill details if user is logged in
        if (window.currentUser) {
            document.getElementById('custName').value = window.currentUser.displayName || '';
            document.getElementById('custPhone').value = window.currentUser.phone || '';
            document.getElementById('custPincode').value = window.currentUser.pincode || '';
            document.getElementById('custAddress').value = window.currentUser.address || '';
        }
    });
};

window.checkoutAsGuest = function() {
    document.getElementById('checkoutAuthChoice').style.display = 'none';
    document.getElementById('checkoutFormContainer').style.display = 'block';
};

window.selectPaymentMethod = function(method) {
    document.getElementById('optOnline').classList.remove('selected');
    document.getElementById('optCOD').classList.remove('selected');
    
    if (method === 'ONLINE') {
        document.getElementById('optOnline').classList.add('selected');
        document.getElementById('codAdvanceBanner').style.display = 'none';
    } else {
        document.getElementById('optCOD').classList.add('selected');
        document.getElementById('codAdvanceBanner').style.display = 'block';
        
        // Calculate balance
        let subtotal = 0;
        if (window.cart && window.cart.length > 0) {
            window.cart.forEach(item => {
                const p = window.allProducts.find(x => x.id === item.productId);
                if (p) {
                    const price = p.salePrice ? Number(p.salePrice) : Number(p.price);
                    subtotal += price * item.quantity;
                }
            });
        }
        const gst = Math.round(subtotal * 0.18);
        let discount = 0;
        let isFreeDelivery = false;
        if (window.appliedCoupon) {
            if (window.appliedCoupon.type === 'PERCENTAGE') discount = Math.floor(subtotal * (window.appliedCoupon.value / 100));
            else if (window.appliedCoupon.type === 'FLAT') discount = window.appliedCoupon.value;
            else if (window.appliedCoupon.type === 'FREE_DELIVERY') isFreeDelivery = true;
        }
        let delivery = subtotal > 0 && !isFreeDelivery ? 150 : 0;
        const grandTotal = Math.max(0, subtotal + gst + delivery - discount);
        
        const balance = Math.max(0, grandTotal - 1000);
        document.getElementById('codBalanceText').innerText = '₹' + balance.toLocaleString('en-IN');
    }
};

document.getElementById('mainCheckoutForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!window.cart || window.cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    const paymentMethod = document.getElementById('optOnline').classList.contains('selected') ? 'ONLINE' : 'COD';
    const isGuest = !window.currentUser;
    
    let subtotal = 0;
    const itemsData = window.cart.map(item => {
        const p = window.allProducts.find(x => x.id === item.productId);
        const price = p ? (p.salePrice ? Number(p.salePrice) : Number(p.price)) : 0;
        subtotal += price * item.quantity;
        return {
            productId: item.productId,
            name: p ? p.name : 'Unknown',
            price: price,
            quantity: item.quantity
        };
    });
    
    const gst = Math.round(subtotal * 0.18);
    let discount = 0;
    if (window.appliedCoupon) {
        if (window.appliedCoupon.type === 'PERCENTAGE') discount = Math.floor(subtotal * (window.appliedCoupon.value / 100));
        else if (window.appliedCoupon.type === 'FLAT') discount = window.appliedCoupon.value;
    }
    let delivery = subtotal > 0 && !(window.appliedCoupon && window.appliedCoupon.type === 'FREE_DELIVERY') ? 150 : 0;
    const grandTotal = Math.max(0, subtotal + gst + delivery - discount);

    const orderData = {
        userId: isGuest ? 'GUEST' : window.currentUser.uid,
        customerInfo: {
            name: document.getElementById('custName').value,
            phone: document.getElementById('custPhone').value,
            pincode: document.getElementById('custPincode').value,
            address: document.getElementById('custAddress').value
        },
        items: itemsData,
        pricing: {
            subtotal,
            gst,
            discount,
            delivery,
            grandTotal,
            couponCode: window.appliedCoupon ? window.appliedCoupon.code : null
        },
        paymentMethod: paymentMethod,
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };
    
    alert('Order placed successfully! In a real app, this would process payment and save to database.');
    window.cart = [];
    window.saveCart();
    window.location.href = DbService.getLinkPrefix() + 'index.html';
});
