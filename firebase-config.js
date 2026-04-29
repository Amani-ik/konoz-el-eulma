import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyB6qS-V41Aevm-IsWV4q7oZ95VEunwzUaI",
  authDomain: "konoz-el-eulma.firebaseapp.com",
  projectId: "konoz-el-eulma",
  storageBucket: "konoz-el-eulma.firebasestorage.app",
  messagingSenderId: "515912311938",
  appId: "1:515912311938:web:914be7d74a1c9dc377009b",
  measurementId: "G-4G02GT5LQ8",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
