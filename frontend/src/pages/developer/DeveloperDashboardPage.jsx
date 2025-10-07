import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Card } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function DeveloperDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const developerName = "Lise"; 
    const ticketsCollectionQuery = query(
      collection(db, "tickets"),
      where("assignedTo", "==", developerName)
    );

    const unsubscribe = onSnapshot(ticketsCollectionQuery, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const sortedTickets = ticketsData.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 0;
        const priorityB = priorityOrder[b.priority] || 0;
        return priorityB - priorityA;
      });

      setTickets(sortedTickets);
      setLoading(false);
    }, (err) => {
      setError("Erreur lors de la récupération des tickets.");
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderTooltip = (props, text) => (
    <Tooltip id="button-tooltip" {...props}>
      {text}
    </Tooltip>
  );

  if (loading) {
    return <Spinner animation="border" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <Card>
      <Card.Header>
        <h4 className="mb-0">Tableau de bord Développeur</h4>
      </Card.Header>
      <Card.Body>
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
            {tickets.length > 0 ? (
              tickets.map(ticket => (
                <tr key={ticket.id}>
                  <td><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge></td>
                  <td className="fw-bold">
                    <div className="d-flex align-items-center">
                      {ticket.hasNewManagerMessage && (
                         <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle note du manager')}>
                          <span className="me-2" style={{color: '#0D6EFD', fontSize: '1.2rem'}}>●</span>
                         </OverlayTrigger>
                      )}
                      <span>{ticket.subject}</span>
                    </div>
                  </td>
                  <td>
                    {ticket.tags?.map(tag => (
                      <Badge key={tag} pill bg="primary" className="me-1">{tag}</Badge>
                    ))}
                  </td>
                  <td>
                    <LinkContainer to={`/dev/ticket/${ticket.id}`}>
                      <Button variant="outline-secondary" size="sm">Ouvrir</Button>
                    </LinkContainer>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">Aucun ticket ne vous est assigné.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}
