import React from 'react';
import { Container, Table, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { mockAllTickets } from '../../data/mockData';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

// Simulation : On affiche uniquement les tickets assignés.
const assignedTickets = mockAllTickets.filter(ticket => ticket.assignedTo);

export default function DeveloperDashboardPage() {
  const sortedTickets = assignedTickets.slice().sort((a, b) => {
    const priorityA = priorityOrder[a.priority] || 0;
    const priorityB = priorityOrder[b.priority] || 0;
    return priorityB - priorityA;
  });

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1>Tableau de bord Développeur</h1>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Sujet</th>
            <th>Tags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedTickets.map(ticket => (
            <tr key={ticket.id}>
              <td><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge></td>
              <td className="fw-bold">{ticket.subject}</td>
              <td>{ticket.tags.map(tag => <Badge key={tag} pill bg="info" className="me-1">{tag}</Badge>)}</td>
              <td>
                <ButtonGroup size="sm">
                  <LinkContainer to={`/dev/ticket/${ticket.id}`}>
                    <Button variant="outline-primary">Ouvrir</Button>
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