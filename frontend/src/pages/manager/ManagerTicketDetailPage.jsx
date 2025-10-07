import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert } from 'react-bootstrap';
import { mockAllTickets } from '../../data/mockData'; // Import des données centralisées

// ... (Les constantes statusVariant et priorityVariant restent identiques)
const statusVariant = { 'Nouveau': 'primary', 'En cours': 'warning', 'En attente': 'info', 'Résolu': 'success' };
const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function ManagerTicketDetailPage() {
  const { ticketId } = useParams(); // Récupère le paramètre :ticketId de l'URL
  const ticket = mockAllTickets.find(t => t.id === ticketId); // Cherche le ticket correspondant

  if (!ticket) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Ticket non trouvé !</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row>
        {/* Colonne principale avec la conversation et la réponse */}
        <Col md={8}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">{ticket.subject}</h4>
              <Badge bg={statusVariant[ticket.status] || 'secondary'} pill>{ticket.status}</Badge>
            </Card.Header>
            <Card.Body>
              <h5>Conversation</h5>
              <ListGroup variant="flush">
                {ticket.conversation.map((msg, index) => (
                  <ListGroup.Item key={index} className="d-flex flex-column">
                    <div className="d-flex justify-content-between">
                      <strong>{msg.author}</strong>
                      <small className="text-muted">{msg.timestamp}</small>
                    </div>
                    <p className="mb-1">{msg.text}</p>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <hr />
              <h5>Répondre au client</h5>
              <Form>
                <Form.Group className="mb-3" controlId="managerResponse">
                  <Form.Control as="textarea" rows={4} placeholder="Votre réponse ici..." />
                </Form.Group>
                <Button variant="primary">Envoyer la réponse</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Colonne latérale avec les outils du manager */}
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Détails du Ticket</Card.Title>
              <p><strong>Client:</strong> {ticket.client}</p>
              <p><strong>Soumis le:</strong> {ticket.submittedAt}</p>
              <div>
                <strong>Priorité:</strong>{' '}
                <Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge>
              </div>
              <div className="mt-2">
                <strong>Tags:</strong>{' '}
                {ticket.tags.map(tag => <Badge key={tag} pill bg="info" className="me-1">{tag}</Badge>)}
              </div>
              <hr />
              <Card.Title>Actions Manager</Card.Title>
              <div className="d-grid gap-2">
                <Button variant="outline-secondary">Modifier Tags / Priorité</Button>
                <Button variant="outline-warning">Transférer au développeur</Button>
                <Button variant="success">Clôturer le ticket</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
