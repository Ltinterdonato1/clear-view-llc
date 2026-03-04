import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyA4ECqfpJjbiYm8TnaTCZK422nkjqzWc_A",
  authDomain: "clear-view-llc.firebaseapp.com",
  projectId: "clear-view-llc",
  storageBucket: "clear-view-llc.firebasestorage.app",
  messagingSenderId: "544518864933",
  appId: "1:544518864933:web:ab32ee39ca197e9e12ffcc",
  measurementId: "G-5664YTQVZE"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// IMPORTANT: Ensure this region matches your deployed function exactly
export const functions = getFunctions(app, 'us-central1');