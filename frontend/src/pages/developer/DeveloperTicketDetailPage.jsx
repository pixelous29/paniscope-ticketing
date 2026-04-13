import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Badge, Form, Button, Alert, Dropdown, Spinner, Tabs, Tab, ListGroup } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';
import StatusBadge from '../../components/shared/StatusBadge';
import { STATUS } from '../../constants/status';
import { DEV_PHASE_LABELS, DEV_PHASE_COLORS } from '../../constants/phases';
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
                
                // Auto-heal invalid statuses
                const validStatuses = Object.values(STATUS);
                if (data.status === STATUS.NEW || !validStatuses.includes(data.status)) {
                    updateDoc(docRef, { status: STATUS.IN_PROGRESS, archived: false }).catch(err => 
                        console.error("Erreur lors de l'auto-correction du statut: ", err)
                    );
                }

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

            const isClient = ticket.clientUid === currentUser.uid;

            const newConversationEntry = { 
                author: isClient ? 'Client' : 'Développeur', 
                uid: currentUser.uid,
                displayName: currentUser.displayName || (isClient ? 'Client' : 'Développeur'),
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

            const updateData = {
                conversation: arrayUnion(newConversationEntry),
                lastUpdate: serverTimestamp()
            };

            if (isClient) {
                updateData.hasNewClientMessage = true;
                if (ticket.status === STATUS.PENDING) {
                    updateData.status = STATUS.IN_PROGRESS;
                }
            } else {
                updateData.hasNewClientMessage = false;
            }

            await updateDoc(docRef, updateData);
            
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

    const handleDevPhaseChange = async (e) => {
        const newPhase = e.target.value;
        const docRef = doc(db, "tickets", ticketId);
        try {
            await updateDoc(docRef, { devPhase: newPhase });
        } catch (err) {
            console.error("Erreur lors de la mise à jour de la phase: ", err);
            showAlert('Erreur', 'Impossible de mettre à jour la phase de développement.');
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
        return <div className="d-flex justify-content-center align-items-center h-100"><Spinner animation="border" /></div>;
    }
    if (error || !ticket) {
        return <div className="p-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></div>;
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
        <div className="d-flex flex-column h-100 w-100 bg-white">
            {/* En-tête du ticket */}
            <div className="flex-shrink-0 border-bottom bg-white d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center p-3 p-md-4 sticky-top z-2">
                <div className="d-flex align-items-center gap-3 w-100 mb-3 mb-md-0">
                    <Link to="/dev" className="text-secondary hover-primary text-decoration-none d-flex align-items-center justify-content-center bg-light rounded-circle p-2" title="Retour aux tickets">
                        <i className="bi bi-arrow-left fs-5"></i>
                    </Link>
                    <div className="flex-grow-1">
                        <div className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                            Ticket #{ticket?.id}
                        </div>
                        <h4 className="mb-0 fw-bold text-dark mt-1">{ticket.subject}</h4>
                    </div>
                </div>
                <div className="ms-md-auto ms-5 ps-2 ps-md-0">
                    <StatusBadge status={ticket.status} />
                </div>
            </div>

            {/* Layout principal (split 70/30) */}
            <div className="flex-grow-1 overflow-hidden d-flex flex-column flex-md-row">
                {/* Zone principale (conversation / notes) */}
                <div className="flex-grow-1 overflow-auto bg-white d-flex flex-column" style={{ flexBasis: '70%' }}>
                    <div className="w-100 mx-auto d-flex flex-column flex-grow-1" style={{ maxWidth: '900px' }}>
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
                                <div className="p-3 p-md-4">
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
                                </div>
                            </Tab>
                            <Tab eventKey="internal" title={
                                <span className="d-flex align-items-center justify-content-center py-2">
                                    Discussion Interne
                                    {ticket.hasNewManagerMessage && <Badge bg="danger" pill className="ms-2">!</Badge>}
                                </span>
                            }>
                                <div className="p-3 p-md-4">
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
                                                        excludeClients={true}
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
                                </div>
                            </Tab>
                        </Tabs>
                    </div>
                </div>
                
                {/* Colonne de droite : Informations du ticket */}
                <div className="flex-shrink-0 overflow-auto bg-light border-start p-4" style={{ flexBasis: '30%', minWidth: '320px' }}>
                    <h5 className="mb-4 pb-2 border-bottom fw-bold text-dark">Informations Clés</h5>
                            <div className="mb-2">
                                <strong>Client :</strong> {ticket.clientName || ticket.client || ticket.clientId}
                            </div>
                            {ticket.companyDomain && (
                              <div className="mb-2">
                                  <strong>Entreprise :</strong> {ticket.companyDomain}
                              </div>
                            )}
                            {ticket.ccEmails && ticket.ccEmails.length > 0 && (
                                <div className="mb-2">
                                    <strong>En copie :</strong>{' '}
                                    {ticket.ccEmails.join(', ')}
                                </div>
                            )}
                             <div className="mb-3 d-flex flex-column align-items-start gap-1">
                                 <strong>Phase de développement :</strong>
                                 <Dropdown>
                                     <Dropdown.Toggle as={Badge} bg={DEV_PHASE_COLORS[ticket.devPhase] || DEV_PHASE_COLORS.PLANNING} text={(DEV_PHASE_COLORS[ticket.devPhase] || DEV_PHASE_COLORS.PLANNING) === 'warning' ? 'dark' : 'white'} style={{ cursor: isTicketClosed ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }} className="border-0 shadow-sm" disabled={isTicketClosed}>
                                         {DEV_PHASE_LABELS[ticket.devPhase] || DEV_PHASE_LABELS.PLANNING}
                                     </Dropdown.Toggle>
                                     <Dropdown.Menu>
                                         {Object.entries(DEV_PHASE_LABELS).map(([key, label]) => (
                                             <Dropdown.Item key={key} onClick={() => handleDevPhaseChange({ target: { value: key } })} className="py-2 px-3 dropdown-item-premium">
                                                 <Badge bg={DEV_PHASE_COLORS[key]} text={DEV_PHASE_COLORS[key] === 'warning' ? 'dark' : 'white'} className="me-2">{label}</Badge>
                                                 {ticket.devPhase === key && <Badge pill bg="light" text="dark" className="float-end border">✓</Badge>}
                                             </Dropdown.Item>
                                         ))}
                                     </Dropdown.Menu>
                                 </Dropdown>
                             </div>
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
                </div>
            </div>

        <ImageModal 
            show={showImageModal} 
            onHide={() => setShowImageModal(false)} 
            imageUrl={currentImageUrl} 
        />
        </div>
    );
}
