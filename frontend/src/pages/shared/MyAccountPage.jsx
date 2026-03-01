import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Image } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { db, storage, auth } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';
import { User, Image as ImageIcon, Briefcase, Building } from 'lucide-react';

export default function MyAccountPage() {
  const { currentUser, userRole } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
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

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      let finalPhotoURL = currentUser.photoURL;

      // Uniquement si l'utilisateur n'est pas connecté avec Google
      if (!isGoogleUser && photoFile) {
        const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
        await uploadBytes(fileRef, photoFile);
        finalPhotoURL = await getDownloadURL(fileRef);
      }
      
      const newDisplayName = `${firstName} ${lastName}`.trim();

      // Mettre à jour dans Firestore
      const updateData = {
        firstName,
        lastName,
        company,
        ...(newDisplayName && { displayName: newDisplayName }),
        ...(!isGoogleUser && photoFile && { photoURL: finalPhotoURL })
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

                {userRole === 'manager' && (
                  <Form.Group className="mb-4" controlId="accWimiNotifs">
                    <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded border">
                      <div>
                        <Form.Label className="mb-0 fw-bold">Notifications Wimi (via Zapier)</Form.Label>
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
