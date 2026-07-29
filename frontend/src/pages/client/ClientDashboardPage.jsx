import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Button, Badge, Spinner, Alert, Nav, Table, Tooltip, OverlayTrigger, Form, InputGroup } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../hooks/useAuth';
import { STATUS } from '../../constants/status';
import { TICKET_TYPE_PASTEL_BG, getTicketPastelBg } from '../../constants/type';
import TicketCardMobile from '../../components/shared/TicketCardMobile';
import StatusBadge from '../../components/shared/StatusBadge';
import TypeBadge from '../../components/shared/TypeBadge';

const getTicketDateMs = (t) => {
  const ts = t.lastUpdateTimestamp || t.submittedAt || t.createdAt;
  if (!ts) return t._rawLastUpdate || 0;
  return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
};

const formatTicketDate = (t) => {
  const ts = t.lastUpdateTimestamp || t.submittedAt || t.createdAt;
  if (!ts) return t.lastUpdate || '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ClientDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
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
        where("clientUid", "==", currentUser.uid || "")
      );
    }

    const unsubscribe = onSnapshot(ticketsCollectionQuery, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const lastUpdateDate = data.lastUpdate?.toDate ? data.lastUpdate.toDate().toLocaleDateString('fr-FR') : 'Date inconnue';
        return { 
          id: doc.id, 
          ...data,
          lastUpdate: lastUpdateDate,
          _rawLastUpdate: data.lastUpdate?.toMillis ? data.lastUpdate.toMillis() : (data.createdAt?.toMillis ? data.createdAt.toMillis() : 0)
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



  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  };

  const matchesSearch = (ticket, term) => {
    if (!term) return true;
    const lowerTerm = term.toLowerCase().trim();

    const ticketId = (ticket.id || '').toLowerCase();
    const formattedId = `#${ticketId}`;
    const subject = (ticket.subject || '').toLowerCase();
    const status = (ticket.status || '').toLowerCase();
    const clientName = (ticket.clientName || '').toLowerCase();
    const dateStr = formatTicketDate(ticket).toLowerCase();

    return (
      ticketId.includes(lowerTerm) ||
      formattedId.includes(lowerTerm) ||
      subject.includes(lowerTerm) ||
      status.includes(lowerTerm) ||
      clientName.includes(lowerTerm) ||
      dateStr.includes(lowerTerm)
    );
  };

  const sortTicketsList = (list) => {
    return [...list].sort((a, b) => {
      let result = 0;
      if (sortColumn === 'id') {
        const numA = parseInt(a.id, 10) || 0;
        const numB = parseInt(b.id, 10) || 0;
        result = numA - numB;
      } else if (sortColumn === 'subject') {
        result = (a.subject || '').localeCompare(b.subject || '');
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

  if (loading) {
    return <div className="d-flex justify-content-center mt-5 w-100"><Spinner animation="border" /></div>;
  }

  if (error) {
    return <div className="mt-4 px-3"><Alert variant="danger">{error}</Alert></div>;
  }

  const currentTickets = tickets.filter(ticket => !ticket.archived || ticket.status !== STATUS.CLOSED);
  const archivedTickets = tickets.filter(ticket => ticket.archived && ticket.status === STATUS.CLOSED);

  const filteredCurrentTickets = currentTickets.filter(ticket => matchesSearch(ticket, searchTerm));
  const filteredArchivedTickets = archivedTickets.filter(ticket => matchesSearch(ticket, searchTerm));

  const sortedCurrentTickets = sortTicketsList(filteredCurrentTickets);
  const sortedArchivedTickets = sortTicketsList(filteredArchivedTickets);

  const showActionsColumn = sortedCurrentTickets.some(ticket => ticket.status === STATUS.CLOSED);

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      {/* Header pleine largeur */}
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-0 flex-shrink-0">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 mb-md-4 gap-3">
          <h4 className="mb-0 fw-bold text-dark">Tableau de bord</h4>
          
          <div className="d-flex align-items-center gap-2 w-100 w-md-auto justify-content-between justify-content-md-end">
            <div className="d-md-none me-2 flex-grow-1">
              <InputGroup size="sm">
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
                Tickets Archivés ({filteredArchivedTickets.length}{searchTerm ? ` / ${archivedTickets.length}` : ''})
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
                placeholder="Rechercher (sujet, date...)"
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
      
      {/* Zone de contenu principale (fluide pleine largeur) */}
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
                      role="client" 
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
                      {renderSortHeader('subject', 'Sujet')}
                      {renderSortHeader('date', 'Dernière mise à jour')}
                      {renderSortHeader('status', 'Statut')}
                      {showActionsColumn && <th className="py-3 px-3 fw-semibold border-bottom-0 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {sortedCurrentTickets.length > 0 ? (
                    sortedCurrentTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3" style={{ backgroundColor: bg }}>
                          <div className="fw-bold text-dark">{ticket.subject}</div>
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <div className="small text-muted mt-1"><i className="bi bi-person me-1"></i> Initiateur: {ticket.clientName || 'Collègue'}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-secondary text-nowrap" style={{ backgroundColor: bg, fontSize: '0.85rem' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatTicketDate(ticket)}
                        </td>
                        <td className="px-3 py-3 align-middle text-nowrap" style={{ backgroundColor: bg }}>
                          <StatusBadge status={ticket.status} />
                        </td>
                        {showActionsColumn && (
                          <td className="px-3 py-3 text-center" style={{ backgroundColor: bg }}>
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
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan={showActionsColumn ? 5 : 4} className="text-center py-5 text-muted">
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
                      role="client" 
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
                      {renderSortHeader('subject', 'Sujet')}
                      {renderSortHeader('date', 'Dernière mise à jour')}
                      {renderSortHeader('status', 'Statut')}
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                  {sortedArchivedTickets.length > 0 ? (
                    sortedArchivedTickets.map(ticket => {
                      const bg = getTicketPastelBg(ticket.type);
                      return (
                      <tr key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} style={{ cursor: 'pointer', '--bs-table-bg': bg, backgroundColor: bg }} className="border-bottom">
                        <td className="px-3 py-3 align-middle text-secondary fw-semibold" style={{ backgroundColor: bg }}>#{ticket.id}</td>
                        <td className="px-3 py-3" style={{ backgroundColor: bg }}>
                          <div className="fw-bold text-dark">{ticket.subject}</div>
                          {ticket.companyDomain && ticket.clientUid !== currentUser.uid && (
                            <div className="small text-muted mt-1"><i className="bi bi-person me-1"></i> Initiateur: {ticket.clientName || 'Collègue'}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-secondary text-nowrap" style={{ backgroundColor: bg, fontSize: '0.85rem' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatTicketDate(ticket)}
                        </td>
                        <td className="px-3 py-3 align-middle text-nowrap" style={{ backgroundColor: bg }}>
                          <StatusBadge status={ticket.status} />
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-5 text-muted">
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
