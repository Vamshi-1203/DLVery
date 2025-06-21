import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDzlzDkcFNnf9XWevzOkjgDv0Xt39aAuro",
  authDomain: "team26-ffb51.firebaseapp.com",
  projectId: "team26-ffb51",
  storageBucket: "team26-ffb51.firebasestorage.app",
  messagingSenderId: "114323576645",
  appId: "1:114323576645:web:bf2556e2745c26ee33902c",
  measurementId: "G-JWVFSVFRZX",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
