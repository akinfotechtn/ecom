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
  { id: "brand-1", name: "Trueview", imageLink: "images/brands/trueview.webp" },
  { id: "brand-2", name: "CPPlus", imageLink: "images/brands/cpplus.webp" },
  { id: "brand-3", name: "Hikvision", imageLink: "images/brands/hikvision.webp" },
  { id: "brand-4", name: "Gopix", imageLink: "images/brands/gopix.webp" },
  { id: "brand-5", name: "Dahua", imageLink: "images/brands/dahua.webp" },
  { id: "brand-6", name: "EZVIZ", imageLink: "images/brands/ezviz.webp" }
];

const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "CCTV Camera", imageLink: "images/cctv-wholesale.webp", deliveryCharge: 150 },
  { id: "cat-2", name: "Printers", imageLink: "images/categories/printers.webp", deliveryCharge: 200 },
  { id: "cat-3", name: "DVR & NVR", imageLink: "images/categories/hd-dvr.webp", deliveryCharge: 250 },
  { id: "cat-4", name: "Security Systems", imageLink: "images/categories/biometric.webp", deliveryCharge: 200 },
  { id: "cat-5", name: "Accessories", imageLink: "images/categories/accessories.webp", deliveryCharge: 100 }
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
  static slugify(text) {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  static getLinkPrefix() {
    const pathname = window.location.pathname;
    if (pathname.includes('/product/') || pathname.includes('/brands/') || pathname.includes('/categories/')) {
      return '../';
    }
    return '';
  }

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

  // HERO BANNERS MANAGEMENT (CRUD - Local First with instant rendering)
  static async getHeroBanners() {
    try {
      const cached = localStorage.getItem('ak_hero_banners');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Return cached immediately and refresh in background
            setTimeout(async () => {
              try {
                const snap = await getDocs(collection(db, "hero_banners"));
                if (!snap.empty) {
                  const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                  localStorage.setItem('ak_hero_banners', JSON.stringify(fresh));
                }
              } catch (e) { }
            }, 100);
            return parsed;
          }
        } catch (e) { }
      }

      const snap = await getDocs(collection(db, "hero_banners"));
      if (!snap.empty) {
        const banners = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem('ak_hero_banners', JSON.stringify(banners));
        return banners;
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

  // PRODUCTS: Instant Local-First Fetch (loads in <10ms)
  static async getProducts(forceRefresh = false) {
    if (!forceRefresh && this._cachedProducts && this._cachedProducts.length > 0) {
      return this._cachedProducts;
    }

    // 1. Check in-memory / localStorage cache for immediate 0ms render
    if (!forceRefresh) {
      try {
        const local = localStorage.getItem('ak_local_products');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this._cachedProducts = parsed;
          }
        }
      } catch (e) { }
    }

    // 2. Fetch authoritative compressed products.json
    const prefix = this.getLinkPrefix();
    const primaryUrl = `${prefix}data/products.json`;

    try {
      const res = await fetch(primaryUrl);
      if (res.ok) {
        const data = await res.json();
        const prods = Array.isArray(data) ? data : (data.products || []);
        if (prods && prods.length > 0) {
          this._cachedProducts = prods;
          try {
            localStorage.setItem('ak_local_products', JSON.stringify(prods));
          } catch (e) { }
          return prods;
        }
      }
    } catch (e) { }

    if (this._cachedProducts && this._cachedProducts.length > 0) {
      return this._cachedProducts;
    }

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
      } catch (e) { }
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
    } catch (e) { }

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

  // BRANDS — read/write locally
  static async getBrands(forceRefresh = false) {
    if (!forceRefresh && this._cachedBrands && this._cachedBrands.length > 0) {
      return this._cachedBrands;
    }

    const urls = [
      `/api/brands?t=${Date.now()}`,
      `data/brands.json?t=${Date.now()}`,
      `/data/brands.json?t=${Date.now()}`,
      `/public/data/brands.json?t=${Date.now()}`,
      `public/data/brands.json?t=${Date.now()}`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const brands = Array.isArray(data) ? data : (data.brands || []);
          if (brands && brands.length > 0) {
            this._cachedBrands = brands;
            return brands;
          }
        }
      } catch (err) { }
    }

    return DEFAULT_BRANDS;
  }

  static async addBrand(brandData) {
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.brand;
      }
    } catch (err) {
      console.error('Error adding brand locally:', err);
    }
    return { id: `brand-${Date.now()}`, ...brandData };
  }

  static async updateBrand(id, brandData) {
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...brandData })
      });
    } catch (err) {
      console.error('Error updating brand locally:', err);
    }
  }

  static async deleteBrand(id) {
    try {
      await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting brand locally:', err);
    }
  }

  // Download brands from firestore and save locally
  static async syncBrandsFromFirestore() {
    try {
      const snap = await getDocs(collection(db, "brands"));
      if (snap.empty) {
        throw new Error("No brands found in Firestore.");
      }
      const brands = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const res = await fetch('/api/brands/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brands })
      });
      return res.ok;
    } catch (err) {
      console.error("Firestore sync brands error:", err);
      throw err;
    }
  }

  // CATEGORIES — read/write locally
  static async getCategories(forceRefresh = false) {
    if (!forceRefresh && this._cachedCategories && this._cachedCategories.length > 0) {
      return this._cachedCategories;
    }

    const urls = [
      `/api/categories?t=${Date.now()}`,
      `data/categories.json?t=${Date.now()}`,
      `/data/categories.json?t=${Date.now()}`,
      `/public/data/categories.json?t=${Date.now()}`,
      `public/data/categories.json?t=${Date.now()}`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const cats = Array.isArray(data) ? data : (data.categories || []);
          if (cats && cats.length > 0) {
            this._cachedCategories = cats;
            return cats;
          }
        }
      } catch (err) { }
    }

    return DEFAULT_CATEGORIES;
  }

  static async addCategory(catData) {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.category;
      }
    } catch (err) {
      console.error('Error adding category locally:', err);
    }
    return { id: `cat-${Date.now()}`, ...catData };
  }

  static async updateCategory(id, catData) {
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...catData })
      });
    } catch (err) {
      console.error('Error updating category locally:', err);
    }
  }

  static async deleteCategory(id) {
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting category locally:', err);
    }
  }

  // Download categories from firestore and save locally
  static async syncCategoriesFromFirestore() {
    try {
      const snap = await getDocs(collection(db, "categories"));
      if (snap.empty) {
        throw new Error("No categories found in Firestore.");
      }
      const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const res = await fetch('/api/categories/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories })
      });
      return res.ok;
    } catch (err) {
      console.error("Firestore sync categories error:", err);
      throw err;
    }
  }

  static async deleteCategory(id) {
    // No-op locally — categories come from products
  }

  // USER PROFILE & DELIVERY ADDRESSES (CRUD)
  static async getUserAddresses(uid) {
    if (!uid) return [];
    try {
      const docSnap = await this._withTimeout(getDoc(doc(db, "users", uid)), 3000, null);
      if (docSnap && docSnap.exists && docSnap.exists() && docSnap.data().addresses) {
        return docSnap.data().addresses;
      }
    } catch (err) {}

    // Fallback to direct Firestore REST API
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/users/${uid}`);
      if (res.ok) {
        const json = await res.json();
        const parsed = this._parseFirestoreRestDoc(json);
        if (parsed && parsed.addresses && Array.isArray(parsed.addresses)) {
          return parsed.addresses;
        }
      }
    } catch (e) {}

    try {
      return JSON.parse(localStorage.getItem(`ak_addresses_${uid}`) || '[]');
    } catch (err) {
      return [];
    }
  }

  static async addUserAddress(uid, addressData) {
    if (!uid) return;

    try {
      const existing = await this.getUserAddresses(uid);
      const isDuplicate = existing.some(addr => {
        const matchStreet = (addr.street || addr.address || '').toLowerCase().trim() === (addressData.street || addressData.address || '').toLowerCase().trim();
        const matchPincode = (addr.pincode || '').toLowerCase().trim() === (addressData.pincode || '').toLowerCase().trim();
        const matchCityState = (addr.cityState || '').toLowerCase().trim() === (addressData.cityState || '').toLowerCase().trim();
        const matchName = (addr.fullName || addr.name || '').toLowerCase().trim() === (addressData.fullName || addressData.name || '').toLowerCase().trim();
        const matchPhone = (addr.phone || '').toLowerCase().trim() === (addressData.phone || '').toLowerCase().trim();
        return matchStreet && matchPincode && matchCityState && matchName && matchPhone;
      });

      if (isDuplicate) {
        console.log("Address already exists, skipping duplicate save.");
        // Return the existing duplicate address
        return existing.find(addr => {
          const matchStreet = (addr.street || addr.address || '').toLowerCase().trim() === (addressData.street || addressData.address || '').toLowerCase().trim();
          const matchPincode = (addr.pincode || '').toLowerCase().trim() === (addressData.pincode || '').toLowerCase().trim();
          const matchCityState = (addr.cityState || '').toLowerCase().trim() === (addressData.cityState || '').toLowerCase().trim();
          return matchStreet && matchPincode && matchCityState;
        });
      }

      const addressId = `addr-${Date.now()}`;
      const newAddr = { id: addressId, ...addressData, createdAt: new Date().toISOString() };
      const updated = [newAddr, ...existing];
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
      localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(updated));
      return newAddr;
    } catch (err) {
      const local = JSON.parse(localStorage.getItem(`ak_addresses_${uid}`) || '[]');
      const isDuplicate = local.some(addr => {
        const matchStreet = (addr.street || addr.address || '').toLowerCase().trim() === (addressData.street || addressData.address || '').toLowerCase().trim();
        const matchPincode = (addr.pincode || '').toLowerCase().trim() === (addressData.pincode || '').toLowerCase().trim();
        const matchCityState = (addr.cityState || '').toLowerCase().trim() === (addressData.cityState || '').toLowerCase().trim();
        const matchName = (addr.fullName || addr.name || '').toLowerCase().trim() === (addressData.fullName || addressData.name || '').toLowerCase().trim();
        const matchPhone = (addr.phone || '').toLowerCase().trim() === (addressData.phone || '').toLowerCase().trim();
        return matchStreet && matchPincode && matchCityState && matchName && matchPhone;
      });
      if (isDuplicate) return;

      const addressId = `addr-${Date.now()}`;
      const newAddr = { id: addressId, ...addressData, createdAt: new Date().toISOString() };
      local.unshift(newAddr);
      localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(local));
      return newAddr;
    }
  }

  static async updateUserAddress(uid, addressId, addressData) {
    if (!uid) return;
    const existing = await this.getUserAddresses(uid);
    const updated = existing.map(a => a.id === addressId ? { ...a, ...addressData } : a);
    try {
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
    } catch (e) { }
    localStorage.setItem(`ak_addresses_${uid}`, JSON.stringify(updated));
  }

  static async deleteUserAddress(uid, addressId) {
    if (!uid) return;
    const existing = await this.getUserAddresses(uid);
    const updated = existing.filter(a => a.id !== addressId);
    try {
      await setDoc(doc(db, "users", uid), { addresses: updated }, { merge: true });
    } catch (e) { }
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
      console.warn("Firestore settings update failed, falling back:", err);
    }
    
    // Always sync to local server settings.json to keep backend credentials in sync
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });
    } catch (err) {
      console.error("Local settings sync failed:", err);
    }
  }

  // ORDERS
  static saveOrderToLocalStorage(order) {
    try {
      const existing = JSON.parse(localStorage.getItem('ak_local_orders') || '[]');
      const filtered = existing.filter(o => String(o.id) !== String(order.id));
      filtered.unshift(order);
      localStorage.setItem('ak_local_orders', JSON.stringify(filtered.slice(0, 50)));
    } catch (e) { }
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

    // Auto-clean cart from Firestore immediately upon order creation to save storage space
    try {
      await this.deleteCartOnOrderPlaced();
    } catch (cleanErr) {
      console.warn("Auto-clean cart failed:", cleanErr);
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
    let orders = [];
    try {
      orders = await this.getOrders();
    } catch (err) {
      console.warn("getUserOrders error:", err);
      orders = this.getOrdersFromLocalStorage();
    }

    // Filter for this user (by uid, email, or customer name)
    const filtered = orders.filter(o => {
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
    let querySuccessful = false;

    // 1. Try Firestore SDK
    try {
      const snapPromise = getDocs(collection(db, "orders"));
      const snap = await this._withTimeout(snapPromise, 5000, null);
      if (snap && snap.docs) {
        firestoreOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        querySuccessful = true;
      }
    } catch (err) {
      console.warn("Firestore SDK getOrders failed:", err.message);
    }

    // 2. If SDK timed out or failed, query Firestore REST API directly (100% reliable)
    if (!querySuccessful) {
      try {
        const res = await fetch("https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/orders");
        if (res.ok) {
          const json = await res.json();
          if (json.documents && Array.isArray(json.documents)) {
            firestoreOrders = json.documents.map(d => this._parseFirestoreRestDoc(d)).filter(Boolean);
          } else {
            firestoreOrders = [];
          }
          querySuccessful = true;
        } else if (res.status === 404) {
          // 404 from Firestore REST API means the collection has 0 documents (empty collection)
          firestoreOrders = [];
          querySuccessful = true;
        }
      } catch (restErr) {
        console.warn("Firestore REST getOrders failed:", restErr);
      }
    }

    // If query was successful, synchronize localOrders by removing deleted ones
    if (querySuccessful) {
      const firestoreIds = new Set(firestoreOrders.map(o => String(o.id)));
      const syncedLocal = localOrders.filter(o => firestoreIds.has(String(o.id)));
      if (syncedLocal.length !== localOrders.length) {
        try {
          localStorage.setItem('ak_local_orders', JSON.stringify(syncedLocal));
        } catch (e) {}
      }
      return firestoreOrders; // Firestore is the single source of truth when online!
    }

    // Fallback if offline / failed to query Firestore entirely
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

  // --------------------------------------------------------------------------
  // LIVE & ABANDONED CARTS TRACKING (OPTIMIZED & LEAN TO SAVE FIRESTORE SPACE)
  // --------------------------------------------------------------------------

  static getCartSessionId() {
    try {
      const user = auth.currentUser;
      if (user && user.uid) return `user_${user.uid}`;
      let guestId = localStorage.getItem('ak_cart_session_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        localStorage.setItem('ak_cart_session_id', guestId);
      }
      return guestId;
    } catch (e) {
      return 'cart_' + Date.now();
    }
  }

  static _toFirestoreFields(obj) {
    const fields = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) continue;
      if (typeof val === 'string') {
        fields[key] = { stringValue: val };
      } else if (typeof val === 'number') {
        if (Number.isInteger(val)) {
          fields[key] = { integerValue: String(val) };
        } else {
          fields[key] = { doubleValue: val };
        }
      } else if (typeof val === 'boolean') {
        fields[key] = { booleanValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(item => {
              if (item && typeof item === 'object') {
                return { mapValue: { fields: DbService._toFirestoreFields(item) } };
              }
              return { stringValue: String(item) };
            })
          }
        };
      } else if (typeof val === 'object') {
        fields[key] = { mapValue: { fields: DbService._toFirestoreFields(val) } };
      }
    }
    return fields;
  }

  static async _writeFirestoreRestDoc(collectionName, docId, data) {
    try {
      const fields = this._toFirestoreFields(data);
      const url = `https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/${collectionName}/${docId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return res.ok;
    } catch (err) {
      console.warn(`Firestore REST write error (${collectionName}/${docId}):`, err);
      return false;
    }
  }

  static syncCartToFirestore(cartItems = null, customerLead = null) {
    if (this._cartDebounceTimer) {
      clearTimeout(this._cartDebounceTimer);
    }

    this._cartDebounceTimer = setTimeout(async () => {
      try {
        let items = cartItems;
        if (items === null) {
          try {
            items = JSON.parse(localStorage.getItem('ak_cart') || '[]');
          } catch (e) { items = []; }
        }

        const cartId = this.getCartSessionId();

        // 1. SPACE OPTIMIZATION: If cart is empty, delete document from Firestore immediately!
        if (!items || !items.length) {
          await this.deleteCartFromFirestore(cartId);
          return;
        }

        // 2. LEAD PERSISTENCE
        let storedLead = {};
        try {
          storedLead = JSON.parse(localStorage.getItem('ak_cart_lead') || '{}');
        } catch (e) {}

        if (customerLead && typeof customerLead === 'object') {
          storedLead = { ...storedLead, ...customerLead };
          try {
            localStorage.setItem('ak_cart_lead', JSON.stringify(storedLead));
          } catch (e) {}
        }

        const user = auth.currentUser;
        let userUid = user ? user.uid : null;
        if (!userUid && cartId && cartId.startsWith('user_')) {
          userUid = cartId.replace('user_', '');
        }

        // Auto-lookup phone & address from saved user profile if missing from lead
        if (userUid && (!storedLead.phone || !storedLead.address)) {
          try {
            const addrs = await this.getUserAddresses(userUid);
            if (addrs && addrs.length > 0) {
              const primary = addrs[0];
              if (!storedLead.phone && primary.phone) storedLead.phone = primary.phone;
              if (!storedLead.name && (primary.fullName || primary.name)) storedLead.name = primary.fullName || primary.name;
              if (!storedLead.address && (primary.street || primary.address)) storedLead.address = primary.street || primary.address;
              if (!storedLead.city && primary.cityState) storedLead.city = primary.cityState;
              if (!storedLead.pincode && primary.pincode) storedLead.pincode = primary.pincode;
              try { localStorage.setItem('ak_cart_lead', JSON.stringify(storedLead)); } catch (e) {}
            }
          } catch (e) {}
        }

        const defaultGst = (typeof storeSettings !== 'undefined' && storeSettings.defaultGstPercent !== undefined)
          ? Number(storeSettings.defaultGstPercent)
          : (typeof window !== 'undefined' && window.storeSettings?.defaultGstPercent !== undefined
            ? Number(window.storeSettings.defaultGstPercent)
            : 18);

        // 3. LEAN PAYLOAD: Strip bulky specs & long descriptions to minimize storage bytes
        const leanItems = items.map(i => {
          const basePrice = Number(i.sellingPrice || i.price || 0);
          const gstPercent = (i.gstPercent !== undefined && i.gstPercent !== null && i.gstPercent !== '')
            ? Number(i.gstPercent)
            : defaultGst;
          const gstAmount = Math.round((basePrice * gstPercent) / 100);
          const priceWithGst = basePrice + gstAmount;
          return {
            id: String(i.id || ''),
            name: String(i.productName || i.name || 'Product').slice(0, 70),
            price: basePrice,
            priceWithGst: priceWithGst,
            gstPercent: gstPercent,
            qty: Number(i.quantity || i.qty || 1),
            photo: String(i.photoLink || i.photo || 'images/logo.webp')
          };
        });

        const totalValue = leanItems.reduce((sum, item) => sum + (item.priceWithGst * item.qty), 0);
        const itemCount = leanItems.reduce((sum, item) => sum + item.qty, 0);

        const cartPayload = {
          id: cartId,
          userUid: user ? user.uid : null,
          customerName: storedLead.name || (user ? (user.displayName || '') : '') || '',
          customerEmail: storedLead.email || (user ? (user.email || '') : '') || '',
          customerPhone: storedLead.phone || '',
          customerAddress: storedLead.address || '',
          customerCity: storedLead.city || storedLead.cityState || '',
          customerPincode: storedLead.pincode || '',
          itemCount: itemCount,
          totalValue: totalValue,
          items: leanItems,
          updatedAt: new Date().toISOString(),
          isLoggedIn: !!user
        };

        // Dual Write: Attempt SDK write, guaranteed REST write fallback
        let writeSuccess = false;
        try {
          const res = await this._withTimeout(setDoc(doc(db, "carts", cartId), cartPayload, { merge: true }), 2500, null);
          if (res !== null) writeSuccess = true;
        } catch (sdkErr) {
          console.warn("Firestore SDK cart write failed, trying REST API:", sdkErr);
        }

        if (!writeSuccess) {
          await this._writeFirestoreRestDoc("carts", cartId, cartPayload);
        }
      } catch (err) {
        console.warn("Firestore cart sync error:", err);
      }
    }, 500);
  }

  static async deleteCartFromFirestore(cartId) {
    if (!cartId) return false;
    let deleted = false;
    try {
      await this._withTimeout(deleteDoc(doc(db, "carts", cartId)), 2500, null);
      deleted = true;
    } catch (err) {
      console.warn("Failed to delete cart via SDK:", err);
    }
    try {
      await fetch(`https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/carts/${cartId}`, {
        method: 'DELETE'
      });
      deleted = true;
    } catch (e) {}
    return deleted;
  }

  static async deleteCartOnOrderPlaced() {
    try {
      const cartId = this.getCartSessionId();
      await this.deleteCartFromFirestore(cartId);
      localStorage.removeItem('ak_cart_session_id');
      localStorage.removeItem('ak_cart_lead');
    } catch (e) {
      console.warn("deleteCartOnOrderPlaced error:", e);
    }
  }

  static async getActiveCarts() {
    let firestoreCarts = [];
    let querySuccessful = false;

    // 1. Try Firestore SDK
    try {
      const snapPromise = getDocs(collection(db, "carts"));
      const snap = await this._withTimeout(snapPromise, 5000, null);
      if (snap && snap.docs) {
        firestoreCarts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        querySuccessful = true;
      }
    } catch (err) {
      console.warn("Firestore SDK getActiveCarts failed:", err.message);
    }

    // 2. Fallback to Firestore REST API directly
    if (!querySuccessful) {
      try {
        const res = await fetch("https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/carts");
        if (res.ok) {
          const json = await res.json();
          if (json.documents && Array.isArray(json.documents)) {
            firestoreCarts = json.documents.map(d => this._parseFirestoreRestDoc(d)).filter(Boolean);
          } else {
            firestoreCarts = [];
          }
          querySuccessful = true;
        } else if (res.status === 404) {
          firestoreCarts = [];
          querySuccessful = true;
        }
      } catch (restErr) {
        console.warn("Firestore REST getActiveCarts failed:", restErr);
      }
    }

    firestoreCarts.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return firestoreCarts;
  }

  static async clearOldCarts(olderThanHours = 48) {
    try {
      const carts = await this.getActiveCarts();
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const cart of carts) {
        const cartTime = new Date(cart.updatedAt || 0).getTime();
        if (cartTime < cutoffTime) {
          await this.deleteCartFromFirestore(cart.id);
          deletedCount++;
        }
      }
      return deletedCount;
    } catch (err) {
      console.error("clearOldCarts error:", err);
      throw err;
    }
  }

  static async clearAllCarts() {
    try {
      const carts = await this.getActiveCarts();
      let deletedCount = 0;
      for (const cart of carts) {
        if (cart.id) {
          await this.deleteCartFromFirestore(cart.id);
          deletedCount++;
        }
      }
      return deletedCount;
    } catch (err) {
      console.error("clearAllCarts error:", err);
      throw err;
    }
  }

  // DYNAMIC SEO INJECTION (Schema.org JSON-LD & Open Graph)
  static injectProductSEO(product) {
    if (!product) return;

    const siteName = "AK Infotech Security Store";
    const title = `${product.productName} | ${siteName}`;
    const hasValidSpec = product.productSpec && product.productSpec.trim() && product.productSpec.trim().toLowerCase() !== 'high quality product';
    const rawDesc = hasValidSpec ? product.productSpec : (product.productName || '');
    const description = rawDesc.replace(/\s+/g, ' ').trim().slice(0, 160);
    const origin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://shop.akinfotechcctv.in';
    const canonicalUrl = typeof window !== 'undefined' ? `${origin}${window.location.pathname}` : 'https://shop.akinfotechcctv.in/product.html';
    
    let photoUrl = product.photoLink || 'images/cctv-wholesale.webp';
    if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
      photoUrl = `${origin}/${photoUrl.replace(/^\.?\/?/, '')}`;
    }

    document.title = title;

    const setMeta = (attr, key, content) => {
      if (!content && content !== 0) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', String(content));
    };

    // Primary Meta
    setMeta('name', 'title', title);
    setMeta('name', 'description', description);

    // Canonical link
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    // Standard Open Graph
    setMeta('property', 'og:type', 'product');
    setMeta('property', 'og:site_name', siteName);
    setMeta('property', 'og:locale', 'en_IN');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', photoUrl);
    setMeta('property', 'og:image:alt', product.productName);
    setMeta('property', 'og:url', canonicalUrl);

    // Product-Specific Open Graph
    setMeta('property', 'product:price:amount', product.sellingPrice || 0);
    setMeta('property', 'product:price:currency', 'INR');
    setMeta('property', 'product:availability', product.inStock !== false ? 'instock' : 'oos');
    setMeta('property', 'product:brand', product.brand || 'AK Infotech');
    setMeta('property', 'product:condition', 'new');

    // Twitter Cards
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', photoUrl);
    setMeta('name', 'twitter:image:alt', product.productName);

    // Schema.org JSON-LD
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
      "image": [photoUrl],
      "description": description,
      "sku": String(product.id || 'PROD-' + product.productName.slice(0, 10)),
      "mpn": String(product.id || 'MPN-' + product.productName.slice(0, 10)),
      "brand": {
        "@type": "Brand",
        "name": product.brand || "AK Infotech"
      },
      "offers": {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": "INR",
        "price": String(product.sellingPrice || 0),
        "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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

if (typeof window !== 'undefined') {
  window.DbService = DbService;
  // Automatically sync cart to Firestore when cartUpdated event fires in storefront
  window.addEventListener('cartUpdated', (e) => {
    try {
      DbService.syncCartToFirestore(e.detail);
    } catch (err) {
      console.warn('Cart sync listener error:', err);
    }
  });

  // Automatically sync existing cart on page load
  setTimeout(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('ak_cart') || '[]');
      if (existing && existing.length > 0) {
        DbService.syncCartToFirestore(existing);
      }
    } catch (e) {}
  }, 400);
}
