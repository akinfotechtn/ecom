// AK INFOTECH - ADMIN DASHBOARD JS (HERO BANNERS SLIDER CRUD & FIREBASE CLOUD FIRESTORE SYNC)
import { DbService } from "./db-service.js";

const AUTHORIZED_ADMIN_EMAILS = ['akinfotecttn@gmail.com', 'akinfotechtn@gmail.com'];

let adminProducts = [];
let adminBrands = [];
let adminCategories = [];
let adminHeroBanners = [];
let adminSettings = {};
let adminOrders = [];
let currentAdminUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupAdminAuthGuard();
  setupEventListeners();
});

// STRICT ADMIN AUTHENTICATION GUARD
function setupAdminAuthGuard() {
  DbService.listenAuthState(async (user) => {
    currentAdminUser = user;
    const gatekeeperEl = document.getElementById('adminGatekeeper');
    const mainPanelEl = document.getElementById('adminMainPanel');
    const msgEl = document.getElementById('gatekeeperStatusMsg');
    const statusLabel = document.getElementById('adminUserStatus');

    if (user && AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      gatekeeperEl.style.display = 'none';
      mainPanelEl.style.display = 'block';

      if (statusLabel) {
        statusLabel.innerHTML = `<span style="color:var(--accent-green);">🟢 Admin: ${escapeHtml(user.email)}</span>`;
      }
      document.getElementById('adminEmailLabel').textContent = user.email;

      await loadAdminData();
    } else {
      gatekeeperEl.style.display = 'block';
      mainPanelEl.style.display = 'none';

      if (statusLabel) {
        statusLabel.innerHTML = `<span style="color:#ef4444;">🔒 Access Denied</span>`;
      }

      if (user) {
        msgEl.innerHTML = `
          <div style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:12px; border-radius:var(--radius-sm); font-size:0.88rem;">
            Signed in as <strong>${escapeHtml(user.email)}</strong> (Unauthorized). Please sign out and sign in with <strong>akinfotecttn@gmail.com</strong>.
          </div>
          <button id="btnGatekeeperLogout" class="pill-btn" style="margin-top:10px; color:#ef4444;">Sign Out Current Account</button>
        `;
        document.getElementById('btnGatekeeperLogout')?.addEventListener('click', async () => {
          await DbService.logoutUser();
        });
      } else {
        msgEl.innerHTML = `<span style="color:var(--text-muted); font-size:0.88rem;">Please sign in using your Google Admin Account.</span>`;
      }
    }
  });

  document.getElementById('btnAdminGoogleLogin')?.addEventListener('click', async () => {
    try {
      await DbService.loginWithGoogle();
    } catch (err) {
      alert(`Google Login Error: ${err.message}`);
    }
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await DbService.logoutUser();
    alert('Admin signed out.');
  });
}

async function loadAdminData() {
  await fetchAdminSettings();
  await fetchAdminHeroBanners();
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

// 1. HERO BANNERS & SLIDER MANAGEMENT (CRUD)
async function fetchAdminHeroBanners() {
  adminHeroBanners = await DbService.getHeroBanners();
  renderHeroBannersList();
}

function renderHeroBannersList() {
  const container = document.getElementById('adminHeroBannersList');
  if (!container) return;

  if (!adminHeroBanners.length) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">No hero slides added yet.</div>`;
    return;
  }

  container.innerHTML = adminHeroBanners.map(h => `
    <div class="hero-banner-card">
      <div style="display:flex; align-items:center; gap:14px; padding:12px; background:#f8fafc; border-bottom:1px solid var(--border-color);">
        <img src="${h.imageUrl || 'images/hero-banner.webp'}" style="width:100px; height:50px; object-fit:cover; border-radius:6px;" onerror="this.src='images/hero-banner.webp'">
        <div style="flex:1;">
          <div style="font-weight:800; font-size:0.95rem; color:var(--text-dark);">${escapeHtml(h.title)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(h.subtitle || '')}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="pill-btn" onclick="editHeroBanner('${h.id}')">✏️ Edit</button>
          <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="deleteHeroBanner('${h.id}')">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function handleAddHeroBanner(e) {
  e.preventDefault();
  const imageUrl = document.getElementById('heroImgUrl').value.trim();
  if (!imageUrl) {
    alert('Please enter a Hero Banner Image URL!');
    return;
  }

  const payload = {
    imageUrl,
    tag: document.getElementById('heroTag').value.trim(),
    title: document.getElementById('heroTitle').value.trim(),
    subtitle: document.getElementById('heroSubtitle').value.trim(),
    btnText: document.getElementById('heroBtnText').value.trim(),
    btnLink: document.getElementById('heroBtnLink').value.trim() || 'javascript:void(0)'
  };

  try {
    await DbService.addHeroBanner(payload);
    document.getElementById('heroBannerForm').reset();
    await fetchAdminHeroBanners();
    alert('✅ New Hero Slide added successfully!');
  } catch (err) {
    alert(`Failed to add hero slide: ${err.message}`);
  }
}

window.editHeroBanner = function(id) {
  const hero = adminHeroBanners.find(h => h.id === id);
  if (!hero) return;

  document.getElementById('editHeroId').value = hero.id;
  document.getElementById('editHeroImgUrl').value = hero.imageUrl || '';
  document.getElementById('editHeroTag').value = hero.tag || '';
  document.getElementById('editHeroTitle').value = hero.title || '';
  document.getElementById('editHeroSubtitle').value = hero.subtitle || '';
  document.getElementById('editHeroBtnText').value = hero.btnText || '';
  document.getElementById('editHeroBtnLink').value = hero.btnLink || '';

  document.getElementById('editHeroModalBackdrop').classList.add('active');
};

window.closeEditHeroModal = function() {
  document.getElementById('editHeroModalBackdrop').classList.remove('active');
};

async function handleSaveHeroEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editHeroId').value;
  const payload = {
    imageUrl: document.getElementById('editHeroImgUrl').value.trim(),
    tag: document.getElementById('editHeroTag').value.trim(),
    title: document.getElementById('editHeroTitle').value.trim(),
    subtitle: document.getElementById('editHeroSubtitle').value.trim(),
    btnText: document.getElementById('editHeroBtnText').value.trim(),
    btnLink: document.getElementById('editHeroBtnLink').value.trim()
  };

  try {
    await DbService.updateHeroBanner(id, payload);
    closeEditHeroModal();
    await fetchAdminHeroBanners();
    alert('✅ Hero Slide updated successfully!');
  } catch (err) {
    alert(`Failed to update hero slide: ${err.message}`);
  }
}

window.deleteHeroBanner = async function(id) {
  if (!confirm('Are you sure you want to delete this hero slide?')) return;
  try {
    await DbService.deleteHeroBanner(id);
    await fetchAdminHeroBanners();
  } catch (err) {
    alert(`Failed to delete hero slide: ${err.message}`);
  }
};

// 2. PURE CLIENT-SIDE GOOGLE SHEETS SYNC & PERSISTENT URL
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

function parseCsvToMatrix(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseCsvTextToProducts(csvText) {
  const matrix = parseCsvToMatrix(csvText);
  if (matrix.length <= 1) throw new Error("CSV contains no data rows.");

  const headers = matrix[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
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
  const deliveryIdx = getColIndex(['delivery', 'shipping', 'fee', 'customdelivery']);

  const parsed = [];
  for (let i = 1; i < matrix.length; i++) {
    const cols = matrix[i];
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

    const rawDelivery = (deliveryIdx !== -1 ? cols[deliveryIdx] : cols[9]) || '';
    const deliveryCharge = (rawDelivery !== '' && !isNaN(rawDelivery)) ? parseFloat(rawDelivery) : null;

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
      isCombo,
      deliveryCharge
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

  await DbService.updateSettings({ googleSheetUrl: urlInput });

  btn.disabled = true;
  statusEl.innerHTML = `<span style="color: var(--accent-cyan);">🔄 Connecting to Google Sheet & parsing data...</span>`;

  try {
    const formattedUrl = normalizeGoogleSheetUrl(urlInput);
    const response = await fetch(formattedUrl);

    if (!response.ok) {
      throw new Error(`Google Sheet request failed (${response.status}). Ensure sheet access is "Anyone with link can view" or "Publish to Web".`);
    }

    const csvText = await response.text();
    const parsedProducts = parseCsvTextToProducts(csvText);

    if (!parsedProducts.length) {
      throw new Error("No valid product rows were found in the Google Sheet.");
    }

    statusEl.innerHTML = `<span style="color: var(--accent-cyan);">💾 Replacing store catalog with ${parsedProducts.length} clean products...</span>`;
    
    await DbService.bulkSyncProducts(parsedProducts, true);
    
    statusEl.innerHTML = `<span style="color: var(--accent-green);">✅ Successfully synced ${parsedProducts.length} products from Google Sheet to Firebase!</span>`;
    await fetchAdminProducts();
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #ef4444;">✕ Sync Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
  }
}

async function saveGoogleSheetUrlOnly() {
  const urlInput = document.getElementById('googleSheetUrlInput').value.trim();
  if (!urlInput) {
    alert('Please enter a Google Sheet URL first!');
    return;
  }

  await DbService.updateSettings({ googleSheetUrl: urlInput });
  alert('✅ Google Sheet URL saved persistently!');
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
    await DbService.bulkSyncProducts(parsed, true);
    alert(`✅ Successfully imported ${parsed.length} products to Firebase!`);
    document.getElementById('rawCsvText').value = '';
    toggleCsvPasteBox();
    await fetchAdminProducts();
  } catch (err) {
    alert(`Import error: ${err.message}`);
  }
}

// 3. BRANDS MANAGEMENT (FULL CRUD: ADD, EDIT, DELETE)
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
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <img src="${b.imageLink || 'images/logo.webp'}" style="height:28px; max-width:50px; object-fit:contain; flex-shrink:0;" onerror="this.src='images/logo.webp'">
        <strong style="font-size:0.88rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(b.name)}</strong>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="pill-btn" style="padding:2px 8px; font-size:0.75rem;" onclick="editBrand('${b.id}')">✏️</button>
        <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:2px 8px; font-size:0.75rem;" onclick="deleteBrand('${b.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function handleAddBrand(e) {
  e.preventDefault();
  const name = document.getElementById('newBrandName').value.trim();
  const imageLink = document.getElementById('newBrandImg').value.trim() || 'images/logo.webp';

  if (!name) return;
  try {
    await DbService.addBrand({ name, imageLink });
    document.getElementById('brandForm').reset();
    await fetchAdminBrands();
    alert(`✅ Brand "${name}" added successfully!`);
  } catch (err) {
    alert(`Brand error: ${err.message}`);
  }
}

window.editBrand = function(id) {
  const brand = adminBrands.find(b => b.id === id);
  if (!brand) return;

  document.getElementById('editBrandId').value = brand.id;
  document.getElementById('editBrandNameInput').value = brand.name;
  document.getElementById('editBrandImgInput').value = brand.imageLink || '';

  document.getElementById('editBrandModalBackdrop').classList.add('active');
};

window.closeEditBrandModal = function() {
  document.getElementById('editBrandModalBackdrop').classList.remove('active');
};

async function handleSaveBrandEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editBrandId').value;
  const name = document.getElementById('editBrandNameInput').value.trim();
  const imageLink = document.getElementById('editBrandImgInput').value.trim() || 'images/logo.webp';

  if (!id || !name) return;
  try {
    await DbService.updateBrand(id, { name, imageLink });
    closeEditBrandModal();
    await fetchAdminBrands();
    alert(`✅ Brand updated successfully!`);
  } catch (err) {
    alert(`Failed to update brand: ${err.message}`);
  }
}

window.deleteBrand = async function(id) {
  if (!confirm('Delete this brand?')) return;
  try {
    await DbService.deleteBrand(id);
    await fetchAdminBrands();
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
};

// 4. CATEGORIES MANAGEMENT (FULL CRUD: ADD, EDIT, DELETE)
async function fetchAdminCategories() {
  adminCategories = await DbService.getCategories();
  renderCategoriesGrid();
  populateDropdowns();
}

function renderCategoriesGrid() {
  const grid = document.getElementById('adminCategoriesGrid');
  if (!grid) return;

  grid.innerHTML = adminCategories.map(c => {
    const feeBadge = (c.deliveryCharge !== undefined && c.deliveryCharge !== null && c.deliveryCharge !== '')
      ? `🚚 ₹${c.deliveryCharge}`
      : `🚚 Default`;

    return `
      <div style="background:#ffffff; border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
          <img src="${c.imageLink || 'images/cctv-wholesale.webp'}" style="width:36px; height:36px; object-fit:cover; border-radius:6px; flex-shrink:0;" onerror="this.src='images/cctv-wholesale.webp'">
          <div style="overflow:hidden;">
            <strong style="font-size:0.88rem; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.name)}</strong>
            <span style="font-size:0.75rem; color:var(--accent-cyan); font-weight:700;">${feeBadge}</span>
          </div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="pill-btn" style="padding:2px 8px; font-size:0.75rem;" onclick="editCategory('${c.id}')">✏️</button>
          <button class="pill-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:2px 8px; font-size:0.75rem;" onclick="deleteCategory('${c.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById('newCatName').value.trim();
  const imageLink = document.getElementById('newCatImg').value.trim() || 'images/cctv-wholesale.webp';
  const devChargeVal = document.getElementById('newCatDeliveryCharge')?.value.trim();
  const deliveryCharge = (devChargeVal !== '' && devChargeVal !== undefined) ? parseFloat(devChargeVal) : null;

  if (!name) return;
  try {
    await DbService.addCategory({ name, imageLink, deliveryCharge });
    document.getElementById('categoryForm').reset();
    await fetchAdminCategories();
    alert(`✅ Category "${name}" added successfully!`);
  } catch (err) {
    alert(`Category error: ${err.message}`);
  }
}

window.editCategory = function(id) {
  const cat = adminCategories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById('editCategoryId').value = cat.id;
  document.getElementById('editCategoryNameInput').value = cat.name;
  document.getElementById('editCategoryImgInput').value = cat.imageLink || '';
  const devEl = document.getElementById('editCategoryDeliveryCharge');
  if (devEl) {
    devEl.value = (cat.deliveryCharge !== undefined && cat.deliveryCharge !== null) ? cat.deliveryCharge : '';
  }

  document.getElementById('editCategoryModalBackdrop').classList.add('active');
};

window.closeEditCategoryModal = function() {
  document.getElementById('editCategoryModalBackdrop').classList.remove('active');
};

async function handleSaveCategoryEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editCategoryId').value;
  const name = document.getElementById('editCategoryNameInput').value.trim();
  const imageLink = document.getElementById('editCategoryImgInput').value.trim() || 'images/cctv-wholesale.webp';
  const devChargeVal = document.getElementById('editCategoryDeliveryCharge')?.value.trim();
  const deliveryCharge = (devChargeVal !== '' && devChargeVal !== undefined) ? parseFloat(devChargeVal) : null;

  if (!id || !name) return;
  try {
    await DbService.updateCategory(id, { name, imageLink, deliveryCharge });
    closeEditCategoryModal();
    await fetchAdminCategories();
    alert(`✅ Category "${name}" updated successfully!`);
  } catch (err) {
    alert(`Failed to update category: ${err.message}`);
  }
}

window.deleteCategory = async function(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await DbService.deleteCategory(id);
    await fetchAdminCategories();
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
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

// 5. PRODUCTS MANAGEMENT (CRUD)
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

let isBulkEditMode = false;

window.toggleBulkEditMode = function() {
  isBulkEditMode = !isBulkEditMode;
  const toolbar = document.getElementById('bulkEditToolbar');
  const stdTable = document.getElementById('standardTableContainer');
  const bulkTable = document.getElementById('bulkTableContainer');
  const btnToggle = document.getElementById('btnToggleBulkEdit');

  if (isBulkEditMode) {
    if (toolbar) toolbar.style.display = 'flex';
    if (stdTable) stdTable.style.display = 'none';
    if (bulkTable) bulkTable.style.display = 'block';
    if (btnToggle) btnToggle.textContent = '❌ Exit Bulk Mode';
    renderBulkEditTable();
  } else {
    if (toolbar) toolbar.style.display = 'none';
    if (stdTable) stdTable.style.display = 'block';
    if (bulkTable) bulkTable.style.display = 'none';
    if (btnToggle) btnToggle.textContent = '📝 Bulk Spreadsheet Edit';
    renderProductsTable();
  }
};

function renderBulkEditTable() {
  const tbody = document.getElementById('bulkProductsTableBody');
  if (!tbody) return;

  if (!adminProducts.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No products available to bulk edit.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminProducts.map(p => `
    <tr data-bulk-id="${p.id}">
      <td>
        <input type="text" class="bulk-photo" value="${escapeHtml(p.photoLink || '')}" style="width:100px; padding:4px 6px; font-size:0.75rem; border:1px solid var(--border-color); border-radius:4px;">
      </td>
      <td>
        <input type="text" class="bulk-name" value="${escapeHtml(p.productName || '')}" style="width:100%; min-width:180px; padding:4px 6px; font-weight:700; border:1px solid var(--border-color); border-radius:4px;">
      </td>
      <td>
        <select class="bulk-brand" style="width:100%; padding:4px; border:1px solid var(--border-color); border-radius:4px;">
          ${adminBrands.map(b => `<option value="${escapeHtml(b.name)}" ${b.name.toLowerCase() === p.brand?.toLowerCase() ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="bulk-category" style="width:100%; padding:4px; border:1px solid var(--border-color); border-radius:4px;">
          ${adminCategories.map(c => `<option value="${escapeHtml(c.name)}" ${c.name.toLowerCase() === p.category?.toLowerCase() ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </td>
      <td>
        <input type="number" class="bulk-price" value="${p.price || 0}" style="width:80px; padding:4px; border:1px solid var(--border-color); border-radius:4px;">
      </td>
      <td>
        <input type="number" class="bulk-selling" value="${p.sellingPrice || 0}" style="width:80px; padding:4px; font-weight:700; color:var(--accent-cyan); border:1px solid var(--border-color); border-radius:4px;">
      </td>
      <td>
        <input type="number" class="bulk-shipping" value="${p.deliveryCharge !== undefined && p.deliveryCharge !== null ? p.deliveryCharge : ''}" placeholder="Default" style="width:80px; padding:4px; border:1px solid var(--border-color); border-radius:4px;">
      </td>
      <td>
        <select class="bulk-stock" style="width:100%; padding:4px; border:1px solid var(--border-color); border-radius:4px;">
          <option value="true" ${p.inStock !== false ? 'selected' : ''}>In Stock</option>
          <option value="false" ${p.inStock === false ? 'selected' : ''}>Out of Stock</option>
        </select>
      </td>
      <td style="text-align:center;">
        <input type="checkbox" class="bulk-combo" ${p.isCombo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
      </td>
      <td>
        <input type="text" class="bulk-spec" value="${escapeHtml(p.productSpec || '')}" style="width:100%; min-width:160px; padding:4px 6px; font-size:0.8rem; border:1px solid var(--border-color); border-radius:4px;">
      </td>
    </tr>
  `).join('');
}

window.saveAllBulkEdits = async function() {
  const rows = document.querySelectorAll('#bulkProductsTableBody tr[data-bulk-id]');
  if (!rows.length) return;

  const updatedProducts = [];

  rows.forEach(tr => {
    const id = tr.getAttribute('data-bulk-id');
    const photoLink = tr.querySelector('.bulk-photo')?.value.trim() || 'images/cctv-wholesale.webp';
    const productName = tr.querySelector('.bulk-name')?.value.trim() || 'Product';
    const brand = tr.querySelector('.bulk-brand')?.value || 'Generic';
    const category = tr.querySelector('.bulk-category')?.value || 'General';
    const price = parseFloat(tr.querySelector('.bulk-price')?.value) || 0;
    const sellingPrice = parseFloat(tr.querySelector('.bulk-selling')?.value) || price;
    const shipVal = tr.querySelector('.bulk-shipping')?.value.trim();
    const deliveryCharge = (shipVal !== '' && shipVal !== undefined) ? parseFloat(shipVal) : null;
    const inStock = tr.querySelector('.bulk-stock')?.value === 'true';
    const isCombo = tr.querySelector('.bulk-combo')?.checked ?? false;
    const productSpec = tr.querySelector('.bulk-spec')?.value.trim() || '';

    updatedProducts.push({
      id,
      productName,
      photoLink,
      brand,
      category,
      price,
      sellingPrice,
      deliveryCharge,
      inStock,
      isCombo,
      productSpec
    });
  });

  const saveBtn = document.querySelector('#bulkEditToolbar button[onclick="saveAllBulkEdits()"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 Saving All Edits...';
  }

  try {
    await DbService.bulkSyncProducts(updatedProducts, true);
    alert(`✅ Successfully saved bulk edits for ${updatedProducts.length} products!`);
    await fetchAdminProducts();
    toggleBulkEditMode();
  } catch (err) {
    alert(`Failed to save bulk edits: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save All Changes';
    }
  }
};

window.openAddProductModal = function() {
  document.getElementById('editProductId').value = '';
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  const devEl = document.getElementById('prodDeliveryCharge');
  if (devEl) devEl.value = '';
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
  const devEl = document.getElementById('prodDeliveryCharge');
  if (devEl) {
    devEl.value = (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : '';
  }

  document.getElementById('productFormModalBackdrop').classList.add('active');
};

window.closeProductModal = function() {
  document.getElementById('productFormModalBackdrop').classList.remove('active');
};

async function saveProductSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editProductId').value;
  const availVal = document.getElementById('prodAvailabilitySelect').value;
  const customDevChargeVal = document.getElementById('prodDeliveryCharge')?.value.trim();

  const payload = {
    productName: document.getElementById('prodName').value.trim(),
    photoLink: document.getElementById('prodPhotoLink').value.trim() || 'images/cctv-wholesale.webp',
    brand: document.getElementById('prodBrandSelect').value,
    category: document.getElementById('prodCategorySelect').value,
    price: parseFloat(document.getElementById('prodPrice').value) || 0,
    sellingPrice: parseFloat(document.getElementById('prodSellingPrice').value) || 0,
    productSpec: document.getElementById('prodSpec').value.trim(),
    isCombo: document.getElementById('prodIsCombo').checked,
    inStock: availVal === 'In stock',
    deliveryCharge: (customDevChargeVal !== '' && customDevChargeVal !== undefined) ? parseFloat(customDevChargeVal) : null
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

window.toggleFreeShippingMinGroup = function(enabled) {
  const minGroup = document.getElementById('freeShippingMinGroup');
  const label = document.getElementById('freeShippingPolicyLabel');
  if (minGroup) {
    minGroup.style.opacity = enabled ? '1' : '0.4';
    minGroup.style.pointerEvents = enabled ? 'auto' : 'none';
  }
  if (label) {
    if (enabled) {
      label.textContent = 'Enable Free Shipping Above Min Order';
      label.style.color = 'var(--accent-green)';
    } else {
      label.textContent = 'Free Shipping Disabled (All Orders Paid Delivery)';
      label.style.color = 'var(--accent-orange)';
    }
  }
};

// 6. SETTINGS MANAGEMENT & PERSISTENCE
async function fetchAdminSettings() {
  try {
    adminSettings = await DbService.getSettings();
    document.getElementById('cfgDeliveryCharge').value = adminSettings.deliveryCharge !== undefined ? adminSettings.deliveryCharge : 150;
    document.getElementById('cfgFreeShippingMin').value = adminSettings.freeShippingMinOrder || 3000;
    document.getElementById('cfgCodAdvanceAmount').value = adminSettings.codAdvanceAmount || 1000;

    const enableFreeChk = document.getElementById('cfgEnableFreeShipping');
    if (enableFreeChk) {
      enableFreeChk.checked = adminSettings.enableFreeShipping !== false;
      toggleFreeShippingMinGroup(enableFreeChk.checked);
    }

    const urlInput = document.getElementById('googleSheetUrlInput');
    if (urlInput && adminSettings.googleSheetUrl) {
      urlInput.value = adminSettings.googleSheetUrl;
    }

    const webhookInput = document.getElementById('googleSheetWebhookUrlInput');
    if (webhookInput && adminSettings.googleSheetWebhookUrl) {
      webhookInput.value = adminSettings.googleSheetWebhookUrl;
    }

    document.getElementById('cfgRzpKeyId').value = adminSettings.razorpay?.keyId || '';
    document.getElementById('cfgRzpKeySecret').value = adminSettings.razorpay?.keySecret || '';
    document.getElementById('cfgSrEmail').value = adminSettings.shiprocket?.email || '';
    document.getElementById('cfgSrPassword').value = adminSettings.shiprocket?.password || '';
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

async function saveStoreSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const enableFreeShipping = document.getElementById('cfgEnableFreeShipping')?.checked ?? true;
  const payload = {
    deliveryCharge: parseFloat(document.getElementById('cfgDeliveryCharge').value),
    enableFreeShipping: enableFreeShipping,
    freeShippingMinOrder: parseFloat(document.getElementById('cfgFreeShippingMin').value) || 3000,
    codAdvanceAmount: parseFloat(document.getElementById('cfgCodAdvanceAmount').value) || 1000,
    googleSheetUrl: document.getElementById('googleSheetUrlInput')?.value.trim() || '',
    googleSheetWebhookUrl: document.getElementById('googleSheetWebhookUrlInput')?.value.trim() || '',
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

window.pushToGoogleSheetWebhook = async function() {
  const webhookUrl = (document.getElementById('googleSheetWebhookUrlInput')?.value || adminSettings.googleSheetWebhookUrl || '').trim();

  if (!webhookUrl) {
    alert('Please enter your Google Apps Script Web App URL first!');
    return;
  }

  if (!adminProducts || !adminProducts.length) {
    alert('No products available to push.');
    return;
  }

  const pushBtn = document.getElementById('btnPushToGoogleSheet');
  if (pushBtn) {
    pushBtn.disabled = true;
    pushBtn.textContent = '🚀 Pushing to Google Sheet...';
  }

  try {
    const cleanProducts = adminProducts.map(p => ({
      photoLink: p.photoLink || '',
      productName: p.productName || '',
      productSpec: p.productSpec || '',
      brand: p.brand || '',
      category: p.category || '',
      price: p.price || 0,
      sellingPrice: p.sellingPrice || 0,
      isCombo: !!p.isCombo,
      inStock: p.inStock !== false,
      deliveryCharge: (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : null
    }));

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ products: cleanProducts })
    });

    await DbService.updateSettings({ googleSheetWebhookUrl: webhookUrl });

    alert(`✅ Successfully pushed ALL ${cleanProducts.length} catalog products directly to your Google Sheet!`);
  } catch (err) {
    alert(`Push error: ${err.message}`);
  } finally {
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = '🚀 Push DIRECT TO Google Sheet';
    }
  }
};

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
};

// 7. ORDERS HISTORY & SHIPROCKET DISPATCH
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
        <select style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 700; font-size: 0.8rem; margin-bottom: 4px;" onchange="updateOrderStatus('${o.id}', this.value)">
          <option value="PROCESSING" ${o.status === 'PROCESSING' ? 'selected' : ''}>⏳ Processing</option>
          <option value="SHIPPED" ${o.status === 'SHIPPED' ? 'selected' : ''}>🚚 Shipped</option>
          <option value="OUT FOR DELIVERY" ${o.status === 'OUT FOR DELIVERY' ? 'selected' : ''}>🚴 Out for Delivery</option>
          <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>✅ Delivered</option>
        </select><br>
        <button class="pill-btn" style="background:#2563eb; color:#fff; font-size:0.75rem; padding:3px 8px;" onclick="shipOrderViaShiprocket('${o.id}')">
          🚚 Create Shiprocket Order
        </button>
      </td>
      <td><small>${new Date(o.createdAt).toLocaleString('en-IN')}</small></td>
    </tr>
  `).join('');
}

window.shipOrderViaShiprocket = async function(orderId) {
  const order = adminOrders.find(o => o.id === orderId);
  if (!order) return;

  const payloadStr = `Order ID: ${order.id}\nCustomer: ${order.customerName}\nPhone: ${order.phone}\nAddress: ${order.address}, ${order.city} - ${order.pincode}\nTotal: ₹${order.finalTotal}`;

  if (confirm(`🚚 Shiprocket Express Dispatch:\n\nCreate shipment for Order #${order.id}?\n\nCustomer: ${order.customerName}\nCity: ${order.city} (${order.pincode})`)) {
    try {
      order.status = 'SHIPPED';
      await DbService.createOrder(order);
      alert(`✅ Shipment created! Order #${order.id} marked as SHIPPED.\n\nOpening Shiprocket Seller Portal to print AWB label...`);
      window.open('https://app.shiprocket.in/orders', '_blank');
      await fetchAdminOrders();
    } catch (err) {
      alert(`Shipment creation notice: ${err.message}`);
    }
  }
};

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

async function generateDynamicSitemap() {
  const statusEl = document.getElementById('syncLogStatus');
  statusEl.innerHTML = `<span style="color: var(--accent-cyan);">📡 Generating dynamic XML sitemap from Firebase products & brands...</span>`;

  try {
    const products = await DbService.getProducts();
    const brands = await DbService.getBrands();
    const today = new Date().toISOString().split('T')[0];
    const baseUrl = 'https://shop.akinfotechcctv.in';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    xml += `  <url><loc>${baseUrl}/index.html</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/account.html</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;

    // Dynamic brand pages
    brands.forEach(b => {
      xml += `  <url><loc>${baseUrl}/brand.html?name=${encodeURIComponent(b.name)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
    });

    // Dynamic product pages
    products.forEach(p => {
      xml += `  <url><loc>${baseUrl}/product.html?id=${encodeURIComponent(p.id)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
    });

    xml += `</urlset>`;

    // Download XML Blob
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusEl.innerHTML = `<span style="color: var(--accent-green);">✅ Successfully generated dynamic sitemap.xml with ${brands.length} brand pages & ${products.length} product pages!</span>`;
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #ef4444;">✕ Sitemap generation failed: ${err.message}</span>`;
  }
}

function setupEventListeners() {
  const btnSync = document.getElementById('btnSyncGoogleSheet');
  if (btnSync) btnSync.addEventListener('click', triggerGoogleSheetSync);

  const btnSaveUrl = document.getElementById('btnSaveSheetLink');
  if (btnSaveUrl) btnSaveUrl.addEventListener('click', saveGoogleSheetUrlOnly);

  const btnUploadCsv = document.getElementById('btnUploadCsv');
  if (btnUploadCsv) btnUploadCsv.addEventListener('click', uploadRawCsv);

  const btnSitemap = document.getElementById('btnGenerateSitemap');
  if (btnSitemap) btnSitemap.addEventListener('click', generateDynamicSitemap);

  const heroBannerForm = document.getElementById('heroBannerForm');
  if (heroBannerForm) heroBannerForm.addEventListener('submit', handleAddHeroBanner);

  const editHeroForm = document.getElementById('editHeroForm');
  if (editHeroForm) editHeroForm.addEventListener('submit', handleSaveHeroEdit);

  const productForm = document.getElementById('productForm');
  if (productForm) productForm.addEventListener('submit', saveProductSubmit);

  const brandForm = document.getElementById('brandForm');
  if (brandForm) brandForm.addEventListener('submit', handleAddBrand);

  const editBrandForm = document.getElementById('editBrandForm');
  if (editBrandForm) editBrandForm.addEventListener('submit', handleSaveBrandEdit);

  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) categoryForm.addEventListener('submit', handleAddCategory);

  const editCategoryForm = document.getElementById('editCategoryForm');
  if (editCategoryForm) editCategoryForm.addEventListener('submit', handleSaveCategoryEdit);

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) settingsForm.addEventListener('submit', saveStoreSettings);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

window.exportProductsToCsv = function() {
  if (!adminProducts || !adminProducts.length) {
    alert('No products available to export.');
    return;
  }

  const headers = ['Product Photo/link', 'Product Name', 'Product Spec', 'Brand', 'Category', 'Price', 'Selling Price', 'Is Combo', 'Availability', 'Custom Delivery Fee'];

  const rows = adminProducts.map(p => {
    return [
      `"${(p.photoLink || '').replace(/"/g, '""')}"`,
      `"${(p.productName || '').replace(/"/g, '""')}"`,
      `"${(p.productSpec || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price || 0,
      p.sellingPrice || 0,
      p.isCombo ? 'TRUE' : 'FALSE',
      p.inStock !== false ? 'In stock' : 'Out of stock',
      (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : ''
    ].join(',');
  });

  const csvText = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ak_infotech_products_catalog_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.restoreFullCatalog = async function() {
  if (!confirm('Restore full 10-product catalog into your store database?')) return;
  try {
    await DbService.resetProductsToDefault();
    alert('✅ Successfully restored full catalog products in database!');
    await fetchAdminProducts();
  } catch (err) {
    alert(`Restore error: ${err.message}`);
  }
};
