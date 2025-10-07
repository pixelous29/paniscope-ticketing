import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Breadcrumb } from 'react-bootstrap';
import { mockAllTickets } from '../../data/mockData';

const statusVariant = {
  'Nouveau': 'primary',
  'En cours': 'warning',
  'En attente': 'info',
  'Résolu': 'success',
};

export default function ClientTicketDetailPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const ticket = mockAllTickets.find(t => t.id === ticketId);

  if (!ticket) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Ticket non trouvé !</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Breadcrumb>
        <Breadcrumb.Item onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Tableau de bord</Breadcrumb.Item>
        <Breadcrumb.Item active>Ticket #{ticket.id}</Breadcrumb.Item>
      </Breadcrumb>

      <Row>
        <Col>
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
              <h5>Ajouter une réponse</h5>
              <Form>
                <Form.Group className="mb-3" controlId="clientResponse">
                  <Form.Control as="textarea" rows={4} placeholder="Votre message ici..." />
                </Form.Group>
                <Button variant="primary">Envoyer</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}