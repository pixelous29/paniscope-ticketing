import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Nav, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../hooks/useAuth';
import { STATUS } from '../../constants/status';
import { TICKET_TYPE_PASTEL_BG, getTicketPastelBg } from '../../constants/type';
import TicketCardMobile from '../../components/shared/TicketCardMobile';
import TypeBadge from '../../components/shared/TypeBadge';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function DeveloperDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current'); // 'current', 'board', or 'archived'
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { currentUser } = useAuth();

  const matchesSearch = (ticket, term) => {
    if (!term) return true;
    const lowerTerm = term.toLowerCase().trim();

    const ticketId = (ticket.id || '').toLowerCase();
    const formattedId = `#${ticketId}`;
    const subject = (ticket.subject || '').toLowerCase();
    const priority = (ticket.priority || '').toLowerCase();
    const clientName = (ticket.clientName || ticket.client || ticket.clientId || '').toLowerCase();
    const companyDomain = (ticket.companyDomain || '').toLowerCase();
    const status = (ticket.status || '').toLowerCase();

    const assigned = Array.isArray(ticket.assignedTo) 
      ? ticket.assignedTo.join(' ').toLowerCase() 
      : (ticket.assignedTo || '').toLowerCase();

    const tags = Array.isArray(ticket.tags) 
      ? ticket.tags.join(' ').toLowerCase() 
      : (ticket.tags || '').toLowerCase();

    const type = (ticket.type || '').toLowerCase();

    return (
      ticketId.includes(lowerTerm) ||
      formattedId.includes(lowerTerm) ||
      subject.includes(lowerTerm) ||
      priority.includes(lowerTerm) ||
      clientName.includes(lowerTerm) ||
      companyDomain.includes(lowerTerm) ||
      status.includes(lowerTerm) ||
      assigned.includes(lowerTerm) ||
      tags.includes(lowerTerm) ||
      type.includes(lowerTerm)
    );
  };

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
  const archivedTickets = tickets.filter(ticket => ticket.archived && ticket.status === STATUS.CLOSED)
    .sort((a, b) => {
      const getTimestamp = (t) => (t.lastUpdate?.toMillis ? t.lastUpdate.toMillis() : (t.createdAt?.toMillis ? t.createdAt.toMillis() : 0));
      return getTimestamp(b) - getTimestamp(a);
    });

  const filteredCurrentTickets = currentTickets.filter(ticket => matchesSearch(ticket, searchTerm));
  const filteredArchivedTickets = archivedTickets.filter(ticket => matchesSearch(ticket, searchTerm));

  const showActionsColumn = filteredCurrentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0 d-flex flex-column flex-md-row justify-content-between align-items-md-end">
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex justify-content-between align-items-center mb-3 mb-md-4">
            <h4 className="m-0 fw-bold text-dark">Tableau de bord Développeur</h4>
            <div className="d-md-none">
              <InputGroup size="sm" style={{ width: '180px' }}>
                <InputGroup.Text id="search-addon-mobile" className="bg-light text-muted">
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  placeholder="Rechercher..."
                  aria-label="Recherche ticket"
                  aria-describedby="search-addon-mobile"
                />
                {searchTerm && (
                  <Button variant="light" size="sm" className="border" onClick={() => setSearchTerm('')}>
                    <i className="bi bi-x"></i>
                  </Button>
                )}
              </InputGroup>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-end">
            <Nav variant="tabs" className="custom-tabs border-bottom-0" activeKey={view} onSelect={(k) => setView(k)}>
              <Nav.Item>
                <Nav.Link eventKey="current" className="fw-semibold">
                  Tickets en cours ({filteredCurrentTickets.length}{searchTerm ? ` / ${currentTickets.length}` : ''})
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="archived" className="fw-semibold">
                  Archivés ({filteredArchivedTickets.length}{searchTerm ? ` / ${archivedTickets.length}` : ''})
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <div className="d-none d-md-block mb-2">
              <InputGroup size="sm" style={{ width: '280px' }}>
                <InputGroup.Text id="search-addon" className="bg-light text-muted border-end-0">
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  placeholder="Rechercher (sujet, client...)"
                  aria-label="Recherche ticket"
                  aria-describedby="search-addon"
                  className="border-start-0"
                />
                {searchTerm && (
                  <Button variant="light" size="sm" className="border border-start-0" onClick={() => setSearchTerm('')}>
                    <i className="bi bi-x"></i>
                  </Button>
                )}
              </InputGroup>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-grow-1 overflow-auto p-3 p-md-4 bg-light">
        <div className="w-100 mx-auto" style={{ maxWidth: '1400px' }}>
          {view === 'current' ? (
            <>
              {/* Vue Mobile (< md) */}
              <div className="d-md-none p-2 bg-light">
                {filteredCurrentTickets.length > 0 ? (
                  filteredCurrentTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="developer" 
                      onArchive={handleArchiveTicket} 
                    />
                  ))
                ) : (
                  <div className="text-center p-4 text-muted border rounded bg-white">
                    {searchTerm ? 'Aucun ticket ne correspond à la recherche.' : 'Aucun ticket en cours.'}
                  </div>
                )}
              </div>

              {/* Vue Desktop (>= md) */}
              <div className="bg-white rounded-3 shadow-sm border d-none d-md-block mb-4 overflow-x-auto">
                <Table hover responsive className="m-0 align-middle">
                  <thead className="bg-light text-secondary text-nowrap">
                    <tr>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Ticket N°</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Tags</th>
                      {showActionsColumn && <th className="py-3 px-3 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {filteredCurrentTickets.length > 0 ? (
                    filteredCurrentTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/dev/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-3 py-3 fw-bold align-middle text-dark" style={{ backgroundColor: bg }}>
                          <div className="d-flex align-items-center">
                            {ticket.hasNewManagerMessage && (
                               <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Nouvelle note du manager')}>
                                <span className="me-2" style={{color: '#0D6EFD', fontSize: '1.2rem'}}>●</span>
                               </OverlayTrigger>
                            )}
                            <span>{ticket.subject}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        {showActionsColumn && (
                          <td className="px-3 py-3 align-middle text-center" style={{ backgroundColor: bg }}>
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
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan={showActionsColumn ? 6 : 5} className="text-center py-5 text-muted">
                         <div className="mb-2"><i className="bi bi-inbox fs-3"></i></div>
                        {searchTerm ? 'Aucun ticket ne correspond à la recherche.' : 'Aucun ticket en cours.'}
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
                {filteredArchivedTickets.length > 0 ? (
                  filteredArchivedTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="developer" 
                    />
                  ))
                ) : (
                  <div className="text-center p-4 text-muted border rounded bg-white">
                    {searchTerm ? 'Aucun ticket ne correspond à la recherche.' : 'Aucun ticket archivé.'}
                  </div>
                )}
              </div>

              {/* Vue Desktop (>= md) */}
              <div className="bg-white rounded-3 shadow-sm border d-none d-md-block mb-4 overflow-x-auto">
                <Table hover responsive className="m-0 align-middle">
                  <thead className="bg-light text-secondary text-nowrap">
                    <tr>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Ticket N°</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-3 fw-semibold border-bottom-0">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {filteredArchivedTickets.length > 0 ? (
                    filteredArchivedTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/dev/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}><Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-3 py-3 fw-bold align-middle text-dark" style={{ backgroundColor: bg }}>{ticket.subject}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-5 text-muted">
                        <div className="mb-2"><i className="bi bi-archive fs-3"></i></div>
                        {searchTerm ? 'Aucun ticket ne correspond à la recherche.' : 'Aucun ticket archivé.'}
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
