const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const originalOpenCartDrawer = `window.openCartDrawer = function () {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (!drawer || !backdrop) return;
  drawer.classList.add('open');
  backdrop.classList.add('open');
};`;

const newOpenCartDrawer = `window.openCartDrawer = function () {
  window.location.href = DbService.getLinkPrefix() + 'checkout.html';
};`;

if (code.includes(originalOpenCartDrawer)) {
    code = code.replace(originalOpenCartDrawer, newOpenCartDrawer);
} else {
    // If it's already modified, maybe it has active class instead of open? Let's use regex.
    code = code.replace(/window\.openCartDrawer = function \(\) \{[\s\S]*?backdrop\.classList\.add\('active'\);\n\};/, newOpenCartDrawer);
    code = code.replace(/window\.openCartDrawer = function \(\) \{[\s\S]*?backdrop\.classList\.add\('open'\);\n\};/, newOpenCartDrawer);
}

const updateCartStr = `window.updateCartCount = function () {
  let totalQty = window.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountEl = document.getElementById('cartCount');
  const drawerCountEl = document.getElementById('cartItemCount');
  const mobileCartCountEl = document.getElementById('mobileCartCount');

  if (cartCountEl) cartCountEl.textContent = totalQty;
  if (drawerCountEl) drawerCountEl.textContent = totalQty;
  if (mobileCartCountEl) mobileCartCountEl.textContent = totalQty;
};`;

code = code.replace(/window\.updateCartCount = function \(\) \{[\s\S]*?if \(drawerCountEl\) drawerCountEl\.textContent = totalQty;\n\};/, updateCartStr);

fs.writeFileSync('js/app.js', code);
console.log('Successfully updated app.js');
