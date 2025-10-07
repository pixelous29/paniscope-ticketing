// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
apiKey: "AIzaSyBh_CwZgloHw6l1-gjNW_ZdK9A6B9G1EA0",
authDomain: "paniscope-ticketing.firebaseapp.com",
projectId: "paniscope-ticketing",
storageBucket: "paniscope-ticketing.firebasestorage.app",
messagingSenderId: "593655564657",
appId: "1:593655564657:web:78e32049485fd5ade40ed0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);