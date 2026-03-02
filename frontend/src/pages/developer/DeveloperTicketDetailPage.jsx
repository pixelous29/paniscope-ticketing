import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Spinner, Breadcrumb, Tabs, Tab } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';
import { STATUS } from '../../constants/status';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { Reply, X } from 'lucide-react';
import MultiImageUpload from '../../components/shared/MultiImageUpload';
import ImageModal from '../../components/shared/ImageModal';
import MessageBubble from '../../components/shared/MessageBubble';
import MentionTextarea from '../../components/shared/MentionTextarea';

const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function DeveloperTicketDetailPage() {
    const { ticketId } = useParams();
    const { currentUser } = useAuth();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [replyText, setReplyText] = useState('');
    const [internalNoteText, setInternalNoteText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [noteReplyingTo, setNoteReplyingTo] = useState(null);
    const { showAlert, showConfirmation } = useModal();

    // États pour le formulaire de réponse au client
    const [replyImages, setReplyImages] = useState([]);
    const [replyPreviews, setReplyPreviews] = useState([]);
    const [replyImageError, setReplyImageError] = useState('');
    const [isReplySubmitting, setIsReplySubmitting] = useState(false);

    // États pour le formulaire de note interne
    const [noteImages, setNoteImages] = useState([]);
    const [notePreviews, setNotePreviews] = useState([]);
    const [noteImageError, setNoteImageError] = useState('');
    const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

    // États pour la modale d'image
    const [showImageModal, setShowImageModal] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [activeTab, setActiveTab] = useState('client');

    const [localLastRead, setLocalLastRead] = useState(null);
    const maxSeenRef = React.useRef(0);
    const updateTimeoutRef = React.useRef(null);
    const autoScrolled = React.useRef(false);

    useEffect(() => {
        if (ticket && localLastRead === null && (ticket.conversation || ticket.internalNotes)) {
            const dbVal = ticket.developerLastReadTimestamp;
            const ms = dbVal ? (dbVal.toMillis ? dbVal.toMillis() : new Date(dbVal).getTime()) : 0;
            setLocalLastRead(ms);
            maxSeenRef.current = ms;
        }
    }, [ticket, localLastRead]);

    const handleMessageVisible = (msgTimestamp) => {
        if (!msgTimestamp) return;
        const ms = msgTimestamp.toMillis ? msgTimestamp.toMillis() : new Date(msgTimestamp).getTime();
        
        if (ms > maxSeenRef.current) {
            maxSeenRef.current = ms;
            setLocalLastRead(ms);

            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = setTimeout(() => {
                const docRef = doc(db, "tickets", ticketId);
                updateDoc(docRef, {
                    developerLastReadTimestamp: new Date(maxSeenRef.current),
                    hasNewManagerMessage: false
                }).catch(e => console.error(e));
            }, 1000);
        }
    };

    useEffect(() => {
        if (localLastRead !== null) {
            const doScroll = () => {
                const firstUnread = document.getElementById('first-unread-msg');
                if (firstUnread) {
                    firstUnread.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    autoScrolled.current = true;
                    return true;
                }

                let selector = '';
                if (activeTab === 'client') {
                    selector = '#conversation-list .list-group-item';
                } else {
                    selector = '#internal-notes-list .list-group-item';
                }

                const items = document.querySelectorAll(selector);
                if (items.length > 0) {
                    items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
                    autoScrolled.current = true;
                    return true;
                }

                return false;
            };

            const delay = autoScrolled.current ? 100 : 800;
            const timer = setTimeout(() => {
                if (!doScroll()) {
                    setTimeout(doScroll, 500);
                }
            }, delay);

            return () => clearTimeout(timer);
        }
    }, [localLastRead, ticket, activeTab]);

    useEffect(() => {
        const docRef = doc(db, "tickets", ticketId);
        
        // Plus besoin de `markAsReadIfNeeded` manuel à l'ouverture, `IntersectionObserver` le fait
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setTicket(data);
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

    const handleAddImage = (file, setImagesState, setPreviewsState, setErrorState) => {
        if (!file.type.startsWith('image/')) {
            setErrorState("Veuillez sélectionner uniquement des fichiers image.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrorState("L'image est trop volumineuse (max 5 Mo).");
            return;
        }
        setImagesState(prev => [...prev, file]);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewsState(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
        setErrorState('');
    };

    const handleRemoveImage = (index, setImagesState, setPreviewsState, setErrorState) => {
        setImagesState(prev => prev.filter((_, i) => i !== index));
        setPreviewsState(prev => prev.filter((_, i) => i !== index));
        setErrorState('');
    };

    const renderImages = (urls) => {
        if (!urls || urls.length === 0) return null;
        return (
            <div className="d-flex flex-wrap gap-2 mt-2">
                {urls.map((url, idx) => (
                    <div key={idx} className="position-relative" style={{ width: '80px', height: '80px', cursor: 'pointer' }} onClick={() => { setCurrentImageUrl(url); setShowImageModal(true); }}>
                        <img 
                            src={url} 
                            alt={`Pièce jointe ${idx + 1}`} 
                            loading="lazy"
                            className="img-fluid rounded border shadow-sm w-100 h-100" 
                            style={{ objectFit: 'cover' }} 
                        />
                    </div>
                ))}
            </div>
        );
    };

    // Soumission d'une réponse au client direct
    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (replyText.trim() === '' && replyImages.length === 0) return;

        setIsReplySubmitting(true);
        const docRef = doc(db, "tickets", ticketId);
        let attachmentUrls = [];

        try {
            if (replyImages.length > 0) {
                for (let i = 0; i < replyImages.length; i++) {
                    const fileExtension = replyImages[i].name.split('.').pop();
                    const fileName = `ticket_${ticketId}_devreply_${Date.now()}_img${i}_${currentUser.uid}.${fileExtension}`;
                    const storageRef = ref(storage, `tickets/${fileName}`);
                    const snapshot = await uploadBytes(storageRef, replyImages[i]);
                    const url = await getDownloadURL(snapshot.ref);
                    attachmentUrls.push(url);
                }
            }

            const newConversationEntry = { 
                author: 'Développeur', 
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Développeur',
                photoURL: currentUser.photoURL || null,
                text: replyText, 
                timestamp: new Date() 
            };
            if (attachmentUrls.length > 0) newConversationEntry.attachmentUrls = attachmentUrls;

            if (replyingTo) {
                newConversationEntry.replyTo = {
                    author: replyingTo.author,
                    displayName: replyingTo.displayName || replyingTo.author,
                    text: replyingTo.text,
                    timestamp: replyingTo.timestamp
                };
            }

            await updateDoc(docRef, {
                conversation: arrayUnion(newConversationEntry),
                lastUpdate: serverTimestamp(),
                status: STATUS.PENDING,
                hasNewClientMessage: false
            });
            
            setReplyText('');
            setReplyingTo(null);
            setReplyImages([]);
            setReplyPreviews([]);
            setReplyImageError('');
        } catch (err) {
            console.error("Erreur lors de l'envoi de la réponse: ", err);
            showAlert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setIsReplySubmitting(false);
        }
    };

    // Soumission d'une note interne pour le manager
    const handleInternalNoteSubmit = async (e) => {
        e.preventDefault();
        if (internalNoteText.trim() === '' && noteImages.length === 0) return;

        setIsNoteSubmitting(true);
        const docRef = doc(db, "tickets", ticketId);
        let attachmentUrls = [];

        try {
            if (noteImages.length > 0) {
                for (let i = 0; i < noteImages.length; i++) {
                    const fileExtension = noteImages[i].name.split('.').pop();
                    const fileName = `ticket_${ticketId}_internalnote_${Date.now()}_img${i}_${currentUser.uid}.${fileExtension}`;
                    const storageRef = ref(storage, `tickets/${fileName}`);
                    const snapshot = await uploadBytes(storageRef, noteImages[i]);
                    const url = await getDownloadURL(snapshot.ref);
                    attachmentUrls.push(url);
                }
            }

            const newInternalNote = {
                author: 'Développeur',
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Développeur',
                photoURL: currentUser.photoURL || null,
                text: internalNoteText,
                timestamp: new Date()
            };
            if (attachmentUrls.length > 0) newInternalNote.attachmentUrls = attachmentUrls;

            if (noteReplyingTo) {
                newInternalNote.replyTo = {
                    author: noteReplyingTo.author,
                    displayName: noteReplyingTo.displayName || noteReplyingTo.author,
                    text: noteReplyingTo.text,
                    timestamp: noteReplyingTo.timestamp
                };
            }

            await updateDoc(docRef, {
                internalNotes: arrayUnion(newInternalNote),
                hasNewDeveloperMessage: true, // Notifie le manager
                hasNewManagerMessage: false, // Le dev vient de répondre
                developerLastReadTimestamp: new Date() // auto mark our own as read
            });
            
            autoScrolled.current = true;
            setInternalNoteText('');
            setNoteReplyingTo(null);
            setNoteImages([]);
            setNotePreviews([]);
            setNoteImageError('');
        } catch (err) {
            console.error("Erreur lors de l'ajout du commentaire interne: ", err);
            showAlert('Erreur', 'Une erreur est survenue.');
        } finally {
            setIsNoteSubmitting(false);
        }
    };

    const handleMarkAsDone = async () => {
        if (ticket.status === STATUS.PENDING_VALIDATION) {
            const docRef = doc(db, "tickets", ticketId);
            try {
                await updateDoc(docRef, {
                    status: STATUS.IN_PROGRESS,
                    lastUpdate: serverTimestamp(),
                });
            } catch (err) {
                console.error("Erreur lors de l'annulation: ", err);
                showAlert('Erreur', 'Une erreur est survenue lors de l\'annulation.');
            }
        } else {
            showConfirmation('Terminer le ticket', 'Confirmez-vous que le travail sur ce ticket est terminé et prêt pour validation ?', async () => {
                const docRef = doc(db, "tickets", ticketId);
                try {
                    await updateDoc(docRef, {
                        status: STATUS.PENDING_VALIDATION,
                        lastUpdate: serverTimestamp(),
                        // On ne touche pas aux read status ici, le manager sera notifié
                    });
                } catch (err) {
                    console.error("Erreur lors de la finalisation du ticket: ", err);
                    showAlert('Erreur', 'Une erreur est survenue.');
                }
            });
        }
    };

    if (loading) {
        return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    }
    if (error || !ticket) {
        return <Container className="mt-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></Container>;
    }
    
    const isTicketClosed = ticket.status === STATUS.CLOSED;
    const isPendingValidation = ticket.status === STATUS.PENDING_VALIDATION;

    // Tri des messages 
    const sortedConversation = ticket.conversation?.slice().sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return timeA - timeB;
    });

    const sortedInternalNotes = ticket.internalNotes?.slice().sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return timeA - timeB;
    });

    return (
        <>
        <Container className="mt-2 mt-md-4 pb-5 px-2 px-md-3">
            <Breadcrumb className="d-none d-md-flex">
                <LinkContainer to="/dev">
                    <Breadcrumb.Item>Tableau de bord</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>Ticket #{ticket.id}</Breadcrumb.Item>
            </Breadcrumb>
            
            {/* Bouton retour mobile */}
            <div className="d-md-none mb-3">
                <Link to="/dev" className="text-decoration-none bg-white px-3 py-2 rounded shadow-sm text-primary fw-bold border d-inline-block">
                    <i className="bi bi-arrow-left me-2"></i> Retour aux tickets
                </Link>
            </div>

            <Row>
                <Col md={7}>
                    <Card className="shadow-sm border-0 mb-3 overflow-hidden">
                        <Tabs
                            id="ticket-conversation-tabs"
                            activeKey={activeTab}
                            onSelect={(k) => setActiveTab(k)}
                            className="custom-tabs bg-white px-3 pt-2"
                            justify
                        >
                            <Tab eventKey="client" title={
                                <span className="d-flex align-items-center justify-content-center py-2">
                                    Conversation Client
                                    {ticket.hasNewClientMessage && <Badge bg="danger" pill className="ms-2">!</Badge>}
                                </span>
                            }>
                                <Card.Body className="p-3 p-md-4">
                                    <ListGroup variant="flush" className="mb-3 border rounded shadow-sm p-2 bg-light mobile-expand-list desktop-fixed-list" id="conversation-list">
                                        {sortedConversation?.map((msg, index, arr) => {
                                            let msgToRender = msg;
                                            if (index === 0 && !msg.attachmentUrls && !msg.attachmentUrl) {
                                                if (ticket.attachmentUrls && ticket.attachmentUrls.length > 0) {
                                                    msgToRender = { ...msg, attachmentUrls: ticket.attachmentUrls };
                                                } else if (ticket.attachmentUrl) {
                                                    msgToRender = { ...msg, attachmentUrls: [ticket.attachmentUrl] };
                                                }
                                            }
                                            
                                            const msgMs = msgToRender.timestamp?.toMillis ? msgToRender.timestamp.toMillis() : new Date(msgToRender.timestamp).getTime();
                                            const isNew = localLastRead !== null && msgMs > localLastRead;
                                            
                                            const isFirstUnread = isNew && index === arr.findIndex((m) => {
                                                const ms = m.timestamp?.toMillis ? m.timestamp.toMillis() : new Date(m.timestamp).getTime();
                                                return ms > localLastRead;
                                            });

                                            return (
                                                <MessageBubble 
                                                    key={index} 
                                                    msg={msgToRender} 
                                                    renderImages={renderImages} 
                                                    ticket={ticket} 
                                                    isNew={isNew}
                                                    onVisible={handleMessageVisible}
                                                    id={isFirstUnread ? "first-unread-msg" : undefined}
                                                    onReply={(msg) => setReplyingTo(msg)}
                                                />
                                            );
                                        })}
                                    </ListGroup>

                                    {!isTicketClosed && (
                                        <>
                                            <hr />
                                            <h5>Répondre directement au client</h5>
                                            <Form onSubmit={handleReplySubmit} className="bg-light p-3 rounded shadow-sm border">
                                                {replyingTo && (
                                                    <div className="mb-3 p-2 bg-white rounded border-start border-3 border-primary shadow-sm d-flex justify-content-between align-items-start position-relative">
                                                        <div className="text-muted" style={{ fontSize: '0.85rem', paddingRight: '2rem' }}>
                                                            <div className="fw-bold mb-1 text-primary">
                                                                <Reply size={14} className="me-1 mb-1" />
                                                                En réponse à {replyingTo.displayName || replyingTo.author}
                                                            </div>
                                                            <div className="text-truncate" style={{ maxWidth: '90%' }}>
                                                                {replyingTo.text || "Message avec pièce jointe"}
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            variant="link" 
                                                            className="p-0 text-muted position-absolute top-0 end-0 m-2" 
                                                            onClick={() => setReplyingTo(null)}
                                                            title="Annuler la réponse"
                                                        >
                                                            <X size={16} />
                                                        </Button>
                                                    </div>
                                                )}
                                                <Form.Group className="mb-4" controlId="devClientResponse">
                                                    <MentionTextarea 
                                                        rows={4} 
                                                        placeholder="Bonjour, merci pour votre retour d'information... (utilisez @ pour mentionner)" 
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        className="border-primary"
                                                        ticket={ticket}
                                                    />
                                                </Form.Group>
                                                
                                                <MultiImageUpload 
                                                    images={replyImages}
                                                    previews={replyPreviews}
                                                    onAddImage={(file) => handleAddImage(file, setReplyImages, setReplyPreviews, setReplyImageError)}
                                                    onRemoveImage={(idx) => handleRemoveImage(idx, setReplyImages, setReplyPreviews, setReplyImageError)}
                                                    error={replyImageError}
                                                    maxImages={4}
                                                />

                                                <div className="d-flex justify-content-end border-top pt-3">
                                                    <Button variant="primary" type="submit" disabled={isReplySubmitting} className="px-4">
                                                        {isReplySubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Envoi en cours...</> : 'Envoyer la réponse'}
                                                    </Button>
                                                </div>
                                            </Form>
                                        </>
                                    )}
                                </Card.Body>
                            </Tab>
                            <Tab eventKey="internal" title={
                                <span className="d-flex align-items-center justify-content-center py-2">
                                    Discussion Interne
                                    {ticket.hasNewManagerMessage && <Badge bg="danger" pill className="ms-2">!</Badge>}
                                </span>
                            }>
                                <Card.Body className="p-3 p-md-4">
                                    <ListGroup variant="flush" className="mb-3 border rounded shadow-sm p-2 bg-light mobile-expand-list desktop-fixed-list" id="internal-notes-list">
                                        {sortedInternalNotes?.map((note, index, arr) => {
                                            const msgMs = note.timestamp?.toMillis ? note.timestamp.toMillis() : new Date(note.timestamp).getTime();
                                            const isNew = localLastRead !== null && msgMs > localLastRead;
                                            
                                            const isFirstUnread = isNew && index === arr.findIndex((m) => {
                                                const ms = m.timestamp?.toMillis ? m.timestamp.toMillis() : new Date(m.timestamp).getTime();
                                                return ms > localLastRead;
                                            });
                                            return (
                                                <MessageBubble 
                                                    key={`note-${index}`} 
                                                    msg={note} 
                                                    renderImages={renderImages} 
                                                    ticket={ticket} 
                                                    isNew={isNew}
                                                    onVisible={handleMessageVisible}
                                                    id={isFirstUnread ? "first-unread-msg" : undefined}
                                                    onReply={(msg) => setNoteReplyingTo(msg)}
                                                />
                                            );
                                        })}
                                    </ListGroup>

                                    {!isTicketClosed && (
                                        <>
                                            <Form onSubmit={handleInternalNoteSubmit} className="bg-light p-3 rounded shadow-sm border mt-4">
                                                {noteReplyingTo && (
                                                    <div className="mb-3 p-2 bg-white rounded border-start border-3 border-secondary shadow-sm d-flex justify-content-between align-items-start position-relative">
                                                        <div className="text-muted" style={{ fontSize: '0.85rem', paddingRight: '2rem' }}>
                                                            <div className="fw-bold mb-1 text-secondary">
                                                                <Reply size={14} className="me-1 mb-1" />
                                                                En réponse à {noteReplyingTo.displayName || noteReplyingTo.author}
                                                            </div>
                                                            <div className="text-truncate" style={{ maxWidth: '90%' }}>
                                                                {noteReplyingTo.text || "Message avec pièce jointe"}
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            variant="link" 
                                                            className="p-0 text-muted position-absolute top-0 end-0 m-2" 
                                                            onClick={() => setNoteReplyingTo(null)}
                                                            title="Annuler la réponse"
                                                        >
                                                            <X size={16} />
                                                        </Button>
                                                    </div>
                                                )}
                                                <Form.Group className="mb-4" controlId="devInternalNote">
                                                    <Form.Label className="h5 mb-3 d-block">Ajouter une note interne</Form.Label>
                                                    <MentionTextarea 
                                                        name="devInternalNote"
                                                        rows={4} 
                                                        placeholder="Problème technique trouvé... (utilisez @ pour mentionner)" 
                                                        value={internalNoteText}
                                                        onChange={(e) => setInternalNoteText(e.target.value)}
                                                        className="border-secondary"
                                                        ticket={ticket}
                                                    />
                                                </Form.Group>

                                                <Form.Group className="mb-4">
                                                    <Form.Label htmlFor="developer-note-images" className="fw-bold mb-2">Captures d'écran en lien avec le message (Max 4 images)</Form.Label>
                                                    <MultiImageUpload 
                                                        id="developer-note-images"
                                                        images={noteImages}
                                                        previews={notePreviews}
                                                        onAddImage={(file) => handleAddImage(file, setNoteImages, setNotePreviews, setNoteImageError)}
                                                        onRemoveImage={(idx) => handleRemoveImage(idx, setNoteImages, setNotePreviews, setNoteImageError)}
                                                        error={noteImageError}
                                                        maxImages={4}
                                                    />
                                                </Form.Group>

                                                <div className="d-flex justify-content-end border-top pt-3">
                                                    <Button variant="secondary" type="submit" disabled={isNoteSubmitting} className="px-4">
                                                        {isNoteSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Envoi en cours...</> : 'Envoyer la note'}
                                                    </Button>
                                                </div>
                                            </Form>
                                        </>
                                    )}
                                </Card.Body>
                            </Tab>
                        </Tabs>
                    </Card>
                </Col>
                
                <Col md={5}>
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Body className="p-3 p-md-4">
                            <Card.Title className="mb-3 pb-2 border-bottom">Informations Clés</Card.Title>
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
                                <Button 
                                    variant={isPendingValidation ? "secondary" : "success"} 
                                    onClick={handleMarkAsDone} 
                                    disabled={isTicketClosed}
                                >
                                    {isPendingValidation ? 'Annuler l\'attente de validation' : 'Terminé, prêt pour validation'}
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>

        <ImageModal 
            show={showImageModal} 
            onHide={() => setShowImageModal(false)} 
            imageUrl={currentImageUrl} 
        />
        </>
    );
}
