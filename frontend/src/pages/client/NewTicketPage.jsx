import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Form, Button, Card } from 'react-bootstrap';

export default function NewTicketPage() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log({ subject, description, clientId });
    alert('Votre demande a été envoyée !');
    navigate('/'); 
  };

  return (
    <Container className="mt-4 d-flex justify-content-center">
      <Card style={{ width: '100%', maxWidth: '600px' }}>
        <Card.Header as="h3" className="text-center">Envoyer une demande d'assistance</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="subject">
              <Form.Label>Objet de la demande *</Form.Label>
              <Form.Control type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </Form.Group>

            <Form.Group className="mb-3" controlId="description">
              <Form.Label>Description de la demande *</Form.Label>
              <Form.Control as="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
            </Form.Group>

            <Form.Group className="mb-3" controlId="clientId">
              <Form.Label>N° de Licence ou Identifiant Client *</Form.Label>
              <Form.Control type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
            </Form.Group>

            <Form.Group className="mb-4" controlId="attachments">
              <Form.Label>Pièces jointes (valeur facultative)</Form.Label>
              <Form.Control type="text" placeholder="Fonctionnalité à venir" disabled />
            </Form.Group>

            <div className="d-grid">
                <Button variant="primary" type="submit" size="lg">Envoyer</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
