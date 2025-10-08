import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Card, Form, Button, ListGroup, Badge, Spinner, Alert, Breadcrumb } from 'react-bootstrap';
import { useModal } from '../../contexts/ModalProvider';

const statusVariant = { 'Nouveau': 'primary', 'En cours': 'warning', 'En attente': 'info', 'En attente de validation': 'secondary', 'Ticket Clôturé': 'success' };

export default function ClientTicketDetailPage() {
    const { ticketId } = useParams();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [replyText, setReplyText] = useState('');
    const { showAlert } = useModal();

    useEffect(() => {
        setLoading(true);
        const docRef = doc(db, "tickets", ticketId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setTicket({ id: docSnap.id, ...docSnap.data() });
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

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (replyText.trim() === '') return;

        const docRef = doc(db, "tickets", ticketId);
        const newConversationEntry = {
            author: 'Client',
            text: replyText,
            timestamp: new Date()
        };

        try {
            await updateDoc(docRef, {
                conversation: arrayUnion(newConversationEntry),
                lastUpdate: serverTimestamp(),
                hasNewClientMessage: true
            });
            setReplyText('');
        } catch (err) {
            console.error("Erreur lors de l'envoi de la réponse: ", err);
            showAlert('Erreur', 'Une erreur est survenue.');
        }
    };
    
    if (loading) {
        return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    }
    if (error || !ticket) {
        return <Container className="mt-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></Container>;
    }
    
    const isTicketClosed = ticket.status === 'Ticket Clôturé';
    
    return (
        <Container className="mt-4">
        <Breadcrumb>
            <Breadcrumb.Item as={Link} to="/">Tableau de bord</Breadcrumb.Item>
            <Breadcrumb.Item active>Ticket #{ticket?.id}</Breadcrumb.Item>
        </Breadcrumb>
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">{ticket.subject}</h4>
            <Badge bg={statusVariant[ticket.status] || 'secondary'} pill>{ticket.status}</Badge>
            </Card.Header>
            <Card.Body>
            <h5>Conversation</h5>
            <ListGroup variant="flush" className="mb-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {ticket.conversation?.slice().sort((a, b) => {
                    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                    return timeA - timeB;
                }).map((msg, index) => (
                <ListGroup.Item key={index} className="d-flex flex-column border-0 px-0">
                    <div className="d-flex justify-content-between">
                    <strong>{msg.author}</strong>
                    <small className="text-muted">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString('fr-FR') : 'Envoi...'}</small>
                    </div>
                    <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                </ListGroup.Item>
                ))}
            </ListGroup>
            
            {!isTicketClosed && (
                <>
                <hr />
                <h5>Ajouter une réponse</h5>
                <Form onSubmit={handleReplySubmit}>
                    <Form.Group className="mb-3" controlId="clientResponse">
                    <Form.Control
                        as="textarea"
                        rows={4}
                        placeholder="Votre message ici..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                    />
                    </Form.Group>
                    <Button variant="primary" type="submit">Envoyer</Button>
                </Form>
                </>
            )}
            </Card.Body>
        </Card>
        </Container>
    );
}