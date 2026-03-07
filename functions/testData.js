const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = JSON.parse(
  fs.readFileSync("../../firebase-adminsdk.json", "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function check() {
  const users = await db
    .collection("users")
    .where("email", "==", "pixelous@protonmail.com")
    .get();
  if (users.empty) {
    console.log("no pixelous");
    return;
  }
  const u = users.docs[0];
  console.log("UserData:", u.data());

  const t = await db.collection("tickets").doc("h0AEL3sq2qvv8uXHgG8R").get();
  console.log("TicketData ccEmails:", t.data().ccEmails);
  console.log("TicketData clientEmail:", t.data().clientEmail);
}

check().catch(console.error);
