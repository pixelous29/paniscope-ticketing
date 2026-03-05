import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Image } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { db, storage, auth } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { updateProfile, reauthenticateWithCredential, EmailAuthProvider, updateEmail, updatePassword } from 'firebase/auth';
import toast from 'react-hot-toast';
import { User, Image as ImageIcon, Briefcase, Building, Mail, Lock } from 'lucide-react';
import { resizeImage } from '../../utils/imageResize';

export default function MyAccountPage() {
  const { currentUser, userRole } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [wimiNotificationsEnabled, setWimiNotificationsEnabled] = useState(true);

  const isGoogleUser = currentUser?.providerData?.some(
    (provider) => provider.providerId === 'google.com'
  );

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!currentUser?.uid) return;
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          let fetchedFirstName = data.firstName || '';
          let fetchedLastName = data.lastName || '';

          // Si on n'a pas de prénom/nom mais qu'on a un displayName (surtout pour Google)
          if ((!fetchedFirstName || !fetchedLastName) && (data.displayName || currentUser.displayName)) {
            const fullName = data.displayName || currentUser.displayName;
            const nameParts = fullName.split(' ');
            
            if (!fetchedLastName) {
              fetchedLastName = nameParts.length > 1 ? nameParts.pop() : ''; 
            }
            if (!fetchedFirstName) {
              fetchedFirstName = nameParts.join(' ');
            }
          }

          setFirstName(fetchedFirstName);
          setLastName(fetchedLastName);
          setCompany(data.company || '');
          setEmail(currentUser.email || '');
          setPhotoPreview(data.photoURL || currentUser.photoURL || null);
          setWimiNotificationsEnabled(data.wimiNotificationsEnabled !== false);
        }
      } catch (err) {
        console.error('Erreur lors de la récupération des données utilisateur:', err);
        setError('Impossible de charger les données du profil.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("L'image ne doit pas dépasser 5 Mo.");
        return;
      }
      
      try {
        // Retaille l'image en 150x150 max avec qualité WebP 0.8 pour un chargement instantané
        const resizedDataUrl = await resizeImage(file, 150, 150, 0.8);
        setPhotoFile(resizedDataUrl); // Base64 string
        setPhotoPreview(resizedDataUrl); // Base64 string preview
      } catch (err) {
        console.error("Erreur de redimensionnement de l'image :", err);
        setError("Impossible de traiter cette image. Veuillez essayer un autre fichier.");
      }
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      let finalPhotoURL = currentUser.photoURL;

      // Re-authentication if changing email/password
      if (!isGoogleUser && (email !== currentUser.email || newPassword)) {
        if (!currentPassword) {
          setError('Veuillez entrer votre mot de passe actuel pour modifier votre email ou mot de passe.');
          setSaving(false);
          return;
        }

        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        try {
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (reauthErr) {
          console.error("Erreur de ré-authentification :", reauthErr);
          setError('Mot de passe actuel incorrect.');
          setSaving(false);
          return;
        }

        if (email !== currentUser.email) {
          try {
            await updateEmail(auth.currentUser, email);
          } catch (err) {
             setError('Erreur lors de la mise à jour de l\'email (' + err.message + ')');
             setSaving(false);
             return;
          }
        }

        if (newPassword) {
          try {
            await updatePassword(auth.currentUser, newPassword);
          } catch (err) {
             setError('Erreur lors de la mise à jour du mot de passe (' + err.message + ')');
             setSaving(false);
             return;
          }
        }
      }

      // Uniquement si l'utilisateur n'est pas connecté avec Google
      if (!isGoogleUser && photoFile && typeof photoFile === 'string' && photoFile.startsWith('data:image')) {
        const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
        await uploadString(fileRef, photoFile, 'data_url');
        finalPhotoURL = await getDownloadURL(fileRef);
      }
      
      const newDisplayName = `${firstName} ${lastName}`.trim();

      // Mettre à jour dans Firestore
      const updateData = {
        firstName,
        lastName,
        company,
        ...(email !== currentUser.email && { email }),
        ...(newDisplayName && { displayName: newDisplayName }),
        ...(!isGoogleUser && photoFile && { photoURL: finalPhotoURL }),
        ...(!isGoogleUser && photoFile && typeof photoFile === 'string' && photoFile.startsWith('data:image') && { photoBase64: photoFile })
      };

      if (userRole === 'manager') {
        updateData.wimiNotificationsEnabled = wimiNotificationsEnabled;
      }

      await updateDoc(doc(db, 'users', currentUser.uid), updateData);

      // Mettre à jour le profil d'authentification s'il y a des changements importants
      if (auth.currentUser) {
        const updates = {};
        if (newDisplayName) updates.displayName = newDisplayName;
        if (!isGoogleUser && photoFile) updates.photoURL = finalPhotoURL;
        
        if (Object.keys(updates).length > 0) {
          await updateProfile(auth.currentUser, updates);
        }
      }

      toast.success('Profil mis à jour avec succès');
      
      // On recharge la page pour que MyAccountPage et la Navbar soient bien à jour
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('Erreur lors de la mise à jour du profil:', err);
      setError('Erreur lors de la sauvegarde du profil.');
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Container className="py-4">Chargement du profil...</Container>;

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <h2 className="fs-4 mb-4 fw-bold">Mon compte</h2>
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSave}>
                {!isGoogleUser && (
                  <div className="mb-4 text-center">
                    <div className="mb-3">
                      {photoPreview ? (
                        <Image 
                          src={photoPreview} 
                          alt="Aperçu avatar" 
                          roundedCircle 
                          style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div 
                          className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center"
                          style={{ width: '100px', height: '100px' }}
                        >
                          <ImageIcon size={40} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <Form.Label htmlFor="photo-upload" className="btn btn-outline-primary btn-sm m-0">
                        Changer la photo
                      </Form.Label>
                      <Form.Control
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="d-none"
                        onChange={handlePhotoChange}
                      />
                    </div>
                  </div>
                )}
                
                {isGoogleUser && (
                  <div className="mb-4 text-center">
                    <div className="mb-2">
                      <Image 
                        src={currentUser?.photoURL} 
                        alt="Avatar Google" 
                        roundedCircle 
                        referrerPolicy="no-referrer"
                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                      />
                    </div>
                    <small className="text-muted d-block">
                      Connecté avec Google. La photo de profil est gérée par Google.
                    </small>
                  </div>
                )}

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="accFirstName">
                      <Form.Label>Prénom</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <User size={18} />
                        </span>
                        <Form.Control
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Votre prénom"
                          className="border-start-0"
                          autoComplete="given-name"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="accLastName">
                      <Form.Label>Nom</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <User size={18} />
                        </span>
                        <Form.Control
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Votre nom"
                          className="border-start-0"
                          autoComplete="family-name"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4" controlId="accCompany">
                  <Form.Label>Société</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-muted border-end-0">
                      <Briefcase size={18} />
                    </span>
                    <Form.Control
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Nom de votre société"
                      className="border-start-0"
                      autoComplete="organization"
                    />
                  </div>
                </Form.Group>

                {!isGoogleUser && (
                  <div className="border-top pt-4 mt-4 mb-4">
                    <h5 className="mb-3">Informations de connexion</h5>
                    <Form.Group className="mb-3" controlId="accEmail">
                      <Form.Label>Adresse email</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <Mail size={18} />
                        </span>
                        <Form.Control
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Votre email"
                          className="border-start-0"
                          autoComplete="email"
                        />
                      </div>
                    </Form.Group>
                    
                    <Form.Group className="mb-3" controlId="accNewPassword">
                      <Form.Label>Nouveau mot de passe (optionnel)</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <Lock size={18} />
                        </span>
                        <Form.Control
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Laisser vide pour ne pas modifier"
                          className="border-start-0"
                          autoComplete="new-password"
                          minLength="6"
                        />
                      </div>
                    </Form.Group>

                    {(email !== currentUser.email || newPassword) && (
                      <Form.Group className="mb-3 p-3 bg-light rounded border border-warning" controlId="accCurrentPassword">
                        <Form.Label className="text-warning fw-bold">Mot de passe actuel requis</Form.Label>
                        <Form.Text className="d-block text-muted mb-2">
                          Pour des raisons de sécurité, veuillez confirmer votre mot de passe actuel pour valider ces modifications.
                        </Form.Text>
                        <div className="input-group">
                          <span className="input-group-text bg-white text-muted border-end-0">
                            <Lock size={18} />
                          </span>
                          <Form.Control
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Votre mot de passe actuel"
                            className="border-start-0"
                            autoComplete="current-password"
                            required={(email !== currentUser.email || newPassword)}
                          />
                        </div>
                      </Form.Group>
                    )}
                  </div>
                )}

                {userRole === 'manager' && (
                  <Form.Group className="mb-4">
                    <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded border">
                      <div>
                        <Form.Label htmlFor="wimi-notif-switch" className="mb-0 fw-bold" style={{ cursor: 'pointer' }}>
                          Notifications Wimi (via Zapier)
                        </Form.Label>
                        <small className="d-block text-muted">Active ou désactive l'envoi de notifications sur Wimi à la création d'un nouveau ticket.</small>
                      </div>
                      <Form.Check 
                        type="switch"
                        id="wimi-notif-switch"
                        checked={wimiNotificationsEnabled}
                        onChange={(e) => setWimiNotificationsEnabled(e.target.checked)}
                      />
                    </div>
                  </Form.Group>
                )}

                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={saving}
                  className="w-100 fw-medium"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
