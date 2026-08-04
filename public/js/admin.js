// AK INFOTECH - ADMIN DASHBOARD JS (PURE CLIENT-SIDE FIREBASE & GOOGLE SHEETS SYNC)
import { DbService } from "./db-service.js";

let adminProducts = [];
let adminBrands = [];
let adminCategories = [];
let adminSettings = {};
let adminOrders = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadAdminData();
});

async function loadAdminData() {
  await fetchAdminSettings();
  await fetchAdminBrands();
  await fetchAdminCategories();
  await fetchAdminProducts();
  await fetchAdminOrders();
}

window.switchAdminTab = function(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
};

// 1. PURE CLIENT-SIDE GOOGLE SHEETS SYNC (WORKS ON VERCEL, GITHUB PAGES & ANY PORT)
function normalizeGoogleSheetUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  if (cleanUrl.includes('/edit')) {
    cleanUrl = cleanUrl.replace(/\/edit.*$/, '/export?format=csv');
  } else if (cleanUrl.includes('/pubhtml')) {
    cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
  }
  return cleanUrl;
}

function parseCsvTextToProducts(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) throw new Error("CSV contains no data rows.");

  const parseCsvRow = (text) => {
    const p = [];
    let c = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQ && text[i + 1] === '"') {
          c += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        p.push(c.trim());
        c = '';
      } else {
        c += ch;
      }
    }
    p.push(c.trim());
    return p;
  };

  const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  const getColIndex = (aliases) => {
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const photoIdx = getColIndex(['photo', 'image', 'link', 'url']);
  const nameIdx = getColIndex(['name', 'title', 'product']);
  const specIdx = getColIndex(['spec', 'description', 'detail']);
  const brandIdx = getColIndex(['brand', 'manufacturer']);
  const catIdx = getColIndex(['category', 'cat', 'type']);
  const priceIdx = getColIndex(['mrp', 'price']);
  const sellingIdx = getColIndex(['selling', 'offer', 'saleprice', 'sale']);
  const comboIdx = getColIndex(['combo', 'iscombo']);
  const availIdx = getColIndex(['availability', 'stock']);

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    if (!cols.length || !cols.some(c => c)) continue;

    const photoLink = (photoIdx !== -1 ? cols[photoIdx] : cols[0]) || 'images/cctv-wholesale.webp';
    const productName = (nameIdx !== -1 ? cols[nameIdx] : cols[1]) || `Product #${i}`;
    const productSpec = (specIdx !== -1 ? cols[specIdx] : cols[2]) || '';
    const brand = (brandIdx !== -1 ? cols[brandIdx] : cols[3]) || 'Generic';
    const category = (catIdx !== -1 ? cols[catIdx] : cols[4]) || 'General';

    const rawPrice = (priceIdx !== -1 ? cols[priceIdx] : cols[5]) || '0';
    const rawSelling = (sellingIdx !== -1 ? cols[sellingIdx] : cols[6]) || rawPrice;

    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
    const sellingPrice = parseFloat(rawSelling.replace(/[^0-9.]/g, '')) || price;

    const comboVal = ((comboIdx !== -1 ? cols[comboIdx] : cols[7]) || '').toLowerCase();
    const isCombo = comboVal === 'yes' || comboVal === 'true' || comboVal === '1' || category.toLowerCase().includes('combo');

    const availVal = ((availIdx !== -1 ? cols[availIdx] : cols[8]) || '').toLowerCase();
    const inStock = !(availVal.includes('out') || availVal === 'false' || availVal === '0' || availVal === 'no');

    parsed.push({
      id: `gs-${Date.now()}-${i}`,
      photoLink,
      productName,
      productSpec,
      brand,
      category,
      price: price || sellingPrice,
      sellingPrice: sellingPrice || price,
      inStock,
      isCombo
    });
  }

  return parsed;
}

async function triggerGoogleSheetSync() {
  const urlInput = document.getElementById('googleSheetUrlInput').value.trim();
  const statusEl = document.getElementById('syncLogStatus');
  const btn = document.getElementById('btnSyncGoogleSheet');

  if (!urlInput) {
    alert('Please enter a published Google Sheet CSV URL!');
    return;
  }

  btn.disabled = true;
  statusEl.innerHTML = `<span style="color: var(--accent-cyan);">🔄 Connecting to Google Sheet & parsing data...</span>`;

  try {
    const formattedUrl = normalizeGoogleSheetUrl(urlInput);
    const response = await fetch(formattedUrl);

    if (!response.ok) {
      throw new Error(`Google Sheet request failed (${response.status}). Ensure your sheet access is set to "Anyone with the link can view" or "Published to web".`);
    }

    const csvText = await response.text();
    const parsedProducts = parseCsvTextToProducts(csvText);

    if (!parsedProducts.length) {
      throw new Error("No valid product rows were found in the Google Sheet.");
    }

    statusEl.innerHTML = `<span style="color: var(--accent-cyan);">💾 Saving ${parsedProducts.length} products directly to Firebase Cloud Firestore...</span>`;
    
    await DbService.bulkSyncProducts(parsedProducts);
    
    statusEl.innerHTML = `<span style="color: var(--accent-green);">✅ Successfully synced ${parsedProducts.length} products from Google Sheet to Firebase!</span>`;
    await fetchAdminProducts();
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #ef4444;">✕ Sync Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
  }
}

window.toggleCsvPasteBox = function() {
  const box = document.getElementById('csvPasteBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

async function uploadRawCsv() {
  const csvText = document.getElementById('rawCsvText').value.trim();
  if (!csvText) {
    alert('Please paste CSV text first!');
    return;
  }

  try {
    const parsed = parseCsvTextToProducts(csvText);
    await DbService.bulkSyncProducts(parsed);
    alert(`✅ Successfully imported ${parsed.length} products to Firebase!`);
    document.getElementById('rawCsvText').value = '';
    toggleCsvPasteBox();
    await fetchAdminProducts();
  } catch (err) {
    alert(`Import error: ${err.message}`);
  }
}

// 2. BRANDS MANAGEMENT
async function fetchAdminBrands() {
  adminBrands = await DbService.getBrands();
  renderBrandsGrid();
  populateDropdowns();
}

function renderBrandsGrid() {
  const grid = document.getElementById('adminBrandsGrid');
  if (!grid) return;

  grid.innerHTML = adminBrands.map(b => `
    <div style="background:#ffffff; border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${b.imageLink || 'images/logo.webp'}" style="height:28px; max-width:60px; object-fit:contain;" onerror="this.src='images/logo.webp'">
        <strong style="font-size:0.88rem;">${escapeHtml(b.name)}</strong>
      </div>
      <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:2px 8px;" onclick="deleteBrand('${b.id}')">✕</button>
    </div>
  `).join('');
}

async function handleAddBrand(e) {
  e.preventDefault();
  const name = document.getElementById('newBrandName').value.trim();
  const imageLink = document.getElementById('newBrandImg').value.trim() || 'images/logo.webp';

  if (!name) return;
  await DbService.addBrand({ name, imageLink });
  document.getElementById('brandForm').reset();
  await fetchAdminBrands();
  alert(`✅ Brand "${name}" added successfully!`);
}

window.deleteBrand = async function(id) {
  if (!confirm('Delete this brand?')) return;
  await DbService.deleteBrand(id);
  await fetchAdminBrands();
};

// 3. CATEGORIES MANAGEMENT
async function fetchAdminCategories() {
  adminCategories = await DbService.getCategories();
  renderCategoriesGrid();
  populateDropdowns();
}

function renderCategoriesGrid() {
  const grid = document.getElementById('adminCategoriesGrid');
  if (!grid) return;

  grid.innerHTML = adminCategories.map(c => `
    <div style="background:#ffffff; border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${c.imageLink || 'images/cctv-wholesale.webp'}" style="width:32px; height:32px; object-fit:cover; border-radius:4px;" onerror="this.src='images/cctv-wholesale.webp'">
        <strong style="font-size:0.88rem;">${escapeHtml(c.name)}</strong>
      </div>
      <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:2px 8px;" onclick="deleteCategory('${c.id}')">✕</button>
    </div>
  `).join('');
}

async function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById('newCatName').value.trim();
  const imageLink = document.getElementById('newCatImg').value.trim() || 'images/cctv-wholesale.webp';

  if (!name) return;
  await DbService.addCategory({ name, imageLink });
  document.getElementById('categoryForm').reset();
  await fetchAdminCategories();
  alert(`✅ Category "${name}" added successfully!`);
}

window.deleteCategory = async function(id) {
  if (!confirm('Delete this category?')) return;
  await DbService.deleteCategory(id);
  await fetchAdminCategories();
};

function populateDropdowns() {
  const brandSel = document.getElementById('prodBrandSelect');
  const catSel = document.getElementById('prodCategorySelect');

  if (brandSel) {
    brandSel.innerHTML = adminBrands.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join('');
  }
  if (catSel) {
    catSel.innerHTML = adminCategories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  }
}

// 4. PRODUCTS MANAGEMENT (CRUD)
async function fetchAdminProducts() {
  try {
    adminProducts = await DbService.getProducts();
    renderProductsTable();
  } catch (err) {
    console.error('Failed to load products table:', err);
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  if (!adminProducts.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">No products in store. Add or sync products from Google Sheets.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminProducts.map(p => `
    <tr>
      <td><img src="${p.photoLink}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px;" onerror="this.src='images/cctv-wholesale.webp'"></td>
      <td><strong><a href="product.html?id=${p.id}" target="_blank" style="color:var(--accent-cyan);">${escapeHtml(p.productName)}</a></strong></td>
      <td><span class="badge-glow">${escapeHtml(p.brand)}</span></td>
      <td>${escapeHtml(p.category)}</td>
      <td>₹${p.price?.toLocaleString('en-IN')}</td>
      <td style="color:var(--accent-cyan); font-weight:800;">₹${p.sellingPrice?.toLocaleString('en-IN')}</td>
      <td>${p.isCombo ? '<span style="color:var(--accent-orange); font-weight:800;">🔥 YES</span>' : 'No'}</td>
      <td>
        ${p.inStock !== false ? `
          <span style="background:#dcfce7; color:#16a34a; padding:2px 8px; border-radius:10px; font-weight:800; font-size:0.75rem;">In stock</span>
        ` : `
          <span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:10px; font-weight:800; font-size:0.75rem;">Out of stock</span>
        `}
      </td>
      <td>
        <button class="pill-btn" onclick="editProduct('${p.id}')">✏️ Edit</button>
        <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

window.openAddProductModal = function() {
  document.getElementById('editProductId').value = '';
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  populateDropdowns();
  document.getElementById('productFormModalBackdrop').classList.add('active');
};

window.editProduct = function(id) {
  const p = adminProducts.find(item => item.id === id);
  if (!p) return;

  populateDropdowns();
  document.getElementById('editProductId').value = p.id;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('prodName').value = p.productName;
  document.getElementById('prodPhotoLink').value = p.photoLink;
  document.getElementById('prodBrandSelect').value = p.brand;
  document.getElementById('prodCategorySelect').value = p.category;
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodSellingPrice').value = p.sellingPrice;
  document.getElementById('prodAvailabilitySelect').value = p.inStock !== false ? 'In stock' : 'Out of stock';
  document.getElementById('prodSpec').value = p.productSpec;
  document.getElementById('prodIsCombo').checked = p.isCombo || false;

  document.getElementById('productFormModalBackdrop').classList.add('active');
};

window.closeProductModal = function() {
  document.getElementById('productFormModalBackdrop').classList.remove('active');
};

async function saveProductSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editProductId').value;
  const availVal = document.getElementById('prodAvailabilitySelect').value;

  const payload = {
    productName: document.getElementById('prodName').value.trim(),
    photoLink: document.getElementById('prodPhotoLink').value.trim() || 'images/cctv-wholesale.webp',
    brand: document.getElementById('prodBrandSelect').value,
    category: document.getElementById('prodCategorySelect').value,
    price: parseFloat(document.getElementById('prodPrice').value) || 0,
    sellingPrice: parseFloat(document.getElementById('prodSellingPrice').value) || 0,
    productSpec: document.getElementById('prodSpec').value.trim(),
    isCombo: document.getElementById('prodIsCombo').checked,
    inStock: availVal === 'In stock'
  };

  try {
    if (id) {
      await DbService.updateProduct(id, payload);
      alert('✅ Product updated successfully!');
    } else {
      await DbService.addProduct(payload);
      alert('✅ Product added successfully!');
    }
    closeProductModal();
    await fetchAdminProducts();
  } catch (err) {
    alert(`Failed to save product: ${err.message}`);
  }
}

window.deleteProduct = async function(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await DbService.deleteProduct(id);
    await fetchAdminProducts();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
};

// 5. SETTINGS MANAGEMENT
async function fetchAdminSettings() {
  try {
    adminSettings = await DbService.getSettings();
    document.getElementById('cfgDeliveryCharge').value = adminSettings.deliveryCharge || 150;
    document.getElementById('cfgFreeShippingMin').value = adminSettings.freeShippingMinOrder || 3000;
    document.getElementById('cfgCodAdvanceAmount').value = adminSettings.codAdvanceAmount || 1000;
    document.getElementById('googleSheetUrlInput').value = adminSettings.googleSheetUrl || '';
    document.getElementById('cfgRzpKeyId').value = adminSettings.razorpay?.keyId || '';
    document.getElementById('cfgRzpKeySecret').value = adminSettings.razorpay?.keySecret || '';
    document.getElementById('cfgSrEmail').value = adminSettings.shiprocket?.email || '';
    document.getElementById('cfgSrPassword').value = adminSettings.shiprocket?.password || '';
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

async function saveStoreSettings(e) {
  e.preventDefault();
  const payload = {
    deliveryCharge: parseFloat(document.getElementById('cfgDeliveryCharge').value),
    freeShippingMinOrder: parseFloat(document.getElementById('cfgFreeShippingMin').value),
    codAdvanceAmount: parseFloat(document.getElementById('cfgCodAdvanceAmount').value) || 1000,
    googleSheetUrl: document.getElementById('googleSheetUrlInput').value.trim(),
    razorpay: {
      keyId: document.getElementById('cfgRzpKeyId').value.trim(),
      keySecret: document.getElementById('cfgRzpKeySecret').value.trim()
    },
    shiprocket: {
      email: document.getElementById('cfgSrEmail').value.trim(),
      password: document.getElementById('cfgSrPassword').value.trim()
    }
  };

  try {
    await DbService.updateSettings(payload);
    alert('✅ Store settings saved to Firebase Cloud Firestore successfully!');
    adminSettings = payload;
  } catch (err) {
    alert(`Error saving settings: ${err.message}`);
  }
}

// 6. ORDERS HISTORY
async function fetchAdminOrders() {
  try {
    adminOrders = await DbService.getOrders();
    renderOrdersTable();
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  if (!adminOrders.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminOrders.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${escapeHtml(o.customerName)}</td>
      <td>${escapeHtml(o.phone)}<br><small style="color:var(--text-muted);">${escapeHtml(o.city)}, ${escapeHtml(o.pincode)}</small></td>
      <td>
        <span class="status-badge ${o.paymentMethod === 'COD' ? 'status-cod' : 'status-online'}">
          ${o.paymentMethod === 'COD' ? '💵 COD (Advance Paid)' : '💳 100% Online'}
        </span>
      </td>
      <td>
        Total: <strong>₹${o.finalTotal?.toLocaleString('en-IN')}</strong><br>
        <small style="color:var(--accent-cyan);">Paid: ₹${o.advancePaid?.toLocaleString('en-IN')}</small> |
        <small style="color:var(--accent-orange);">Due at Delivery: ₹${o.balanceOnDelivery?.toLocaleString('en-IN')}</small>
      </td>
      <td>
        <select style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 700; font-size: 0.8rem;" onchange="updateOrderStatus('${o.id}', this.value)">
          <option value="PROCESSING" ${o.status === 'PROCESSING' ? 'selected' : ''}>⏳ Processing</option>
          <option value="SHIPPED" ${o.status === 'SHIPPED' ? 'selected' : ''}>🚚 Shipped</option>
          <option value="OUT FOR DELIVERY" ${o.status === 'OUT FOR DELIVERY' ? 'selected' : ''}>🚴 Out for Delivery</option>
          <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>✅ Delivered</option>
        </select>
      </td>
      <td><small>${new Date(o.createdAt).toLocaleString('en-IN')}</small></td>
    </tr>
  `).join('');
}

window.updateOrderStatus = async function(orderId, newStatus) {
  try {
    const order = adminOrders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
      await DbService.createOrder(order);
      alert(`Order #${orderId} status updated to: ${newStatus}`);
    }
  } catch (err) {
    alert(`Failed to update status: ${err.message}`);
  }
};

function setupEventListeners() {
  const btnSync = document.getElementById('btnSyncGoogleSheet');
  if (btnSync) btnSync.addEventListener('click', triggerGoogleSheetSync);

  const btnUploadCsv = document.getElementById('btnUploadCsv');
  if (btnUploadCsv) btnUploadCsv.addEventListener('click', uploadRawCsv);

  const productForm = document.getElementById('productForm');
  if (productForm) productForm.addEventListener('submit', saveProductSubmit);

  const brandForm = document.getElementById('brandForm');
  if (brandForm) brandForm.addEventListener('submit', handleAddBrand);

  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) categoryForm.addEventListener('submit', handleAddCategory);

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) settingsForm.addEventListener('submit', saveStoreSettings);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
