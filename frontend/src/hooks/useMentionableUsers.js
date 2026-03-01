import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "./useAuth";

// Cache partagé pour éviter les requêtes Firestore répétées
const profileCache = {};

export const useMentionableUsers = (ticket) => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!ticket) return;

    const fetchParticipants = async () => {
      // 1. Collecter tous les UIDs uniques des messages
      const uidSet = new Set();

      if (ticket.conversation && Array.isArray(ticket.conversation)) {
        ticket.conversation.forEach((msg) => {
          if (msg.uid) uidSet.add(msg.uid);
        });
      }

      if (ticket.internalNotes && Array.isArray(ticket.internalNotes)) {
        ticket.internalNotes.forEach((note) => {
          if (note.uid) uidSet.add(note.uid);
        });
      }

      // Ajouter le client du ticket par son UID
      if (ticket.clientUid) uidSet.add(ticket.clientUid);

      // Retirer l'utilisateur courant
      const currentUid = currentUser?.uid;
      if (currentUid) uidSet.delete(currentUid);

      // 2. Récupérer les profils actuels depuis Firestore pour chaque UID
      const participants = [];

      for (const uid of uidSet) {
        try {
          let profile = profileCache[uid];

          if (!profile) {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              profile = {
                name:
                  data.displayName ||
                  data.firstName ||
                  data.email?.split("@")[0] ||
                  "Utilisateur",
                role: data.role || "Inconnu",
              };
            } else {
              // Fallback : chercher le nom dans les messages du ticket
              const allMessages = [
                ...(ticket.conversation || []),
                ...(ticket.internalNotes || []),
              ];
              const msgFromUser = allMessages.find((m) => m.uid === uid);
              profile = {
                name:
                  msgFromUser?.displayName ||
                  msgFromUser?.author ||
                  "Utilisateur",
                role: msgFromUser?.author || "Inconnu",
              };
            }
            profileCache[uid] = profile;
          }

          // Formatter le rôle pour l'affichage
          let displayRole = profile.role;
          if (displayRole === "manager") displayRole = "Manager";
          else if (displayRole === "developer") displayRole = "Développeur";
          else if (displayRole === "client") displayRole = "Client";
          else if (displayRole === "admin") displayRole = "Admin";

          participants.push({
            id: uid,
            name: profile.name,
            role: displayRole,
          });
        } catch {
          // Fallback si Firestore refuse l'accès : extraire depuis les messages
          const allMessages = [
            ...(ticket.conversation || []),
            ...(ticket.internalNotes || []),
          ];
          const msgFromUser = allMessages.find((m) => m.uid === uid);
          if (msgFromUser) {
            let fallbackRole = msgFromUser.author || "Inconnu";
            if (fallbackRole === "manager") fallbackRole = "Manager";
            else if (fallbackRole === "developer") fallbackRole = "Développeur";
            else if (fallbackRole === "client") fallbackRole = "Client";

            participants.push({
              id: uid,
              name:
                msgFromUser.displayName || msgFromUser.author || "Utilisateur",
              role: fallbackRole,
            });
          }
        }
      }

      setUsers(participants);
    };

    fetchParticipants();
  }, [ticket, currentUser]);

  return users;
};
