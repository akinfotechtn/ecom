// FIREBASE CONFIGURATION FOR AK INFOTECH
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDBorJWHVlb_O1Eg6ksj--COsuKrh_XVKE",
  authDomain: "ecom-33627.firebaseapp.com",
  projectId: "ecom-33627",
  storageBucket: "ecom-33627.firebasestorage.app",
  messagingSenderId: "846290890549",
  appId: "1:846290890549:web:08db767f908baa2f69e67c",
  measurementId: "G-E7J8KDXG4F"
};

// Initialize Firebase App, Auth & Cloud Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
  app,
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
  where, 
  orderBy, 
  serverTimestamp 
};
