import React from 'react';
import { Container, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { mockAllTickets } from '../../data/mockData'; // Import des données centralisées

const statusVariant = {
  'Nouveau': 'primary',
  'En cours': 'warning',
  'En attente': 'info',
  'Résolu': 'success',
};

// Simulation : On affiche uniquement les tickets du 'Client A (ACME Corp)'
const clientTickets = mockAllTickets.filter(ticket => ticket.client === 'Client A (ACME Corp)');

export default function ClientDashboardPage() {
  const navigate = useNavigate();

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1>Tableau de bord Client</h1>
        <Button variant="success" onClick={() => navigate('/nouveau-ticket')}>
          + Nouvelle demande
        </Button>
      </div>

      <p>Voici la liste de vos demandes d'assistance :</p>
      
      <ListGroup>
        {clientTickets.map(ticket => (
          <ListGroup.Item 
            key={ticket.id} 
            as={Link} 
            to={`/ticket/${ticket.id}`} 
            action 
            className="d-flex justify-content-between align-items-center"
          >
            <div>
              <h5 className="mb-1">{ticket.subject}</h5>
              <small>Dernière mise à jour : {ticket.submittedAt.split(' ')[0]}</small>
            </div>
            <Badge bg={statusVariant[ticket.status] || 'secondary'} pill>
              {ticket.status}
            </Badge>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Container>
  );
}
