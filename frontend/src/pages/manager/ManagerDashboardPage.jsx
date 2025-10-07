import React from 'react';
import { Container, Table, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { mockAllTickets } from '../../data/mockData'; // Import des données centralisées

// ... (Le reste des constantes priorityVariant, statusVariant, priorityOrder reste identique)
const statusVariant = { 'Nouveau': 'primary', 'En cours': 'warning', 'En attente': 'info', 'Résolu': 'success' };
const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function ManagerDashboardPage() {
  const sortedTickets = mockAllTickets.slice().sort((a, b) => {
    const priorityA = priorityOrder[a.priority] || 0;
    const priorityB = priorityOrder[b.priority] || 0;
    return priorityB - priorityA;
  });

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1>Tableau de bord Manager</h1>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Sujet</th>
            <th>Client</th>
            <th>Assigné à</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedTickets.map(ticket => (
            <tr key={ticket.id}>
              {/* ... (Les autres cellules <td> restent identiques) */}
              <td><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge></td>
              <td className="fw-bold">{ticket.subject}</td>
              <td>{ticket.client}</td>
              <td>{ticket.assignedTo || 'Non assigné'}</td>
              <td><Badge bg={statusVariant[ticket.status] || 'secondary'} pill>{ticket.status}</Badge></td>
              <td>
                <ButtonGroup size="sm">
                  <LinkContainer to={`/manager/ticket/${ticket.id}`}>
                    <Button variant="outline-primary">Voir</Button>
                  </LinkContainer>
                </ButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}