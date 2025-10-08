import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Spinner, Breadcrumb } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';

const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function DeveloperTicketDetailPage() {
    const { ticketId } = useParams();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [commentText, setCommentText] = useState('');
    const { showAlert, showConfirmation } = useModal();

  useEffect(() => {
    const docRef = doc(db, "tickets", ticketId);
    
    // Marque la notification comme lue en ouvrant le ticket
    const markAsReadIfNeeded = async (ticketData) => {
        if (ticketData.hasNewManagerMessage) {
            await updateDoc(docRef, { hasNewManagerMessage: false });
        }
    };

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setTicket(data);
        markAsReadIfNeeded(data);
      } else {
        setError("Ticket non trouvé.");
      }
        setLoading(false);
        }, (err) => {
        setError("Erreur lors de la récupération du ticket.");
        console.error(err);
        setLoading(false);
        });
        return () => unsubscribe();
  }, [ticketId]);
  

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (commentText.trim() === '') return;

        const docRef = doc(db, "tickets", ticketId);
        const newInternalNote = {
            author: 'Développeur',
            text: commentText,
            timestamp: new Date()
        };

        try {
            await updateDoc(docRef, {
                internalNotes: arrayUnion(newInternalNote),
                hasNewDeveloperMessage: true, // Notifie le manager
                hasNewManagerMessage: false // Le dev vient de répondre, donc le manager n'a pas de nouveau message pour le dev
            });
            setCommentText('');
        } catch (err) {
            console.error("Erreur lors de l'ajout du commentaire: ", err);
            showAlert('Erreur', 'Une erreur est survenue.');
        }
    };

    const handleMarkAsDone = async () => {
        showConfirmation('Terminer le ticket', 'Confirmez-vous que le travail sur ce ticket est terminé et prêt pour validation ?', async () => {
            const docRef = doc(db, "tickets", ticketId);
            try {
                await updateDoc(docRef, {
                    status: 'En attente de validation',
                    lastUpdate: serverTimestamp(),
                    hasNewDeveloperMessage: true // Notifie le manager que le statut a changé
                });
            } catch (err) {
                console.error("Erreur lors de la finalisation du ticket: ", err);
                showAlert('Erreur', 'Une erreur est survenue.');
            }
        });
    };

    if (loading) {
        return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    }
    if (error || !ticket) {
        return <Container className="mt-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></Container>;
    }
    const isTicketClosed = ticket.status === 'Ticket Clôturé';
    const isPendingValidation = ticket.status === 'En attente de validation';

    // Tri des notes internes pour affichage chronologique correct
    const sortedInternalNotes = ticket.internalNotes?.slice().sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return timeA - timeB;
    });

    return (
        <Container className="mt-4">
        <Breadcrumb>
            <Breadcrumb.Item as={Link} to="/dev">Tableau de bord</Breadcrumb.Item>
            <Breadcrumb.Item active>Ticket #{ticket.id}</Breadcrumb.Item>
        </Breadcrumb>
        <Row>
            <Col md={8}>
            <Card className="mb-4">
                <Card.Header as="h5">Note(s) du Manager</Card.Header>
                <ListGroup variant="flush">{/* Affiche uniquement les notes du manager */}
                {sortedInternalNotes?.filter(note => note.author === 'Manager').map((note, index) => (
                    <ListGroup.Item key={index}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{note.text}</p>
                    <small className="text-muted">Le {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleDateString('fr-FR') : ''}</small>
                    </ListGroup.Item>
                ))}
                </ListGroup>
            </Card>
            <Card className="mb-4">
                <Card.Header as="h5">Description originale du client</Card.Header>
                <Card.Body>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                    {ticket.conversation?.[0]?.text || "Aucune description initiale trouvée."}
                </p>
                </Card.Body>
            </Card>
            <Card>
                <Card.Header as="h5">Discussion interne (Dev/Manager)</Card.Header>
                <ListGroup variant="flush" className="mb-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {sortedInternalNotes?.map((note, index) => (
                    <ListGroup.Item key={index} className="d-flex flex-column border-0">
                        <div className="d-flex justify-content-between">
                        <strong>{note.author}</strong>
                        <small className="text-muted">{note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString('fr-FR') : 'Envoi...'}</small>
                        </div>
                        <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{note.text}</p>
                    </ListGroup.Item>
                    ))}
                </ListGroup>
                {!isTicketClosed && !isPendingValidation && (
                <Card.Body>
                    <hr/>
                    <h6>Ajouter un commentaire technique</h6>
                    <Form onSubmit={handleCommentSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Control 
                        as="textarea"
                        rows={3}
                        placeholder="Mise à jour, question..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        />
                    </Form.Group>
                    <Button variant="secondary" type="submit">Ajouter le commentaire</Button>
                    </Form>
                </Card.Body>
                )}
            </Card>
            </Col>
            <Col md={4}>
            <Card>
                <Card.Header as="h5">Informations Clés</Card.Header>
                <Card.Body>
                <div>
                    <strong>Priorité :</strong>{' '}
                    <Badge bg={priorityVariant[ticket.priority] || 'light'} text={ticket.priority === 'Critique' || ticket.priority === 'Haute' ? 'light' : 'dark'}>{ticket.priority}</Badge>
                </div>
                <div className="mt-2">
                    <strong>Tags :</strong>{' '}
                    {ticket.tags?.map(tag => <Badge key={tag} pill bg="primary" className="me-1">{tag}</Badge>)}
                </div>
                <hr />
                <div className="d-grid gap-2">
                    <Button variant="success" onClick={handleMarkAsDone} disabled={isTicketClosed || isPendingValidation}>
                  {isPendingValidation ? 'En attente de validation' : 'Terminé, prêt pour validation'}
                </Button>
                </div>
                </Card.Body>
            </Card>
            </Col>
        </Row>
        </Container>
    );
}