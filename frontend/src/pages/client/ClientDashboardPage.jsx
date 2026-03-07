import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Card, Button, Badge, Spinner, Alert, Nav, Table, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../hooks/useAuth';
import { STATUS } from '../../constants/status';
import TicketCardMobile from '../../components/shared/TicketCardMobile';
import StatusBadge from '../../components/shared/StatusBadge';

export default function ClientDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current');
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    let ticketsCollectionQuery;
    if (currentUser.companyDomain) {
      // Si l'utilisateur appartient à une entreprise, il voit tous les tickets de son entreprise
      ticketsCollectionQuery = query(
        collection(db, "tickets"),
        where("companyDomain", "==", currentUser.companyDomain)
      );
    } else {
      // Sinon, il ne voit que ses propres tickets
      ticketsCollectionQuery = query(
        collection(db, "tickets"),
        where("clientUid", "==", currentUser.uid)
      );
    }

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
      
      // Auto-heal invalid statuses (e.g., devPhases leaked into status previously)
      const validStatuses = Object.values(STATUS);
      ticketsData.forEach(ticket => {
        if (!validStatuses.includes(ticket.status)) {
          console.warn(`Auto-healing ticket ${ticket.id} status from ${ticket.status} to IN_PROGRESS`);
          updateDoc(doc(db, "tickets", ticket.id), { status: STATUS.IN_PROGRESS, archived: false }).catch(err => 
            console.error("Erreur lors de l'auto-correction du statut:", err)
          );
        }
      });
      
      setLoading(false);
      setError(null); // Réinitialiser l'erreur en cas de succès
    }, (err) => {
      console.error('Erreur Firestore:', err);
      // Ne pas afficher d'erreur si c'est juste une permission refusée (normal pour un nouveau client)
      if (err.code === 'permission-denied') {
        setTickets([]);
        setError(null);
      } else {
        setError("Erreur lors de la récupération des tickets.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

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

  const currentTickets = tickets.filter(ticket => !ticket.archived || ticket.status !== STATUS.CLOSED);
  const archivedTickets = tickets.filter(ticket => ticket.archived && ticket.status === STATUS.CLOSED);
  const showActionsColumn = currentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <Container className="mt-4">
      <Card>
        <Card.Header className="position-relative">
          <h4 className="mb-3 text-center">Tableau de bord Client</h4>
          <div className="position-absolute top-0 end-0 mt-1 d-none d-md-block">
            {(!currentUser.company || !currentUser.firstName || !currentUser.lastName) ? (
              <OverlayTrigger placement="left" overlay={(props) => renderTooltip(props, 'Vous devez renseigner votre nom, prénom et société avant de créer un ticket.')}>
                <span className="d-inline-block">
                  <LinkContainer to="/mon-compte">
                    <Button variant="warning">Compléter mon profil</Button>
                  </LinkContainer>
                </span>
              </OverlayTrigger>
            ) : (
              <LinkContainer to="/nouveau-ticket">
                <Button variant="success">+ Nouvelle demande</Button>
              </LinkContainer>
            )}
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
            <>
              {/* Vue Mobile (< md) */}
              <div className="d-md-none p-2 bg-light">
                {currentTickets.length > 0 ? (
                  currentTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="client" 
                      onArchive={handleArchiveTicket} 
                    />
                  ))
                ) : (
                  <div className="text-center p-4 text-muted border rounded bg-white">
                    Aucun ticket en cours.
                  </div>
                )}
              </div>

              {/* Vue Desktop (>= md) */}
              <Table striped bordered hover responsive className="m-0 d-none d-md-table">
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
                        <td className="fw-bold align-middle">
                          {ticket.subject}
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <><br/><small className="text-muted fw-normal fst-italic">Initiateur: {ticket.clientName || 'Collègue'}</small></>
                          )}
                        </td>
                        <td className="align-middle">{ticket.lastUpdate}</td>
                        <td className="align-middle">
                          <StatusBadge status={ticket.status} />
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
            </>
          ) : (
            <>
              {/* Vue Mobile (< md) */}
              <div className="d-md-none p-2 bg-light">
                {archivedTickets.length > 0 ? (
                  archivedTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="client" 
                    />
                  ))
                ) : (
                  <div className="text-center p-4 text-muted border rounded bg-white">
                    Aucun ticket archivé.
                  </div>
                )}
              </div>

              {/* Vue Desktop (>= md) */}
              <Table striped bordered hover responsive className="m-0 d-none d-md-table">
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
                        <td className="fw-bold align-middle">
                          {ticket.subject}
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <><br/><small className="text-muted fw-normal fst-italic">Initiateur: {ticket.clientName || 'Collègue'}</small></>
                          )}
                        </td>
                        <td className="align-middle">{ticket.lastUpdate}</td>
                        <td className="align-middle">
                          <StatusBadge status={ticket.status} />
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
            </>
          )}
        </Card.Body>
      </Card>

      {/* Bouton d'action flottant pour mobile */}
      <div className="d-md-none position-fixed" style={{ bottom: '24px', right: '24px', zIndex: 1050 }}>
        {(!currentUser.company || !currentUser.firstName || !currentUser.lastName) ? (
          <OverlayTrigger placement="left" overlay={(props) => renderTooltip(props, 'Complétez votre profil pour créer un ticket.')}>
            <span className="d-inline-block">
              <LinkContainer to="/mon-compte">
                <Button variant="warning" className="rounded-circle shadow d-flex align-items-center justify-content-center p-0" style={{ width: '85px', height: '85px' }}>
                  <i className="bi bi-person-fill" style={{ fontSize: '2.5rem', lineHeight: 1 }}></i>
                </Button>
              </LinkContainer>
            </span>
          </OverlayTrigger>
        ) : (
          <LinkContainer to="/nouveau-ticket">
            <Button variant="success" className="rounded-circle shadow d-flex align-items-center justify-content-center p-0" style={{ width: '85px', height: '85px' }}>
              <i className="bi bi-plus" style={{ fontSize: '3.5rem', lineHeight: 1 }}></i>
            </Button>
          </LinkContainer>
        )}
      </div>
    </Container>
  );
}
