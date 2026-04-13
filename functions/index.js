const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

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

/**
 * 1. NOTIFICATION MANAGERS
 * Se déclenche dès qu'un nouveau ticket est créé dans Firestore
 */
exports.notifyManagersOnNewTicket = functions.firestore
  .document("tickets/{ticketId}")
  .onCreate(async (snap, context) => {
    const ticketId = context.params.ticketId;
    
    // Parapluie de robustesse: Si le navigateur du client a gardé en cache (SW/PWA)
    // l'ancien comportement qui créait le ticket sans la conversation puis faisait un updateDoc...
    // On attend 1.5 seconde et on va lire l'état ultime en base de données !
    await new Promise(resolve => setTimeout(resolve, 1500));
    const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
    const freshTicketSnap = await ticketRef.get();
    const ticket = freshTicketSnap.exists ? freshTicketSnap.data() : snap.data();

    console.log(`Nouveau ticket détecté : ${ticketId} - Préparation Email pour Managers...`);

    let clientName = ticket.clientName || ticket.client || ticket.clientEmail || "Client inconnu";
    let companyName = ticket.companyDomain || "";

    if (ticket.clientUid) {
      try {
        const userDoc = await db.collection("users").doc(ticket.clientUid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          let userRealName = (userData.firstName || userData.lastName) 
            ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim() 
            : userData.displayName;

          companyName = userData.company || companyName;

          if (userRealName) {
            clientName = companyName ? `${userRealName} (${companyName})` : userRealName;
          } else if (companyName) {
            // Prevent repeating the company name if it's already the default name
            clientName = (clientName === companyName) ? companyName : `${clientName} (${companyName})`;
          }
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de la société de l'utilisateur:", err);
      }
    }

    const ticketUrl = `https://paniscope-ticketing.web.app/manager/ticket/${ticketId}`;
    
    let initialMessage = "Aucun contenu.";
    console.log(`[DEBUG_TICKET] conversation: ${JSON.stringify(ticket.conversation)}`);
    if (ticket.conversation && ticket.conversation.length > 0) {
      if (ticket.conversation[0].text && ticket.conversation[0].text.trim() !== "") {
        initialMessage = ticket.conversation[0].text;
      } else if (ticket.conversation[0].attachmentUrls && ticket.conversation[0].attachmentUrls.length > 0) {
        initialMessage = "Message envoyé sans texte (uniquement avec des pièces jointes).";
      }
    }

    const hasAttachments = (ticket.conversation && ticket.conversation.length > 0 && ticket.conversation[0].attachmentUrls && ticket.conversation[0].attachmentUrls.length > 0) || (ticket.attachmentUrls && ticket.attachmentUrls.length > 0);
    const attachmentNote = hasAttachments ? `<br><p>📎 <em>Ce ticket contient des pièces jointes (visibles depuis l'application).</em></p>` : "";

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "support@paniscope.fr";
    const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";



    try {
      await smtpTransporter.sendMail({
        from: `"Support Paniscope" <${fromEmail}>`, 
        to: adminEmail,
        subject: `[Ticket #${ticketId}] Nouveau ticket de ${clientName} : ${ticket.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <div style="background-color: #0B1B2B; color: #D9AC5F; padding: 10px; border-radius: 5px 5px 0 0;">
              <h2 style="margin: 0;">Nouveau ticket de support</h2>
            </div>
            <div style="background: #ffffff; padding: 20px; border: 1px solid #ddd; border-top: none;">
              <p>Bonjour,</p>
              <p><strong>${clientName}</strong> a ouvert un nouveau ticket d'assistance.</p>
              <br>
              <p><strong>Sujet :</strong> ${ticket.subject}</p>
              <p><strong>Priorité :</strong> ${ticket.priority || "Normale"}</p>
              <br>
              <p><strong>Message original :</strong></p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #D9AC5F; white-space: pre-wrap;">${initialMessage}</div>
              ${attachmentNote}
              <br>
              <p><a href="${ticketUrl}" style="background-color: #0B1B2B; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Répondre depuis l'application</a></p>
              <p style="font-size: 13px; color: #555; margin-top: 15px;">Vous pouvez également répondre directement à cet email pour converser avec le client. La réponse sera automatiquement ajoutée dans l'application et transmise au client !</p>
            </div>
          </div>
        `
      });
      console.log(`✅ Email de notification envoyé aux managers (${adminEmail}) pour le ticket ${ticketId}`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de l'email aux managers :`, error.message);
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

      const systemEmailLower = (process.env.SMTP_FROM || "support@paniscope.fr").toLowerCase();
      if (from === systemEmailLower) {
         console.log(`Boucle évitée: L'email provient du système (${from}). On l'ignore.`);
         return res.status(200).send("Email système ignoré (évitement de boucle).");
      }

      console.log(
        `Mail reçu brut: ${fromHeader} -> Email extrait: ${from} - Sujet: ${subject}`,
      );

      // 1. Chercher l'utilisateur par son email exact d'abord
      let userQuery = await db
        .collection("users")
        .where("email", "==", from)
        .limit(1)
        .get();

      let userData = null;
      let userId = null;

      if (!userQuery.empty) {
        userData = userQuery.docs[0].data();
        userId = userQuery.docs[0].id;
      } else {
        // 1.bis. L'utilisateur n'existe pas, on cherche si le nom de domaine correspond à une extension autorisée (companyDomain)
        console.log(
          `Utilisateur non trouvé par email, recherche par extension...`,
        );
        const domainMatch = from.match(/@(.+)$/);

        if (domainMatch && domainMatch[1]) {
          const emailDomain = domainMatch[1].toLowerCase();

          // Ignorer les domaines publics fréquents pour éviter d'associer un inconnu @gmail.com avec un autre client @gmail.com
          const publicDomains = [
            "gmail.com",
            "yahoo.fr",
            "yahoo.com",
            "hotmail.fr",
            "hotmail.com",
            "outlook.fr",
            "outlook.com",
            "orange.fr",
            "wanadoo.fr",
            "sfr.fr",
            "free.fr",
            "laposte.net",
          ];

          if (!publicDomains.includes(emailDomain)) {
            // Chercher le premier utilisateur qui a ce companyDomain
            const domainQuery = await db
              .collection("users")
              .where("companyDomain", "==", emailDomain)
              .limit(1)
              .get();

            if (!domainQuery.empty) {
              userData = domainQuery.docs[0].data();
              userId = domainQuery.docs[0].id;
              console.log(
                `Utilisateur non référencé (${from}) mais rattaché à l'entreprise via le domaine : ${emailDomain}`,
              );
            }
          } else {
            console.log(
              `Domaine public ignoré pour l'association d'entreprise : ${emailDomain}`,
            );
          }
        }
      }

      if (!userData) {
        console.log(
          `Expéditeur inconnu et aucun domaine entreprise correspondant : ${from}`,
        );
        return res.status(200).send("Expéditeur inconnu, ticket non créé.");
      }

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

      let userRole = userData && userData.role ? userData.role : "client";
      let isManager = (userRole === "manager" || userRole === "admin" || userRole === "dev");
      let messageAuthor = isManager ? "Support" : "Client";

      const initialMessage = {
        author: messageAuthor,
        uid: userId,
        text: plain,
        timestamp: new Date(),
        displayName: (userData && userData.displayName && userData.company) ? `${userData.displayName} (${userData.company})` : (userData ? (userData.displayName || userData.company || from) : from),
        photoURL: (userData && userData.photoURL) || null,
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

          // Gestion des ccEmails si la personne qui répond n'est pas l'auteur principal
          const updatedCcEmails = Array.isArray(ticketData.ccEmails)
            ? [...ticketData.ccEmails]
            : [];
          if (
            from !== ticketData.clientEmail &&
            !updatedCcEmails.includes(from) &&
            from !== systemEmailLower
          ) {
            updatedCcEmails.push(from);
          }

          const updates = {
            conversation: admin.firestore.FieldValue.arrayUnion(initialMessage),
            hasNewClientMessage: true,
            ccEmails: updatedCcEmails,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (
            ticketData.status === "En attente" ||
            ticketData.status === "En attente de validation"
          ) {
            updates.status = "En cours";
          }

          await ticketRef.update(updates);

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
        clientEmail: from, // L'email de la personne qui a écrit
        client: (userData && userData.displayName && userData.company) ? `${userData.displayName} (${userData.company})` : (userData ? (userData.company || userData.displayName) : from),
        companyDomain: userData ? userData.companyDomain : null, // On ajoute le companyDomain pour le partage
        status: "Nouveau",
        priority: "Normale",
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        conversation: [initialMessage],
        hasNewClientMessage: true,
        ccEmails: [], // On initialise le tableau ccEmails
      };

      // On ajoute EXCLUSIVEMENT l'expéditeur en CC.
      // S'il s'agit d'un membre non-inscrit, cela garantit qu'il recevra les réponses.
      // Le titulaire du compte (userData.email) n'est PAS mis en copie automatiquement.
      if (from && from !== systemEmailLower) {
        newTicket.ccEmails.push(from);
      }

      if (attachmentUrls.length > 0) {
        newTicket.attachmentUrls = attachmentUrls;
      }

      const counterRef = db.collection("counters").doc("ticketCounter");
      const nextIdStr = await db.runTransaction(async (t) => {
        const counterDoc = await t.get(counterRef);
        let nextNum = 1;

        if (counterDoc.exists) {
          nextNum = counterDoc.data().lastId + 1;
        }

        t.set(counterRef, { lastId: nextNum }, { merge: true });
        return String(nextNum).padStart(7, '0');
      });

      const docRef = db.collection("tickets").doc(nextIdStr);
      await docRef.set(newTicket);
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
          // 1. Récupérer l'email du client (priorité à l'auteur original du ticket)
          let clientEmail = afterData.clientEmail || null;

          if (!clientEmail && afterData.clientUid) {
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
                  ? `<p><em>📎 Ce message contient des pièces jointes. <a href="https://paniscope-ticketing.web.app/ticket/${ticketId}">Connectez-vous à l'application</a> pour les consulter.</em></p>`
                  : ""
              }
              
              <p>Vous pouvez répondre directement à cet e-mail pour ajouter un commentaire à votre ticket, ou vous connecter sur votre espace client : <br>
              <a href="https://paniscope-ticketing.web.app/ticket/${ticketId}" style="display:inline-block; margin-top:10px; padding:10px 15px; background-color:#0d6efd; color:#fff; text-decoration:none; border-radius:5px;">Voir mon ticket en ligne</a></p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
              <p style="font-size: 11px; color: #aaa;">Cet e-mail est lié au ticket #${ticketId}. Ne modifiez pas le sujet de cet e-mail lors de votre réponse.</p>
            </div>
          `;

          const mailOptions = {
            from: `"Support Paniscope" <${fromEmail}>`,
            to: clientEmail,
            subject: `Re: [Ticket #${ticketId}] ${ticketSubject}`,
            html: emailHtml,
            text: `--- Répondez au-dessus de cette ligne ---\n\nBonjour,\n\n${newMessage.displayName || newMessage.author} a répondu à votre ticket :\n\n${messageText}\n\nVous pouvez répondre directement à cet e-mail pour mettre à jour votre ticket.`,
          };

          if (afterData.ccEmails && afterData.ccEmails.length > 0) {
            // Nettoyage : retirer l'adresse TO et l'adresse FROM de la liste des CC pour éviter les doublons et les boucles
            const cleanCc = afterData.ccEmails.filter(
              (email) => email !== clientEmail && email !== fromEmail,
            );
            if (cleanCc.length > 0) {
              mailOptions.cc = cleanCc.join(",");
            }
          }

          await smtpTransporter.sendMail(mailOptions);

          console.log(
            `✅ Email de réponse envoyé avec succès au client ${clientEmail} ${afterData.ccEmails && afterData.ccEmails.length > 0 ? `et CC (${afterData.ccEmails.join(", ")}) ` : ""}(Ticket ${ticketId})`,
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
        let clientEmail = afterData.clientEmail || null;
        if (!clientEmail && afterData.clientUid) {
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

        const closeMailOptions = {
          from: `"Support Paniscope" <${fromEmail}>`,
          to: clientEmail,
          subject: `Re: [Ticket #${ticketId}] ${ticketSubject}`,
          html: emailHtml,
          text: `Bonjour,\n\nVotre ticket #${ticketId} (${ticketSubject}) a été clôturé.\n\nSi vous avez une nouvelle demande, veuillez ouvrir un nouveau ticket.\n\nL'équipe Support Paniscope.`,
        };

        if (afterData.ccEmails && afterData.ccEmails.length > 0) {
          const cleanCc = afterData.ccEmails.filter(
            (email) => email !== clientEmail,
          );
          if (cleanCc.length > 0) {
            closeMailOptions.cc = cleanCc.join(",");
          }
        }

        await smtpTransporter.sendMail(closeMailOptions);

        console.log(
          `✅ Email de clôture envoyé avec succès au client ${clientEmail} ${afterData.ccEmails && afterData.ccEmails.length > 0 ? `et CC (${afterData.ccEmails.join(", ")}) ` : ""}(Ticket ${ticketId})`,
        );
      } catch (error) {
        console.error(
          `❌ Erreur lors de l'envoi de l'email de clôture (Ticket ${ticketId}):`,
          error,
        );
      }
    }
  });

/**
 * 6. NOTIFICATION EMAIL - MENTION DANS NOTE INTERNE (Outbound)
 * Se déclenche quand une note interne est ajoutée
 * et notifie les membres de l'équipe taggués avec @[Nom].
 */
exports.notifyTeamOnInternalMention = functions.firestore
  .document("tickets/{ticketId}")
  .onUpdate(async (change, context) => {
    const ticketId = context.params.ticketId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeNotes = beforeData.internalNotes || [];
    const afterNotes = afterData.internalNotes || [];

    // Si une nouvelle note interne a été ajoutée
    if (afterNotes.length > beforeNotes.length) {
      const newNote = afterNotes[afterNotes.length - 1];
      const messageText = newNote.text || "";

      // Extraction de toutes les mentions de type @[Nom]
      const mentionRegex = /@\[([^\]]+)\]/g;
      const mentionedNames = [];
      let match;
      while ((match = mentionRegex.exec(messageText)) !== null) {
        mentionedNames.push(match[1].trim()); // match[1] contient le nom sans les crochets et le @
      }

      if (mentionedNames.length > 0) {
        console.log(`Mentions trouvées dans la note du ticket ${ticketId} :`, mentionedNames.join(", "));
        
        try {
            // Récupérer les membres de l'équipe
            const usersSnapshot = await db.collection("users").where("role", "in", ["manager", "admin", "developer"]).get();
            const teamMembers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const emailsToSend = [];
            
            for (const name of mentionedNames) {
              const queryLower = name.toLowerCase();
              
              // Trouver le(s) membre(s) correspondant au nom taggué
              const matchedUsers = teamMembers.filter(user => {
                 const generatedName = (user.displayName || user.firstName || (user.email ? user.email.split("@")[0] : "Utilisateur")).toLowerCase();
                 return generatedName === queryLower || generatedName.startsWith(queryLower) || generatedName.includes(queryLower);
              });
              
              matchedUsers.forEach(user => {
                 if (user.email && !emailsToSend.some(e => e.email === user.email)) {
                    emailsToSend.push({
                       email: user.email,
                       role: user.role,
                       name: user.displayName || user.firstName || "Membre de l'équipe"
                    });
                 }
              });
            }

            if (emailsToSend.length > 0) {
              const fromEmail = process.env.SMTP_FROM || "support@paniscope.fr";
              const ticketSubject = afterData.subject || "Sans objet";

              for (const targetUser of emailsToSend) {
                // Construction du lien selon le rôle
                let routePrefix = "manager";
                if (targetUser.role === "developer") routePrefix = "dev";
                
                const ticketUrl = `https://paniscope-ticketing.web.app/${routePrefix}/ticket/${ticketId}`; // La route amène au ticket. Pour l'onglet on pourrait passer tab=internal mais vu l'URL de paniscope, /ticket/0000X charge la page du role
                
                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5;">
                    <p>Bonjour ${targetUser.name},</p>
                    <p><strong>${newNote.displayName || newNote.author}</strong> vous a mentionné dans une note interne sur le ticket <strong>#${ticketId}</strong> (<em>${ticketSubject}</em>) :</p>
                    
                    <div style="background-color: #f9f9f9; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0; white-space: pre-wrap;">${messageText}</div>
                    
                    <p>Pour consulter ou répondre à cette note, veuillez cliquer sur le lien suivant : <br>
                    <a href="${ticketUrl}" style="display:inline-block; margin-top:10px; padding:10px 15px; background-color:#6c757d; color:#fff; text-decoration:none; border-radius:5px;">Accéder au ticket</a></p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                    <p style="font-size: 11px; color: #aaa;">Veuillez répondre directement via l'application. Ne répondez pas à cet e-mail.</p>
                  </div>
                `;

                const mailOptions = {
                  from: `"Support Paniscope" <${fromEmail}>`,
                  to: targetUser.email,
                  subject: `[Notification Interne] Vous avez été mentionné - Ticket #${ticketId}`,
                  html: emailHtml,
                  text: `Bonjour ${targetUser.name},\n\n${newNote.displayName || newNote.author} vous a mentionné dans une note interne sur le ticket #${ticketId} (${ticketSubject}).\n\nMessage :\n${messageText}\n\nLien : ${ticketUrl}`
                };
                
                await smtpTransporter.sendMail(mailOptions);
                console.log(`✅ Email de notification de mention envoyé à ${targetUser.email} (Ticket ${ticketId})`);
              }
            } else {
              console.log(`⚠️ Aucune adresse e-mail trouvée pour les mentions dans le ticket ${ticketId}`);
            }
        } catch(error) {
            console.error(`❌ Erreur lors de la notification des mentions internes (Ticket ${ticketId}):`, error);
        }
      }
    }
  });
