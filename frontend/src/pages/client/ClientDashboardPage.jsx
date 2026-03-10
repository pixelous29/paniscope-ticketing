import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Button, Badge, Spinner, Alert, Nav, Table, Tooltip, OverlayTrigger } from 'react-bootstrap';
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



  if (loading) {
    return <div className="d-flex justify-content-center mt-5 w-100"><Spinner animation="border" /></div>;
  }

  if (error) {
    return <div className="mt-4 px-3"><Alert variant="danger">{error}</Alert></div>;
  }

  const currentTickets = tickets.filter(ticket => !ticket.archived || ticket.status !== STATUS.CLOSED);
  const archivedTickets = tickets.filter(ticket => ticket.archived && ticket.status === STATUS.CLOSED);
  const showActionsColumn = currentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      {/* Header pleine largeur */}
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0 fw-bold text-dark">Tableau de bord</h4>
          <div className="d-none d-md-block">
            {(!currentUser.company || !currentUser.firstName || !currentUser.lastName) ? (
              <OverlayTrigger placement="left" overlay={(props) => <Tooltip id="button-tooltip" {...props}>Vous devez renseigner votre nom, prénom et société avant de créer un ticket.</Tooltip>}>
                <span className="d-inline-block">
                  <LinkContainer to="/mon-compte">
                    <Button variant="warning" className="fw-semibold px-4 py-2 shadow-sm rounded-pill">Compléter profil</Button>
                  </LinkContainer>
                </span>
              </OverlayTrigger>
            ) : (
              <LinkContainer to="/nouveau-ticket">
                <Button variant="primary" className="fw-semibold px-4 py-2 shadow-sm rounded-pill d-flex align-items-center">
                  <i className="bi bi-plus-lg me-2"></i>Nouveau ticket
                </Button>
              </LinkContainer>
            )}
          </div>
        </div>
        
        <Nav variant="tabs" className="custom-tabs" activeKey={view} onSelect={(k) => setView(k)}>
          <Nav.Item>
            <Nav.Link eventKey="current" className="fw-semibold">Tickets en cours ({currentTickets.length})</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="archived" className="fw-semibold">Tickets Archivés ({archivedTickets.length})</Nav.Link>
          </Nav.Item>
        </Nav>
      </div>
      
      {/* Zone de contenu principale */}
      <div className="flex-grow-1 overflow-auto p-3 p-md-4 bg-light">
        <div className="w-100 mx-auto" style={{ maxWidth: '1200px' }}>
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
              <div className="bg-white rounded-3 shadow-sm border overflow-hidden d-none d-md-block mb-4">
                <Table hover responsive className="m-0 align-middle">
                  <thead className="bg-light text-secondary">
                    <tr>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Dernière mise à jour</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Statut</th>
                      {showActionsColumn && <th className="py-3 px-4 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {currentTickets.length > 0 ? (
                    currentTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3">
                          <div className="fw-bold text-dark">{ticket.subject}</div>
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <div className="small text-muted mt-1"><i className="bi bi-person me-1"></i> Initiateur: {ticket.clientName || 'Collègue'}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-secondary">{ticket.lastUpdate}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ticket.status} />
                        </td>
                        {showActionsColumn && (
                          <td className="px-4 py-3 text-center">
                            {ticket.status === STATUS.CLOSED && (
                              <OverlayTrigger placement="top" overlay={(props) => <Tooltip id={`tooltip-${ticket.id}`} {...props}>Archiver</Tooltip>}>
                                <Button variant="light" size="sm" onClick={(e) => handleArchiveTicket(e, ticket.id)} className="text-secondary hover-primary border">
                                  <i className="bi bi-archive"></i>
                                </Button>
                              </OverlayTrigger>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={showActionsColumn ? 4 : 3} className="text-center py-5 text-muted">
                        <div className="mb-2"><i className="bi bi-inbox fs-3"></i></div>
                        Aucun ticket en cours.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              </div>
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
              <div className="bg-white rounded-3 shadow-sm border overflow-hidden d-none d-md-block mb-4">
                <Table hover responsive className="m-0 align-middle">
                  <thead className="bg-light text-secondary">
                    <tr>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Dernière mise à jour</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {archivedTickets.length > 0 ? (
                    archivedTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3">
                          <div className="fw-bold text-dark">{ticket.subject}</div>
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <div className="small text-muted mt-1"><i className="bi bi-person me-1"></i> Initiateur: {ticket.clientName || 'Collègue'}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-secondary">{ticket.lastUpdate}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ticket.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-5 text-muted">
                        <div className="mb-2"><i className="bi bi-archive fs-3"></i></div>
                        Aucun ticket archivé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bouton d'action flottant pour mobile */}
      <div className="d-md-none position-fixed shadow-lg rounded-circle" style={{ bottom: '24px', right: '24px', zIndex: 1050 }}>
        {(!currentUser.company || !currentUser.firstName || !currentUser.lastName) ? (
          <OverlayTrigger placement="left" overlay={(props) => <Tooltip id="mobile-tooltip" {...props}>Complétez votre profil pour créer un ticket.</Tooltip>}>
            <span className="d-inline-block">
              <LinkContainer to="/mon-compte">
                <Button variant="warning" className="rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '64px', height: '64px' }}>
                  <i className="bi bi-person-fill" style={{ fontSize: '2rem', lineHeight: 1 }}></i>
                </Button>
              </LinkContainer>
            </span>
          </OverlayTrigger>
        ) : (
          <LinkContainer to="/nouveau-ticket">
            <Button variant="primary" className="rounded-circle d-flex align-items-center justify-content-center p-0 shadow" style={{ width: '64px', height: '64px' }}>
              <i className="bi bi-plus" style={{ fontSize: '2.5rem', lineHeight: 1 }}></i>
            </Button>
          </LinkContainer>
        )}
      </div>
    </div>
  );
}
