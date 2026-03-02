import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { STATUS } from '../../constants/status';
import { Container, Card, Form, Button, FloatingLabel, Spinner, Alert } from 'react-bootstrap';
import MultiImageUpload from '../../components/shared/MultiImageUpload';

export default function NewTicketPage() {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });
  
  // Nouveaux états pour MultiImageUpload
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [imageError, setImageError] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser && !currentUser.company) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddImage = (file) => {
    if (!file.type.startsWith('image/')) {
      setImageError("Veuillez sélectionner uniquement des fichiers image.");
      return;
    }
    // Limite à 5Mo par image
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
        clientUid: currentUser.uid,
        clientEmail: currentUser.email,
        clientName: currentUser.company || currentUser.displayName || currentUser.email,
        status: STATUS.NEW,
        priority: 'Normale',
        submittedAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        hasNewClientMessage: false,
        hasNewDeveloperMessage: false,
        hasNewManagerMessage: false,
      };

      if (attachmentUrls.length > 0) {
        ticketData.attachmentUrls = attachmentUrls;
      }

      const docRef = await addDoc(collection(db, "tickets"), ticketData);

      // 3. Message initial dans la conversation
      const initialMessage = {
        author: 'Client',
        uid: currentUser.uid,
        displayName: currentUser.displayName || formData.clientName || 'Client',
        photoURL: currentUser.photoURL || null,
        text: formData.description,
        timestamp: new Date() 
      };

      if (attachmentUrls.length > 0) {
        initialMessage.attachmentUrls = attachmentUrls;
      }

      await updateDoc(docRef, {
        conversation: arrayUnion(initialMessage)
      });
      
      navigate('/'); 

    } catch (err) {
      console.error("Error adding document: ", err);
      setError("Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="mt-4 pb-5">
      <Card className="shadow-sm">
        <Card.Header className="bg-white py-3">
          <h4 className="mb-0 fw-bold">Envoyer une demande d'assistance</h4>
        </Card.Header>
        <Card.Body className="p-4">
          {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <FloatingLabel controlId="subject" label="Objet de la demande *" className="mb-3">
              <Form.Control 
                type="text" 
                placeholder="Ex: Problème de connexion" 
                name="subject" 
                value={formData.subject} 
                onChange={handleChange} 
                required 
              />
            </FloatingLabel>

            <FloatingLabel controlId="description" label="Description de la demande *" className="mb-4">
              <Form.Control 
                as="textarea" 
                placeholder="Décrivez votre problème en détail..." 
                style={{ height: '150px' }} 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                required 
              />
            </FloatingLabel>
            
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
                    Envoi en cours...
                  </>
                ) : 'Envoyer la demande'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
