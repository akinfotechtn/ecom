// DUAL DATABASE SERVICE: FIREBASE CLOUD FIRESTORE + HERO BANNERS CRUD & AUTO-SCROLL
import { 
  db, 
  auth,
  googleProvider,
  signInWithPopup,
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

const DEFAULT_PRODUCTS = [
  {
    id: "prod-101",
    photoLink: "https://res.cloudinary.com/dympxkxk2/image/upload/v1783264637/realconnect/products/router.jpg",
    productName: "4G WI-FI ROUTER R300 WHITE",
    productSpec: "4G LTE Wi-Fi Router with SIM slot, 300Mbps High Speed, Dual External Antennas",
    brand: "Trueview",
    category: "CCTV Camera",
    price: 2299,
    sellingPrice: 1249,
    inStock: true,
    isCombo: true
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
  { id: "cat-1", name: "CCTV Camera", imageLink: "images/cctv-wholesale.webp" },
  { id: "cat-2", name: "Printers", imageLink: "images/printers-wholesale.webp" },
  { id: "cat-3", name: "DVR & NVR", imageLink: "images/storage-wholesale.webp" },
  { id: "cat-4", name: "Security Systems", imageLink: "images/biometrics-wholesale.webp" },
  { id: "cat-5", name: "Accessories", imageLink: "images/networking-wholesale.webp" }
];

const DEFAULT_SETTINGS = {
  storeName: "AK Infotech",
  tagline: "Wholesale & Retail Security Systems, CCTV & IT Solutions",
  deliveryCharge: 150,
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
  static loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
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

  // PRODUCTS: Fetch all
  static async getProducts() {
    try {
      const snap = await getDocs(collection(db, "products"));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      for (const p of DEFAULT_PRODUCTS) {
        await setDoc(doc(db, "products", p.id), p);
      }
      return DEFAULT_PRODUCTS;
    } catch (err) {
      console.warn("Firestore fallback to local:", err.message);
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          return data.products || DEFAULT_PRODUCTS;
        }
      } catch (e) {}
      return DEFAULT_PRODUCTS;
    }
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
      return false;
    }
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
  static async createOrder(orderPayload) {
    const user = auth.currentUser;
    const orderId = orderPayload.id || `AK-${Math.floor(100000 + Math.random() * 900000)}`;
    const fullOrder = {
      ...orderPayload,
      id: orderId,
      userUid: user ? user.uid : null,
      userEmail: user ? user.email : orderPayload.email || '',
      createdAt: new Date().toISOString(),
      status: orderPayload.status || 'PROCESSING'
    };

    try {
      await setDoc(doc(db, "orders", orderId), fullOrder);
    } catch (err) {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullOrder)
      });
    }
    return fullOrder;
  }

  static async getUserOrders(uid) {
    try {
      if (!uid) return [];
      const q = query(collection(db, "orders"), where("userUid", "==", uid));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      return [];
    }
  }

  static async trackOrderByIdOrPhone(queryStr) {
    try {
      const cleanStr = queryStr.trim().toUpperCase();
      const allOrders = await this.getOrders();
      return allOrders.filter(o => 
        o.id.toUpperCase() === cleanStr || 
        (o.phone && o.phone.includes(queryStr.trim())) ||
        (o.razorpayOrderId && o.razorpayOrderId.toUpperCase() === cleanStr)
      );
    } catch (err) {
      return [];
    }
  }

  static async getOrders() {
    try {
      const snap = await getDocs(collection(db, "orders"));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      return [];
    } catch (err) {
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const data = await res.json();
          return data.orders || [];
        }
      } catch (e) {}
      return [];
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
