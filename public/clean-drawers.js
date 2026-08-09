const fs = require('fs');

function removeDrawers(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  const cartDrawerStart = content.indexOf('<!-- BASE CART DRAWER');
  const cartOverlayStart = content.indexOf('<div class="cart-drawer-overlay"');
  const navBottomStart = content.indexOf('<!-- MOBILE BOTTOM NAVIGATION BAR -->') !== -1 
    ? content.indexOf('<!-- MOBILE BOTTOM NAVIGATION BAR -->') 
    : content.indexOf('<!-- MOBILE / BOTTOM NAVIGATION BAR -->');
  
  if (cartDrawerStart !== -1 && navBottomStart !== -1 && cartDrawerStart < navBottomStart) {
    content = content.substring(0, cartDrawerStart) + content.substring(navBottomStart);
    fs.writeFileSync(file, content);
    console.log('Cleaned', file);
  } else if (cartOverlayStart !== -1 && navBottomStart !== -1 && cartOverlayStart < navBottomStart) {
    content = content.substring(0, cartOverlayStart) + content.substring(navBottomStart);
    fs.writeFileSync(file, content);
    console.log('Cleaned', file);
  } else {
    console.log('Could not find markers in', file);
  }
}

['product.html', 'category.html'].forEach(f => {
  if (fs.existsSync(f)) removeDrawers(f);
});
