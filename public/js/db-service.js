// DUAL DATABASE SERVICE: FIREBASE CLOUD FIRESTORE + HERO BANNERS CRUD & AUTO-SCROLL
import { 
  db, 
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where
} from "./firebase-config.js";

// Handle redirect result on page load (for browsers that blocked popup)
getRedirectResult(auth).then((result) => {
  if (result && result.user) {
    console.log('Google sign-in via redirect succeeded:', result.user.email);
  }
}).catch((err) => {
  // Silently ignore - user just hasn't signed in yet via redirect
  if (err.code !== 'auth/no-current-user') {
    console.warn('Redirect sign-in result error:', err.code, err.message);
  }
});

const DEFAULT_PRODUCTS = [
  {
    id: "prod-101",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo 2K Prime 3MP PTZ",
    productSpec: "Cloud Storage Mobile App; Qubo Smart AI Human Detection",
    brand: "Qubo",
    category: "Wireless CCTV",
    price: 4490,
    sellingPrice: 2400,
    inStock: true,
    isCombo: false,
    deliveryCharge: 150
  },
  {
    id: "prod-102",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo 3MP Outdoor Bullet Camera",
    productSpec: "IP66 Weatherproof Night Vision Two-Way Audio Security",
    brand: "Qubo",
    category: "Wireless CCTV",
    price: 5490,
    sellingPrice: 3400,
    inStock: true,
    isCombo: false,
    deliveryCharge: 150
  },
  {
    id: "prod-103",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo Smart Door Lock Ultra",
    productSpec: "Fingerprint OTP PIN RFID Card & Mechanical Key Unlock",
    brand: "Qubo",
    category: "Security Systems",
    price: 9990,
    sellingPrice: 3900,
    inStock: true,
    isCombo: false,
    deliveryCharge: 200
  },
  {
    id: "prod-104",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo Video Door Bell 2K",
    productSpec: "2-Way Talk Intruder Alarm Motion Detector Wi-Fi Doorbell",
    brand: "Qubo",
    category: "Video Door Bell",
    price: 14990,
    sellingPrice: 8700,
    inStock: true,
    isCombo: false,
    deliveryCharge: 150
  },
  {
    id: "prod-105",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Trueview 4G WI-FI ROUTER R300",
    productSpec: "4G LTE Wi-Fi Router with SIM slot, 300Mbps High Speed",
    brand: "Trueview",
    category: "Accessories",
    price: 2299,
    sellingPrice: 1249,
    inStock: true,
    isCombo: true,
    deliveryCharge: 100
  },
  {
    id: "prod-106",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "CPPlus 4CH Full HD DVR Kit",
    productSpec: "4 Channel DVR + 2 Dome + 2 Bullet Cameras + Power Supply",
    brand: "CPPlus",
    category: "DVR & NVR",
    price: 12990,
    sellingPrice: 7990,
    inStock: true,
    isCombo: true,
    deliveryCharge: 250
  },
  {
    id: "prod-107",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Hikvision 8CH 4K NVR Network Video Recorder",
    productSpec: "8 Channel 4K H.265+ NVR for IP Surveillance Cameras",
    brand: "Hikvision",
    category: "DVR & NVR",
    price: 15990,
    sellingPrice: 9490,
    inStock: true,
    isCombo: false,
    deliveryCharge: 250
  },
  {
    id: "prod-108",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo Smart Plug 16A",
    productSpec: "Wi-Fi Smart Plug with Energy Monitoring Voice Control",
    brand: "Qubo",
    category: "Smart Plug",
    price: 1990,
    sellingPrice: 950,
    inStock: true,
    isCombo: false,
    deliveryCharge: 100
  },
  {
    id: "prod-109",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "Qubo Smart Plug 10A Dual",
    productSpec: "Dual Outlet Wi-Fi Smart Plug Alexa Google Assistant",
    brand: "Qubo",
    category: "Smart Plug",
    price: 2290,
    sellingPrice: 1050,
    inStock: true,
    isCombo: false,
    deliveryCharge: 100
  },
  {
    id: "prod-110",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "ESSL Biometric Attendance Terminal",
    productSpec: "Fingerprint & RFID Time Attendance System with Battery Backup",
    brand: "Generic",
    category: "Security Systems",
    price: 8990,
    sellingPrice: 4990,
    inStock: true,
    isCombo: false,
    deliveryCharge: 200
  }
];

const DEFAULT_BRANDS = [
  { id: "brand-1", name: "Trueview", imageLink: "images/trueview-logo.webp" },
  { id: "brand-2", name: "CPPlus", imageLink: "images/cpplus-logo.webp" },
  { id: "brand-3", name: "Hikvision", imageLink: "images/hikvision-logo.webp" },
  { id: "brand-4", name: "Gopix", imageLink: "images/gopix-logo.webp" },
  { id: "brand-5", name: "Dahua", imageLink: "images/dahua-logo.webp" },
  { id: "brand-6", name: "EZVIZ", imageLink: "images/ezviz-logo.webp" }
];

const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "CCTV Camera", imageLink: "images/cctv-wholesale.webp", deliveryCharge: 150 },
  { id: "cat-2", name: "Printers", imageLink: "images/printers-wholesale.webp", deliveryCharge: 200 },
  { id: "cat-3", name: "DVR & NVR", imageLink: "images/storage-wholesale.webp", deliveryCharge: 250 },
  { id: "cat-4", name: "Security Systems", imageLink: "images/biometrics-wholesale.webp", deliveryCharge: 200 },
  { id: "cat-5", name: "Accessories", imageLink: "images/networking-wholesale.webp", deliveryCharge: 100 }
];

const DEFAULT_SETTINGS = {
  storeName: "AK Infotech",
  tagline: "Wholesale & Retail Security Systems, CCTV & IT Solutions",
  deliveryCharge: 150,
  defaultGstPercent: 18,
  enableFreeShipping: true,
  freeShippingMinOrder: 3000,
  codAdvanceAmount: 1000,
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/17o2T1_38rPgFHXLIMbbheudVMKginlpzrgY8NztiQgs/edit?usp=sharing",
  razorpay: {
    keyId: "rzp_test_sampleKey123",
    keySecret: "sampleSecretKey456"
  },
  shiprocket: {
    email: "user@example.com",
    password: "Password123"
  },
  discountCoupons: [
    { code: "WELCOME10", discountPercent: 10, minOrderAmount: 1000 },
    { code: "AKINFO500", discountFlat: 500, minOrderAmount: 5000 }
  ]
};

export class DbService {
  // GOOGLE AUTHENTICATION
  static async loginWithGoogle() {
    try {
      // Use signInWithPopup directly for all devices (works on mobile & desktop when triggered by click/touch event)
      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        console.warn('Popup was blocked by browser. Falling back to redirect flow...');
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  }

  static logoutUser() {
    return signOut(auth);
  }

  static listenAuthState(callback) {
    return onAuthStateChanged(auth, callback);
  }

  // HERO BANNERS MANAGEMENT (CRUD)
  static async getHeroBanners() {
    try {
      const snap = await getDocs(collection(db, "hero_banners"));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      return [];
    } catch (err) {
      return [];
    }
  }

  static async addHeroBanner(bannerData) {
    const id = `hero-${Date.now()}`;
    const newBanner = { id, ...bannerData };
    await setDoc(doc(db, "hero_banners", id), newBanner);
    return newBanner;
  }

  static async updateHeroBanner(id, bannerData) {
    await setDoc(doc(db, "hero_banners", id), bannerData, { merge: true });
  }

  static async deleteHeroBanner(id) {
    await deleteDoc(doc(db, "hero_banners", id));
  }

  static _cachedProducts = null;
  static _cachedBrands = null;
  static _cachedCategories = null;
  static _cachedSettings = null;

  static clearCache() {
    this._cachedProducts = null;
    this._cachedBrands = null;
    this._cachedCategories = null;
    this._cachedSettings = null;
  }

  // PRODUCTS: Fetch all (always loads directly from public/data/products.json with zero Firestore reads)
  static async getProducts(forceRefresh = true) {
    if (!forceRefresh && this._cachedProducts && this._cachedProducts.length > 0) {
      return this._cachedProducts;
    }

    // 1. Fetch from static local JSON (/data/products.json, data/products.json, /public/data/products.json)
    const jsonUrls = [
      `data/products.json?t=${Date.now()}`,
      `/data/products.json?t=${Date.now()}`,
      `/public/data/products.json?t=${Date.now()}`,
      `public/data/products.json?t=${Date.now()}`,
      `/api/products?t=${Date.now()}`
    ];

    for (const url of jsonUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const prods = Array.isArray(data) ? data : (data.products || []);
          if (prods && prods.length > 0) {
            this._cachedProducts = prods;
            try {
              localStorage.setItem('ak_local_products', JSON.stringify(prods));
            } catch (e) {}
            return prods;
          }
        }
      } catch (e) {}
    }

    // 2. Check localStorage fallback
    try {
      const local = localStorage.getItem('ak_local_products');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._cachedProducts = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    this._cachedProducts = DEFAULT_PRODUCTS;
    return DEFAULT_PRODUCTS;
  }

  // RETRIEVE PRODUCTS FROM FIRESTORE AND PERSIST LOCALLY
  static async retrieveAndSaveFirestoreProductsLocally() {
    let prods = [];

    // 1. Try Firestore SDK
    try {
      const snap = await getDocs(collection(db, "products"));
      if (snap && snap.docs && snap.docs.length > 0) {
        prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore SDK fetch:", e);
    }

    // 2. Try REST API
    if (!prods.length) {
      try {
        const res = await fetch("https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/products");
        if (res.ok) {
          const json = await res.json();
          if (json.documents) {
            prods = json.documents.map(d => this._parseFirestoreRestDoc(d)).filter(Boolean);
          }
        }
      } catch (e) {}
    }

    if (!prods.length) {
      prods = DEFAULT_PRODUCTS;
    }

    // Save to localStorage & cache
    localStorage.setItem('ak_local_products', JSON.stringify(prods));
    this._cachedProducts = prods;

    // Send to local backend server if active
    try {
      await fetch('/api/products/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: prods })
      });
    } catch (e) {}

    return prods;
  }

  static async getProductById(id) {
    const products = await this.getProducts();
    return products.find(p => p.id === id);
  }

  static async addProduct(productData) {
    const customId = `prod-${Date.now()}`;
    const newProd = {
      ...productData,
      id: customId,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, "products", customId), newProd);
    } catch (err) {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProd)
      });
    }
    return newProd;
  }

  static async updateProduct(id, productData) {
    try {
      await setDoc(doc(db, "products", id), productData, { merge: true });
    } catch (err) {
      await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData)
      });
    }
  }

  static async deleteProduct(id) {
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (err) {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
    }
  }

  // BULK SYNC FROM GOOGLE SHEET (REPLACES CATALOG & REMOVES DUMMY ITEMS)
  static async bulkSyncProducts(productsArray, replaceAll = true) {
    try {
      if (replaceAll) {
        // Delete all existing products to remove dummy items
        const snap = await getDocs(collection(db, "products"));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "products", d.id));
        }
      }

      for (const p of productsArray) {
        const docId = p.id || `gs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, "products", docId), p);
      }
      return true;
    } catch (err) {
      console.error("Bulk sync error:", err);
      throw err;
    }
  }

  static async resetProductsToDefault() {
    await this.bulkSyncProducts(DEFAULT_PRODUCTS, true);
    return DEFAULT_PRODUCTS;
  }

  // BRANDS MANAGEMENT (ADD, EDIT, DELETE)
  static async getBrands() {
    try {
      const snap = await getDocs(collection(db, "brands"));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      for (const b of DEFAULT_BRANDS) {
        await setDoc(doc(db, "brands", b.id), b);
      }
      return DEFAULT_BRANDS;
    } catch (err) {
      return DEFAULT_BRANDS;
    }
  }

  static async addBrand(brandData) {
    const id = `brand-${Date.now()}`;
    const newBrand = { id, ...brandData };
    await setDoc(doc(db, "brands", id), newBrand);
    return newBrand;
  }

  static async updateBrand(id, brandData) {
    await setDoc(doc(db, "brands", id), brandData, { merge: true });
  }

  static async deleteBrand(id) {
    await deleteDoc(doc(db, "brands", id));
  }

  // CATEGORIES MANAGEMENT (ADD, EDIT, DELETE)
  static async getCategories() {
    try {
      const snap = await getDocs(collection(db, "categories"));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      for (const c of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, "categories", c.id), c);
      }
      return DEFAULT_CATEGORIES;
    } catch (err) {
      return DEFAULT_CATEGORIES;
    }
  }

  static async addCategory(catData) {
    const id = `cat-${Date.now()}`;
    const newCat = { id, ...catData };
    await setDoc(doc(db, "categories", id), newCat);
    return newCat;
  }

  static async updateCategory(id, catData) {
    await setDoc(doc(db, "categories", id), catData, { merge: true });
  }

  static async deleteCategory(id) {
    await deleteDoc(doc(db, "categories", id));
  }

  // USER PROFILE & DELIVERY ADDRESSES (CRUD)
  static async getUserAddresses(uid) {
    if (!uid) return [];
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists() && docSnap.data().addresses) {
        return docSnap.data().addresses;
      }
      const local = JSON.parse(localStorage.getItem(`ak_addresses_${uid}`) || '[]');
      return local;
    } catch (err) {
      return JSON.parse(localStorage.getItem(`ak_addresses_${uid}`) || '[]');
    }
  }

  static async addUserAddress(uid, addressData) {
    if (!uid) return;
    const addressId = `addr-${Date.now()}`;
    const newAddr = { id: addressId, ...addressData, createdAt: new Date().toISOString() };
    
    try {
      const existing = await this.getUserAddresses(uid);
      const updated = [newAddr, ...existing];
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
      localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(updated));
    } catch (err) {
      const local = JSON.parse(localStorage.getItem(`ak_addresses_${uid}`) || '[]');
      local.unshift(newAddr);
      localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(local));
    }
    return newAddr;
  }

  static async updateUserAddress(uid, addressId, addressData) {
    if (!uid) return;
    const existing = await this.getUserAddresses(uid);
    const updated = existing.map(a => a.id === addressId ? { ...a, ...addressData } : a);
    try {
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
    } catch (e) {}
    localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(updated));
  }

  static async deleteUserAddress(uid, addressId) {
    if (!uid) return;
    const existing = await this.getUserAddresses(uid);
    const updated = existing.filter(a => a.id !== addressId);
    try {
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
    } catch (e) {}
    localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(updated));
  }

  // STORE SETTINGS & PERSISTENT GOOGLE SHEET URL
  static async getSettings() {
    try {
      const docSnap = await getDoc(doc(db, "settings", "store_config"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const savedUrl = localStorage.getItem('ak_google_sheet_url') || data.googleSheetUrl;
        return { ...DEFAULT_SETTINGS, ...data, googleSheetUrl: savedUrl || DEFAULT_SETTINGS.googleSheetUrl };
      }
      await setDoc(doc(db, "settings", "store_config"), DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (err) {
      const localUrl = localStorage.getItem('ak_google_sheet_url');
      return { ...DEFAULT_SETTINGS, googleSheetUrl: localUrl || DEFAULT_SETTINGS.googleSheetUrl };
    }
  }

  static getStoreSettings() {
    return this.getSettings();
  }

  static async updateSettings(newSettings) {
    if (newSettings.googleSheetUrl) {
      localStorage.setItem('ak_google_sheet_url', newSettings.googleSheetUrl);
    }
    try {
      await setDoc(doc(db, "settings", "store_config"), newSettings, { merge: true });
    } catch (err) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });
    }
  }

  // ORDERS
  static saveOrderToLocalStorage(order) {
    try {
      const existing = JSON.parse(localStorage.getItem('ak_local_orders') || '[]');
      const filtered = existing.filter(o => String(o.id) !== String(order.id));
      filtered.unshift(order);
      localStorage.setItem('ak_local_orders', JSON.stringify(filtered.slice(0, 50)));
    } catch (e) {}
  }

  static getOrdersFromLocalStorage() {
    try {
      return JSON.parse(localStorage.getItem('ak_local_orders') || '[]');
    } catch (e) {
      return [];
    }
  }

  static async createOrder(orderPayload) {
    const user = auth.currentUser;
    const orderId = orderPayload.id || `AK-${Math.floor(100000 + Math.random() * 900000)}`;
    const fullOrder = {
      ...orderPayload,
      id: orderId,
      userUid: user ? user.uid : (orderPayload.userUid || null),
      userEmail: user ? (user.email || '') : (orderPayload.email || ''),
      customerEmail: orderPayload.email || (user ? user.email : ''),
      createdAt: new Date().toISOString(),
      status: orderPayload.status || 'PROCESSING'
    };

    // Store in local storage first (instant & resilient)
    this.saveOrderToLocalStorage(fullOrder);

    try {
      await this._withTimeout(setDoc(doc(db, "orders", orderId), fullOrder), 5000, null);
    } catch (err) {
      console.warn("Firestore setDoc order failed:", err);
    }
    return fullOrder;
  }

  static async getGuestOrder(orderId, phone) {
    try {
      const docSnap = await this._withTimeout(getDoc(doc(db, "orders", orderId)), 5000, null);
      if (docSnap && docSnap.exists()) {
        const orderData = docSnap.data();
        const orderPhone = String(orderData.phone || orderData.custPhone || '').replace(/\D/g, '');
        const searchPhone = String(phone).replace(/\D/g, '');
        if (orderPhone.includes(searchPhone) || searchPhone.includes(orderPhone)) {
          return orderData;
        }
      }
    } catch (err) {
      console.warn("Firestore lookup failed:", err);
    }
    // Check local storage fallback
    const localOrders = this.getOrdersFromLocalStorage();
    const found = localOrders.find(o => String(o.id) === String(orderId));
    if (found) {
      const orderPhone = String(found.phone || found.custPhone || '').replace(/\D/g, '');
      const searchPhone = String(phone).replace(/\D/g, '');
      if (orderPhone.includes(searchPhone) || searchPhone.includes(orderPhone)) {
        return found;
      }
    }
    return null;
  }

  static async trackOrderByIdOrPhone(queryStr) {
    try {
      const cleanStr = queryStr.trim().toUpperCase();
      const allOrders = await this.getOrders();
      return allOrders.filter(o => 
        (o.id && String(o.id).toUpperCase() === cleanStr) || 
        (o.phone && String(o.phone).includes(queryStr.trim())) ||
        (o.razorpayOrderId && String(o.razorpayOrderId).toUpperCase() === cleanStr)
      );
    } catch (err) {
      return [];
    }
  }

  // Helper: timeout wrapper for Firestore promises
  static _withTimeout(promise, ms, fallback = null) {
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([
      promise.then(val => { clearTimeout(timer); return val; }),
      timeout
    ]);
  }

  static async getUserOrders(uid, userEmail = '', userName = '') {
    const localOrders = this.getOrdersFromLocalStorage();
    let firestoreOrders = [];

    try {
      const all = await this.getOrders();
      firestoreOrders = all;
    } catch (err) {
      console.warn("getUserOrders error:", err);
    }

    const mergedMap = new Map();
    for (const o of localOrders) {
      if (o.id) mergedMap.set(String(o.id), o);
    }
    for (const o of firestoreOrders) {
      if (o.id) mergedMap.set(String(o.id), o);
    }

    const merged = Array.from(mergedMap.values());
    
    // Filter for this user (by uid, email, or customer name)
    const filtered = merged.filter(o => {
      if (uid && o.userUid && String(o.userUid) === String(uid)) return true;
      if (userEmail) {
        const target = userEmail.trim().toLowerCase();
        if (o.userEmail && o.userEmail.trim().toLowerCase() === target) return true;
        if (o.email && o.email.trim().toLowerCase() === target) return true;
        if (o.customerEmail && o.customerEmail.trim().toLowerCase() === target) return true;
      }
      if (userName && userName.trim().length > 2) {
        const nameTarget = userName.trim().toLowerCase();
        const ordCustName = String(o.customerName || o.name || o.fullName || o.custName || '').trim().toLowerCase();
        if (ordCustName && (ordCustName.includes(nameTarget) || nameTarget.includes(ordCustName))) return true;
      }
      return false;
    });

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return filtered;
  }

  static _parseFirestoreRestDoc(doc) {
    if (!doc || !doc.fields) return null;
    const fields = doc.fields;
    const obj = { id: doc.name.split('/').pop() };
    for (const [key, val] of Object.entries(fields)) {
      if (val.stringValue !== undefined) obj[key] = val.stringValue;
      else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
      else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
      else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
      else if (val.arrayValue !== undefined) {
        obj[key] = (val.arrayValue.values || []).map(v => {
          if (v.mapValue && v.mapValue.fields) {
            const item = {};
            for (const [k2, v2] of Object.entries(v.mapValue.fields)) {
              if (v2.stringValue !== undefined) item[k2] = v2.stringValue;
              else if (v2.integerValue !== undefined) item[k2] = parseInt(v2.integerValue);
              else if (v2.doubleValue !== undefined) item[k2] = parseFloat(v2.doubleValue);
              else if (v2.booleanValue !== undefined) item[k2] = v2.booleanValue;
            }
            return item;
          }
          return v.stringValue || v.integerValue || v;
        });
      }
    }
    return obj;
  }

  static async getOrders() {
    const localOrders = this.getOrdersFromLocalStorage();
    let firestoreOrders = [];

    // 1. Try Firestore SDK
    try {
      const snapPromise = getDocs(collection(db, "orders"));
      const snap = await this._withTimeout(snapPromise, 5000, null);
      if (snap && snap.docs && snap.docs.length > 0) {
        firestoreOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Firestore SDK getOrders failed:", err.message);
    }

    // 2. If SDK was empty or timed out, query Firestore REST API directly (100% reliable)
    if (!firestoreOrders.length) {
      try {
        const res = await fetch("https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/orders");
        if (res.ok) {
          const json = await res.json();
          if (json.documents && Array.isArray(json.documents)) {
            firestoreOrders = json.documents.map(d => this._parseFirestoreRestDoc(d)).filter(Boolean);
          }
        }
      } catch (restErr) {
        console.warn("Firestore REST getOrders failed:", restErr);
      }
    }

    const mergedMap = new Map();
    for (const o of localOrders) {
      if (o.id) mergedMap.set(String(o.id), o);
    }
    for (const o of firestoreOrders) {
      if (o.id) mergedMap.set(String(o.id), o);
    }

    const all = Array.from(mergedMap.values());
    all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return all;
  }

  static async updateOrder(id, orderData) {
    try {
      await setDoc(doc(db, "orders", id), orderData, { merge: true });
    } catch (err) {
      console.warn("Update order fallback error:", err);
    }
  }

  // DYNAMIC SEO INJECTION
  static injectProductSEO(product) {
    if (!product) return;

    document.title = `${product.productName} | AK Infotech Security Store`;

    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('og:title', `${product.productName} - AK Infotech`);
    setMeta('og:description', `${product.productSpec} | Best Price: ₹${product.sellingPrice}`);
    setMeta('og:image', product.photoLink || 'images/logo.webp');
    setMeta('og:type', 'product');
    setMeta('og:price:amount', product.sellingPrice);
    setMeta('og:price:currency', 'INR');

    let jsonLd = document.getElementById('jsonLdProductSchema');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.id = 'jsonLdProductSchema';
      jsonLd.type = 'application/ld+json';
      document.head.appendChild(jsonLd);
    }

    const schemaObj = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.productName,
      "image": [product.photoLink],
      "description": product.productSpec,
      "sku": product.id,
      "brand": {
        "@type": "Brand",
        "name": product.brand || "AK Infotech"
      },
      "offers": {
        "@type": "Offer",
        "url": window.location.href,
        "priceCurrency": "INR",
        "price": product.sellingPrice,
        "itemCondition": "https://schema.org/NewCondition",
        "availability": product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "Organization",
          "name": "AK Infotech"
        }
      }
    };

    jsonLd.textContent = JSON.stringify(schemaObj, null, 2);
  }
}
