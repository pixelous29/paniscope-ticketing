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

      // Vérifier si un manager a désactivé les notifications Zapier/Wimi
      try {
        const managersSnapshot = await db
          .collection("users")
          .where("role", "==", "manager")
          .get();

        let wimiEnabledByManagers = true;
        managersSnapshot.forEach((doc) => {
          if (doc.data().wimiNotificationsEnabled === false) {
            wimiEnabledByManagers = false;
          }
        });

        if (!wimiEnabledByManagers) {
          console.log(
            "Notification Zapier annulée : désactivée dans les paramètres d'un compte manager.",
          );
          return;
        }
      } catch (err) {
        console.error(
          "Erreur lors de la vérification des paramètres managers:",
          err,
        );
      }

      let clientName = ticket.clientName || ticket.client || ticket.clientUid;
      let companyName = "";

      if (ticket.clientUid) {
        try {
          const userDoc = await db
            .collection("users")
            .doc(ticket.clientUid)
            .get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.company) {
              companyName = userData.company;
              clientName = `${clientName} de chez ${companyName}`;
            }
          }
        } catch (err) {
          console.error(
            "Erreur lors de la récupération de la société de l'utilisateur:",
            err,
          );
        }
      }

      // Préparation du "paquet cadeau" (Payload Json) pour Zapier
      const payload = {
        ticket_id: ticketId,
        subject: ticket.subject,
        client_name: clientName,
        company_name: companyName,
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
  const files = [];

  bb.on("field", (name, val) => {
    fields[name] = val;
  });

  bb.on("file", (name, file, info) => {
    console.log(
      `Fichier détecté -> param: ${name}, filename: ${info.filename}, mime: ${info.mimeType}`,
    );
    const fileName = info.filename || `piece_jointe_${Date.now()}`;
    const fileMimeType = info.mimeType || "application/octet-stream";
    let chunks = [];

    file.on("data", (data) => {
      chunks.push(data);
    });

    file.on("end", () => {
      files.push({
        fileName: fileName,
        fileMimeType: fileMimeType,
        fileData: Buffer.concat(chunks),
      });
    });
  });

  bb.on("finish", async () => {
    try {
      const fromHeader = fields.from || "";
      const subject = fields.subject || "Sans objet";
      const plain = fields.text || "";

      // Extraction de l'email avec une RegEx robuste qui trouve le texte format email
      const emailMatch = fromHeader.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      );
      const from = emailMatch
        ? emailMatch[0].toLowerCase().trim()
        : fromHeader.toLowerCase().trim();

      console.log(
        `Mail reçu brut: ${fromHeader} -> Email extrait: ${from} - Sujet: ${subject}`,
      );

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

      // 2. Gérer les pièces jointes (jusqu'à 4)
      const attachmentUrls = [];
      const bucket = storage.bucket("paniscope-ticketing.firebasestorage.app");

      // On limite le traitement à 4 fichiers maximum
      const filesToProcess = files.slice(0, 4);

      for (const fileObj of filesToProcess) {
        if (fileObj.fileData && fileObj.fileData.length > 0) {
          console.log(
            `Traitement de la pièce jointe (taille: ${fileObj.fileData.length} octets) : ${fileObj.fileName}`,
          );
          const safeName = fileObj.fileName.replace(/[^a-zA-Z0-9.-]/g, "_"); // sécuriser le nom
          const storedFileName = `attachments/email_${Date.now()}_${safeName}`;
          const storageFile = bucket.file(storedFileName);

          const token = require("crypto").randomUUID();

          await storageFile.save(fileObj.fileData, {
            metadata: {
              contentType: fileObj.fileMimeType,
              metadata: {
                firebaseStorageDownloadTokens: token,
              },
            },
          });

          const attachmentUrl = `https://firebasestorage.googleapis.com/v0/b/paniscope-ticketing.firebasestorage.app/o/${encodeURIComponent(
            storedFileName,
          )}?alt=media&token=${token}`;

          attachmentUrls.push(attachmentUrl);
          console.log(`Fichier uploadé avec succès : ${attachmentUrl}`);
        }
      }

      const initialMessage = {
        author: "Client",
        uid: userId,
        text: plain,
        timestamp: new Date(),
        displayName: userData.displayName || from,
        photoURL: userData.photoURL || null,
      };

      if (attachmentUrls.length > 0) {
        initialMessage.attachmentUrls = attachmentUrls;
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
        conversation: [initialMessage],
        hasNewClientMessage: true,
      };

      if (attachmentUrls.length > 0) {
        newTicket.attachmentUrls = attachmentUrls;
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

/**
 * 3. NOTIFICATION EMAIL - NOUVELLE INSCRIPTION
 * Se déclenche quand un nouveau document utilisateur est créé dans Firestore
 * Envoie un email de notification à l'admin pour gérer la demande
 */
const nodemailer = require("nodemailer");

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "ssl0.ovh.net",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.notifyAdminOnNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;

    // Ne notifier que pour les comptes en attente de validation
    if (userData.status !== "pending") {
      console.log(
        `Utilisateur ${userId} créé avec le statut "${userData.status}", pas de notification.`,
      );
      return;
    }

    const adminEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL || "yves@paniscope.fr";
    const fromEmail = process.env.SMTP_FROM || "noreply@paniscope.fr";

    const displayName =
      userData.displayName ||
      `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
      userData.email;
    const company = userData.company ? ` (${userData.company})` : "";

    console.log(
      `Nouvelle inscription détectée : ${displayName} - Email: ${userData.email}`,
    );

    try {
      await smtpTransporter.sendMail({
        from: `"Support Paniscope" <${fromEmail}>`,
        to: adminEmail,
        subject: `🆕 Nouvelle demande de compte - ${displayName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0d6efd, #6f42c1); padding: 20px; border-radius: 10px 10px 0 0; color: white;">
              <h2 style="margin: 0;">🆕 Nouvelle demande de compte</h2>
              <p style="margin: 5px 0 0; opacity: 0.9;">Support Paniscope</p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 10px 10px;">
              <p>Bonjour,</p>
              <p><strong>${displayName}${company}</strong> a fait une demande de création de compte sur <strong>Support Paniscope</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold; width: 120px;">Nom</td>
                  <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${displayName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Email</td>
                  <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${userData.email}</td>
                </tr>
                ${userData.company ? `<tr><td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Société</td><td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${userData.company}</td></tr>` : ""}
              </table>
              <p>Merci de gérer cette demande en vous rendant sur le panneau d'administration :</p>
              <p style="text-align: center;">
                <a href="https://paniscope-ticketing.web.app/admin" 
                   style="display: inline-block; background: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Gérer les utilisateurs
                </a>
              </p>
              <p style="color: #6c757d; font-size: 0.85rem; margin-top: 20px;">
                Cet email a été envoyé automatiquement par Support Paniscope.
              </p>
            </div>
          </div>
        `,
      });

      console.log(
        `✅ Email de notification envoyé à ${adminEmail} pour l'inscription de ${displayName}`,
      );
    } catch (error) {
      console.error(
        `❌ Erreur lors de l'envoi de l'email de notification :`,
        error.message,
      );
    }
  });
