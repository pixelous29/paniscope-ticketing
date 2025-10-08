import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Card, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { STATUS, STATUS_VARIANT } from '../../constants/status';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function ManagerDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current'); // 'current' or 'archived'
  const navigate = useNavigate();
  const { showAlert } = useModal();

  useEffect(() => {
    const ticketsCollectionQuery = query(collection(db, "tickets"));
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
      setError("Erreur lors de la récupération des tickets en temps réel.");
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleArchiveTicket = async (e, id) => {
    e.stopPropagation();
    const ticketRef = doc(db, "tickets", id);
    try {
      await updateDoc(ticketRef, {
        archived: true
      });
    } catch (err) {
      console.error("Erreur lors de l'archivage du ticket: ", err);
      showAlert("Erreur", "Une erreur est survenue lors de l'archivage.");
    }
  };

  const renderTooltip = (props, text) => (
    <Tooltip id="button-tooltip" {...props}>
      {text}
    </Tooltip>
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
        <Card.Header>
          <h4 className="mb-3">Tableau de bord Manager</h4>
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
                  <th>Priorité</th>
                  <th>Sujet</th>
                  <th>Client</th>
                  <th>Assigné à</th>
                  <th>Tags</th>
                  <th>Statut</th>
                  {showActionsColumn && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {currentTickets.length > 0 ? (
                  currentTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'}>{ticket.priority}</Badge></td>
                      <td className="fw-bold align-middle">
                        <div className="d-flex align-items-center">
                          {ticket.hasNewClientMessage && (
                             <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle réponse du client')}>
                               <span className="me-2" style={{color: 'orange', fontSize: '1.2rem'}}>●</span>
                             </OverlayTrigger>
                          )}
                          {ticket.hasNewManagerMessage && (
                             <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle note du manager pour le dev')}>
                              <span className="me-2" style={{color: '#0D6EFD', fontSize: '1.2rem'}}>●</span>
                             </OverlayTrigger>
                          )}
                          {ticket.hasNewDeveloperMessage && (
                             <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle note du développeur')}>
                              <span className="me-2" style={{color: 'purple', fontSize: '1.2rem'}}>●</span>
                             </OverlayTrigger>
                          )}
                          <span>{ticket.subject}</span>
                        </div>
                      </td>
                      <td className="align-middle">{ticket.client || ticket.clientId}</td>
                      <td className="align-middle">{ticket.assignedTo || 'Non assigné'}</td>
                      <td className="align-middle">
                        {ticket.tags?.map(tag => (
                          <Badge key={tag} pill bg="primary" className="me-1">{tag}</Badge>
                        ))}
                      </td>
                      <td className="align-middle"><Badge bg={STATUS_VARIANT[ticket.status] || 'secondary'} pill>{ticket.status}</Badge></td>
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
                    <td colSpan={showActionsColumn ? 7 : 6} className="text-center">Aucun ticket en cours.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          ) : (
            <Table striped bordered hover responsive className="m-0">
              <thead>
                <tr>
                  <th>Priorité</th>
                  <th>Sujet</th>
                  <th>Client</th>
                  <th>Assigné à</th>
                  <th>Tags</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {archivedTickets.length > 0 ? (
                  archivedTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'}>{ticket.priority}</Badge></td>
                      <td className="fw-bold align-middle">{ticket.subject}</td>
                      <td className="align-middle">{ticket.client || ticket.clientId}</td>
                      <td className="align-middle">{ticket.assignedTo || 'Non assigné'}</td>
                      <td className="align-middle">
                        {ticket.tags?.map(tag => (
                          <Badge key={tag} pill bg="primary" className="me-1">{tag}</Badge>
                        ))}
                      </td>
                      <td className="align-middle"><Badge bg={STATUS_VARIANT[ticket.status] || 'secondary'} pill>{ticket.status}</Badge></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center">Aucun ticket archivé.</td>
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
