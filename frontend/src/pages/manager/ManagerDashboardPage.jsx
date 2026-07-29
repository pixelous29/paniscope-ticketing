import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Table, Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger, Nav, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { STATUS } from '../../constants/status';
import { TICKET_TYPE_PASTEL_BG, getTicketPastelBg } from '../../constants/type';
import { DEV_PHASE_LABELS, DEV_PHASE_COLORS, DEV_PHASES_ORDER } from '../../constants/phases';
import StatusBadge from '../../components/shared/StatusBadge';
import TypeBadge from '../../components/shared/TypeBadge';
import TicketCardMobile from '../../components/shared/TicketCardMobile';

const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };
const devPhaseIcons = {
  PLANNING: "bi-clipboard-data",
  DEVELOPMENT: "bi-code-slash",
  TESTING: "bi-bug",
  READY_FOR_DEPLOY: "bi-rocket-takeoff",
};

const getTicketDateMs = (t) => {
  const ts = t.submittedAt || t.createdAt || t.lastUpdate;
  if (!ts) return 0;
  return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
};

const formatTicketDate = (t) => {
  const ts = t.submittedAt || t.createdAt || t.lastUpdate;
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ManagerDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current'); // 'current' or 'archived' or 'board'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const navigate = useNavigate();
  const { showAlert } = useModal();

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'date' || column === 'priority' ? 'desc' : 'asc');
    }
  };

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
    const dateStr = formatTicketDate(ticket).toLowerCase();

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
      type.includes(lowerTerm) ||
      dateStr.includes(lowerTerm)
    );
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

  const filteredCurrentTickets = currentTickets.filter(ticket => matchesSearch(ticket, searchTerm));
  const filteredArchivedTickets = archivedTickets.filter(ticket => matchesSearch(ticket, searchTerm));

  const sortTicketsList = (list) => {
    return [...list].sort((a, b) => {
      let result = 0;
      if (sortColumn === 'id') {
        const numA = parseInt(a.id, 10) || 0;
        const numB = parseInt(b.id, 10) || 0;
        result = numA - numB;
      } else if (sortColumn === 'priority') {
        const prioA = priorityOrder[a.priority] || 0;
        const prioB = priorityOrder[b.priority] || 0;
        result = prioA - prioB;
      } else if (sortColumn === 'devPhase') {
        const phaseA = DEV_PHASES_ORDER.indexOf(a.devPhase) !== -1 ? DEV_PHASES_ORDER.indexOf(a.devPhase) : 0;
        const phaseB = DEV_PHASES_ORDER.indexOf(b.devPhase) !== -1 ? DEV_PHASES_ORDER.indexOf(b.devPhase) : 0;
        result = phaseA - phaseB;
      } else if (sortColumn === 'subject') {
        result = (a.subject || '').localeCompare(b.subject || '');
      } else if (sortColumn === 'client') {
        const clientA = a.clientName || a.client || a.clientId || '';
        const clientB = b.clientName || b.client || b.clientId || '';
        result = clientA.localeCompare(clientB);
      } else if (sortColumn === 'assignedTo') {
        const assignedA = Array.isArray(a.assignedTo) ? a.assignedTo.join(' ') : (a.assignedTo || '');
        const assignedB = Array.isArray(b.assignedTo) ? b.assignedTo.join(' ') : (b.assignedTo || '');
        result = assignedA.localeCompare(assignedB);
      } else if (sortColumn === 'tags') {
        const tagsA = (a.tags || []).join(' ');
        const tagsB = (b.tags || []).join(' ');
        result = tagsA.localeCompare(tagsB);
      } else if (sortColumn === 'status') {
        result = (a.status || '').localeCompare(b.status || '');
      } else if (sortColumn === 'date') {
        result = getTicketDateMs(a) - getTicketDateMs(b);
      }

      return sortDirection === 'asc' ? result : -result;
    });
  };

  const renderSortHeader = (colKey, label) => {
    const isSorted = sortColumn === colKey;
    return (
      <th 
        className="py-3 px-3 fw-semibold border-bottom-0 user-select-none" 
        onClick={() => handleSort(colKey)}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center gap-1">
          <span>{label}</span>
          {isSorted ? (
            <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} text-primary fw-bold`}></i>
          ) : (
            <i className="bi bi-arrow-down-up text-muted opacity-50" style={{ fontSize: '0.75rem' }}></i>
          )}
        </div>
      </th>
    );
  };

  const sortedCurrentTickets = sortTicketsList(filteredCurrentTickets);
  const sortedArchivedTickets = sortTicketsList(filteredArchivedTickets);

  const showActionsColumn = sortedCurrentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0 d-flex flex-column flex-md-row justify-content-between align-items-md-end">
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex justify-content-between align-items-center mb-3 mb-md-4">
            <h4 className="m-0 fw-bold text-dark">Tableau de bord</h4>
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
                  placeholder="Rechercher (sujet, client, dev...)"
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
        <div className="w-100 mx-auto px-1">
          {view === 'current' ? (
            <>
              {/* Vue Mobile (< md) */}
              <div className="d-md-none p-2 bg-light">
                {sortedCurrentTickets.length > 0 ? (
                  sortedCurrentTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="manager" 
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
                      {renderSortHeader('id', 'Ticket N°')}
                      {renderSortHeader('priority', 'Priorité')}
                      {renderSortHeader('devPhase', 'Phase de dev')}
                      {renderSortHeader('subject', 'Sujet')}
                      {renderSortHeader('client', 'Client')}
                      {renderSortHeader('assignedTo', 'Assigné à')}
                      {renderSortHeader('tags', 'Tags')}
                      {renderSortHeader('status', 'Statut')}
                      {renderSortHeader('date', 'Date')}
                      {showActionsColumn && <th className="py-3 px-3 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {sortedCurrentTickets.length > 0 ? (
                    sortedCurrentTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      const phaseKey = ticket.devPhase || 'PLANNING';
                      const phaseColor = DEV_PHASE_COLORS[phaseKey] || 'secondary';
                      const phaseLabel = DEV_PHASE_LABELS[phaseKey] || 'Planification';
                      const phaseIcon = devPhaseIcons[phaseKey] || 'bi-gear';

                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          <Badge bg={phaseColor} text={phaseColor === 'warning' ? 'dark' : 'white'} className="px-2 py-1 fw-normal">
                            <i className={`bi ${phaseIcon} me-1`}></i>
                            {phaseLabel}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 fw-bold align-middle text-dark" style={{ backgroundColor: bg }}>
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
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
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
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        <td className="px-3 py-3 align-middle text-nowrap" style={{ backgroundColor: bg }}><StatusBadge status={ticket.status} /></td>
                        <td className="px-3 py-3 align-middle text-nowrap text-secondary" style={{ backgroundColor: bg, fontSize: '0.85rem' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatTicketDate(ticket)}
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
                      <td colSpan={showActionsColumn ? 10 : 9} className="text-center py-5 text-muted">
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
                {sortedArchivedTickets.length > 0 ? (
                  sortedArchivedTickets.map(ticket => (
                    <TicketCardMobile 
                      key={ticket.id} 
                      ticket={ticket} 
                      role="manager" 
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
                      {renderSortHeader('id', 'Ticket N°')}
                      {renderSortHeader('priority', 'Priorité')}
                      {renderSortHeader('devPhase', 'Phase de dev')}
                      {renderSortHeader('subject', 'Sujet')}
                      {renderSortHeader('client', 'Client')}
                      {renderSortHeader('assignedTo', 'Assigné à')}
                      {renderSortHeader('tags', 'Tags')}
                      {renderSortHeader('status', 'Statut')}
                      {renderSortHeader('date', 'Date')}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {sortedArchivedTickets.length > 0 ? (
                    sortedArchivedTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      const phaseKey = ticket.devPhase || 'PLANNING';
                      const phaseColor = DEV_PHASE_COLORS[phaseKey] || 'secondary';
                      const phaseLabel = DEV_PHASE_LABELS[phaseKey] || 'Planification';
                      const phaseIcon = devPhaseIcons[phaseKey] || 'bi-gear';

                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/manager/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}><Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'} className="px-2 py-1">{ticket.priority}</Badge></td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          <Badge bg={phaseColor} text={phaseColor === 'warning' ? 'dark' : 'white'} className="px-2 py-1 fw-normal">
                            <i className={`bi ${phaseIcon} me-1`}></i>
                            {phaseLabel}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 fw-bold align-middle text-dark" style={{ backgroundColor: bg }}>{ticket.subject}</td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.clientName || ticket.client || ticket.clientId}
                          {ticket.companyDomain && (
                            <><br/><small className="text-muted"><i className="bi bi-building me-1"></i>{ticket.companyDomain}</small></>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
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
                        <td className="px-3 py-3 align-middle" style={{ backgroundColor: bg }}>
                          {ticket.tags?.map(tag => (
                            <Badge key={tag} pill bg="primary" className="me-1 fw-normal">{tag}</Badge>
                          ))}
                        </td>
                        <td className="px-3 py-3 align-middle text-nowrap" style={{ backgroundColor: bg }}><StatusBadge status={ticket.status} /></td>
                        <td className="px-3 py-3 align-middle text-nowrap text-secondary" style={{ backgroundColor: bg, fontSize: '0.85rem' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatTicketDate(ticket)}
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
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
