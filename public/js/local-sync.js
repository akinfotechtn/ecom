let localProducts = [];
let isBulkMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  loadLocalProducts();
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings && data.settings.googleSheetUrl) {
        const input = document.getElementById('localSheetUrlInput');
        if (input) input.value = data.settings.googleSheetUrl;
      }
    }
  } catch (e) {
    console.warn('Could not load settings for URL pre-fill');
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 1. FETCH ALL LOCAL PRODUCTS DIRECTLY FROM LOCAL JSON / SERVER
async function loadLocalProducts() {
  const tbody = document.getElementById('localProductsTableBody');
  const countBadge = document.getElementById('localTotalCount');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-dim);">⏳ Reading local products.json...</td></tr>`;
  }

  try {
    const res = await fetch('/api/products').catch(() => fetch('/data/products.json'));
    if (res.ok) {
      const data = await res.json();
      localProducts = Array.isArray(data) ? data : (data.products || []);
    } else {
      const fallback = await fetch('/data/products.json');
      localProducts = await fallback.json();
    }

    if (countBadge) countBadge.textContent = localProducts.length;
    renderLocalTable(localProducts);
  } catch (err) {
    console.error("Local fetch error:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: #ef4444;">Error loading local JSON: ${err.message}</td></tr>`;
    }
  }
}

// 2. RENDER STANDARD PRODUCT TABLE
function renderLocalTable(products) {
  const tbody = document.getElementById('localProductsTableBody');
  const countBadge = document.getElementById('localTotalCount');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = products.length;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-dim);">No products found in local JSON.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <img src="${p.photoLink || 'images/cctv-wholesale.webp'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-dark);" onerror="this.src='images/cctv-wholesale.webp'">
      </td>
      <td>
        <strong style="color: #ffffff; font-size: 0.9rem;">${escapeHtml(p.productName || 'Unnamed Product')}</strong>
        ${p.productSpec ? `<div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">${escapeHtml(p.productSpec)}</div>` : ''}
      </td>
      <td><span style="background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;">${escapeHtml(p.brand || 'Generic')}</span></td>
      <td><span style="color: var(--text-dim); font-size: 0.82rem;">${escapeHtml(p.category || 'General')}</span></td>
      <td>₹${Number(p.price || 0).toLocaleString('en-IN')}</td>
      <td><strong style="color: var(--accent-cyan); font-size: 0.95rem;">₹${Number(p.sellingPrice || 0).toLocaleString('en-IN')}</strong></td>
      <td><span style="background: rgba(6,182,212,0.15); color: var(--accent-cyan); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">${p.dealerMarginPercent !== undefined ? p.dealerMarginPercent : 0}%</span></td>
      <td>
        ${p.inStock !== false ? `<span style="color: #34d399; font-weight: 700; font-size: 0.8rem;">● In Stock</span>` : `<span style="color: #f87171; font-weight: 700; font-size: 0.8rem;">● Out of Stock</span>`}
      </td>
      <td>${p.isCombo ? `<span style="color: #f59e0b; font-weight: 800;">🔥 Yes</span>` : '<span style="color: var(--text-dim);">No</span>'}</td>
      <td style="text-align: right;">
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openEditModal('${p.id}')">✏️ Edit</button>
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239,68,68,0.4);" onclick="deleteLocalProduct('${p.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// 3. SEARCH / FILTER PRODUCTS
window.filterLocalProducts = function() {
  const q = document.getElementById('localSearchInput').value.toLowerCase().trim();
  if (!q) {
    renderLocalTable(localProducts);
    return;
  }
  const filtered = localProducts.filter(p => {
    const text = `${p.productName || ''} ${p.brand || ''} ${p.category || ''} ${p.productSpec || ''} ${p.id || ''}`.toLowerCase();
    return text.includes(q);
  });
  renderLocalTable(filtered);
};

// 4. ADD SINGLE PRODUCT TO LOCAL JSON
window.handleAddSingleProduct = async function(e) {
  e.preventDefault();
  const nameInput = document.getElementById('addProdName');
  const sellingPriceInput = document.getElementById('addProdSellingPrice');

  const name = nameInput ? nameInput.value.trim() : '';
  const brand = document.getElementById('addProdBrand')?.value.trim() || 'Generic';
  const category = document.getElementById('addProdCategory')?.value.trim() || 'General';
  const price = parseFloat(document.getElementById('addProdPrice')?.value) || 0;
  let sellingPrice = parseFloat(sellingPriceInput?.value) || 0;
  if (!sellingPrice && price) sellingPrice = price;

  const dealerMarginPercent = parseFloat(document.getElementById('addProdDealerMargin')?.value) || 0;

  const photoLink = document.getElementById('addProdPhoto')?.value.trim() || 'images/cctv-wholesale.webp';
  const productSpec = document.getElementById('addProdSpec')?.value.trim() || '';
  const inStock = document.getElementById('addProdInStock')?.checked !== false;
  const isCombo = document.getElementById('addProdIsCombo')?.checked === true;

  if (!name) {
    alert("⚠️ Please enter a Product Name before saving!");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!sellingPrice) {
    alert("⚠️ Please enter a Selling Price (₹) before saving!");
    if (sellingPriceInput) sellingPriceInput.focus();
    return;
  }

  const newProduct = {
    id: `prod-${Date.now()}`,
    productName: name,
    brand,
    category,
    price: price || sellingPrice,
    sellingPrice,
    dealerMarginPercent,
    photoLink,
    productSpec,
    inStock,
    isCombo,
    createdAt: new Date().toISOString()
  };

  localProducts.unshift(newProduct);
  localStorage.setItem('ak_local_products', JSON.stringify(localProducts));

  const form = document.getElementById('addSingleProductForm');
  if (form) form.reset();

  renderLocalTable(localProducts);

  try {
    await fetch('/api/products/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: localProducts })
    });
    alert(`🎉 Successfully added "${name}" (₹${sellingPrice.toLocaleString('en-IN')}) to products.json! Total: ${localProducts.length} products.`);
  } catch (err) {
    alert(`🎉 Added "${name}" locally! Total: ${localProducts.length} products.`);
  }
};

// 5. EDIT PRODUCT MODAL
window.openEditModal = function(id) {
  const p = localProducts.find(x => String(x.id) === String(id));
  if (!p) return;

  document.getElementById('editProdId').value = p.id;
  document.getElementById('editProdName').value = p.productName || '';
  document.getElementById('editProdBrand').value = p.brand || '';
  document.getElementById('editProdCategory').value = p.category || '';
  document.getElementById('editProdPrice').value = p.price || 0;
  document.getElementById('editProdSellingPrice').value = p.sellingPrice || 0;
  document.getElementById('editProdDealerMargin').value = p.dealerMarginPercent || 0;
  document.getElementById('editProdPhoto').value = p.photoLink || '';
  document.getElementById('editProdSpec').value = p.productSpec || '';
  document.getElementById('editProdInStock').checked = p.inStock !== false;
  document.getElementById('editProdIsCombo').checked = p.isCombo === true;

  document.getElementById('editProductModal').classList.add('open');
};

window.closeEditModal = function() {
  document.getElementById('editProductModal').classList.remove('open');
};

window.handleSaveEdit = async function(e) {
  e.preventDefault();
  const id = document.getElementById('editProdId').value;
  const index = localProducts.findIndex(x => String(x.id) === String(id));
  if (index === -1) return;

  const updated = {
    ...localProducts[index],
    productName: document.getElementById('editProdName').value.trim(),
    brand: document.getElementById('editProdBrand').value.trim() || 'Generic',
    category: document.getElementById('editProdCategory').value.trim() || 'General',
    price: parseFloat(document.getElementById('editProdPrice').value) || 0,
    sellingPrice: parseFloat(document.getElementById('editProdSellingPrice').value) || 0,
    dealerMarginPercent: parseFloat(document.getElementById('editProdDealerMargin').value) || 0,
    photoLink: document.getElementById('editProdPhoto').value.trim() || 'images/cctv-wholesale.webp',
    productSpec: document.getElementById('editProdSpec').value.trim(),
    inStock: document.getElementById('editProdInStock').checked,
    isCombo: document.getElementById('editProdIsCombo').checked
  };

  localProducts[index] = updated;
  localStorage.setItem('ak_local_products', JSON.stringify(localProducts));

  try {
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  } catch (err) {
    await saveAllBulkToServer();
  }

  closeEditModal();
  renderLocalTable(localProducts);
  alert(`✅ Product "${updated.productName}" updated successfully!`);
};

// 6. DELETE PRODUCT
window.deleteLocalProduct = async function(id) {
  const p = localProducts.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!confirm(`Are you sure you want to delete "${p.productName}" from local JSON?`)) return;

  localProducts = localProducts.filter(x => String(x.id) !== String(id));
  localStorage.setItem('ak_local_products', JSON.stringify(localProducts));

  try {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
  } catch (err) {
    await saveAllBulkToServer();
  }

  renderLocalTable(localProducts);
};

// 7. GOOGLE SHEETS 1-CLICK SYNC (Directly updates local JSON)
window.syncGoogleSheetLocal = async function() {
  const url = document.getElementById('localSheetUrlInput').value.trim();
  const statusEl = document.getElementById('localSyncStatus');
  const btn = document.getElementById('btnLocalSyncSheet');

  btn.disabled = true;
  statusEl.innerHTML = `<span style="color: var(--accent-cyan);">⏳ Downloading and parsing Google Sheet CSV...</span>`;

  try {
    const res = await fetch('/api/sync-google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl: url })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      statusEl.innerHTML = `<span style="color: #34d399; font-weight: 800;">✅ Successfully synced ${data.totalSynced} products to local products.json!</span>`;
      await loadLocalProducts();
    } else {
      throw new Error(data.message || 'Sync failed.');
    }
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #f87171;">✕ Sync Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
  }
};

window.toggleLocalCsvBox = function() {
  const box = document.getElementById('localCsvBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.uploadRawCsvLocal = async function() {
  const csvText = document.getElementById('localRawCsvText').value.trim();
  if (!csvText) {
    alert("Please paste CSV text first!");
    return;
  }

  try {
    const res = await fetch('/api/upload-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(`✅ Successfully imported ${data.totalSynced} products into products.json!`);
      document.getElementById('localRawCsvText').value = '';
      toggleLocalCsvBox();
      await loadLocalProducts();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    alert(`CSV import error: ${err.message}`);
  }
};

// 8. SPREADSHEET BULK EDIT MODE
window.toggleBulkSpreadsheetMode = function() {
  isBulkMode = !isBulkMode;
  const stdView = document.getElementById('standardLocalTableWrapper');
  const bulkView = document.getElementById('bulkLocalTableWrapper');
  const btnToggle = document.getElementById('btnToggleBulk');
  const btnSave = document.getElementById('btnSaveBulk');

  if (isBulkMode) {
    stdView.style.display = 'none';
    bulkView.style.display = 'block';
    btnToggle.textContent = '❌ Exit Bulk Mode';
    btnSave.style.display = 'inline-flex';
    renderBulkTable();
  } else {
    stdView.style.display = 'block';
    bulkView.style.display = 'none';
    btnToggle.textContent = '📝 Spreadsheet Bulk Edit';
    btnSave.style.display = 'none';
    renderLocalTable(localProducts);
  }
};

function renderBulkTable() {
  const tbody = document.getElementById('bulkLocalTableBody');
  if (!tbody) return;

  tbody.innerHTML = localProducts.map(p => `
    <tr data-bulk-id="${p.id}">
      <td>
        <input type="text" class="bulk-photo" value="${escapeHtml(p.photoLink || '')}" style="width: 130px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px 6px; font-size: 0.78rem; border-radius: 4px;">
      </td>
      <td>
        <input type="text" class="bulk-name" value="${escapeHtml(p.productName || '')}" style="width: 100%; min-width: 220px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px 6px; font-weight: 700; font-size: 0.85rem; border-radius: 4px;">
      </td>
      <td>
        <input type="text" class="bulk-brand" value="${escapeHtml(p.brand || 'Generic')}" style="width: 100%; min-width: 110px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px 6px; font-size: 0.82rem; border-radius: 4px;">
      </td>
      <td>
        <input type="text" class="bulk-category" value="${escapeHtml(p.category || 'General')}" style="width: 100%; min-width: 120px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px 6px; font-size: 0.82rem; border-radius: 4px;">
      </td>
      <td>
        <input type="number" class="bulk-price" value="${p.price || 0}" style="width: 80px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px; font-size: 0.85rem; border-radius: 4px;">
      </td>
      <td>
        <input type="number" class="bulk-selling" value="${p.sellingPrice || 0}" style="width: 90px; background: #0f172a; border: 1px solid var(--border-dark); color: var(--accent-cyan); font-weight: 800; padding: 4px; font-size: 0.9rem; border-radius: 4px;">
      </td>
      <td>
        <input type="number" class="bulk-dealer-margin" value="${p.dealerMarginPercent || 0}" style="width: 80px; background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px; font-size: 0.85rem; border-radius: 4px;">
      </td>
      <td>
        <select class="bulk-stock" style="background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px; border-radius: 4px; font-size: 0.8rem;">
          <option value="true" ${p.inStock !== false ? 'selected' : ''}>In Stock</option>
          <option value="false" ${p.inStock === false ? 'selected' : ''}>Out of Stock</option>
        </select>
      </td>
      <td>
        <select class="bulk-combo" style="background: #0f172a; border: 1px solid var(--border-dark); color: #fff; padding: 4px; border-radius: 4px; font-size: 0.8rem;">
          <option value="false" ${!p.isCombo ? 'selected' : ''}>No</option>
          <option value="true" ${p.isCombo ? 'selected' : ''}>Yes</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.saveAllBulkSpreadsheetEdits = async function() {
  const rows = document.querySelectorAll('#bulkLocalTableBody tr');
  if (!rows.length) return;

  const updatedProducts = [];

  rows.forEach(row => {
    const id = row.getAttribute('data-bulk-id');
    const orig = localProducts.find(x => String(x.id) === String(id)) || {};

    const photoLink = row.querySelector('.bulk-photo')?.value.trim() || orig.photoLink || 'images/cctv-wholesale.webp';
    const productName = row.querySelector('.bulk-name')?.value.trim() || orig.productName || 'Product';
    const brand = row.querySelector('.bulk-brand')?.value.trim() || orig.brand || 'Generic';
    const category = row.querySelector('.bulk-category')?.value.trim() || orig.category || 'General';
    const price = parseFloat(row.querySelector('.bulk-price')?.value) || 0;
    const sellingPrice = parseFloat(row.querySelector('.bulk-selling')?.value) || orig.sellingPrice || 0;
    const dealerMarginPercent = parseFloat(row.querySelector('.bulk-dealer-margin')?.value) || 0;
    const inStock = row.querySelector('.bulk-stock')?.value === 'true';
    const isCombo = row.querySelector('.bulk-combo')?.value === 'true';

    updatedProducts.push({
      ...orig,
      id,
      photoLink,
      productName,
      brand,
      category,
      price,
      sellingPrice,
      dealerMarginPercent,
      inStock,
      isCombo
    });
  });

  localProducts = updatedProducts;
  await saveAllBulkToServer();
  toggleBulkSpreadsheetMode();
  alert(`🎉 Successfully saved all ${updatedProducts.length} product changes to local products.json!`);
};

async function saveAllBulkToServer() {
  try {
    await fetch('/api/products/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: localProducts })
    });
  } catch (err) {
    console.error("Bulk save error:", err);
  }
}

// 9. DOWNLOAD PRODUCTS.JSON BACKUP
window.downloadProductsJsonBackup = function() {
  const blob = new Blob([JSON.stringify(localProducts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'products.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 10. DEPLOY TO GITHUB
window.deployToGitHub = async function() {
  const btn = document.getElementById('btnDeploy');
  if (btn) { btn.textContent = '⏳ Deploying...'; btn.disabled = true; }

  try {
    const res = await fetch('/api/deploy', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Deployed to GitHub!\n\n${data.message}`);
    } else {
      alert(`❌ Deploy failed:\n${data.message}`);
    }
  } catch (err) {
    alert('❌ Could not reach server to deploy. Make sure the local server is running.');
  } finally {
    if (btn) { btn.textContent = '🚀 Deploy to GitHub'; btn.disabled = false; }
  }
};

// --- BRANDS & CATEGORIES TAB LOGIC ---
let localBrands = [];
let localCategories = [];
let editingBrandId = null;
let editingCategoryId = null;

// Tab switching
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).style.display = 'block';
  if (tabId === 'products-tab') {
    document.getElementById('tabBtnProducts').classList.add('active');
  } else if (tabId === 'brands-cats-tab') {
    document.getElementById('tabBtnBrandsCats').classList.add('active');
    loadLocalBrandsAndCategories();
  } else if (tabId === 'featured-tab') {
    document.getElementById('tabBtnFeatured').classList.add('active');
    populateFeaturedFilters();
    filterLocalFeaturedList();
  }
};

// Toggle inputs based on select type
window.toggleBrandImageInputs = function() {
  const type = document.getElementById('brandImgSrcType').value;
  if (type === 'url') {
    document.getElementById('brandImgUrlGroup').style.display = 'block';
    document.getElementById('brandImgUploadGroup').style.display = 'none';
  } else {
    document.getElementById('brandImgUrlGroup').style.display = 'none';
    document.getElementById('brandImgUploadGroup').style.display = 'block';
  }
};

window.toggleCatImageInputs = function() {
  const type = document.getElementById('catImgSrcType').value;
  if (type === 'url') {
    document.getElementById('catImgUrlGroup').style.display = 'block';
    document.getElementById('catImgUploadGroup').style.display = 'none';
  } else {
    document.getElementById('catImgUrlGroup').style.display = 'none';
    document.getElementById('catImgUploadGroup').style.display = 'block';
  }
};

// Handle Image uploads
window.uploadBrandImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImageBase64(file, 'brandUploadStatus');
    // Store url in input field
    document.getElementById('addBrandImageUrl').value = url;
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
};

window.uploadCatImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImageBase64(file, 'catUploadStatus');
    document.getElementById('addCategoryImageUrl').value = url;
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
};

// Helper for upload
async function uploadImageBase64(file, statusElId) {
  const statusEl = document.getElementById(statusElId);
  if (statusEl) statusEl.textContent = '⏳ Uploading image...';
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data: reader.result
          })
        });
        const data = await res.json();
        if (data.success) {
          if (statusEl) statusEl.textContent = '✅ Uploaded: ' + data.url;
          resolve(data.url);
        } else {
          if (statusEl) statusEl.textContent = '❌ Upload failed: ' + data.message;
          reject(new Error(data.message));
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ Error uploading.';
        reject(err);
      }
    };
    reader.onerror = () => {
      if (statusEl) statusEl.textContent = '❌ Error reading file.';
      reject(new Error('File reading error.'));
    };
    reader.readAsDataURL(file);
  });
}

// Load brands & categories from local API
async function loadLocalBrandsAndCategories() {
  try {
    const brandRes = await fetch('/api/brands').catch(() => fetch('/data/brands.json'));
    if (brandRes.ok) {
      const data = await brandRes.json();
      localBrands = data.brands || data || [];
    }
    
    const catRes = await fetch('/api/categories').catch(() => fetch('/data/categories.json'));
    if (catRes.ok) {
      const data = await catRes.json();
      localCategories = data.categories || data || [];
    }
    
    renderBrandsList();
    renderCategoriesList();
  } catch (err) {
    console.error('Error loading brands/categories:', err);
  }
}


// Render Brands Table
window.renderBrandsList = function() {
  const query = document.getElementById('brandSearch').value.toLowerCase();
  const tbody = document.getElementById('localBrandsTableBody');
  const countSpan = document.getElementById('localBrandsCount');
  
  const filtered = localBrands.filter(b => 
    b.name?.toLowerCase().includes(query) || 
    b.description?.toLowerCase().includes(query)
  );
  
  countSpan.textContent = filtered.length;
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-dim);">No brands match search</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>
        <img src="${b.imageLink || 'images/brands/generic.png'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: contain; background: #fff; padding: 2px;" alt="${b.name}">
      </td>
      <td style="font-weight: 700; color:#fff;">${escapeHtml(b.name)}</td>
      <td style="color: var(--text-dim); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(b.description || '')}</td>
      <td style="text-align: right;">
        <button class="btn-secondary" style="border-color: var(--accent-cyan); color: var(--accent-cyan); padding: 4px 8px; font-size: 0.78rem; margin-right: 4px;" onclick="startEditBrand('${b.id}')">✏️ Edit</button>
        <button class="btn-secondary" style="border-color: #ef4444; color:#ef4444; padding: 4px 8px; font-size: 0.78rem;" onclick="deleteBrandBtn('${b.id}')">✕ Delete</button>
      </td>
    </tr>
  `).join('');
};

// Render Categories Table
window.renderCategoriesList = function() {
  const query = document.getElementById('catSearch').value.toLowerCase();
  const tbody = document.getElementById('localCategoriesTableBody');
  const countSpan = document.getElementById('localCategoriesCount');
  
  const filtered = localCategories.filter(c => 
    c.name?.toLowerCase().includes(query) || 
    c.description?.toLowerCase().includes(query)
  );
  
  countSpan.textContent = filtered.length;
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-dim);">No categories match search</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>
        <img src="${c.imageLink || 'images/categories/generic.png'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: contain; background: #fff; padding: 2px;" alt="${c.name}">
      </td>
      <td style="font-weight: 700; color:#fff;">${escapeHtml(c.name)}</td>
      <td style="color: var(--text-dim); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.description || '')}</td>
      <td style="text-align: right;">
        <button class="btn-secondary" style="border-color: var(--accent-cyan); color: var(--accent-cyan); padding: 4px 8px; font-size: 0.78rem; margin-right: 4px;" onclick="startEditCategory('${c.id}')">✏️ Edit</button>
        <button class="btn-secondary" style="border-color: #ef4444; color:#ef4444; padding: 4px 8px; font-size: 0.78rem;" onclick="deleteCategoryBtn('${c.id}')">✕ Delete</button>
      </td>
    </tr>
  `).join('');
};

// Edit & Cancel Brand functions
window.startEditBrand = function(id) {
  const b = localBrands.find(x => String(x.id) === String(id));
  if (!b) return;
  
  editingBrandId = b.id;
  document.getElementById('addBrandName').value = b.name || '';
  document.getElementById('addBrandDesc').value = b.description || '';
  document.getElementById('addBrandImageUrl').value = b.imageLink || 'images/brands/generic.png';
  
  const typeSelect = document.getElementById('brandImgSrcType');
  if (typeSelect) {
    typeSelect.value = 'url';
    toggleBrandImageInputs();
  }
  
  const btnSave = document.getElementById('btnSaveBrand');
  if (btnSave) btnSave.textContent = '💾 Save Brand Changes';
  
  const btnCancel = document.getElementById('btnCancelBrandEdit');
  if (btnCancel) btnCancel.style.display = 'inline-block';
};

window.cancelBrandEdit = function() {
  editingBrandId = null;
  document.getElementById('addBrandForm').reset();
  document.getElementById('addBrandImageUrl').value = 'images/brands/generic.png';
  document.getElementById('brandUploadStatus').textContent = '';
  
  const btnSave = document.getElementById('btnSaveBrand');
  if (btnSave) btnSave.textContent = '💾 Save Brand Locally';
  
  const btnCancel = document.getElementById('btnCancelBrandEdit');
  if (btnCancel) btnCancel.style.display = 'none';
};

// Edit & Cancel Category functions
window.startEditCategory = function(id) {
  const c = localCategories.find(x => String(x.id) === String(id));
  if (!c) return;
  
  editingCategoryId = c.id;
  document.getElementById('addCategoryName').value = c.name || '';
  document.getElementById('addCategoryDesc').value = c.description || '';
  document.getElementById('addCategoryImageUrl').value = c.imageLink || 'images/categories/generic.png';
  
  const typeSelect = document.getElementById('catImgSrcType');
  if (typeSelect) {
    typeSelect.value = 'url';
    toggleCatImageInputs();
  }
  
  const btnSave = document.getElementById('btnSaveCategory');
  if (btnSave) btnSave.textContent = '💾 Save Category Changes';
  
  const btnCancel = document.getElementById('btnCancelCategoryEdit');
  if (btnCancel) btnCancel.style.display = 'inline-block';
};

window.cancelCategoryEdit = function() {
  editingCategoryId = null;
  document.getElementById('addCategoryForm').reset();
  document.getElementById('addCategoryImageUrl').value = 'images/categories/generic.png';
  document.getElementById('catUploadStatus').textContent = '';
  
  const btnSave = document.getElementById('btnSaveCategory');
  if (btnSave) btnSave.textContent = '💾 Save Category Locally';
  
  const btnCancel = document.getElementById('btnCancelCategoryEdit');
  if (btnCancel) btnCancel.style.display = 'none';
};

// Add/Edit Brand submit
window.handleAddBrand = async function(event) {
  event.preventDefault();
  const name = document.getElementById('addBrandName').value.trim();
  const description = document.getElementById('addBrandDesc').value.trim();
  const imageLink = document.getElementById('addBrandImageUrl').value.trim();
  
  if (!name) return;
  
  const body = { name, description, imageLink };
  if (editingBrandId) {
    body.id = editingBrandId;
  }
  
  try {
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      cancelBrandEdit();
      alert('Brand saved successfully!');
      loadLocalBrandsAndCategories();
    } else {
      const data = await res.json();
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to save brand: ' + err.message);
  }
};

// Add/Edit Category submit
window.handleAddCategory = async function(event) {
  event.preventDefault();
  const name = document.getElementById('addCategoryName').value.trim();
  const description = document.getElementById('addCategoryDesc').value.trim();
  const imageLink = document.getElementById('addCategoryImageUrl').value.trim();
  
  if (!name) return;
  
  const body = { name, description, imageLink };
  if (editingCategoryId) {
    body.id = editingCategoryId;
  }
  
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      cancelCategoryEdit();
      alert('Category saved successfully!');
      loadLocalBrandsAndCategories();
    } else {
      const data = await res.json();
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to save category: ' + err.message);
  }
};

// Delete Brand
window.deleteBrandBtn = async function(id) {
  if (!confirm('Are you sure you want to delete this brand?')) return;
  try {
    const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadLocalBrandsAndCategories();
    } else {
      alert('Delete failed.');
    }
  } catch (err) {
    alert(err.message);
  }
};

// Delete Category
window.deleteCategoryBtn = async function(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadLocalBrandsAndCategories();
    } else {
      alert('Delete failed.');
    }
  } catch (err) {
    alert(err.message);
  }
};

// Sync from Firestore Buttons
window.syncBrandsFromFirestoreBtn = async function() {
  if (!confirm('This will download all brands from Cloud Firestore and overwrite your local brands.json. Continue?')) return;
  try {
    const { DbService } = await import('./db-service.js');
    const success = await DbService.syncBrandsFromFirestore();
    if (success) {
      alert('✅ Successfully downloaded brands from Firestore and saved locally!');
      loadLocalBrandsAndCategories();
    } else {
      alert('❌ Failed to download brands.');
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
};

window.syncCategoriesFromFirestoreBtn = async function() {
  if (!confirm('This will download all categories from Cloud Firestore and overwrite your local categories.json. Continue?')) return;
  try {
    const { DbService } = await import('./db-service.js');
    const success = await DbService.syncCategoriesFromFirestore();
    if (success) {
      alert('✅ Successfully downloaded categories from Firestore and saved locally!');
      loadLocalBrandsAndCategories();
    } else {
      alert('❌ Failed to download categories.');
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
};

// ==========================================
// FEATURED PRODUCTS MANAGER
// ==========================================

window.populateFeaturedFilters = function() {
  const catSelect = document.getElementById('filterFeaturedCat');
  const brandSelect = document.getElementById('filterFeaturedBrand');
  
  const categories = [...new Set(localProducts.map(p => p.category))].filter(Boolean).sort();
  const brands = [...new Set(localProducts.map(p => p.brand))].filter(Boolean).sort();
  
  let catHtml = '<option value="all">All Categories</option>';
  categories.forEach(c => { catHtml += `<option value="${c}">${c}</option>`; });
  if(catSelect) catSelect.innerHTML = catHtml;
  
  let brandHtml = '<option value="all">All Brands</option>';
  brands.forEach(b => { brandHtml += `<option value="${b}">${b}</option>`; });
  if(brandSelect) brandSelect.innerHTML = brandHtml;
};

window.filterLocalFeaturedList = function() {
  const query = (document.getElementById('searchFeaturedInput')?.value || '').toLowerCase();
  const cat = document.getElementById('filterFeaturedCat')?.value || 'all';
  const brand = document.getElementById('filterFeaturedBrand')?.value || 'all';
  
  const filtered = localProducts.filter(p => {
    const matchesSearch = p.productName?.toLowerCase().includes(query) || p.id?.toLowerCase().includes(query);
    const matchesCat = cat === 'all' || p.category === cat;
    const matchesBrand = brand === 'all' || p.brand === brand;
    return matchesSearch && matchesCat && matchesBrand;
  });
  
  renderFeaturedTable(filtered);
};

window.renderFeaturedTable = function(products) {
  const tbody = document.getElementById('localFeaturedTableBody');
  const countLabel = document.getElementById('featuredCountLabel');
  
  if (countLabel) {
    countLabel.textContent = `Showing ${products.length} available products`;
  }
  
  if (!tbody) return;
  
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-dim);">No products found matching filters.</td></tr>';
    return;
  }
  
  let html = '';
  products.forEach(p => {
    // Only show non-featured in this list
    if (p.isFeatured) return;

    const imgSrc = p.photoLink ? (p.photoLink.startsWith('http') ? p.photoLink : `/${p.photoLink}`) : '/images/placeholder.jpg';
    html += `
      <tr>
        <td>
          <img src="${imgSrc}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; border:1px solid #475569;" onerror="this.src='/images/placeholder.jpg'">
        </td>
        <td>
          <div style="font-weight:600; font-size:0.9rem; color:#fff;">${p.productName || 'Unnamed'}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">ID: ${p.id || 'N/A'}</div>
        </td>
        <td>
          <span style="background:#0f172a; padding:2px 6px; border-radius:4px; font-size:0.75rem; border:1px solid var(--border-dark); color:#fff;">${p.category || 'N/A'}</span>
        </td>
        <td>
          <span style="font-size:0.8rem; color:var(--text-dim);">${p.brand || 'N/A'}</span>
        </td>
        <td style="text-align:center;">
          <input type="checkbox" class="make-featured-checkbox" data-id="${p.id}" style="width:20px; height:20px; cursor:pointer;">
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;

  renderCurrentFeaturedTable();
};

window.renderCurrentFeaturedTable = function() {
  const tbody = document.getElementById('currentFeaturedTableBody');
  if (!tbody) return;

  const featured = localProducts.filter(p => p.isFeatured);

  if (featured.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-dim);">No products currently featured.</td></tr>';
    return;
  }

  let html = '';
  featured.forEach(p => {
    const imgSrc = p.photoLink ? (p.photoLink.startsWith('http') ? p.photoLink : `/${p.photoLink}`) : '/images/placeholder.jpg';
    html += `
      <tr>
        <td>
          <img src="${imgSrc}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; border:1px solid #475569;" onerror="this.src='/images/placeholder.jpg'">
        </td>
        <td>
          <div style="font-weight:600; font-size:0.9rem; color:#fff;">${p.productName || 'Unnamed'}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">ID: ${p.id || 'N/A'}</div>
        </td>
        <td>
          <span style="background:#0f172a; padding:2px 6px; border-radius:4px; font-size:0.75rem; border:1px solid var(--border-dark); color:#fff;">${p.category || 'N/A'}</span>
        </td>
        <td>
          <span style="font-size:0.8rem; color:var(--text-dim);">${p.brand || 'N/A'}</span>
        </td>
        <td style="text-align:center;">
          <button class="btn-secondary" style="color: #ef4444; border-color: #ef4444;" onclick="removeProductFeatured('${p.id}')">Remove</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
};

window.makeSelectedFeatured = async function() {
  const checkboxes = document.querySelectorAll('.make-featured-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select at least one product to make featured.');
    return;
  }

  let changed = false;
  checkboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    const idx = localProducts.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
      localProducts[idx].isFeatured = true;
      changed = true;
    }
  });

  if (changed) {
    await saveFeaturedChanges();
  }
};

window.removeProductFeatured = async function(id) {
  const idx = localProducts.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return;
  
  localProducts[idx].isFeatured = false;
  await saveFeaturedChanges();
};

window.saveFeaturedChanges = async function() {
  localStorage.setItem('ak_local_products', JSON.stringify(localProducts));
  
  const label = document.getElementById('featuredCountLabel');
  let oldText = 'Showing products';
  if (label) {
    oldText = label.textContent;
    label.textContent = 'Saving & Rebuilding site...';
    label.style.color = '#e67e22'; // orange
  }
    
  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: localProducts })
    });
    
    if (!response.ok) throw new Error('Failed to save to products.json');
    
    if (label) {
      label.textContent = 'Saved! Live in ~2s';
      label.style.color = '#27ae60'; // green
    }
    
    setTimeout(() => {
      filterLocalFeaturedList();
      if (label) {
        label.style.color = 'var(--text-dim)';
      }
    }, 2500);
    
  } catch (error) {
    console.error(error);
    alert('Failed to save featured status to file! Check server logs.');
    // We don't revert here easily for bulk, just reload
    filterLocalFeaturedList();
    if (label) {
      label.textContent = oldText;
      label.style.color = 'var(--text-dim)';
    }
  }
};

