import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { STATUS } from '../../constants/status';
import { Container, Card, Form, Button, FloatingLabel, Spinner, Alert } from 'react-bootstrap';
import { Image as ImageIcon, X, Upload } from 'lucide-react';

export default function NewTicketPage() {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (currentUser && !currentUser.company) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Veuillez sélectionner uniquement des fichiers image.");
        return;
      }
      // Limite à 5Mo par exemple
      if (file.size > 5 * 1024 * 1024) {
        setError("L'image est trop volumineuse (max 5 Mo).");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      let imageUrl = null;

      // 1. Upload de l'image si présente
      if (imageFile) {
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${currentUser.uid}.${fileExtension}`;
        const storageRef = ref(storage, `tickets/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      // 2. Création du ticket
      const docRef = await addDoc(collection(db, "tickets"), {
        subject: formData.subject,
        clientUid: currentUser.uid,
        clientEmail: currentUser.email,
        clientName: currentUser.displayName || currentUser.email,
        status: STATUS.NEW,
        priority: 'Normale',
        submittedAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        hasNewClientMessage: false,
        hasNewDeveloperMessage: false,
        hasNewManagerMessage: false,
        attachmentUrl: imageUrl // URL de la capture d'écran
      });

      // 3. Message initial dans la conversation
      const initialMessage = {
        author: 'Client',
        text: formData.description,
        timestamp: new Date() 
      };

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
            
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold mb-2">Capture d'écran en lien avec le problème décrit</Form.Label>
              
              <div 
                className="border rounded-3 p-4 text-center bg-light position-relative"
                style={{ 
                  borderStyle: 'dashed !important',
                  borderWidth: '2px !important',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => !imagePreview && fileInputRef.current.click()}
              >
                {!imagePreview ? (
                  <div className="py-2">
                    <Upload className="text-primary mb-2" size={32} />
                    <p className="mb-1 text-dark fw-medium">Cliquez pour ajouter une capture d'écran</p>
                    <p className="text-muted small mb-0">Formats acceptés : PNG, JPG, JPEG (Max 5Mo)</p>
                  </div>
                ) : (
                  <div className="position-relative d-inline-block">
                    <img 
                      src={imagePreview} 
                      alt="Aperçu" 
                      className="img-fluid rounded border shadow-sm"
                      style={{ maxHeight: '250px' }}
                    />
                    <Button 
                      variant="danger" 
                      size="sm" 
                      className="position-absolute top-0 end-0 m-2 rounded-circle shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage();
                      }}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="d-none"
                />
              </div>
            </Form.Group>

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
