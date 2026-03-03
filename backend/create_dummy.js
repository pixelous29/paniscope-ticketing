/* eslint-disable */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const dummyTickets = [
  {
    subject: "Dummy Kanban 1 - Bug visuel",
    description: "Le bouton de connexion est décalé sur mobile.",
    priority: "Haute",
    status: "IN_PROGRESS",
    devPhase: "PLANNING",
    assignedTo: ["developpeur@paniscope.fr"],
    clientId: "client123",
    clientName: "Boulangerie Test",
    clientEmail: "test@boulangerie.fr",
    category: "frontend",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    archived: false,
  },
  {
    subject: "Dummy Kanban 2 - API lente",
    description: "L'affichage des commandes prend plus de 5 secondes.",
    priority: "Critique",
    status: "IN_PROGRESS",
    devPhase: "DEVELOPMENT",
    assignedTo: ["developpeur@paniscope.fr"],
    clientId: "client456",
    clientName: "Pâtisserie Demo",
    clientEmail: "demo@patisserie.fr",
    category: "backend",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    archived: false,
  },
  {
    subject: "Dummy Kanban 3 - Nouveau logo",
    description: "Intégrer le nouveau logo dans le header.",
    priority: "Normale",
    status: "IN_PROGRESS",
    devPhase: "TESTING",
    assignedTo: ["developpeur@paniscope.fr"],
    clientId: "client789",
    clientName: "Snack Express",
    clientEmail: "contact@snack.fr",
    category: "design",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    archived: false,
  },
];

async function createTickets() {
  const ticketsRef = db.collection("tickets");
  for (const ticket of dummyTickets) {
    try {
      const docRef = await ticketsRef.add(ticket);
      console.log("Document écrit avec l'ID: ", docRef.id);
    } catch (e) {
      console.error("Erreur lors de l'ajout: ", e);
    }
  }
  process.exit();
}

createTickets();
