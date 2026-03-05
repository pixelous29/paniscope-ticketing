require("dotenv").config({ path: "frontend/.env" });
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const {
  getFirestore,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} = require("firebase/firestore");
const admin = require("firebase-admin");

// 1. Initialize admin to create a user with a known password
const serviceAccount = require("./functions/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const dbAdmin = admin.firestore();

// 2. Initialize Client SDK
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runTest() {
  const testEmail = "testclient_bot@paniscope.fr";
  const testPwd = "TestPassword123!";
  let uid = null;

  // Clean up if exists
  try {
    const user = await admin.auth().getUserByEmail(testEmail);
    uid = user.uid;
    await admin.auth().deleteUser(uid);
    await dbAdmin.collection("users").doc(uid).delete();
    await dbAdmin.collection("temporaryPasswords").doc(uid).delete();
  } catch (e) {
    // ignore
  }

  console.log("Creating user...");
  const userRecord = await admin.auth().createUser({
    email: testEmail,
    password: testPwd,
    displayName: "Test Bot",
  });
  uid = userRecord.uid;

  await dbAdmin.collection("users").doc(uid).set({
    email: testEmail,
    firstName: "Test",
    lastName: "Bot",
    company: "Test Co",
    displayName: "Test Bot",
    role: "client",
    status: "approved",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    photoURL: null,
    lastConnection: null,
  });

  await dbAdmin.collection("temporaryPasswords").doc(uid).set({
    password: testPwd,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("User created! Logging in with Client SDK...");

  try {
    const cred = await signInWithEmailAndPassword(auth, testEmail, testPwd);
    console.log("Logged in client:", cred.user.uid);

    console.log("Attempting to update lastConnection...");
    const userDocRef = doc(db, "users", uid);
    try {
      await updateDoc(userDocRef, {
        lastConnection: serverTimestamp(),
      });
      console.log("✅ lastConnection updated successfully!");
    } catch (e) {
      console.error("❌ Erreur maj lastConnection:", e.message);
    }

    console.log("Attempting to delete temporaryPassword...");
    const tempPwdRef = doc(db, "temporaryPasswords", uid);
    try {
      await deleteDoc(tempPwdRef);
      console.log("✅ provisional password deleted successfully!");
    } catch (e) {
      console.error("❌ Erreur suppression mdp provisoire:", e.message);
    }
  } catch (e) {
    console.error("Login failed:", e);
  }

  process.exit(0);
}

runTest();
