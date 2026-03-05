const admin = require("firebase-admin");
const serviceAccount = require("./paniscope-ticketing-firebase-adminsdk-h0e5d-c05e197825.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkPasswords() {
  const snapshot = await db.collection("temporaryPasswords").get();
  console.log("Found " + snapshot.docs.length + " temporary passwords.");
  snapshot.forEach((doc) => {
    console.log(doc.id, "=>", doc.data());
  });
}

checkPasswords().catch(console.error);
