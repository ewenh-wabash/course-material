// ============================================================
// firebase-config.js
//
// Fill in the values below with your Firebase project's config.
// Find these in: Firebase Console -> Project Settings -> General
// -> "Your apps" -> Web app -> SDK setup and configuration.
//
// This file is imported by both student.js and admin.js.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAM1lRZSZ_TpyeGrDVOe3JIcE0SL_mi3gI",
  authDomain: "reflections-d6899.firebaseapp.com",
  projectId: "reflections-d6899",
  storageBucket: "reflections-d6899.firebasestorage.app",
  messagingSenderId: "598215736938",
  appId: "1:598215736938:web:5fc3d310e88aa556bb9413"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);