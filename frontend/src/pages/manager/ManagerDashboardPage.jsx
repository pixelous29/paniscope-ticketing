import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Nav, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { STATUS } from '../../constants/status';
import StatusBadge from '../../components/shared/StatusBadge';
import TicketCardMobile from '../../components/shared/TicketCardMobile';
import toast from 'react-hot-toast';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function ManagerDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current'); // 'current' or 'archived' or 'board'
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { showAlert } = useModal();

  const handleSearch = async (e) => {
    e.preventDefault();
    let val = e.target.search.value.trim();
    if (!val) return;
    val = val.replace(/^#/, '');

    if (/^\d+$/.test(val)) {
      val = val.padStart(7, '0');
    }

    setIsSearching(true);
    try {
      const docRef = doc(db, "tickets", val);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        navigate(`/manager/ticket/${val}`);
      } else {
        toast.error('Ticket non trouvé.', { position: 'top-center' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la recherche.', { position: 'top-center' });
    } finally {
      setIsSearching(false);
    }
  };

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
    return <div className="d-flex justify-content-center mt-5 w-100"><Spinner animation="border" /></div>;
  }

  if (error) {
    return <div className="mt-4 px-3"><Alert variant="danger">{error}</Alert></div>;
  }

  // Un ticket est archivé seulement si archived=true ET status=CLOSED
  // Si un ticket est réouvert, il revient automatiquement dans les tickets en cours
  const currentTickets = tickets.filter(ticket => !ticket.archived || ticket.status !== STATUS.CLOSED);
  const archivedTickets = tickets.filter(ticket => ticket.archived && ticket.status === STATUS.CLOSED)
    .sort((a, b) => {
      const getTimestamp = (t) => (t.lastUpdate?.toMillis ? t.lastUpdate.toMillis() : (t.createdAt?.toMillis ? t.createdAt.toMillis() : 0));
      return getTimestamp(b) - getTimestamp(a);
    });
  const showActionsColumn = currentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0 d-flex flex-column flex-md-row justify-content-between align-items-md-end">
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex justify-content-between align-items-center mb-3 mb-md-4">
            <h4 className="m-0 fw-bold text-dark">Tableau de bord</h4>
            <div className="d-md-none">
              <Form onSubmit={handleSearch} className="d-flex">
                <InputGroup size="sm" style={{ width: '150px' }}>
                  <InputGroup.Text id="search-addon-mobile" className="bg-light fw-bold">#</InputGroup.Text>
                  <Form.Control
                    name="search"
                    autoComplete="off"
                    placeholder="ID ticket..."
                    aria-label="Recherche ticket"
                    aria-describedby="search-addon-mobile"
                  />
                  <Button type="submit" variant="primary" disabled={isSearching}>
                    {isSearching ? <Spinner animation="border" size="sm" /> : <i className="bi bi-search"></i>}
                  </Button>
                </InputGroup>
              </Form>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-end">
            <Nav variant="tabs" className="custom-tabs border-bottom-0" activeKey={view} onSelect={(k) => setView(k)}>
              <Nav.Item>
                <Nav.Link eventKey="current" className="fw-semibold">Tickets en cours ({currentTickets.length})</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="archived" className="fw-semibold">Archivés ({archivedTickets.length})</Nav.Link>
              </Nav.Item>
            </Nav>

            <div className="d-none d-md-block mb-2">
              <Form onSubmit={handleSearch} className="d-flex" style={{ width: '250px' }}>
                <InputGroup size="sm">
                  <InputGroup.Text id="search-addon" className="bg-light fw-bold border-end-0">#</InputGroup.Text>
                  <Form.Control
                    name="search"
                    autoComplete="off"
                    placeholder="Chercher un ticket..."
                    aria-label="Recherche ticket"
                    aria-describedby="search-addon"
                  />
                  <Button type="submit" variant="primary" disabled={isSearching}>
                    {isSearching ? <Spinner animation="border" size="sm" /> : <i className="bi bi-search"></i>}
                  </Button>
                </InputGroup>
              </Form>
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
                {currentTickets.length > 0 ? (
                  currentTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="manager" 
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
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Ticket N°</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Assigné à</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Tags</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Statut</th>
                      {showActionsColumn && <th className="py-3 px-4 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {currentTickets.length > 0 ? (
                    currentTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3 align-middle text-secondary fw-semibold">#{ticket.id}</td>
                        <td className="px-4 py-3 align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-4 py-3 fw-bold align-middle text-dark">
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
                        <td className="px-4 py-3 align-middle">
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {Array.isArray(ticket.assignedTo) && ticket.assignedTo.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {ticket.assignedTo.map(assignee => (
                                <Badge key={assignee} pill bg="primary" text="white" className="fw-normal">{assignee}</Badge>
                              ))}
                            </div>
                          ) : typeof ticket.assignedTo === 'string' && ticket.assignedTo.trim() !== '' ? (
                            <Badge pill bg="primary" text="white" className="fw-normal">{ticket.assignedTo}</Badge>
                          ) : (
                            <span className="text-muted fst-italic">Non assigné</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        <td className="px-4 py-3 align-middle"><StatusBadge status={ticket.status} /></td>
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
                      <td colSpan={showActionsColumn ? 8 : 7} className="text-center py-5 text-muted">
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
                      role="manager" 
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
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Ticket N°</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Priorité</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Sujet</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Client</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Assigné à</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Tags</th>
                      <th className="py-3 px-4 fw-semibold border-bottom-0">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {archivedTickets.length > 0 ? (
                    archivedTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer' }} className="border-bottom">
                        <td className="px-4 py-3 align-middle text-secondary fw-semibold">#{ticket.id}</td>
                        <td className="px-4 py-3 align-middle"><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-4 py-3 fw-bold align-middle text-dark">{ticket.subject}</td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {Array.isArray(ticket.assignedTo) && ticket.assignedTo.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {ticket.assignedTo.map(assignee => (
                                <Badge key={assignee} pill bg="primary" text="white" className="fw-normal">{assignee}</Badge>
                              ))}
                            </div>
                          ) : typeof ticket.assignedTo === 'string' && ticket.assignedTo.trim() !== '' ? (
                            <Badge pill bg="primary" text="white" className="fw-normal">{ticket.assignedTo}</Badge>
                          ) : (
                            <span className="text-muted fst-italic">Non assigné</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        <td className="px-4 py-3 align-middle"><StatusBadge status={ticket.status} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
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
