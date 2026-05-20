import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCG6eBQLhJTOWhLguKIlDnCq2c_66rMhy0",
  authDomain: "emotion-wellbeing-ai.firebaseapp.com",
  projectId: "emotion-wellbeing-ai",
  storageBucket: "emotion-wellbeing-ai.firebasestorage.app",
  messagingSenderId: "491197726517",
  appId: "1:491197726517:web:50aa868fad46f98926567c",
  measurementId: "G-D84F0VXS7S"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
