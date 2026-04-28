import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { doc, setDoc, runTransaction, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { STATUS } from '../../constants/status';
import { Form, Button, FloatingLabel, Spinner, Alert, Dropdown, Badge } from 'react-bootstrap';
import MultiImageUpload from '../../components/shared/MultiImageUpload';

export default function NewManagerTicketPage() {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });
  
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [imageError, setImageError] = useState('');
  
  const [developers, setDevelopers] = useState([]);
  const [assignedTo, setAssignedTo] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDevelopers = async () => {
        try {
            const q = query(collection(db, "users"), where("role", "==", "developer"));
            const querySnapshot = await getDocs(q);
            const devs = querySnapshot.docs.map(d => ({
                id: d.id,
                name: d.data().displayName || d.data().email
            }));
            setDevelopers(devs);
        } catch (err) {
            console.error("Erreur lors de la récupération des développeurs:", err);
        }
    };
    fetchDevelopers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddImage = (file) => {
    if (!file.type.startsWith('image/')) {
      setImageError("Veuillez sélectionner uniquement des fichiers image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("L'image est trop volumineuse (max 5 Mo).");
      return;
    }

    setImages(prev => [...prev, file]);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviews(prev => [...prev, reader.result]);
    };
    reader.readAsDataURL(file);
    setImageError('');
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setImageError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const attachmentUrls = [];

      // 1. Upload de toutes les images
      for (let i = 0; i < images.length; i++) {
        const fileExtension = images[i].name.split('.').pop();
        const fileName = `ticket_${Date.now()}_img${i}_${currentUser.uid}.${fileExtension}`;
        const storageRef = ref(storage, `tickets/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, images[i]);
        const url = await getDownloadURL(snapshot.ref);
        attachmentUrls.push(url);
      }

      // 2. Création du ticket
      const ticketData = {
        subject: formData.subject,
        clientUid: null,
        clientEmail: null,
        clientName: 'Ticket Interne',
        companyDomain: null,
        status: STATUS.IN_PROGRESS, // Statut par défaut validé : IN_PROGRESS
        priority: 'Normale',
        devPhase: 'PLANNING',
        submittedAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        hasNewClientMessage: false,
        hasNewDeveloperMessage: false,
        hasNewManagerMessage: false,
        assignedTo: assignedTo,
      };

      if (attachmentUrls.length > 0) {
        ticketData.attachmentUrls = attachmentUrls;
      }

      // Generation de l'ID sequentiel
      const counterRef = doc(db, 'counters', 'ticketCounter');
      const nextIdStr = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNum = 1;
        if (counterDoc.exists()) {
          nextNum = counterDoc.data().lastId + 1;
        }
        transaction.set(counterRef, { lastId: nextNum }, { merge: true });
        return String(nextNum).padStart(7, '0');
      });

      // 3. Message initial (note interne)
      const initialMessage = {
        author: 'Manager',
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Manager',
        photoURL: currentUser.photoURL || null,
        text: formData.description,
        timestamp: new Date() 
      };

      if (attachmentUrls.length > 0) {
        initialMessage.attachmentUrls = attachmentUrls;
      }

      ticketData.internalNotes = [initialMessage];

      const docRef = doc(db, "tickets", nextIdStr);
      await setDoc(docRef, ticketData);
      
      navigate('/manager'); 

    } catch (err) {
      console.error("Error adding document: ", err);
      setError("Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="flex-shrink-0 border-bottom bg-white d-flex align-items-center p-3 p-md-4 sticky-top z-2">
          <div className="d-flex align-items-center gap-3">
              <Link to="/manager" className="text-secondary hover-primary text-decoration-none d-flex align-items-center justify-content-center bg-light rounded-circle p-2" title="Retour aux tickets">
                  <i className="bi bi-arrow-left fs-5"></i>
              </Link>
              <div>
                  <h4 className="mb-0 fw-bold text-dark">Nouveau Ticket Interne</h4>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Créer un ticket sans client associé
                  </div>
              </div>
          </div>
      </div>

      <div className="flex-grow-1 overflow-auto p-3 p-md-4 d-flex justify-content-center">
        <div className="w-100" style={{ maxWidth: '800px' }}>
          <div className="bg-white rounded shadow-sm border p-4 p-md-5">
          {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <FloatingLabel controlId="subject" label="Objet du ticket *" className="mb-3">
              <Form.Control 
                type="text" 
                placeholder="Ex: Problème serveur" 
                name="subject" 
                value={formData.subject} 
                onChange={handleChange} 
                required 
              />
            </FloatingLabel>

            <FloatingLabel controlId="description" label="Description / Note interne *" className="mb-4">
              <Form.Control 
                as="textarea" 
                placeholder="Décrivez le problème en détail..." 
                style={{ height: '150px' }} 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                required 
              />
            </FloatingLabel>
            
            <div className="mb-4">
                <Form.Label className="fw-bold">Assigner à (Optionnel)</Form.Label>
                <Dropdown>
                    <Dropdown.Toggle variant="outline-secondary" className="w-100 text-start d-flex justify-content-between align-items-center">
                        <span>
                        {assignedTo.length > 0
                            ? assignedTo.join(', ')
                            : 'Sélectionner des développeurs'}
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="w-100" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {developers.map(dev => {
                            const isAssigned = assignedTo.includes(dev.name);
                            return (
                                <Dropdown.Item 
                                    key={dev.id} 
                                    className="py-2 px-3 dropdown-item-premium"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setAssignedTo(prev => {
                                            const newAssigned = [...prev];
                                            const idx = newAssigned.indexOf(dev.name);
                                            if (idx > -1) {
                                                newAssigned.splice(idx, 1);
                                            } else {
                                                newAssigned.push(dev.name);
                                            }
                                            return newAssigned;
                                        });
                                    }}
                                >
                                    <Form.Check 
                                        type="checkbox" 
                                        label={dev.name} 
                                        checked={isAssigned} 
                                        readOnly
                                        className="m-0"
                                    />
                                </Dropdown.Item>
                            );
                        })}
                    </Dropdown.Menu>
                </Dropdown>
            </div>

            <MultiImageUpload 
              images={images}
              previews={previews}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              error={imageError}
              maxImages={4}
            />

            <div className="d-grid mt-5">
              <Button variant="primary" type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                    Création en cours...
                  </>
                ) : 'Créer le ticket interne'}
              </Button>
            </div>
          </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
