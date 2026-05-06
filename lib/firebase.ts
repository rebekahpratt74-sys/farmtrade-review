// lib/firebase.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Auth } from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import { getFunctions } from "firebase/functions";

// ✅ Your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDnTCvNQ_1uKuldmy24CQulLw9XQ3CXAP4",
  authDomain: "farmtrade-da2d3.firebaseapp.com",
  projectId: "farmtrade-da2d3",
  storageBucket: "farmtrade-da2d3.firebasestorage.app",
  messagingSenderId: "619786327497",
  appId: "1:619786327497:web:5362b1a850d34042380418",
  measurementId: "G-BHR90FRPKX"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 🔑 getReactNativePersistence exists at runtime in RN bundle,
// but may be missing in TS types in newer Firebase versions.
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence as
  | ((storage: any) => any)
  | undefined;

let auth: Auth;

try {
  if (!getReactNativePersistence) {
    console.log("❌ getReactNativePersistence not found at runtime");
    auth = firebaseAuth.getAuth(app);
  } else {
    auth = firebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log("✅ Auth initialized WITH AsyncStorage persistence");
  }
} catch (e) {
  // Fast refresh / already initialized
  auth = firebaseAuth.getAuth(app);
  console.log("ℹ️ Reusing existing Auth instance");
}

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "us-central1");

export { app, auth, db, functions, storage };

