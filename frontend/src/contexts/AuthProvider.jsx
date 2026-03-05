import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour récupérer le rôle de l'utilisateur depuis Firestore
  const fetchUserRole = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data().role || "client";
      }
      return "client"; // Rôle par défaut
    } catch (error) {
      console.error("Erreur lors de la récupération du rôle:", error);
      return "client";
    }
  };

  // Connexion avec email/password
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  };

  // Inscription avec email/password
  const signup = async (email, password, userData) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const displayName = `${userData.firstName} ${userData.lastName}`.trim();

    // Créer le document utilisateur dans Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      company: userData.company || '',
      displayName: displayName || email.split("@")[0],
      role: "client", // Rôle par défaut
      status: "pending", // Statut en attente d'approbation
      createdAt: new Date(),
      photoURL: null,
    });

    return user;
  };

  // Connexion avec Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Vérifier si l'utilisateur existe déjà dans Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      // Créer le document utilisateur s'il n'existe pas
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName,
        role: "client", // Rôle par défaut
        status: "pending", // Statut en attente d'approbation
        createdAt: new Date(),
        photoURL: user.photoURL,
      });
    }

    return user;
  };

  // Déconnexion
  const logout = () => {
    return signOut(auth);
  };

  // Réinitialisation du mot de passe
  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Écouter les changements d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Récupérer les données utilisateur depuis Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Enrichir l'objet user avec les données Firestore
            const enrichedUser = {
              ...user,
              displayName: userData.displayName || user.displayName,
              photoURL: userData.photoURL || user.photoURL,
              company: userData.company || '',
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              lastConnection: userData.lastConnection || null
            };

            // Mettre à jour la date de dernière connexion (si absente ou plus vieille d'une heure)
            const now = new Date();
            const lastConn = userData.lastConnection?.toDate ? userData.lastConnection.toDate() : null;
            const oneHour = 60 * 60 * 1000;
            
            toast(`Debug - lastConn: ${lastConn ? lastConn.toISOString() : 'null'}`, { duration: 6000 });
            
            if (!lastConn || (now - lastConn > oneHour)) {
              toast(`Debug - Entrée dans le if de maj. lastConn=${lastConn}`, { duration: 6000 });
              // Update last connection
              updateDoc(userDocRef, {
                lastConnection: serverTimestamp()
              })
              .then(() => {
                if (!lastConn) toast.success("Première connexion détectée : profil mis à jour !");
              })
              .catch(e => {
                console.error("Erreur maj lastConnection:", e);
                toast.error("Erreur maj profil : " + e.message, { duration: 6000 });
              });
              
              // If this is the very first connection, securely delete the temporary password!
              if (!lastConn) {
                const tempPwdRef = doc(db, 'temporaryPasswords', user.uid);
                deleteDoc(tempPwdRef)
                .then(() => toast.success("Le mot de passe provisoire a été supprimé de la base."))
                .catch(e => {
                  console.warn("Erreur suppression mdp provisoire:", e);
                  toast.error("Erreur suppression mdp : " + e.message, { duration: 6000 });
                });
              }
            } else {
               toast(`Debug - Maj ignorée. Trop récent.`, { duration: 4000 });
            }

            setCurrentUser(enrichedUser);
            setUserRole(userData.role || 'client');
            setUserStatus(userData.status || 'approved'); // Par défaut approved pour les anciens comptes
          } else {
            setCurrentUser(user);
            setUserRole('client');
            setUserStatus('pending');
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des données utilisateur:', error);
          setCurrentUser(user);
          const role = await fetchUserRole(user.uid);
          setUserRole(role);
          setUserStatus('pending');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserStatus(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userStatus,
    login,
    signup,
    signInWithGoogle,
    logout,
    resetPassword,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
