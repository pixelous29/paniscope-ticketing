import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { STATUS } from '../../constants/status';
import { Container, Card, Form, Button, FloatingLabel, Spinner, Alert } from 'react-bootstrap';

export default function NewTicketPage() {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    clientId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.description || !formData.clientId) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, "tickets"), {
        subject: formData.subject,
        clientId: formData.clientId,
        status: STATUS.NEW,
        priority: 'Normale',
        submittedAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
        hasNewClientMessage: false,
        hasNewDeveloperMessage: false,
        hasNewManagerMessage: false // Ajout du nouveau champ
      });

      const initialMessage = {
        author: 'Client',
        text: formData.description,
        timestamp: new Date() 
      };

      await updateDoc(docRef, {
        conversation: arrayUnion(initialMessage)
      });
      
      // Redirige l'utilisateur vers son tableau de bord après succès
      navigate('/'); 

    } catch (err)      {
      console.error("Error adding document: ", err);
      setError("Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="mt-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">Envoyer une demande d'assistance</h4>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <FloatingLabel controlId="subject" label="Objet de la demande *" className="mb-3">
              <Form.Control type="text" placeholder="Objet de la demande *" name="subject" value={formData.subject} onChange={handleChange} required />
            </FloatingLabel>
            <FloatingLabel controlId="description" label="Description de la demande *" className="mb-3">
              <Form.Control as="textarea" placeholder="Description de la demande *" style={{ height: '150px' }} name="description" value={formData.description} onChange={handleChange} required />
            </FloatingLabel>
            <FloatingLabel controlId="clientId" label="N° de Licence ou Identifiant Client *" className="mb-4">
              <Form.Control type="text" placeholder="N° de Licence ou Identifiant Client *" name="clientId" value={formData.clientId} onChange={handleChange} required />
            </FloatingLabel>
            <Form.Group className="mb-3">
              <Form.Label>Pièces jointes (valeur facultative)</Form.Label>
              <Card body className="text-center text-muted">
                Fonctionnalité à venir
              </Card>
            </Form.Group>
            <div className="d-grid">
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    {' '}Envoi en cours...
                  </>
                ) : 'Envoyer'}
              </Button>
            </div>

          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
