import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Breadcrumb } from 'react-bootstrap';
import { mockAllTickets } from '../../data/mockData';

const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function DeveloperTicketDetailPage() {
  const { ticketId } = useParams();
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
        <Breadcrumb.Item as={Link} to="/dev">Tableau de bord</Breadcrumb.Item>
        <Breadcrumb.Item active>Ticket #{ticket.id}</Breadcrumb.Item>
      </Breadcrumb>

      <Row>
        {/* Colonne principale avec les détails techniques */}
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header>
              <h4 className="mb-0">{ticket.subject}</h4>
            </Card.Header>
            <Card.Body>
              <Card.Title>Note du Manager</Card.Title>
              <Card.Text className="fst-italic text-muted">
                (Fonctionnalité à venir) Ici s'affichera la note interne laissée par le manager lors du transfert.
              </Card.Text>
              <hr />
              <Card.Title>Description originale du client</Card.Title>
              <Card.Text>
                {ticket.description}
              </Card.Text>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <h5>Discussion interne (Dev/Manager)</h5>
              <ListGroup variant="flush">
                {/* La discussion interne sera implémentée plus tard */}
                <ListGroup.Item className="text-muted">Aucun commentaire pour le moment.</ListGroup.Item>
              </ListGroup>
              <hr />
              <h5>Ajouter un commentaire technique</h5>
              <Form>
                <Form.Group className="mb-3" controlId="devComment">
                  <Form.Control as="textarea" rows={3} placeholder="Mise à jour, question..." />
                </Form.Group>
                <Button variant="secondary">Ajouter le commentaire</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Colonne latérale avec infos clés et actions */}
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Informations Clés</Card.Title>
              <div>
                <strong>Priorité:</strong>{' '}
                <Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge>
              </div>
              <div className="mt-2">
                <strong>Tags:</strong>{' '}
                {ticket.tags.map(tag => <Badge key={tag} pill bg="info" className="me-1">{tag}</Badge>)}
              </div>
              <hr />
              <Card.Title>Actions</Card.Title>
              <div className="d-grid gap-2">
                <Button variant="success">Terminé, prêt pour validation</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}