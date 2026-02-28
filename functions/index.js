const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Configuration Zapier chargée depuis .env
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;

/**
 * 1. NOTIFICATION ZAPIER
 * Se déclenche dès qu'un nouveau ticket est créé dans Firestore
 */
exports.notifyZapierOnNewTicket = functions.firestore
  .document("tickets/{ticketId}")
  .onCreate(async (snap, context) => {
    const ticket = snap.data();
    const ticketId = context.params.ticketId;

    console.log(
      `Nouveau ticket détecté : ${ticketId} - Préparation Webhook Zapier...`,
    );

    try {
      if (!ZAPIER_WEBHOOK_URL) {
        console.warn(
          "L'URL Zapier (ZAPIER_WEBHOOK_URL) est manquante dans .env",
        );
        return;
      }

      // Préparation du "paquet cadeau" (Payload Json) pour Zapier
      const payload = {
        ticket_id: ticketId,
        subject: ticket.subject,
        client_name: ticket.clientName || ticket.client || ticket.clientUid,
        priority: ticket.priority || "Normale",
        ticket_url: `https://paniscope-ticketing.web.app/manager/ticket/${ticketId}`,
        created_at: new Date().toISOString(),
      };

      // Envoi du paquet cadeau à l'URL Zapier
      const response = await axios.post(ZAPIER_WEBHOOK_URL, payload);
      console.log(
        "✅ Webhook envoyé à Zapier avec succès ! (Status:",
        response.status,
        ")",
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'envoi du Webhook à Zapier :",
        error.message,
      );
    }
  });

/**
 * 2. EMAIL -> TICKET (WebHook Inbound)
 * Reçoit les emails de Make via multipart/form-data
 */
const busboy = require("busboy");

exports.inboundEmailToTicket = functions.https.onRequest((req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const bb = busboy({ headers: req.headers });
  const fields = {};
  let fileData = null;
  let fileMimeType = null;
  let fileName = null;

  bb.on("field", (name, val) => {
    fields[name] = val;
  });

  bb.on("file", (name, file, info) => {
    console.log(`Fichier détecté : ${info.filename}`);
    fileName = info.filename || "piece_jointe";
    fileMimeType = info.mimeType;
    let chunks = [];
    file.on("data", (data) => {
      chunks.push(data);
    });
    file.on("end", () => {
      fileData = Buffer.concat(chunks);
    });
  });

  bb.on("finish", async () => {
    try {
      const fromHeader = fields.from || "";
      const subject = fields.subject || "Sans objet";
      const plain = fields.text || "";

      // Extraction de l'email (ex: "Jean Dupont <jean@dupont.com>" devient "jean@dupont.com")
      const emailMatch = fromHeader.match(/<([^>]+)>/);
      const from = emailMatch
        ? emailMatch[1].toLowerCase().trim()
        : fromHeader.toLowerCase().trim();

      console.log(`Mail reçu de : ${from} - Sujet: ${subject}`);

      // 1. Chercher l'utilisateur par son email
      const userQuery = await db
        .collection("users")
        .where("email", "==", from)
        .limit(1)
        .get();

      if (userQuery.empty) {
        console.log(`Utilisateur non trouvé pour l'email : ${from}`);
        return res.status(200).send("Expéditeur inconnu, ticket non créé.");
      }

      const userData = userQuery.docs[0].data();
      const userId = userQuery.docs[0].id;

      // 2. Gérer la photo attachée (si présente)
      let attachmentUrl = null;
      if (fileData && fileMimeType && fileMimeType.startsWith("image/")) {
        console.log(`Traitement de la pièce jointe: ${fileName}`);
        const bucket = storage.bucket(
          "paniscope-ticketing.firebasestorage.app",
        );
        const storedFileName = `attachments/email_${Date.now()}_${fileName}`;
        const storageFile = bucket.file(storedFileName);

        const token = require("crypto").randomUUID();

        await storageFile.save(fileData, {
          metadata: {
            contentType: fileMimeType,
            metadata: {
              firebaseStorageDownloadTokens: token,
            },
          },
        });

        attachmentUrl = `https://firebasestorage.googleapis.com/v0/b/paniscope-ticketing.firebasestorage.app/o/${encodeURIComponent(storedFileName)}?alt=media&token=${token}`;
        console.log(`Image uploadée avec succès : ${attachmentUrl}`);
      }

      // 3. Créer le ticket dans Firestore
      const newTicket = {
        subject: subject,
        clientUid: userId,
        client: userData.displayName || from,
        status: "Nouveau",
        priority: "Normale",
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        conversation: [
          {
            author: "Client (Email)",
            text: plain,
            timestamp: new Date(),
          },
        ],
        hasNewClientMessage: true,
      };

      if (attachmentUrl) {
        newTicket.attachmentUrl = attachmentUrl;
      }

      const docRef = await db.collection("tickets").add(newTicket);
      console.log(`Ticket créé via email avec l'ID : ${docRef.id}`);

      return res.status(200).send(`Ticket #${docRef.id} créé !`);
    } catch (error) {
      console.error("Erreur lourde process email:", error);
      return res.status(500).send("Erreur interne du Cloud.");
    }
  });

  bb.end(req.rawBody);
});
