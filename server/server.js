const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { parseProductsFromCsv } = require('./utils/csvParser');
const ShiprocketHelper = require('./utils/shiprocket');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// File paths
const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const ORDERS_FILE = path.join(__dirname, '../data/orders.json');

// Utility to read JSON
function readJson(filePath, defaultData = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultData;
  }
}

// Utility to write JSON
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
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

app.post('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const newProduct = {
    id: `prod-${Date.now()}`,
    photoLink: req.body.photoLink || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9',
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

  res.json({ success: true, message: 'Product added successfully.', product: newProduct });
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

// Shiprocket Pincode Check API
app.post('/api/shiprocket/check-pincode', async (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  const { pincode } = req.body;
  const shiprocketHelper = new ShiprocketHelper(settings.shiprocket?.email, settings.shiprocket?.password);
  const result = await shiprocketHelper.checkPincode(pincode);
  res.json(result);
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
