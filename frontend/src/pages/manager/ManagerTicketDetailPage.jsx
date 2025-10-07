import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Spinner, Modal, FloatingLabel } from 'react-bootstrap';

const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function ManagerTicketDetailPage() {
    const { ticketId } = useParams();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({ priority: '', assignedTo: '', tags: '' });
    const [replyText, setReplyText] = useState('');
    const [internalNoteText, setInternalNoteText] = useState('');



    useEffect(() => {
        const docRef = doc(db, "tickets", ticketId);
        const updateStatusIfNeeded = async (ticketData) => {
            if (ticketData.status === 'Nouveau') {
                try {
                    await updateDoc(docRef, { status: 'En cours' });
                } catch (err) {
                    console.error("Erreur lors du changement de statut: ", err);
                }
            }
        };
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setTicket(data);
            setEditFormData({
            priority: data.priority,
            assignedTo: data.assignedTo || '',
            tags: data.tags ? data.tags.join(', ') : ''
            });
            updateStatusIfNeeded(data);
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

    const handleEditModalOpen = () => setShowEditModal(true);
    const handleEditModalClose = () => setShowEditModal(false);

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        const docRef = doc(db, "tickets", ticketId);
        try {
        const tagsArray = editFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        await updateDoc(docRef, {
            priority: editFormData.priority,
            assignedTo: editFormData.assignedTo || null,
            tags: tagsArray
        });
        handleEditModalClose();
        } catch (err) {
        console.error("Erreur lors de la mise à jour du ticket: ", err);
        alert("Une erreur est survenue. Veuillez réessayer.");
        }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (replyText.trim() === '') return;
        const docRef = doc(db, "tickets", ticketId);
        const newConversationEntry = { author: 'Manager', text: replyText, timestamp: new Date() };
        try {
            await updateDoc(docRef, {
                conversation: arrayUnion(newConversationEntry),
                lastUpdate: serverTimestamp(),
                status: 'En attente',
                hasNewClientMessage: false
            });
            setReplyText('');
        } catch (err) {
            console.error("Erreur lors de l'envoi de la réponse: ", err);
            alert("Une erreur est survenue. Veuillez réessayer.");
        }
    };
    
    const handleInternalNoteSubmit = async (e) => {
        e.preventDefault();
        if (internalNoteText.trim() === '') return;
        const docRef = doc(db, "tickets", ticketId);
        const newInternalNote = {
            author: 'Manager',
            text: internalNoteText,
            timestamp: new Date() 
        };
        try {
            await updateDoc(docRef, {
                internalNotes: arrayUnion(newInternalNote),
                hasNewDeveloperMessage: false,
                hasNewManagerMessage: true
            });
            setInternalNoteText('');
        } catch (err) {
            console.error("Erreur lors de l'envoi de la note interne: ", err);
            alert("Une erreur est survenue.");
        }
    };

    const handleMarkClientAsRead = async () => {
        const docRef = doc(db, "tickets", ticketId);
        await updateDoc(docRef, { hasNewClientMessage: false });
    };

    const handleMarkDevAsRead = async () => {
        const docRef = doc(db, "tickets", ticketId);
        await updateDoc(docRef, { hasNewDeveloperMessage: false });
    };

    const handleApproveResolution = async () => {
        if (window.confirm("Confirmez-vous la résolution de ce ticket ? Vous pourrez ensuite le clôturer.")) {
            const docRef = doc(db, "tickets", ticketId);
            const approvalNote = {
                author: 'Manager',
                text: 'Résolution du ticket approuvée.',
                timestamp: new Date()
            };
            try {
                await updateDoc(docRef, {
                    status: 'En cours',
                    hasNewDeveloperMessage: false,
                    internalNotes: arrayUnion(approvalNote),
                    hasNewManagerMessage: true,
                    lastUpdate: serverTimestamp()
                });
            } catch (err) {
                console.error("Erreur lors de l'approbation: ", err);
                alert("Une erreur est survenue.");
            }
        }
    };

    const handleRejectResolution = async () => {
        const note = prompt("Veuillez indiquer les modifications à apporter au développeur :");
        if (note && note.trim() !== '') {
            const docRef = doc(db, "tickets", ticketId);
            const newInternalNote = {
                author: 'Manager',
                text: `REJET DE LA SOLUTION : ${note}`,
                timestamp: new Date()
            };
            try {
                await updateDoc(docRef, {
                    status: 'En cours',
                    internalNotes: arrayUnion(newInternalNote),
                    hasNewDeveloperMessage: false,
                    hasNewManagerMessage: true,
                    lastUpdate: serverTimestamp()
                });
            } catch (err) {
                console.error("Erreur lors du rejet: ", err);
                alert("Une erreur est survenue.");
            }
        }
    };
    
    const handleCloseTicket = async () => {
        if (window.confirm("Êtes-vous sûr de vouloir clôturer ce ticket ?")) {
        const docRef = doc(db, "tickets", ticketId);
        try {
            await updateDoc(docRef, { status: 'Ticket Clôturé', lastUpdate: serverTimestamp() });
        } catch (err) {
            console.error("Erreur lors de la clôture du ticket: ", err);
            alert("Une erreur est survenue.");
        }
        }
    };

    if (loading) {
        return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    }
    if (error || !ticket) {
        return <Container className="mt-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></Container>;
    }
    const isTicketClosed = ticket.status === 'Ticket Clôturé';
    const isPendingValidation = ticket.status === 'En attente de validation';
    return (
        <>
        <Container className="mt-4">
            <Row>
                <Col md={7}>
                <Card className="mb-4">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Conversation Client</h5>
                        {ticket.hasNewClientMessage && !isTicketClosed && (
                            <Button variant="outline-secondary" size="sm" onClick={handleMarkClientAsRead}>Marquer comme lu</Button>
                        )}
                    </Card.Header>
                    <Card.Body>
                    <ListGroup variant="flush" className="mb-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {ticket.conversation?.map((msg, index) => (
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
                        <h5>Répondre au client</h5>
                        <Form onSubmit={handleReplySubmit}>
                            <Form.Group className="mb-3" controlId="managerResponse">
                            <Form.Control 
                            as="textarea" 
                            rows={3} 
                            placeholder="Votre réponse ici..." 
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            />
                            </Form.Group>
                            <Button variant="primary" type="submit">Envoyer la réponse</Button>
                        </Form>
                    </>
                    )}
                    </Card.Body>
                </Card>
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Discussion Interne (Développeur)</h5>
                        {ticket.hasNewDeveloperMessage && !isTicketClosed && (
                            <Button variant="outline-secondary" size="sm" onClick={handleMarkDevAsRead}>Marquer comme lu</Button>
                        )}
                    </Card.Header>
                    <Card.Body>
                        <ListGroup variant="flush" className="mb-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {ticket.internalNotes?.map((note, index) => (
                            <ListGroup.Item key={index} className="d-flex flex-column border-0 px-0">
                                <div className="d-flex justify-content-between">
                                <strong>{note.author}</strong>
                                <small className="text-muted">{note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString('fr-FR') : 'Envoi...'}</small>
                                </div>
                                <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{note.text}</p>
                            </ListGroup.Item>
                            ))}
                        </ListGroup>
                        {!isTicketClosed && (
                        <>
                            <hr />
                            <h5>Ajouter une note interne</h5>
                            <Form onSubmit={handleInternalNoteSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Control 
                                    as="textarea" 
                                    rows={3} 
                                    placeholder="Note pour le développeur..." 
                                    value={internalNoteText}
                                    onChange={(e) => setInternalNoteText(e.target.value)}
                                    />
                                </Form.Group>
                                <Button variant="secondary" type="submit">Envoyer la note</Button>
                            </Form>
                        </>
                        )}
                    </Card.Body>
                </Card>
                </Col>
                <Col md={5}>
                <Card>
                    <Card.Body>
                    <Card.Title>Détails & Actions</Card.Title>
                    <p><strong>Client:</strong> {ticket.client || ticket.clientId}</p>
                    <p><strong>Soumis le:</strong> {ticket.submittedAt?.toDate ? ticket.submittedAt.toDate().toLocaleString('fr-FR') : 'Date inconnue'}</p>
                    <div>
                        <strong>Priorité:</strong>{' '}
                        <Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'}>{ticket.priority}</Badge>
                    </div>
                    <div className="mt-2">
                        <strong>Tags:</strong>{' '}
                        {ticket.tags?.map(tag => <Badge key={tag} pill bg="info" className="me-1">{tag}</Badge>)}
                    </div>
                    <p className="mt-2"><strong>Assigné à:</strong> {ticket.assignedTo || 'Personne'}</p>
                    <hr />
                    {isPendingValidation ? (
                        <div className="d-grid gap-2">
                            <Card.Title>Validation requise</Card.Title>
                            <Button variant="outline-success" onClick={handleApproveResolution}>Approuver la résolution</Button>
                            <Button variant="outline-danger" onClick={handleRejectResolution}>Demander une modification</Button>
                        </div>
                    ) : (
                        <div className="d-grid gap-2">
                            <Card.Title>Actions Manager</Card.Title>
                            <Button variant="outline-secondary" onClick={handleEditModalOpen} disabled={isTicketClosed}>Modifier Tags / Priorité / Assignation</Button>
                            <Button variant="success" onClick={handleCloseTicket} disabled={isTicketClosed}>Clôturer le ticket</Button>
                        </div>
                    )}
                    </Card.Body>
                </Card>
                </Col>
            </Row>
        </Container>
        <Modal show={showEditModal} onHide={handleEditModalClose}>
            <Modal.Header closeButton>
            <Modal.Title>Modifier le Ticket</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleEditSubmit}>
            <Modal.Body>
                <FloatingLabel controlId="prioritySelect" label="Priorité" className="mb-3">
                <Form.Select name="priority" value={editFormData.priority} onChange={handleEditFormChange}>
                    <option value="Faible">Faible</option>
                    <option value="Normale">Normale</option>
                    <option value="Haute">Haute</option>
                    <option value="Critique">Critique</option>
                </Form.Select>
                </FloatingLabel>
                <FloatingLabel controlId="assignedToInput" label="Assigner à" className="mb-3">
                <Form.Control type="text" placeholder="Nom du développeur" name="assignedTo" value={editFormData.assignedTo} onChange={handleEditFormChange} />
                </FloatingLabel>
                <FloatingLabel controlId="tagsInput" label="Tags (séparés par des virgules)">
                <Form.Control type="text" placeholder="tag1, tag2, tag3" name="tags" value={editFormData.tags} onChange={handleEditFormChange} />
                </FloatingLabel>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleEditModalClose}>Annuler</Button>
                <Button variant="primary" type="submit">Enregistrer les modifications</Button>
            </Modal.Footer>
            </Form>
        </Modal>
        </>
    );
}
