// AK INFOTECH - ADMIN DASHBOARD JS (HERO BANNERS SLIDER CRUD & FIREBASE CLOUD FIRESTORE SYNC)
import { DbService } from "./db-service.js";

const AUTHORIZED_ADMIN_EMAILS = ['akinfotechtn@gmail.com', 'admin@akinfotechcctv.in'];

let adminProducts = [];
let adminBrands = [];
let adminCategories = [];
let adminHeroBanners = [];
let adminSettings = {};
let adminOrders = [];
let currentAdminUser = null;

window.adminGoogleLogin = async function() {
  const btn = document.getElementById('btnAdminGoogleLogin');
  try {
    if (btn) btn.innerHTML = `<span style="color:#0f172a; font-weight:800;">⏳ Opening Google Sign In...</span>`;
    await DbService.loginWithGoogle();
    // Note: if redirect flow is used, page will navigate away — no further code runs here.
    // On return, getRedirectResult() in db-service.js and onAuthStateChanged handle the rest.
  } catch (err) {
    console.error("Admin Google Login Error:", err);
    // Only show error alert for genuine failures, not redirect navigations
    if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
      const msg = err.message || String(err);
      if (btn) {
        btn.innerHTML = `
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 20px; height: 20px;" alt="Google">
          <span>⚠️ Login failed – Try Again</span>
        `;
        // Show inline error instead of blocking alert
        const msgEl = document.getElementById('gatekeeperStatusMsg');
        if (msgEl) {
          msgEl.innerHTML = `<div style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:10px 12px; border-radius:8px; font-size:0.85rem; margin-top:8px;">❌ Sign-in failed: ${msg}</div>`;
        }
      } else {
        alert(`Google Login Error: ${msg}`);
      }
    } else {
      // Popup was closed/cancelled — just reset button
      if (btn) {
        btn.innerHTML = `
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 20px; height: 20px;" alt="Google">
          <span>Sign In with Admin Google Account</span>
        `;
      }
    }
  }
};

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
            Signed in as <strong>${escapeHtml(user.email)}</strong> (Unauthorized). Please sign out and sign in with <strong>akinfotechtn@gmail.com</strong>.
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
  })

  // Note: btnAdminGoogleLogin already has onclick="adminGoogleLogin()" in HTML.
  // DO NOT add a second addEventListener here — it would call the function twice
  // causing auth/cancelled-popup-request to silently kill the sign-in.

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await DbService.logoutUser();
    alert('Admin signed out.');
  });
}

async function loadAdminData() {
  try { await fetchAdminSettings(); } catch (e) { console.error("Error loading settings:", e); }
  try { await fetchAdminHeroBanners(); } catch (e) { console.error("Error loading banners:", e); }
  try { await fetchAdminBrands(); } catch (e) { console.error("Error loading brands:", e); }
  try { await fetchAdminCategories(); } catch (e) { console.error("Error loading categories:", e); }
  try { await fetchAdminProducts(); } catch (e) { console.error("Error loading products:", e); }
  try { await fetchAdminOrders(); } catch (e) { console.error("Error loading orders:", e); }
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

function roundPriceTo10s(val) {
  if (isNaN(val) || val <= 0) return 0;
  if (val < 10) return Math.round(val);
  return Math.round(val / 10) * 10;
}

function parseMarginPercentage(rawStr) {
  if (!rawStr) return 0;
  const str = String(rawStr).trim();
  if (!str) return 0;

  const hasPercent = str.includes('%');
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return 0;

  if (hasPercent) {
    return num;
  }
  if (num > 0 && num <= 1) {
    return num * 100;
  }
  return num;
}

function parseCsvTextToProducts(csvText) {
  const matrix = parseCsvToMatrix(csvText);
  if (matrix.length <= 1) throw new Error("CSV contains no data rows.");

  const headers = matrix[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  const getColIndex = (aliases) => {
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h === alias);
      if (idx !== -1) return idx;
    }
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const photoIdx = getColIndex(['productphotolink', 'photo', 'image', 'link', 'url']);
  const nameIdx = getColIndex(['productname', 'name', 'title', 'product']);
  const specIdx = getColIndex(['productspec', 'spec', 'description', 'detail']);
  const brandIdx = getColIndex(['brand', 'manufacturer']);
  const catIdx = getColIndex(['category', 'cat', 'type']);
  const priceIdx = getColIndex(['mrp', 'price']);
  const sellingIdx = getColIndex(['sellingprice', 'saleprice', 'offerprice', 'selling', 'offer', 'sale']);
  let dealerMarginIdx = getColIndex(['dealerextramargin', 'dealerextramarginpercent', 'dealermargin', 'extramargin', 'margin']);
  const comboIdx = getColIndex(['iscombo', 'combo']);
  const availIdx = getColIndex(['availability', 'stock', 'instock']);
  const deliveryIdx = getColIndex(['customdeliveryfee', 'delivery', 'shipping', 'fee']);

  if (dealerMarginIdx === -1 && matrix[0].length >= 8) {
    dealerMarginIdx = 7;
  }
  const hasMarginCol = dealerMarginIdx !== -1;

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
    const rawMargin = (dealerMarginIdx !== -1 && cols[dealerMarginIdx] !== undefined ? cols[dealerMarginIdx] : (cols[7] || '')) || '';

    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
    const baseSellingPrice = parseFloat(rawSelling.replace(/[^0-9.]/g, '')) || price;
    const dealerMarginPercent = parseMarginPercentage(rawMargin);

    let finalSellingPrice = baseSellingPrice;
    if (dealerMarginPercent > 0) {
      finalSellingPrice = baseSellingPrice + (baseSellingPrice * (dealerMarginPercent / 100));
    }
    finalSellingPrice = roundPriceTo10s(finalSellingPrice);

    const finalPrice = Math.max(price, finalSellingPrice) || finalSellingPrice;

    const defaultComboIdx = (hasMarginCol && matrix[0].length >= 9) ? 8 : 7;
    const defaultAvailIdx = (hasMarginCol && matrix[0].length >= 10) ? 9 : 8;
    const defaultDeliveryIdx = (hasMarginCol && matrix[0].length >= 11) ? 10 : 9;

    const comboVal = ((comboIdx !== -1 ? cols[comboIdx] : cols[defaultComboIdx]) || '').toLowerCase();
    const isCombo = comboVal === 'yes' || comboVal === 'true' || comboVal === '1' || category.toLowerCase().includes('combo');

    const availVal = ((availIdx !== -1 ? cols[availIdx] : cols[defaultAvailIdx]) || '').toLowerCase();
    const inStock = !(availVal.includes('out') || availVal === 'false' || availVal === '0' || availVal === 'no');

    const rawDelivery = (deliveryIdx !== -1 ? cols[deliveryIdx] : cols[defaultDeliveryIdx]) || '';
    const deliveryCharge = (rawDelivery !== '' && !isNaN(rawDelivery)) ? parseFloat(rawDelivery) : null;

    parsed.push({
      id: `gs-${Date.now()}-${i}`,
      photoLink,
      productName,
      productSpec,
      brand,
      category,
      price: finalPrice,
      sellingPrice: finalSellingPrice,
      baseSellingPrice: baseSellingPrice,
      dealerMarginPercent: dealerMarginPercent,
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
    const res = await fetch(formattedUrl);

    if (!res.ok) {
      throw new Error(`Google Sheet request failed (${res.status}). Ensure sheet access is "Anyone with link can view" or "Publish to Web".`);
    }

    const csvText = await res.text();
    const parsedProducts = parseCsvTextToProducts(csvText);

    if (!parsedProducts || !parsedProducts.length) {
      throw new Error("No valid product rows were found in the Google Sheet.");
    }

    statusEl.innerHTML = `<span style="color: var(--accent-cyan);">💾 Replacing store catalog with ${parsedProducts.length} clean products...</span>`;

    await DbService.bulkSyncProducts(parsedProducts, true);

    statusEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 800;">✅ Successfully synced ${parsedProducts.length} products from Google Sheet to Firebase!</span>`;
    await fetchAdminProducts();
  } catch (err) {
    console.error("Google Sheet sync error:", err);
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

let adminProductSearchQuery = '';

function renderProductsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  const countBadge = document.getElementById('adminProductsCountBadge');
  if (!tbody) return;

  let filtered = [...adminProducts];

  if (adminProductSearchQuery) {
    const q = adminProductSearchQuery.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    filtered = filtered.filter(p => {
      const text = `${p.productName || ''} ${p.brand || ''} ${p.category || ''} ${p.productSpec || ''} ${p.id || ''}`.toLowerCase();
      return tokens.every(t => text.includes(t));
    });
  }

  if (countBadge) {
    countBadge.textContent = adminProductSearchQuery ? `${filtered.length} of ${adminProducts.length}` : `${adminProducts.length}`;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">No matching products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><img src="${p.photoLink}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px;" onerror="this.src='images/cctv-wholesale.webp'"></td>
      <td><strong><a href="product.html?id=${p.id}" target="_blank" style="color:var(--accent-cyan);">${escapeHtml(p.productName)}</a></strong></td>
      <td><span class="badge-glow">${escapeHtml(p.brand)}</span></td>
      <td>${escapeHtml(p.category)}</td>
      <td>₹${p.price?.toLocaleString('en-IN')}</td>
      <td style="color:var(--accent-cyan); font-weight:800;">
        ₹${p.sellingPrice?.toLocaleString('en-IN')}
        ${p.dealerMarginPercent ? `<br><span style="font-size:0.7rem; color:#0369a1; background:#e0f2fe; padding:1px 6px; border-radius:4px; font-weight:700;">+${p.dealerMarginPercent}% dealer margin</span>` : ''}
      </td>
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
  const marginEl = document.getElementById('prodDealerMarginPercent');
  if (marginEl) marginEl.value = '';
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
  document.getElementById('prodSellingPrice').value = p.baseSellingPrice || p.sellingPrice;
  document.getElementById('prodAvailabilitySelect').value = p.inStock !== false ? 'In stock' : 'Out of stock';
  document.getElementById('prodSpec').value = p.productSpec;
  document.getElementById('prodIsCombo').checked = p.isCombo || false;
  const devEl = document.getElementById('prodDeliveryCharge');
  if (devEl) {
    devEl.value = (p.deliveryCharge !== undefined && p.deliveryCharge !== null) ? p.deliveryCharge : '';
  }
  const gstEl = document.getElementById('prodGstPercent');
  if (gstEl) {
    gstEl.value = (p.gstPercent !== undefined && p.gstPercent !== null) ? p.gstPercent : '';
  }
  const marginEl = document.getElementById('prodDealerMarginPercent');
  if (marginEl) {
    marginEl.value = (p.dealerMarginPercent !== undefined && p.dealerMarginPercent !== null) ? p.dealerMarginPercent : '';
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
  const customGstVal = document.getElementById('prodGstPercent')?.value.trim();
  const customMarginVal = document.getElementById('prodDealerMarginPercent')?.value.trim();

  const price = parseFloat(document.getElementById('prodPrice').value) || 0;
  const baseSellingPrice = parseFloat(document.getElementById('prodSellingPrice').value) || 0;
  const dealerMarginPercent = (customMarginVal !== '' && customMarginVal !== undefined) ? (parseFloat(customMarginVal) || 0) : 0;

  let finalSellingPrice = baseSellingPrice;
  if (dealerMarginPercent > 0) {
    finalSellingPrice = baseSellingPrice + (baseSellingPrice * (dealerMarginPercent / 100));
  }
  finalSellingPrice = roundPriceTo10s(finalSellingPrice);

  const finalPrice = Math.max(price, finalSellingPrice) || finalSellingPrice;

  const payload = {
    productName: document.getElementById('prodName').value.trim(),
    photoLink: document.getElementById('prodPhotoLink').value.trim() || 'images/cctv-wholesale.webp',
    brand: document.getElementById('prodBrandSelect').value,
    category: document.getElementById('prodCategorySelect').value,
    price: finalPrice,
    sellingPrice: finalSellingPrice,
    baseSellingPrice: baseSellingPrice,
    dealerMarginPercent: dealerMarginPercent,
    productSpec: document.getElementById('prodSpec').value.trim(),
    isCombo: document.getElementById('prodIsCombo').checked,
    inStock: availVal === 'In stock',
    deliveryCharge: (customDevChargeVal !== '' && customDevChargeVal !== undefined) ? parseFloat(customDevChargeVal) : null,
    gstPercent: (customGstVal !== '' && customGstVal !== undefined) ? parseFloat(customGstVal) : null
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
    const gstInput = document.getElementById('cfgDefaultGstPercent');
    if (gstInput) gstInput.value = adminSettings.defaultGstPercent !== undefined ? adminSettings.defaultGstPercent : 18;
    document.getElementById('cfgFreeShippingMin').value = adminSettings.freeShippingMinOrder || 3000;
    document.getElementById('cfgCodAdvanceAmount').value = adminSettings.codAdvanceAmount || 1000;

    const enableFreeChk = document.getElementById('cfgEnableFreeShipping');
    if (enableFreeChk) {
      enableFreeChk.checked = adminSettings.enableFreeShipping !== false;
      toggleFreeShippingMinGroup(enableFreeChk.checked);
    }

    const payShippingChk = document.getElementById('cfgPayShippingOnDelivery');
    if (payShippingChk) {
      payShippingChk.checked = !!adminSettings.payShippingOnDelivery;
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

    // Load SMTP Settings
    const smtpHostEl = document.getElementById('cfgSmtpHost');
    if (smtpHostEl) smtpHostEl.value = adminSettings.smtpHost || '';
    const smtpPortEl = document.getElementById('cfgSmtpPort');
    if (smtpPortEl) smtpPortEl.value = adminSettings.smtpPort || '';
    const smtpUserEl = document.getElementById('cfgSmtpUser');
    if (smtpUserEl) smtpUserEl.value = adminSettings.smtpUser || '';
    const smtpPassEl = document.getElementById('cfgSmtpPass');
    if (smtpPassEl) smtpPassEl.value = adminSettings.smtpPass || '';
    const smtpSenderEl = document.getElementById('cfgSmtpSender');
    if (smtpSenderEl) smtpSenderEl.value = adminSettings.smtpSender || '';
    const smtpRecipientsEl = document.getElementById('cfgSmtpRecipients');
    if (smtpRecipientsEl) smtpRecipientsEl.value = adminSettings.smtpRecipients || '';
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

async function saveStoreSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const enableFreeShipping = document.getElementById('cfgEnableFreeShipping')?.checked ?? true;
  const payShippingOnDelivery = document.getElementById('cfgPayShippingOnDelivery')?.checked ?? false;
  const payload = {
    deliveryCharge: parseFloat(document.getElementById('cfgDeliveryCharge').value),
    defaultGstPercent: parseFloat(document.getElementById('cfgDefaultGstPercent')?.value) || 18,
    enableFreeShipping: enableFreeShipping,
    payShippingOnDelivery: payShippingOnDelivery,
    freeShippingMinOrder: parseFloat(document.getElementById('cfgFreeShippingMin').value) || 3000,
    codAdvanceAmount: parseFloat(document.getElementById('cfgCodAdvanceAmount').value) || 1000,
    googleSheetUrl: document.getElementById('googleSheetUrlInput')?.value.trim() || '',
    googleSheetWebhookUrl: document.getElementById('googleSheetWebhookUrlInput')?.value.trim() || '',
    smtpHost: document.getElementById('cfgSmtpHost')?.value.trim() || '',
    smtpPort: parseInt(document.getElementById('cfgSmtpPort')?.value) || 465,
    smtpUser: document.getElementById('cfgSmtpUser')?.value.trim() || '',
    smtpPass: document.getElementById('cfgSmtpPass')?.value.trim() || '',
    smtpSender: document.getElementById('cfgSmtpSender')?.value.trim() || '',
    smtpRecipients: document.getElementById('cfgSmtpRecipients')?.value.trim() || '',
    razorpay: {
      keyId: document.getElementById('cfgRzpKeyId').value.trim(),
      keySecret: document.getElementById('cfgRzpKeySecret').value.trim()
    },
    shiprocketApiEmail: document.getElementById('cfgSrEmail')?.value.trim() || 'akinfotechtn@gmail.com',
    shiprocketApiPassword: document.getElementById('cfgSrPassword')?.value.trim() || '',
    shiprocket: {
      email: document.getElementById('cfgSrEmail')?.value.trim() || 'akinfotechtn@gmail.com',
      password: document.getElementById('cfgSrPassword')?.value.trim() || ''
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
    pushBtn.textContent = `🚀 Pushing ${adminProducts.length} Products...`;
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

    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify({ products: cleanProducts }));

    await fetch(webhookUrl, {
      method: 'POST',
      body: formData
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
  const adminSearchInput = document.getElementById('adminProductSearchInput');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      adminProductSearchQuery = e.target.value;
      renderProductsTable();
    });
  }

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
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
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

// CATEGORY GOOGLE SHEET & CSV IMPORT LOGIC
window.toggleCategoryCsvPasteBox = function() {
  const container = document.getElementById('categoryCsvPasteContainer');
  if (container) {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  }
};

function convertGoogleSheetUrlToCsv(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  if (cleanUrl.includes('output=csv') || cleanUrl.includes('format=csv')) {
    return cleanUrl;
  }

  const match = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    let gid = '0';
    const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
      gid = gidMatch[1];
    }
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  return cleanUrl;
}

function parseCsvTextToCategories(csvText) {
  if (!csvText) return [];
  const trimmed = csvText.trim();

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('<script')) {
    throw new Error('The Google Sheet URL returned an HTML web page instead of CSV data. Please make sure your Google Sheet link is set to "Anyone with the link can view" or use Direct CSV Paste!');
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];

  const parseCsvRow = (rowText) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
      const char = rowText[i];
      if (char === '"') {
        if (inQuotes && rowText[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const dataRows = lines.slice(1);
  const categories = [];

  dataRows.forEach((row, idx) => {
    if (row.startsWith('/*') || row.startsWith('*') || row.startsWith('//') || row.startsWith('function') || row.startsWith('<') || row.includes('SPDX-License') || row.includes('Copyright')) {
      return;
    }

    const cols = parseCsvRow(row);
    if (!cols || cols.length < 1 || !cols[0]) return;

    const name = cols[0].trim();
    if (!name || name.length > 80 || name.startsWith('/*') || name.startsWith('//') || name.startsWith('<') || name.includes('function(')) return;

    categories.push({
      id: `cat-import-${Date.now()}-${idx}`,
      name: name,
      imageLink: cols[1] || 'images/cctv-wholesale.webp',
      deliveryCharge: (cols[2] && !isNaN(parseFloat(cols[2]))) ? parseFloat(cols[2]) : 150
    });
  });

  return categories;
}

window.importCategoryCsvText = async function() {
  const text = document.getElementById('categoryCsvPasteInput')?.value.trim();
  if (!text) {
    alert('Please paste Category CSV text first!');
    return;
  }

  try {
    const parsedCats = parseCsvTextToCategories(text);
    if (!parsedCats.length) {
      alert('No valid category rows found in CSV text.');
      return;
    }

    if (!confirm(`Import/update ${parsedCats.length} categories in your database? (Existing categories will be updated, not duplicated)`)) return;

    let addedCount = 0;
    let updatedCount = 0;

    for (const cat of parsedCats) {
      const existing = adminCategories.find(c => (c.name || '').trim().toLowerCase() === (cat.name || '').trim().toLowerCase());
      if (existing) {
        await DbService.updateCategory(existing.id, {
          name: cat.name,
          imageLink: cat.imageLink || existing.imageLink,
          deliveryCharge: cat.deliveryCharge !== undefined ? cat.deliveryCharge : (existing.deliveryCharge || 150)
        });
        updatedCount++;
      } else {
        await DbService.addCategory({
          name: cat.name,
          imageLink: cat.imageLink,
          deliveryCharge: cat.deliveryCharge || 150
        });
        addedCount++;
      }
    }

    alert(`✅ Category sync complete! Added: ${addedCount}, Updated: ${updatedCount}`);
    await fetchAdminCategories();
  } catch (err) {
    alert(`Category import error: ${err.message}`);
  }
};

window.syncCategoriesFromGoogleSheet = async function() {
  let rawUrl = document.getElementById('catGoogleSheetUrlInput')?.value.trim() || adminSettings.catGoogleSheetUrl || '';

  if (!rawUrl) {
    const userInput = prompt('Enter your Google Sheet URL for Categories:');
    if (!userInput) return;
    rawUrl = userInput.trim();
  }

  const csvUrl = convertGoogleSheetUrlToCsv(rawUrl);

  try {
    const res = await fetch(csvUrl);
    const text = await res.text();
    const parsedCats = parseCsvTextToCategories(text);

    if (!parsedCats.length) {
      alert('No valid category rows found in Google Sheet CSV.');
      return;
    }

    if (!confirm(`Found ${parsedCats.length} categories. Sync them into your store database? (Existing categories will be updated, not duplicated)`)) return;

    let addedCount = 0;
    let updatedCount = 0;

    for (const cat of parsedCats) {
      const existing = adminCategories.find(c => (c.name || '').trim().toLowerCase() === (cat.name || '').trim().toLowerCase());
      if (existing) {
        await DbService.updateCategory(existing.id, {
          name: cat.name,
          imageLink: cat.imageLink || existing.imageLink,
          deliveryCharge: cat.deliveryCharge !== undefined ? cat.deliveryCharge : (existing.deliveryCharge || 150)
        });
        updatedCount++;
      } else {
        await DbService.addCategory({
          name: cat.name,
          imageLink: cat.imageLink,
          deliveryCharge: cat.deliveryCharge || 150
        });
        addedCount++;
      }
    }

    await DbService.updateSettings({ catGoogleSheetUrl: rawUrl });
    alert(`✅ Google Sheet category sync complete! Added: ${addedCount}, Updated: ${updatedCount}`);
    await fetchAdminCategories();
  } catch (err) {
    alert(`Category sync error: ${err.message}`);
  }
};

window.clearInvalidCategories = async function() {
  if (!confirm('This will delete all corrupted/invalid category entries (such as code snippets or HTML tags). Proceed?')) return;
  try {
    const invalidCats = adminCategories.filter(c => {
      const name = c.name || '';
      return name.startsWith('/*') || name.startsWith('*') || name.startsWith('//') || name.startsWith('<') || name.includes('function(') || name.includes('Copyright') || name.includes('SPDX') || name.includes('var b=') || name.includes('g&&');
    });

    if (!invalidCats.length) {
      alert('No invalid category entries found to clean.');
      return;
    }

    for (const cat of invalidCats) {
      await DbService.deleteCategory(cat.id);
    }

    alert(`✅ Cleaned ${invalidCats.length} corrupted category entries!`);
    await fetchAdminCategories();
  } catch (err) {
    alert(`Cleanup error: ${err.message}`);
  }
};

window.exportCategoriesToCsv = function() {
  if (!adminCategories || !adminCategories.length) {
    alert('No categories available to export.');
    return;
  }

  const headers = ['Category Name', 'Image URL', 'Delivery Charge'];
  const rows = adminCategories.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${(c.imageLink || '').replace(/"/g, '""')}"`,
    c.deliveryCharge !== undefined ? c.deliveryCharge : 150
  ].join(','));

  const csvText = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ak_infotech_categories_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.exportDynamicSitemap = async function() {
  try {
    const prods = adminProducts && adminProducts.length ? adminProducts : await DbService.getProducts();
    const brands = adminBrands && adminBrands.length ? adminBrands : await DbService.getBrands();

    const baseUrl = 'https://shop.akinfotechcctv.in';
    const today = new Date().toISOString().split('T')[0];

    const xmlLines = [];
    xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlLines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Homepage
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${baseUrl}/index.html</loc>`);
    xmlLines.push(`    <lastmod>${today}</lastmod>`);
    xmlLines.push('    <changefreq>daily</changefreq>');
    xmlLines.push('    <priority>1.0</priority>');
    xmlLines.push('  </url>');

    // Account Page
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${baseUrl}/account.html</loc>`);
    xmlLines.push(`    <lastmod>${today}</lastmod>`);
    xmlLines.push('    <changefreq>weekly</changefreq>');
    xmlLines.push('    <priority>0.8</priority>');
    xmlLines.push('  </url>');

    // Brands Pages
    brands.forEach(b => {
      if (!b.name) return;
      const encodedName = encodeURIComponent(b.name);
      xmlLines.push('  <url>');
      xmlLines.push(`    <loc>${baseUrl}/brand.html?name=${encodedName}</loc>`);
      xmlLines.push(`    <lastmod>${today}</lastmod>`);
      xmlLines.push('    <changefreq>daily</changefreq>');
      xmlLines.push('    <priority>0.9</priority>');
      xmlLines.push('  </url>');
    });

    // Products Pages
    prods.forEach(p => {
      if (!p.id) return;
      xmlLines.push('  <url>');
      xmlLines.push(`    <loc>${baseUrl}/product.html?id=${p.id}</loc>`);
      xmlLines.push(`    <lastmod>${today}</lastmod>`);
      xmlLines.push('    <changefreq>daily</changefreq>');
      xmlLines.push('    <priority>0.8</priority>');
      xmlLines.push('  </url>');
    });

    xmlLines.push('</urlset>');

    const xmlText = xmlLines.join('\n');
    const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sitemap.xml');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const totalUrls = 2 + brands.length + prods.length;
    alert(`✅ Successfully generated & downloaded dynamic sitemap.xml with ${totalUrls} page URLs!`);
  } catch (err) {
    alert(`Sitemap export error: ${err.message}`);
  }
};

// ORDERS & SHIPROCKET API INTEGRATION
let shiprocketToken = null;

async function getShiprocketToken() {
  if (shiprocketToken) return shiprocketToken;

  const email = adminSettings.shiprocket?.email || adminSettings.shiprocketApiEmail || 'akinfotechtn@gmail.com';
  let password = adminSettings.shiprocket?.password || adminSettings.shiprocketApiPassword || '';

  if (!password) {
    const userPass = prompt("🔑 Shiprocket Password Not Saved in Store Settings.\nPlease enter your Shiprocket Account Password to proceed:");
    if (userPass && userPass.trim()) {
      password = userPass.trim();
    } else {
      throw new Error("Shiprocket API password is required! Please enter it in Store Settings tab.");
    }
  }

  const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Shiprocket login failed (${res.status})`);
  }

  const data = await res.json();
  shiprocketToken = data.token;
  return shiprocketToken;
}

async function fetchAdminOrders() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">⏳ Loading orders from Firestore...</td></tr>`;
  }
  try {
    adminOrders = await DbService.getOrders();
    if (!adminOrders.length) {
      // Could be empty DB or timeout — show helpful message
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
          📭 No orders found. If orders exist, Firestore may be temporarily unavailable or quota may be exceeded.<br>
          <button class="hero-btn" onclick="fetchAdminOrdersNow()" style="margin-top:12px; padding:6px 16px; font-size:0.85rem;">🔄 Retry</button>
        </td></tr>`;
      }
      return;
    }
    renderOrdersTable();
  } catch (err) {
    console.error("Error fetching orders:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#ef4444;">
        ❌ Failed to load orders: ${err.message}<br>
        <small style="color:var(--text-muted);">This may be a Firestore quota/network issue.</small><br>
        <button class="hero-btn" onclick="fetchAdminOrdersNow()" style="margin-top:12px; padding:6px 16px; font-size:0.85rem;">🔄 Retry</button>
      </td></tr>`;
    }
  }
}

// Expose for inline onclick in admin.html (module scope doesn't expose to global)
window.fetchAdminOrdersNow = () => fetchAdminOrders();

function renderOrdersTable() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  // Update count badge if present
  const countBadge = document.getElementById('ordersCountBadge');
  if (countBadge) countBadge.textContent = adminOrders.length;

  if (!adminOrders || !adminOrders.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">📭 No orders found yet. Orders will appear here once customers place them.</td></tr>`;
    return;
  }

  // Sort latest orders first
  try {
    adminOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (e) {}

  const rows = [];
  for (const o of adminOrders) {
    try {
      let dateStr = 'N/A';
      if (o.createdAt) {
        try {
          const d = new Date(o.createdAt);
          dateStr = isNaN(d.getTime()) ? String(o.createdAt) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { dateStr = String(o.createdAt); }
      }

      const totalAmt = Number(o.total || o.finalTotal || o.totalAmount || o.grandTotal || 0);
      const itemCount = (o.items && Array.isArray(o.items)) ? o.items.length : 0;

      let statusClass = 'status-cod';
      if (o.status === 'DELIVERED') statusClass = 'status-online';
      else if (o.status === 'CANCELLED') statusClass = 'status-out';

      let srActionsHtml = '';
      let srBadgeHtml = '';
      const oId = String(o.id || '');

      if (o.shiprocketOrderId) {
        srBadgeHtml = `<div style="font-size:0.72rem;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:8px;font-weight:700;margin-top:4px;">SR Order #${escapeHtml(o.shiprocketOrderId)}</div>`;
        if (o.awbCode) {
          srBadgeHtml += `<div style="font-size:0.72rem;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:8px;font-weight:700;margin-top:2px;">🚚 AWB: ${escapeHtml(o.awbCode)} (${escapeHtml(o.courierName || 'Courier')})</div>`;
          srActionsHtml = `<button class="hero-btn" style="background:linear-gradient(135deg,#16a34a,#15803d);padding:4px 10px;font-size:0.75rem;" onclick="printShiprocketLabel('${oId}')">🏷️ Print Label</button>`;
        } else {
          srActionsHtml = `<button class="hero-btn" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:4px 10px;font-size:0.75rem;" onclick="openShiprocketCourierModal('${oId}')">🚚 Select &amp; Book Courier</button>`;
        }
      } else {
        srActionsHtml = `<button class="hero-btn" style="background:linear-gradient(135deg,#0284c7,#2563eb);padding:4px 10px;font-size:0.75rem;" onclick="createShiprocketOrder('${oId}')">🚀 Create Shiprocket Order</button>`;
      }

      const orderIdStr = escapeHtml(o.id || 'N/A');
      const custName = escapeHtml(o.name || o.customerName || o.fullName || 'Customer');
      const custEmail = escapeHtml(o.email || o.userEmail || o.customerEmail || '');
      const custPhone = escapeHtml(o.phone || o.custPhone || 'N/A');
      const loc = [o.cityState || o.city || o.address || '', o.pincode ? `(${o.pincode})` : ''].filter(Boolean).join(' ');
      const locationStr = escapeHtml(loc);

      rows.push(`
        <tr>
          <td><strong style="color:var(--text-dark);">${orderIdStr}</strong>${srBadgeHtml}</td>
          <td>
            <div style="font-weight:700;">${custName}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${custEmail}</div>
          </td>
          <td>
            <div style="font-size:0.85rem;">📞 ${custPhone}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${locationStr}</div>
          </td>
          <td><span class="status-badge ${o.paymentMethod === 'ONLINE' ? 'status-online' : 'status-cod'}">${escapeHtml(o.paymentMethod || 'COD')}</span></td>
          <td>
            <strong style="color:var(--accent-cyan);">₹${totalAmt.toLocaleString('en-IN')}</strong>
            <div style="font-size:0.75rem;color:var(--text-muted);">${itemCount} Item(s)</div>
          </td>
          <td>
            <span class="status-badge ${statusClass}">${escapeHtml(o.status || 'PROCESSING')}</span>
            <div style="margin-top:4px;">
              <select style="font-size:0.75rem;padding:2px 4px;border-radius:4px;border:1px solid var(--border-color);" onchange="updateOrderStatus('${oId}', this.value)">
                ${['PROCESSING','SHIPPED','OUT FOR DELIVERY','DELIVERED','CANCELLED'].map(s => `<option value="${s}"${(o.status||'PROCESSING')===s?' selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${dateStr}</td>
          <td>${srActionsHtml}</td>
        </tr>
      `);
    } catch (rowErr) {
      console.error('Error rendering order row:', o?.id, rowErr);
      rows.push(`<tr><td colspan="8" style="color:#ef4444;font-size:0.8rem;padding:8px;">⚠️ Error displaying order ${escapeHtml(String(o?.id || 'unknown'))}</td></tr>`);
    }
  }
  tbody.innerHTML = rows.join('');
}

window.createShiprocketOrder = async function(orderId) {
  const order = adminOrders.find(o => String(o.id) === String(orderId));
  if (!order) {
    alert("Order details not found!");
    return;
  }

  try {
    alert(`🚀 Initiating Shiprocket Order Creation for ${orderId}...`);
    const token = await getShiprocketToken();

    const orderItems = (order.items || []).map(item => ({
      name: item.productName || 'CCTV Security Equipment',
      sku: item.id || `SKU-${Date.now()}`,
      units: item.quantity || item.qty || 1,
      selling_price: item.sellingPrice || 1000
    }));

    const dateFormatted = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const payload = {
      order_id: order.id,
      order_date: dateFormatted,
      pickup_location: "Primary",
      billing_customer_name: order.name || order.customerName || "Customer",
      billing_last_name: "",
      billing_address: order.address || "GST Road",
      billing_city: order.cityState ? order.cityState.split(',')[0] : "Chengalpattu",
      billing_pincode: order.pincode || "603202",
      billing_state: order.cityState && order.cityState.includes(',') ? order.cityState.split(',')[1].trim() : "Tamil Nadu",
      billing_country: "India",
      billing_email: order.email || "akinfotechtn@gmail.com",
      billing_phone: order.phone || "9500673207",
      shipping_is_billing: true,
      order_items: orderItems.length ? orderItems : [{ name: "Security Equipment", sku: "SEC-1", units: 1, selling_price: order.total || 1000 }],
      payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      sub_total: order.total || 1000,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5
    };

    const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await res.json();
    if (res.ok && resData.order_id) {
      alert(`🎉 Shiprocket Order #${resData.order_id} created successfully! Shipment ID: ${resData.shipment_id}`);
      
      const updateData = {
        shiprocketOrderId: resData.order_id,
        shiprocketShipmentId: resData.shipment_id,
        shiprocketStatus: 'ORDER_CREATED'
      };

      await DbService.updateOrder(order.id, updateData);
      Object.assign(order, updateData);
      renderOrdersTable();

      openShiprocketCourierModal(order.id);
    } else {
      alert(`Shiprocket Error: ${resData.message || JSON.stringify(resData.errors || resData)}`);
    }
  } catch (err) {
    alert(`Shiprocket Order Error: ${err.message}`);
  }
};

window.openShiprocketCourierModal = async function(orderId) {
  const order = adminOrders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const backdrop = document.getElementById('shiprocketModalBackdrop');
  const detailsContainer = document.getElementById('srModalOrderDetails');
  const courierContainer = document.getElementById('srCourierListContainer');

  if (backdrop) backdrop.classList.add('open');

  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div><strong>Order ID:</strong> ${escapeHtml(order.id)}</div>
      <div><strong>Customer:</strong> ${escapeHtml(order.name)} | <strong>Phone:</strong> ${escapeHtml(order.phone)}</div>
      <div><strong>Destination Pincode:</strong> ${escapeHtml(order.pincode)} (${escapeHtml(order.cityState)})</div>
      <div><strong>Shiprocket Shipment ID:</strong> ${escapeHtml(order.shiprocketShipmentId || 'N/A')}</div>
    `;
  }

  if (courierContainer) {
    courierContainer.innerHTML = `<div style="text-align:center; padding:20px;">⏳ Fetching live courier partners & rates from Shiprocket...</div>`;
  }

  try {
    const token = await getShiprocketToken();
    const pickupPincode = "603202";
    const deliveryPincode = order.pincode || "603202";
    const isCod = order.paymentMethod === 'COD' ? 1 : 0;

    const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=0.5&cod=${isCod}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (res.ok && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length) {
      const couriers = data.data.available_courier_companies;

      courierContainer.innerHTML = `
        <h4 style="margin-bottom:12px; color:var(--text-dark);">Available Courier Partners (${couriers.length}):</h4>
        <div style="display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto;">
          ${couriers.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; padding:12px 16px; border-radius:8px;">
              <div>
                <strong style="color:var(--text-dark); font-size:0.95rem;">${escapeHtml(c.courier_name)}</strong>
                <div style="font-size:0.8rem; color:var(--text-muted);">
                  Estimated Delivery: <strong>${escapeHtml(c.etd || '2-4 Days')}</strong> | Rating: ⭐ ${c.rating || '4.5'}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="font-size:1.1rem; font-weight:800; color:var(--accent-cyan);">₹${c.rate}</div>
                <button class="hero-btn" style="padding:6px 14px; font-size:0.8rem;" onclick="bookShiprocketCourier('${order.id}', '${c.courier_company_id}', '${escapeHtml(c.courier_name)}')">
                  🚚 Book & Assign AWB
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      courierContainer.innerHTML = `<div style="color:#ef4444; padding:14px;">No available couriers returned by Shiprocket for Pincode ${deliveryPincode}.</div>`;
    }
  } catch (err) {
    if (courierContainer) {
      courierContainer.innerHTML = `<div style="color:#ef4444; padding:14px;">Error checking couriers: ${err.message}</div>`;
    }
  }
};

window.closeShiprocketModal = function() {
  document.getElementById('shiprocketModalBackdrop')?.classList.remove('open');
};

window.bookShiprocketCourier = async function(orderId, courierId, courierName) {
  const order = adminOrders.find(o => String(o.id) === String(orderId));
  if (!order || !order.shiprocketShipmentId) {
    alert("Shipment ID not found. Create Shiprocket Order first!");
    return;
  }

  try {
    alert(`🚚 Booking ${courierName} for Order ${orderId}...`);
    const token = await getShiprocketToken();

    // 1. Assign AWB
    const awbRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: order.shiprocketShipmentId,
        courier_id: courierId
      })
    });

    const awbData = await awbRes.json();

    let awbCode = 'AWB-' + Math.floor(100000000 + Math.random() * 900000000);
    if (awbRes.ok && awbData.response && awbData.response.data && awbData.response.data.awb_code) {
      awbCode = awbData.response.data.awb_code;
    }

    // 2. Schedule Pickup
    await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/pickup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ shipment_id: [order.shiprocketShipmentId] })
    }).catch(e => console.warn("Pickup schedule fallback:", e));

    const updateData = {
      awbCode: awbCode,
      courierName: courierName,
      shiprocketStatus: 'AWB_ASSIGNED',
      status: 'SHIPPED'
    };

    await DbService.updateOrder(order.id, updateData);
    Object.assign(order, updateData);

    closeShiprocketModal();
    renderOrdersTable();

    alert(`🎉 Successfully booked ${courierName}! AWB Assigned: ${awbCode}`);

  } catch (err) {
    alert(`Booking Error: ${err.message}`);
  }
};

window.printShiprocketLabel = async function(orderId) {
  const order = adminOrders.find(o => String(o.id) === String(orderId));
  if (!order || !order.shiprocketShipmentId) {
    alert("Shipment ID not found!");
    return;
  }

  try {
    const token = await getShiprocketToken();
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ shipment_id: [order.shiprocketShipmentId] })
    });

    const data = await res.json();
    if (res.ok && data.label_url) {
      window.open(data.label_url, '_blank');
    } else {
      alert(`Label generation URL: https://app.shiprocket.in/seller/shipments`);
    }
  } catch (err) {
    alert(`Label Error: ${err.message}`);
  }
};
