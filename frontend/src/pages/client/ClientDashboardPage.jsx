import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Card, Button, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

const statusVariant = { 'Nouveau': 'primary', 'En cours': 'warning', 'En attente': 'info', 'En attente de validation': 'secondary', 'Ticket Clôturé': 'success' };

export default function ClientDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ticketsCollectionQuery = query(collection(db, "tickets"));

    const unsubscribe = onSnapshot(ticketsCollectionQuery, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Convertir le timestamp Firebase en une date lisible
        const lastUpdateDate = data.lastUpdate?.toDate ? data.lastUpdate.toDate().toLocaleDateString('fr-FR') : 'Date inconnue';
        return { 
          id: doc.id, 
          ...data,
          lastUpdate: lastUpdateDate
        };
      });
      
      // Pour l'instant, on affiche tous les tickets. Le filtrage par client se fera avec l'authentification.
      setTickets(ticketsData);
      setLoading(false);
    }, (err) => {
      setError("Erreur lors de la récupération des tickets.");
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Tableau de bord Client</h4>
          <LinkContainer to="/nouveau-ticket">
            <Button variant="success">+ Nouvelle demande</Button>
          </LinkContainer>
        </Card.Header>
        <Card.Body>
          <Card.Title>Voici la liste de vos demandes d'assistance :</Card.Title>
          <ListGroup variant="flush">
            {tickets.length > 0 ? (
              tickets.map(ticket => (
                <LinkContainer key={ticket.id} to={`/ticket/${ticket.id}`}>
                  <ListGroup.Item action className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">{ticket.subject}</div>
                      <small className="text-muted">Dernière mise à jour : {ticket.lastUpdate}</small>
                    </div>
                    <Badge bg={statusVariant[ticket.status] || 'secondary'} pill>
                      {ticket.status}
                    </Badge>
                  </ListGroup.Item>
                </LinkContainer>
              ))
            ) : (
              <p className="text-muted mt-3">Vous n'avez aucune demande pour le moment.</p>
            )}
          </ListGroup>
        </Card.Body>
      </Card>
    </Container>
  );
}