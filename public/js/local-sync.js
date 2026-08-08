let localProducts = [];
let isBulkMode = false;

document.addEventListener('DOMContentLoaded', () => {
  loadLocalProducts();
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
  const name = document.getElementById('addProdName').value.trim();
  const brand = document.getElementById('addProdBrand').value.trim() || 'Generic';
  const category = document.getElementById('addProdCategory').value.trim() || 'General';
  const price = parseFloat(document.getElementById('addProdPrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('addProdSellingPrice').value) || 0;
  const photoLink = document.getElementById('addProdPhoto').value.trim() || 'images/cctv-wholesale.webp';
  const productSpec = document.getElementById('addProdSpec').value.trim();
  const inStock = document.getElementById('addProdInStock').checked;
  const isCombo = document.getElementById('addProdIsCombo').checked;

  if (!name || !sellingPrice) {
    alert("Please provide both Product Name and Selling Price!");
    return;
  }

  const newProduct = {
    id: `prod-${Date.now()}`,
    productName: name,
    brand,
    category,
    price,
    sellingPrice,
    photoLink,
    productSpec,
    inStock,
    isCombo,
    createdAt: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct)
    });

    if (!res.ok) {
      throw new Error(`Server returned error ${res.status}`);
    }

    localProducts.unshift(newProduct);
    localStorage.setItem('ak_local_products', JSON.stringify(localProducts));
    document.getElementById('addSingleProductForm').reset();
    renderLocalTable(localProducts);
    alert(`🎉 Successfully added "${name}" to local products.json!`);
  } catch (err) {
    // Fallback: save to local memory & trigger bulk save
    localProducts.unshift(newProduct);
    localStorage.setItem('ak_local_products', JSON.stringify(localProducts));
    await saveAllBulkToServer();
    renderLocalTable(localProducts);
    alert(`🎉 Added "${name}" directly to local JSON!`);
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

  if (!url) {
    alert("Please enter a Google Sheet URL first!");
    return;
  }

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
