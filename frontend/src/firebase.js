import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD40foWeZhh8WPH-ovZW8c-OSd8qUzTQhc",
  authDomain: "perfect-path-4c87b.firebaseapp.com",
  projectId: "perfect-path-4c87b",
  storageBucket: "perfect-path-4c87b.firebasestorage.app",
  messagingSenderId: "395895271005",
  appId: "1:395895271005:web:0a3b9cb4c4e3a6075fa7b4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();