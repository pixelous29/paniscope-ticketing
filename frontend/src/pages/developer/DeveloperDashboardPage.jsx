import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../hooks/useAuth';
import { STATUS } from '../../constants/status';
import TicketCardMobile from '../../components/shared/TicketCardMobile';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function DeveloperDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current'); // 'current', 'board', or 'archived'
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    
    // Fallback to email if displayName is not set
    const developerName = currentUser.displayName || currentUser.email; 
    
    const ticketsCollectionQuery = query(
      collection(db, "tickets"),
      where("assignedTo", "array-contains", developerName)
    );

    const unsubscribe = onSnapshot(ticketsCollectionQuery, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const sortedTickets = ticketsData.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 0;
        const priorityB = priorityOrder[b.priority] || 0;
        return priorityB - priorityA;
      });

      setTickets(sortedTickets);
      
      // Auto-heal invalid statuses (e.g., devPhases leaked into status previously)
      const validStatuses = Object.values(STATUS);
      sortedTickets.forEach(ticket => {
        if (!validStatuses.includes(ticket.status)) {
          console.warn(`Auto-healing ticket ${ticket.id} status from ${ticket.status} to IN_PROGRESS`);
          updateDoc(doc(db, "tickets", ticket.id), { status: STATUS.IN_PROGRESS, archived: false }).catch(err => 
            console.error("Erreur lors de l'auto-correction du statut:", err)
          );
        }
      });
      
      setLoading(false);
    }, (err) => {
      setError("Erreur lors de la récupération des tickets.");
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

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
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0">
        <h4 className="mb-4 fw-bold text-dark">Tableau de bord Développeur</h4>
        <Nav variant="tabs" className="custom-tabs" activeKey={view} onSelect={(k) => setView(k)}>
          <Nav.Item>
            <Nav.Link eventKey="current" className="fw-semibold">Tickets en cours ({currentTickets.length})</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="archived" className="fw-semibold">Archivés ({archivedTickets.length})</Nav.Link>
          </Nav.Item>
        </Nav>
      </div>
      
      <div className="flex-grow-1 overflow-auto p-3 p-md-4 bg-light">
        <div className="w-100 mx-auto" style={{ maxWidth: '1400px' }}>
          {view === 'current' ? (
            <>
              {/* Vue Mobile (< md) */}
              <div className="d-md-none p-2 bg-light">
                {currentTickets.length > 0 ? (
                  currentTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="developer" 
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
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Tags</th>
                      {showActionsColumn && <th className="py-3 px-4 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {currentTickets.length > 0 ? (
                    currentTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/dev/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3 align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-4 py-3 fw-bold align-middle text-dark">
                          <div className="d-flex align-items-center">
                            {ticket.hasNewManagerMessage && (
                               <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle note du manager')}>
                                <span className="me-2" style={{color: '#0D6EFD', fontSize: '1.2rem'}}>●</span>
                               </OverlayTrigger>
                            )}
                            <span>{ticket.subject}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        {showActionsColumn && (
                          <td className="px-4 py-3 align-middle text-center">
                            {ticket.status === STATUS.CLOSED && (
                              <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Archiver le ticket')}>
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
                      <td colSpan={showActionsColumn ? 5 : 4} className="text-center py-5 text-muted">
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
                      role="developer" 
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
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {archivedTickets.length > 0 ? (
                    archivedTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/dev/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3 align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-4 py-3 fw-bold align-middle text-dark">{ticket.subject}</td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-5 text-muted">
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
    </div>
  );
}
