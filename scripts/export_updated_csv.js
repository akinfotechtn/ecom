const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '../public/data/products.json');
const OUTPUT_CSV = path.join(__dirname, '../public/data/ak_products_catalog_updated.csv');

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

const headers = ['Product Photo/link', 'Product Name', 'Product Spec', 'Brand', 'Category', 'Price', 'Selling Price', 'Dealer Extra Margin %', 'Is Combo', 'Availability', 'Custom Delivery Fee'];

const rows = products.map(p => {
  const photo = (p.photoLink || '').replace(/"/g, '""');
  const name = (p.productName || '').replace(/"/g, '""');
  const spec = (p.productSpec || '').replace(/"/g, '""');
  const brand = (p.brand || '').replace(/"/g, '""');
  const cat = (p.category || '').replace(/"/g, '""');
  const price = p.price || 0;
  const selling = p.baseSellingPrice || p.sellingPrice || 0;
  const margin = (p.dealerMarginPercent !== undefined && p.dealerMarginPercent !== null && p.dealerMarginPercent !== '') ? `${p.dealerMarginPercent}%` : '0%';
  const isCombo = p.isCombo ? 'TRUE' : 'FALSE';
  const inStock = p.inStock !== false ? 'In stock' : 'Out of stock';
  const fee = (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : '';

  return `"${photo}","${name}","${spec}","${brand}","${cat}",${price},${selling},"${margin}",${isCombo},"${inStock}","${fee}"`;
});

const csvContent = [headers.join(','), ...rows].join('\n');
fs.writeFileSync(OUTPUT_CSV, csvContent, 'utf8');

console.log(`✅ CSV generated successfully at: ${OUTPUT_CSV}`);
console.log(`Total Products: ${products.length}`);
