import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Table, Badge, ButtonGroup, Button, Spinner, Alert, Modal, Tooltip, OverlayTrigger, Card } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

const statusVariant = { 'Nouveau': 'primary', 'En cours': 'warning', 'En attente': 'info', 'En attente de validation': 'secondary', 'Ticket Clôturé': 'success' };
const priorityVariant = { 'Faible': 'secondary', 'Normale': 'success', 'Haute': 'warning', 'Critique': 'danger' };
const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function ManagerDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);

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

  const handleShowDeleteModal = (id) => {
    setTicketToDelete(id);
    setShowDeleteModal(true);
  };
  const handleCloseDeleteModal = () => {
    setTicketToDelete(null);
    setShowDeleteModal(false);
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      await deleteDoc(doc(db, "tickets", ticketToDelete));
      handleCloseDeleteModal();
    } catch (err) {
      console.error("Erreur lors de la suppression du ticket: ", err);
      alert("Une erreur est survenue.");
      handleCloseDeleteModal();
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

  return (
    <>
      <Card>
        <Card.Header>
          <h4 className="mb-0">Tableau de bord Manager</h4>
        </Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive className="m-0">
            <thead>
              <tr>
                <th>Priorité</th>
                <th>Sujet</th>
                <th>Client</th>
                <th>Assigné à</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <tr key={ticket.id}>
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
                    <td className="align-middle"><Badge bg={statusVariant[ticket.status] || 'secondary'} pill>{ticket.status}</Badge></td>
                    <td className="align-middle">
                      <ButtonGroup size="sm">
                        <LinkContainer to={`/manager/ticket/${ticket.id}`}>
                          <Button variant="outline-primary">Voir</Button>
                        </LinkContainer>
                        <Button variant="outline-danger" onClick={() => handleShowDeleteModal(ticket.id)}>Supprimer</Button>
                      </ButtonGroup>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center">Aucun ticket pour le moment.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmer la suppression</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Êtes-vous sûr de vouloir supprimer ce ticket ? Cette action est irréversible.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>Annuler</Button>
          <Button variant="danger" onClick={handleDeleteTicket}>Confirmer la suppression</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}