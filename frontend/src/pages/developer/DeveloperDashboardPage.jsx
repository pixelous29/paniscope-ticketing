import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function DeveloperDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
    <Container className="mt-4">
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
              </tr>
            </thead>
            <tbody>
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <tr key={ticket.id} onClick={() => navigate(`/dev/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }}>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center">Aucun ticket ne vous est assigné.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
}
