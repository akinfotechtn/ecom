const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { parseProductsFromCsv } = require('./utils/csvParser');
const ShiprocketHelper = require('./utils/shiprocket');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// File paths - Single Unified Data Folder (public/data)
const DATA_DIR = path.join(__dirname, '../public/data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Utility to read JSON
function readJson(filePath, defaultData = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw || !raw.trim()) return defaultData;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.products)) return parsed.products;
    return defaultData;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultData;
  }
}

// Utility to write JSON across all local product mirrors
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    // If updating products, mirror to data/products.json and root products.json
    if (filePath.includes('products.json')) {
      const pathsToSync = [
        path.join(__dirname, '../public/data/products.json'),
        path.join(__dirname, '../data/products.json'),
        path.join(__dirname, '../products.json')
      ];

      for (const p of pathsToSync) {
        try {
          const dir = path.dirname(p);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {}
      }
    }
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

// ---------------------------------------------------------
// PRODUCTS API
// ---------------------------------------------------------
app.get('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const { brand, category, isCombo, search } = req.query;

  let filtered = [...products];

  if (brand) {
    filtered = filtered.filter(p => p.brand?.toLowerCase() === brand.toLowerCase());
  }

  if (category) {
    filtered = filtered.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }

  if (isCombo === 'true') {
    filtered = filtered.filter(p => p.isCombo || p.category?.toLowerCase().includes('combo'));
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.productName?.toLowerCase().includes(q) ||
      p.productSpec?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }

  // Calculate unique brands & categories for dynamic UI filters
  const allBrands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  const allCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  res.json({
    success: true,
    total: filtered.length,
    brands: allBrands,
    categories: allCategories,
    products: filtered
  });
});

// BULK SAVE - called by local-sync.js when adding/editing single products
app.post('/api/products/bulk-save', (req, res) => {
  try {
    const products = req.body.products;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Expected { products: [...] }' });
    }
    const ok = writeJson(PRODUCTS_FILE, products);
    if (!ok) {
      return res.status(500).json({ success: false, message: 'Failed to write products.json' });
    }
    console.log(`[bulk-save] Saved ${products.length} products to disk.`);
    return res.json({ success: true, message: `Saved ${products.length} products.`, total: products.length });
  } catch (err) {
    console.error('[bulk-save] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/products', (req, res) => {
  if (Array.isArray(req.body.products)) {
    writeJson(PRODUCTS_FILE, req.body.products);
    return res.json({ success: true, message: 'Products saved successfully.', total: req.body.products.length });
  }

  const products = readJson(PRODUCTS_FILE, []);
  const newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    photoLink: req.body.photoLink || 'images/cctv-wholesale.webp',
    productName: req.body.productName,
    productSpec: req.body.productSpec || '',
    brand: req.body.brand || 'Generic',
    category: req.body.category || 'General',
    price: parseFloat(req.body.price) || 0,
    sellingPrice: parseFloat(req.body.sellingPrice) || 0,
    inStock: req.body.inStock !== false,
    isCombo: req.body.isCombo === true || req.body.category?.toLowerCase().includes('combo')
  };

  if (!newProduct.productName || !newProduct.sellingPrice) {
    return res.status(400).json({ success: false, message: 'Product name and selling price are required.' });
  }

  products.unshift(newProduct);
  writeJson(PRODUCTS_FILE, products);

  res.json({ success: true, message: 'Product added successfully.', product: newProduct, total: products.length });
});

app.put('/api/products/:id', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  products[index] = {
    ...products[index],
    photoLink: req.body.photoLink ?? products[index].photoLink,
    productName: req.body.productName ?? products[index].productName,
    productSpec: req.body.productSpec ?? products[index].productSpec,
    brand: req.body.brand ?? products[index].brand,
    category: req.body.category ?? products[index].category,
    price: parseFloat(req.body.price) ?? products[index].price,
    sellingPrice: parseFloat(req.body.sellingPrice) ?? products[index].sellingPrice,
    inStock: req.body.inStock ?? products[index].inStock,
    isCombo: req.body.isCombo ?? (req.body.category?.toLowerCase().includes('combo') || false)
  };

  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: 'Product updated.', product: products[index] });
});

app.delete('/api/products/:id', (req, res) => {
  let products = readJson(PRODUCTS_FILE, []);
  const initialLen = products.length;
  products = products.filter(p => p.id !== req.params.id);

  if (products.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: 'Product deleted.' });
});

app.post('/api/products/bulk-save', (req, res) => {
  const products = req.body?.products || req.body || [];
  if (!Array.isArray(products)) {
    return res.status(400).json({ success: false, message: 'Invalid products array.' });
  }
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true, message: `Successfully saved ${products.length} products to local JSON!`, total: products.length });
});

// ---------------------------------------------------------
// GOOGLE SHEETS & CSV SYNC API
// ---------------------------------------------------------
app.post('/api/sync-google-sheet', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const sheetUrl = req.body.sheetUrl || settings.googleSheetUrl;

    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: 'No Google Sheet URL provided.' });
    }

    const parsedProducts = await parseProductsFromCsv(sheetUrl);

    // Save imported products to store
    writeJson(PRODUCTS_FILE, parsedProducts);

    // Update settings with current URL & sync timestamp
    settings.googleSheetUrl = sheetUrl;
    settings.lastSyncedAt = new Date().toISOString();
    writeJson(SETTINGS_FILE, settings);

    res.json({
      success: true,
      message: `Successfully synced ${parsedProducts.length} products from Google Sheet!`,
      totalSynced: parsedProducts.length,
      lastSyncedAt: settings.lastSyncedAt,
      sampleProduct: parsedProducts[0]
    });
  } catch (err) {
    console.error('Google Sheet Sync Error:', err.message);
    res.status(500).json({
      success: false,
      message: `Google Sheet Sync Failed: ${err.message}. Make sure your sheet is published as CSV (File -> Share -> Publish to Web -> CSV).`
    });
  }
});

app.post('/api/upload-csv', async (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText) {
      return res.status(400).json({ success: false, message: 'CSV content missing.' });
    }

    const parsedProducts = await parseProductsFromCsv(csvText);
    writeJson(PRODUCTS_FILE, parsedProducts);

    res.json({
      success: true,
      message: `Successfully imported ${parsedProducts.length} products from CSV string!`,
      totalSynced: parsedProducts.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `CSV Parsing Failed: ${err.message}` });
  }
});

// ---------------------------------------------------------
// SETTINGS API
// ---------------------------------------------------------
app.get('/api/settings', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  res.json({ success: true, settings });
});

app.put('/api/settings', (req, res) => {
  const currentSettings = readJson(SETTINGS_FILE, {});
  const updatedSettings = {
    ...currentSettings,
    storeName: req.body.storeName || currentSettings.storeName,
    tagline: req.body.tagline || currentSettings.tagline,
    deliveryCharge: parseFloat(req.body.deliveryCharge) ?? currentSettings.deliveryCharge,
    freeShippingMinOrder: parseFloat(req.body.freeShippingMinOrder) ?? currentSettings.freeShippingMinOrder,
    codAdvanceAmount: parseFloat(req.body.codAdvanceAmount) ?? 1000,
    googleSheetUrl: req.body.googleSheetUrl ?? currentSettings.googleSheetUrl,
    razorpay: {
      keyId: req.body.razorpay?.keyId || currentSettings.razorpay?.keyId || '',
      keySecret: req.body.razorpay?.keySecret || currentSettings.razorpay?.keySecret || ''
    },
    shiprocket: {
      email: req.body.shiprocket?.email || currentSettings.shiprocket?.email || '',
      password: req.body.shiprocket?.password || currentSettings.shiprocket?.password || '',
      channelId: req.body.shiprocket?.channelId || currentSettings.shiprocket?.channelId || ''
    },
    discountCoupons: req.body.discountCoupons || currentSettings.discountCoupons || []
  };

  writeJson(SETTINGS_FILE, updatedSettings);
  res.json({ success: true, message: 'Settings saved successfully.', settings: updatedSettings });
});

// ---------------------------------------------------------
// RAZORPAY PAYMENT API (Online Payments & COD ₹1,000 Advance)
// ---------------------------------------------------------
app.post('/api/payment/create-razorpay-order', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const { amount, paymentType, customerDetails } = req.body;

    // Amount should be passed in INR, converted to paise (* 100)
    const orderAmountInPaise = Math.round((parseFloat(amount) || 0) * 100);

    if (orderAmountInPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order amount.' });
    }

    const razorpayKeyId = settings.razorpay?.keyId || 'rzp_test_sampleKey123';
    const razorpayKeySecret = settings.razorpay?.keySecret || 'sampleSecretKey456';

    // If live key is provided, instantiate real Razorpay SDK instance
    let razorpayOrderId = `order_sim_${Date.now()}`;

    if (razorpayKeyId && !razorpayKeyId.includes('sampleKey')) {
      try {
        const instance = new Razorpay({
          key_id: razorpayKeyId,
          key_secret: razorpayKeySecret
        });

        const options = {
          amount: orderAmountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: {
            paymentType: paymentType || 'ONLINE',
            customerPhone: customerDetails?.phone || ''
          }
        };

        const rzpOrder = await instance.orders.create(options);
        razorpayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.warn('Razorpay SDK notice (using fallback order ID):', rzpErr.message);
      }
    }

    res.json({
      success: true,
      razorpayOrderId,
      amount: orderAmountInPaise,
      currency: 'INR',
      keyId: razorpayKeyId,
      paymentType,
      isSimulation: razorpayKeyId.includes('sampleKey')
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/payment/verify-razorpay', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const keySecret = settings.razorpay?.keySecret || 'sampleSecretKey456';

  // If using simulation mode, approve automatically
  if (razorpay_order_id.startsWith('order_sim_') || keySecret.includes('sampleSecret')) {
    return res.json({
      success: true,
      verified: true,
      paymentId: razorpay_payment_id || `pay_sim_${Date.now()}`
    });
  }

  // Real signature verification logic
  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    return res.json({ success: isValid, verified: isValid, paymentId: razorpay_payment_id });
  } catch (err) {
    return res.status(400).json({ success: false, verified: false, message: err.message });
  }
});

// ---------------------------------------------------------
// ORDERS & SHIPROCKET DISPATCH API
// ---------------------------------------------------------
app.get('/api/orders', (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  res.json({ success: true, total: orders.length, orders });
});

app.post('/api/orders', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const orders = readJson(ORDERS_FILE, []);

    const {
      customerName,
      phone,
      email,
      address,
      pincode,
      city,
      state,
      items,
      paymentMethod, // 'ONLINE' or 'COD'
      paymentId,
      razorpayOrderId,
      couponApplied,
      subtotal,
      deliveryFee,
      discountAmount,
      finalTotal
    } = req.body;

    if (!customerName || !phone || !address || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'Missing required order details.' });
    }

    const codAdvanceFee = settings.codAdvanceAmount || 1000;
    const remainingBalanceAtDelivery = paymentMethod === 'COD' ? Math.max(0, finalTotal - codAdvanceFee) : 0;

    const newOrder = {
      id: `AK-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toISOString(),
      customerName,
      phone,
      email: email || '',
      address,
      pincode,
      city: city || 'Chennai',
      state: state || 'Tamil Nadu',
      items,
      subtotal: parseFloat(subtotal) || 0,
      deliveryFee: parseFloat(deliveryFee) || 0,
      discountAmount: parseFloat(discountAmount) || 0,
      finalTotal: parseFloat(finalTotal) || 0,
      paymentMethod, // ONLINE or COD
      paymentStatus: paymentMethod === 'COD' ? `ADVANCE_PAID_₹${codAdvanceFee}` : 'PAID_ONLINE',
      paymentId: paymentId || `pay_sim_${Date.now()}`,
      razorpayOrderId: razorpayOrderId || '',
      advancePaid: paymentMethod === 'COD' ? codAdvanceFee : finalTotal,
      balanceOnDelivery: remainingBalanceAtDelivery,
      status: 'PROCESSING',
      shiprocket: null
    };

    // Dispatch to Shiprocket API
    const shiprocketHelper = new ShiprocketHelper(settings.shiprocket?.email, settings.shiprocket?.password);
    const shiprocketRes = await shiprocketHelper.createShiprocketOrder(newOrder, settings);
    newOrder.shiprocket = shiprocketRes;

    orders.unshift(newOrder);
    writeJson(ORDERS_FILE, orders);

    res.json({
      success: true,
      message: paymentMethod === 'COD'
        ? `COD Order Placed! ₹${codAdvanceFee} Advance Paid successfully. Balance ₹${remainingBalanceAtDelivery} payable on delivery.`
        : 'Order Placed Successfully via Online Payment!',
      order: newOrder
    });
  } catch (err) {
    console.error('Order placement error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ORDER EMAIL NOTIFICATION ENDPOINT
app.post('/api/send-order-email', async (req, res) => {
  try {
    const order = req.body || {};
    if (!order || !order.id) {
      return res.status(400).json({ success: false, message: 'Missing order details.' });
    }

    const localSettings = readJson(SETTINGS_FILE, {});
    const settings = order.settings || localSettings || {};

    const smtpHost = settings.smtpHost || localSettings.smtpHost || process.env.SMTP_HOST || 'smtp.zoho.in';
    const smtpPort = parseInt(settings.smtpPort || localSettings.smtpPort || process.env.SMTP_PORT || '465');
    const smtpUser = settings.smtpUser || localSettings.smtpUser || process.env.SMTP_USER || 'admin@akinfotechcctv.in';
    const smtpPass = settings.smtpPass || localSettings.smtpPass || process.env.SMTP_PASS || '';
    const rawSender = settings.smtpSender || localSettings.smtpSender || process.env.SMTP_SENDER || 'AK Infotech';
    const adminRecipientsStr = settings.smtpRecipients || localSettings.smtpRecipients || process.env.SMTP_RECIPIENTS || 'akinfotechtn@gmail.com, admin@akinfotechcctv.in';

    if (!smtpPass) {
      console.warn("SMTP Password is missing. Cannot send order email.");
      return res.status(200).json({ success: false, message: 'SMTP Password missing in store settings.' });
    }

    // Format Sender (From Header) so Zoho/Gmail SMTP won't reject it
    const sender = rawSender.includes('<') ? rawSender : `"${rawSender}" <${smtpUser}>`;

    // Recipient list: Admin emails + Customer email
    const recipientList = adminRecipientsStr.split(',').map(s => s.trim()).filter(Boolean);
    const customerEmail = (order.email || order.userEmail || order.customerEmail || '').trim();
    if (customerEmail && !recipientList.some(e => e.toLowerCase() === customerEmail.toLowerCase())) {
      recipientList.push(customerEmail);
    }
    const recipients = recipientList.join(', ');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          <img src="${item.photoLink}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 8px;">
          <strong>${item.productName}</strong>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity || item.qty || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(item.sellingPrice || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${((item.sellingPrice || 0) * (item.quantity || item.qty || 1)).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const emailSubject = `🎉 New Order Placed: ${order.id} (₹${(order.finalTotal || 0).toLocaleString('en-IN')})`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0ea5e9; margin: 0 0 4px 0;">AK INFOTECH</h2>
          <p style="color: #64748b; font-size: 0.9rem; margin: 0;">New Order Notification Manager</p>
        </div>
        
        <h3 style="color: #0f172a; margin-top: 0;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Order ID:</strong></td>
            <td style="padding: 6px 0; text-align: right;"><strong>${order.id}</strong></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Date & Time:</strong></td>
            <td style="padding: 6px 0; text-align: right;">${new Date().toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Method:</strong></td>
            <td style="padding: 6px 0; text-align: right;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${order.paymentMethod || 'COD'}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Status:</strong></td>
            <td style="padding: 6px 0; text-align: right;">${order.paymentStatus || 'PENDING'}</td>
          </tr>
        </table>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Customer Details</h3>
        <p style="font-size: 0.9rem; line-height: 1.5; color: #334155; margin: 0 0 20px 0;">
          <strong>Name:</strong> ${order.customerName || order.name || 'N/A'}<br>
          <strong>Phone:</strong> ${order.phone || order.custPhone || 'N/A'}<br>
          <strong>Email:</strong> ${order.email || 'N/A'}<br>
          <strong>Address:</strong> ${order.address || ''}, ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}
        </p>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Item Name</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1; width: 60px;">Qty</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Price</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 10px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Subtotal (with GST):</td>
            <td style="padding: 6px 0; text-align: right;">₹${(order.subtotal || 0).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Delivery Charges:</td>
            <td style="padding: 6px 0; text-align: right;">${order.deliveryFee === 0 ? '<span style="color:#16a34a; font-weight:bold;">FREE</span>' : `₹${(order.deliveryFee || 0).toLocaleString('en-IN')}`}</td>
          </tr>
          ${order.discountAmount ? `
          <tr>
            <td style="padding: 6px 0; color: #16a34a;">Discount Code Applied:</td>
            <td style="padding: 6px 0; text-align: right; color: #16a34a;">-₹${(order.discountAmount || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #e2e8f0; font-size: 1.1rem; font-weight: bold;">
            <td style="padding: 10px 0; color: #0f172a;">Grand Total Payable:</td>
            <td style="padding: 10px 0; text-align: right; color: #0284c7;">₹${(order.finalTotal || 0).toLocaleString('en-IN')}</td>
          </tr>
          ${order.paymentMethod === 'COD' ? `
          <tr style="font-size: 0.9rem; color: #64748b;">
            <td style="padding: 6px 0;">Advance Paid Online:</td>
            <td style="padding: 6px 0; text-align: right;">₹${(order.advancePaid || 0).toLocaleString('en-IN')}</td>
          </tr>
          <tr style="font-size: 0.95rem; font-weight: bold; color: #b45309; background: #fffbe6; border: 1px dashed #ffe58f;">
            <td style="padding: 8px;">Balance Payable at Delivery:</td>
            <td style="padding: 8px; text-align: right;">₹${(order.balanceOnDelivery || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <a href="https://wa.me/919500673207" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">
            💬 Contact Store on WhatsApp
          </a>
        </div>
      </div>
    `;

    if (transporter) {
      await transporter.sendMail({
        from: sender,
        to: recipients,
        subject: emailSubject,
        html: emailBody
      });
      console.log(`✉️ Successful order email sent for order ${order.id} to ${recipients}`);
      return res.json({ success: true, message: 'Email sent successfully via Nodemailer SMTP!' });
    }

    res.json({ success: true, message: 'SMTP not configured, order received.' });
  } catch (err) {
    console.error('Email sending error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Shiprocket Full Proxy API (Fixes CORS on client-side requests)
app.post('/api/shiprocket', async (req, res) => {
  try {
    const { action, email, password, token, payload, shipment_id, courier_id, pickup_postcode, delivery_postcode, weight, cod } = req.body || {};

    if (action === 'login') {
      const loginRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await loginRes.json();
      return res.status(loginRes.status).json(data);
    }

    if (action === 'create_order') {
      const orderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await orderRes.json();
      return res.status(orderRes.status).json(data);
    }

    if (action === 'get_couriers') {
      const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=${pickup_postcode || '603202'}&delivery_postcode=${delivery_postcode || '600001'}&weight=${weight || 0.5}&cod=${cod ? 1 : 0}`;
      const courierRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await courierRes.json();
      return res.status(courierRes.status).json(data);
    }

    if (action === 'generate_awb') {
      const awbRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id, courier_id })
      });
      const data = await awbRes.json();
      return res.status(awbRes.status).json(data);
    }

    if (action === 'generate_label') {
      const labelRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id: [shipment_id] })
      });
      const data = await labelRes.json();
      return res.status(labelRes.status).json(data);
    }

    return res.status(400).json({ success: false, message: `Unknown Shiprocket action: ${action}` });
  } catch (err) {
    console.error("Shiprocket proxy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Ak Info Ecom Server is running on port ${PORT}`);
  console.log(` Storefront UI: http://localhost:${PORT}`);
  console.log(` Admin Portal : http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
