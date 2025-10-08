import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Card, Button, Badge, Spinner, Alert, Nav, Table, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { STATUS, STATUS_VARIANT } from '../../constants/status';

export default function ClientDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current');
  const navigate = useNavigate();
  const { showAlert } = useModal();

  useEffect(() => {
    const ticketsCollectionQuery = query(collection(db, "tickets"));

    const unsubscribe = onSnapshot(ticketsCollectionQuery, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const lastUpdateDate = data.lastUpdate?.toDate ? data.lastUpdate.toDate().toLocaleDateString('fr-FR') : 'Date inconnue';
        return { 
          id: doc.id, 
          ...data,
          lastUpdate: lastUpdateDate
        };
      });
      
      setTickets(ticketsData);
      setLoading(false);
    }, (err) => {
      setError("Erreur lors de la récupération des tickets.");
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleArchiveTicket = async (e, id) => {
    e.stopPropagation();
    const ticketRef = doc(db, "tickets", id);
    try {
      await updateDoc(ticketRef, { archived: true });
    } catch (err) {
      console.error("Erreur lors de l'archivage du ticket: ", err);
      showAlert("Erreur", "Une erreur est survenue lors de l'archivage.");
    }
  };

  const renderTooltip = (props, text) => (
    <Tooltip id="button-tooltip" {...props}>{text}</Tooltip>
  );

  if (loading) {
    return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
  }

  if (error) {
    return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
  }

  const currentTickets = tickets.filter(ticket => !ticket.archived);
  const archivedTickets = tickets.filter(ticket => ticket.archived);
  const showActionsColumn = currentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <Container className="mt-4">
      <Card>
        <Card.Header className="position-relative">
          <h4 className="mb-3 text-center">Tableau de bord Client</h4>
          <div className="position-absolute top-0 end-0 mt-1">
            <LinkContainer to="/nouveau-ticket">
              <Button variant="success">+ Nouvelle demande</Button>
            </LinkContainer>
          </div>
          <Nav variant="tabs" activeKey={view} onSelect={(k) => setView(k)}>
            <Nav.Item>
              <Nav.Link eventKey="current">Tickets en cours</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="archived">Tickets Archivés</Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        <Card.Body>
          {view === 'current' ? (
            <Table striped bordered hover responsive className="m-0">
              <thead>
                <tr>
                  <th>Sujet</th>
                  <th>Dernière mise à jour</th>
                  <th>Statut</th>
                  {showActionsColumn && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {currentTickets.length > 0 ? (
                  currentTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="fw-bold align-middle">{ticket.subject}</td>
                      <td className="align-middle">{ticket.lastUpdate}</td>
                      <td className="align-middle">
                        <Badge bg={STATUS_VARIANT[ticket.status] || 'secondary'} pill>
                          {ticket.status}
                        </Badge>
                      </td>
                      {showActionsColumn && (
                        <td className="align-middle text-center">
                          {ticket.status === STATUS.CLOSED && (
                            <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Archiver le ticket')}>
                              <Button variant="outline-secondary" size="sm" onClick={(e) => handleArchiveTicket(e, ticket.id)}>
                                <i className="bi bi-archive-fill"></i>
                              </Button>
                            </OverlayTrigger>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showActionsColumn ? 4 : 3} className="text-center">Aucun ticket en cours.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          ) : (
            <Table striped bordered hover responsive className="m-0">
              <thead>
                <tr>
                  <th>Sujet</th>
                  <th>Dernière mise à jour</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {archivedTickets.length > 0 ? (
                  archivedTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="fw-bold align-middle">{ticket.subject}</td>
                      <td className="align-middle">{ticket.lastUpdate}</td>
                      <td className="align-middle">
                        <Badge bg={STATUS_VARIANT[ticket.status] || 'secondary'} pill>
                          {ticket.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="text-center">Aucun ticket archivé.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
