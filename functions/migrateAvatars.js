/**
 * Script de migration ponctuel : convertit les avatars Firebase Storage
 * existants en base64 dans le document Firestore de chaque utilisateur.
 *
 * Usage : node migrateAvatars.js
 */

const admin = require("firebase-admin");
const https = require("https");
const http = require("http");

// Initialiser avec le project ID explicite
admin.initializeApp({
  projectId: "paniscope-ticketing",
});
const db = admin.firestore();

async function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers["content-type"] || "image/webp";
          const base64 = `data:${contentType};base64,${buffer.toString("base64")}`;
          resolve(base64);
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function migrate() {
  console.log("Début de la migration des avatars...");

  const usersSnapshot = await db.collection("users").get();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();

    // Skip si déjà migré
    if (data.photoBase64) {
      console.log(`  ⏭️  ${data.displayName || data.email} - déjà migré`);
      skipped++;
      continue;
    }

    // Skip si pas de photoURL Firebase Storage
    if (
      !data.photoURL ||
      !data.photoURL.includes("firebasestorage.googleapis.com")
    ) {
      console.log(
        `  ⏭️  ${data.displayName || data.email} - pas d'avatar Firebase Storage`,
      );
      skipped++;
      continue;
    }

    try {
      console.log(`  🔄 Migration de ${data.displayName || data.email}...`);
      const base64 = await fetchImageAsBase64(data.photoURL);

      // Vérifier que le base64 n'est pas trop gros (< 500Ko pour rester safe dans Firestore)
      if (base64.length > 500 * 1024) {
        console.warn(
          `  ⚠️  Image trop volumineuse (${Math.round(base64.length / 1024)} Ko), skip.`,
        );
        skipped++;
        continue;
      }

      await db.collection("users").doc(userDoc.id).update({
        photoBase64: base64,
      });

      console.log(`  ✅ Migré (${Math.round(base64.length / 1024)} Ko base64)`);
      migrated++;
    } catch (err) {
      console.error(
        `  ❌ Erreur pour ${data.displayName || data.email}: ${err.message}`,
      );
      errors++;
    }
  }

  console.log(
    `\n🏁 Migration terminée ! Migrés: ${migrated}, Ignorés: ${skipped}, Erreurs: ${errors}`,
  );
  process.exit(0);
}

migrate();
