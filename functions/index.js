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
      let subject = fields.subject || "Sans objet";
      let plain = fields.text || "";

      // --- NOUVEAU: Extraction de l'ID du ticket et Nettoyage du corps ---
      const ticketIdMatch = subject.match(/\[Ticket #([a-zA-Z0-9]+)\]/i);
      const existingTicketId = ticketIdMatch ? ticketIdMatch[1] : null;

      if (plain.includes("--- Répondez au-dessus de cette ligne ---")) {
        plain = plain.split("--- Répondez au-dessus de cette ligne ---")[0];
      }

      const lines = plain.split("\n");
      const cleanLines = [];
      for (let line of lines) {
        if (line.trim().startsWith(">")) continue;
        if (line.match(/^On .* wrote:$/i) || line.match(/^Le .* a écrit :$/i))
          break;
        if (line.match(/_{10,}/)) break;
        cleanLines.push(line);
      }
      plain = cleanLines.join("\n").trim();

      if (!plain && files.length === 0) {
        console.log("Email vide après nettoyage, on ignore.");
        return res.status(200).send("Email vide ignoré.");
      }
      // -------------------------------------------------------------------

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

      // 3. Gérer l'ajout au ticket existant ou création d'un nouveau
      if (existingTicketId) {
        const ticketRef = db.collection("tickets").doc(existingTicketId);
        const ticketDoc = await ticketRef.get();

        if (ticketDoc.exists) {
          const ticketData = ticketDoc.data();

          // Vérification si le ticket est clos
          if (
            ticketData.status === "Ticket Clôturé" ||
            ticketData.status === "Fermé" ||
            ticketData.status === "CLOSED" ||
            ticketData.status === "Clôturé"
          ) {
            console.log(
              `Tentative de réponse sur ticket clos ${existingTicketId} rejetée. Envoi d'un email d'information.`,
            );

            const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";
            await smtpTransporter.sendMail({
              from: `"Support Paniscope" <${fromEmail}>`,
              to: from, // L'email de l'expéditeur
              subject: `Re: [Ticket #${existingTicketId}] Ticket Clôturé`,
              text: `Bonjour,\n\nVous avez tenté de répondre au ticket #${existingTicketId}, mais celui-ci est actuellement clôturé.\n\nSi votre problème persiste ou si vous avez une nouvelle demande, nous vous invitons à ouvrir un nouveau ticket en envoyant un nouvel e-mail à cette adresse (sans répondre à cet e-mail ci).\n\nL'équipe Support Paniscope.`,
              html: `
                  <div style="font-family: Arial, sans-serif; color: #333;">
                    <p>Bonjour,</p>
                    <p>Vous avez tenté de répondre au ticket <strong>#${existingTicketId}</strong>, mais celui-ci est actuellement <strong>clôturé</strong>.</p>
                    <p>Si votre problème persiste ou si vous avez une nouvelle demande, nous vous invitons à ouvrir un nouveau ticket en envoyant un nouvel e-mail à cette adresse (sans utiliser la fonction "Répondre").</p>
                    <br>
                    <p>L'équipe Support Paniscope.</p>
                  </div>
                `,
            });

            return res
              .status(200)
              .send(
                `Réponse ignorée (Ticket #${existingTicketId} clôturé) et notification envoyée.`,
              );
          }

          await ticketRef.update({
            conversation: admin.firestore.FieldValue.arrayUnion(initialMessage),
            hasNewClientMessage: true,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
            status: "Nouveau", // On repasse en nouveau pour attirer l'attention du manager
          });
          console.log(
            `Réponse ajoutée au ticket existant : ${existingTicketId}`,
          );
          return res
            .status(200)
            .send(`Réponse ajoutée au ticket #${existingTicketId}`);
        } else {
          console.log(
            `Ticket ${existingTicketId} introuvable. Création d'un nouveau ticket.`,
          );
          subject = subject
            .replace(/Re:\s*/i, "")
            .replace(/\[Ticket #[a-zA-Z0-9]+\]\s*/i, "")
            .trim();
        }
      }

      // CAS 2 : CREATION D'UN NOUVEAU TICKET
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
    const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";

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

/**
 * 4. CREATION DE COMPTE CLIENT (par un Manager)
 * Permet à un Manager de créer un compte client sans être déconnecté
 */
exports.createClientAccount = functions.https.onCall(async (data, context) => {
  // Vérifier que l'appelant est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Vous devez être connecté pour effectuer cette action.",
    );
  }

  // Vérifier que l'appelant est un manager
  const callerId = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerId).get();
  if (!callerDoc.exists || callerDoc.data().role !== "manager") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Seuls les managers peuvent créer de nouveaux comptes.",
    );
  }

  const { email, firstName, lastName, company, photoBase64 } = data;
  let { password } = data;

  if (!email || !firstName || !lastName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Tous les champs obligatoires (email, prénom, nom) doivent être fournis.",
    );
  }

  const crypto = require("crypto");
  // Auto-generate password for security if not provided
  if (!password) {
    password = crypto.randomUUID().slice(0, 12) + "A1!";
  }

  try {
    // 1. Création de l'utilisateur dans Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`.trim(),
    });

    let finalPhotoURL = null;

    if (photoBase64) {
      try {
        const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const type = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const extension = type.split("/")[1] || "jpeg";
          const fileName = `avatars/${userRecord.uid}_${Date.now()}.${extension}`;

          const bucket = storage.bucket(
            "paniscope-ticketing.firebasestorage.app",
          );
          const file = bucket.file(fileName);

          const downloadToken = crypto.randomUUID();

          await file.save(buffer, {
            metadata: {
              contentType: type,
              metadata: {
                firebaseStorageDownloadTokens: downloadToken,
              },
            },
          });

          finalPhotoURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;

          // Mettre à jour Firebase Auth avec la photo
          await admin.auth().updateUser(userRecord.uid, {
            photoURL: finalPhotoURL,
          });
        }
      } catch (err) {
        console.error("Erreur lors de l'upload de l'avatar:", err);
      }
    }

    // 2. Création du document utilisateur correspondant dans Firestore
    await db
      .collection("users")
      .doc(userRecord.uid)
      .set({
        email: email,
        firstName: firstName,
        lastName: lastName,
        company: company || "",
        displayName: userRecord.displayName,
        role: "client",
        status: "approved", // Le compte est directement approuvé puisque créé par un manager
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        photoURL: finalPhotoURL,
        photoBase64: photoBase64 || null, // Miniature base64 pour un chargement instantané
        lastConnection: null, // Initialisation de la dernière connexion
      });

    // 2bis. Stockage sécurisé du mot de passe temporaire pour le manager
    await db.collection("temporaryPasswords").doc(userRecord.uid).set({
      password: password,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Envoi de l'email de bienvenue obligatoire
    const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";
    try {
      await smtpTransporter.sendMail({
        from: `"Support Paniscope" <${fromEmail}>`,
        to: email,
        subject: `Bienvenue sur le Support Paniscope`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0B1B2B;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://support.paniscope.fr/paniscope.png" alt="Paniscope" style="height: auto; max-width: 200px; max-height: 60px;">
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="https://support.paniscope.fr/pwa-192x192.png" alt="Support" style="width: 32px; height: 32px; border-radius: 6px; vertical-align: middle; margin-right: 12px;">
                  <h2 style="color: #0B1B2B; margin: 0; display: inline-block; vertical-align: middle; font-size: 22px;">Bienvenue sur le Support Paniscope !</h2>
                </div>
                <p>Bonjour <strong>${firstName} ${lastName}</strong>,</p>
                <p>Votre compte d'assistance a été créé avec succès. Vous pouvez dès à présent vous connecter pour soumettre et suivre vos tickets de support.</p>
                
                <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; font-size: 16px; color: #495057;">Vos identifiants de connexion :</h3>
                  <p style="margin: 5px 0;"><strong>Lien d'accès :</strong> <a href="https://support.paniscope.fr/" style="color: #0d6efd;">https://support.paniscope.fr</a></p>
                  <p style="margin: 5px 0;"><strong>Identifiant :</strong> ${email}</p>
                  <div style="margin-top: 15px;">
                    <strong>Mot de passe provisoire :</strong>
                    <div style="background: #ffffff; border: 1px dashed #ced4da; padding: 12px; text-align: center; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0B1B2B; margin-top: 10px; margin-bottom: 10px; user-select: all; cursor: pointer;">
                      ${password}
                    </div>
                    <p style="font-size: 11px; color: #6c757d; text-align: center; margin-top: 0;">(Sélectionnez le texte ci-dessus pour le copier)</p>
                  </div>
                </div>
                
                <p style="color: #dc3545; font-weight: bold; font-size: 0.9em;">
                  ⚠️ Important : Dès votre première connexion, nous vous invitons fortement à modifier ce mot de passe provisoire en vous rendant dans la rubrique "Mon compte".
                </p>
                
                <p style="margin-top: 30px; text-align: center;">
                  <a href="https://support.paniscope.fr/" style="display: inline-block; background: #0B1B2B; color: #D9AC5F; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Accéder au support
                  </a>
                </p>
              </div>
              
              <p style="text-align: center; color: white; font-size: 0.85rem; margin-top: 20px;">
                Cet email a été envoyé automatiquement merci de ne pas y répondre
              </p>
            </div>
          `,
      });
      console.log(`✅ Email de bienvenue envoyé à ${email}`);
    } catch (err) {
      console.error(
        "❌ Erreur lors de l'envoi de l'email de bienvenue :",
        err.message,
      );
    }

    return {
      success: true,
      message: "Compte client créé avec succès",
      uid: userRecord.uid,
    };
  } catch (error) {
    console.error(
      "Erreur Firebase Auth lors de la création du compte :",
      error,
    );
    // Gestion des erreurs courantes Firebase Auth
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "L'adresse email est déjà utilisée par un autre compte.",
      );
    }
    if (error.code === "auth/invalid-password") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Le mot de passe doit contenir au moins 6 caractères.",
      );
    }
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Une erreur est survenue lors de la création du compte.",
    );
  }
});

/**
 * 5. NOTIFICATION EMAIL - REPONSE AU CLIENT (Outbound)
 * Se déclenche quand un manager/dev répond à un ticket,
 * envoie un mail au client avec l'ID du ticket dans le sujet.
 */
exports.notifyClientOnNewMessage = functions.firestore
  .document("tickets/{ticketId}")
  .onUpdate(async (change, context) => {
    const ticketId = context.params.ticketId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeConv = beforeData.conversation || [];
    const afterConv = afterData.conversation || [];

    // CAS 1 : NOUVEAU MESSAGE (Le manager a répondu)
    if (afterConv.length > beforeConv.length) {
      const newMessage = afterConv[afterConv.length - 1];

      // Si l'auteur n'est PAS le client (et pas le système), on notifie le client
      if (newMessage.author !== "Client" && newMessage.author !== "Système") {
        console.log(
          `Nouveau message de ${newMessage.author} sur le ticket ${ticketId}. Préparation de l'email client...`,
        );

        try {
          // 1. Récupérer l'email du client
          let clientEmail = null;
          if (afterData.clientUid) {
            const userDoc = await db
              .collection("users")
              .doc(afterData.clientUid)
              .get();
            if (userDoc.exists) {
              clientEmail = userDoc.data().email;
            }
          }

          if (!clientEmail) {
            console.warn(
              `Impossible de trouver l'email du client pour le ticket ${ticketId}`,
            );
            return;
          }

          const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";
          const ticketSubject = afterData.subject || "Sans objet";

          // Nettoyer le HTML ou formatage texte
          const messageText = newMessage.text || "";

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5;">
              <div style="color: #999; font-size: 12px; margin-bottom: 20px;">
                --- Répondez au-dessus de cette ligne ---
              </div>
              
              <p>Bonjour,</p>
              <p><strong>${newMessage.displayName || newMessage.author}</strong> a répondu à votre ticket :</p>
              
              <div style="background-color: #f9f9f9; border-left: 4px solid #0d6efd; padding: 15px; margin: 20px 0; white-space: pre-wrap;">
${messageText}
              </div>
              
              ${
                newMessage.attachmentUrls &&
                newMessage.attachmentUrls.length > 0
                  ? `<p><em>📎 Ce message contient des pièces jointes. <a href="https://paniscope-ticketing.web.app/client/ticket/${ticketId}">Connectez-vous à l'application</a> pour les consulter.</em></p>`
                  : ""
              }
              
              <p>Vous pouvez répondre directement à cet e-mail pour ajouter un commentaire à votre ticket, ou vous connecter sur votre espace client : <br>
              <a href="https://paniscope-ticketing.web.app/client/ticket/${ticketId}" style="display:inline-block; margin-top:10px; padding:10px 15px; background-color:#0d6efd; color:#fff; text-decoration:none; border-radius:5px;">Voir mon ticket en ligne</a></p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
              <p style="font-size: 11px; color: #aaa;">Cet e-mail est lié au ticket #${ticketId}. Ne modifiez pas le sujet de cet e-mail lors de votre réponse.</p>
            </div>
          `;

          await smtpTransporter.sendMail({
            from: `"Support Paniscope" <${fromEmail}>`,
            to: clientEmail,
            subject: `Re: [Ticket #${ticketId}] ${ticketSubject}`,
            html: emailHtml,
            text: `--- Répondez au-dessus de cette ligne ---\n\nBonjour,\n\n${newMessage.displayName || newMessage.author} a répondu à votre ticket :\n\n${messageText}\n\nVous pouvez répondre directement à cet e-mail pour mettre à jour votre ticket.`,
          });

          console.log(
            `✅ Email de réponse envoyé avec succès au client ${clientEmail} (Ticket ${ticketId})`,
          );
        } catch (error) {
          console.error(
            `❌ Erreur lors de l'envoi de l'email de réponse (Ticket ${ticketId}):`,
            error,
          );
        }
      }
    }

    // CAS 2 : STATUT MODIFIÉ VERS "CLÔTURÉ"
    if (
      beforeData.status !== "Ticket Clôturé" &&
      beforeData.status !== "Clôturé" &&
      beforeData.status !== "CLOSED" &&
      (afterData.status === "Ticket Clôturé" ||
        afterData.status === "Clôturé" ||
        afterData.status === "CLOSED")
    ) {
      console.log(
        `Ticket ${ticketId} clôturé. Préparation de l'email de clôture au client...`,
      );
      try {
        // 1. Récupérer l'email du client
        let clientEmail = null;
        if (afterData.clientUid) {
          const userDoc = await db
            .collection("users")
            .doc(afterData.clientUid)
            .get();
          if (userDoc.exists) {
            clientEmail = userDoc.data().email;
          }
        }

        if (!clientEmail) {
          console.warn(
            `Impossible de trouver l'email du client pour la clôture du ticket ${ticketId}`,
          );
          return;
        }

        const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";
        const ticketSubject = afterData.subject || "Sans objet";

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5;">
              <p>Bonjour,</p>
              <p>Le statut de votre ticket <strong>#${ticketId}</strong> (<em>${ticketSubject}</em>) vient de passer à <strong>Clôturé</strong>.</p>
              
              <div style="background-color: #f0fff4; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #155724;">✅ Votre demande a été traitée et le ticket est maintenant clos.</p>
              </div>
              
              <p>Si vous avez une nouvelle demande ou si le problème persiste, nous vous invitons à <a href="mailto:${fromEmail}">nous envoyer un nouvel e-mail</a> ou à ouvrir un autre ticket depuis l'application.</p>
              
              <p>Merci pour votre confiance.<br>
              L'équipe Support Paniscope.</p>
            </div>
          `;

        await smtpTransporter.sendMail({
          from: `"Support Paniscope" <${fromEmail}>`,
          to: clientEmail,
          subject: `Re: [Ticket #${ticketId}] ${ticketSubject}`,
          html: emailHtml,
          text: `Bonjour,\n\nVotre ticket #${ticketId} (${ticketSubject}) a été clôturé.\n\nSi vous avez une nouvelle demande, veuillez ouvrir un nouveau ticket.\n\nL'équipe Support Paniscope.`,
        });

        console.log(
          `✅ Email de clôture envoyé avec succès au client ${clientEmail} (Ticket ${ticketId})`,
        );
      } catch (error) {
        console.error(
          `❌ Erreur lors de l'envoi de l'email de clôture (Ticket ${ticketId}):`,
          error,
        );
      }
    }
  });
