import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Container, Row, Col, Card, Badge, Form, Button, ListGroup, Alert, Spinner, Modal, FloatingLabel, Breadcrumb, Tabs, Tab } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';
import { LinkContainer } from 'react-router-bootstrap';
import { STATUS } from '../../constants/status';
import { DEV_PHASE_LABELS, DEV_PHASE_COLORS } from '../../constants/phases';
import { useAuth } from '../../hooks/useAuth';
import { Reply, X } from 'lucide-react';
import MultiImageUpload from '../../components/shared/MultiImageUpload';
import ImageModal from '../../components/shared/ImageModal';
import MessageBubble from '../../components/shared/MessageBubble';
import MentionTextarea from '../../components/shared/MentionTextarea';

const priorityVariant = { 'Critique': 'danger', 'Haute': 'warning', 'Normale': 'success', 'Faible': 'secondary' };

export default function ManagerTicketDetailPage() {
    const { ticketId } = useParams();
    const { currentUser } = useAuth();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({ priority: '', assignedTo: '', tags: '', devPhase: '' });
    const [replyText, setReplyText] = useState('');
    const [internalNoteText, setInternalNoteText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [noteReplyingTo, setNoteReplyingTo] = useState(null);
    const [activeTab, setActiveTab] = useState('client');
    const [developers, setDevelopers] = useState([]);
    const { showAlert, showConfirmation, showPrompt } = useModal();

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

    const [localLastRead, setLocalLastRead] = useState(null);
    const maxSeenRef = React.useRef(0);
    const updateTimeoutRef = React.useRef(null);
    const autoScrolled = React.useRef(false);

    useEffect(() => {
        if (ticket && localLastRead === null && (ticket.conversation || ticket.internalNotes)) {
            const dbVal = ticket.managerLastReadTimestamp;
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
                    managerLastReadTimestamp: new Date(maxSeenRef.current),
                    hasNewClientMessage: false,
                    hasNewDeveloperMessage: false
                }).catch(e => console.error(e));
            }, 1000);
        }
    };

    useEffect(() => {
        if (localLastRead !== null) {
            const doScroll = () => {
                // Si on a un élément "NEW", on le cherche d'abord
                const firstUnread = document.getElementById('first-unread-msg');
                if (firstUnread) {
                    firstUnread.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    autoScrolled.current = true;
                    return true;
                }

                // Sinon, scroll vers le bas selon l'onglet actif
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

            // On scroll au chargement initial OU au changement d'onglet
            // On utilise un petit délai pour laisser l'onglet s'afficher
            const delay = autoScrolled.current ? 100 : 800;
            const timer = setTimeout(() => {
                if (!doScroll()) {
                    setTimeout(doScroll, 500);
                }
            }, delay);

            return () => clearTimeout(timer);
        }
    }, [localLastRead, ticket, activeTab]);

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

    // Fonction utilitaire pour rendre les images de manière uniforme
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

    useEffect(() => {
        const docRef = doc(db, "tickets", ticketId);
        
        // Fetch developers for the assignment dropdown
        const fetchDevelopers = async () => {
            try {
                const q = query(collection(db, "users"), where("role", "==", "developer"));
                const querySnapshot = await getDocs(q);
                const devs = querySnapshot.docs.map(d => ({
                    id: d.id,
                    name: d.data().displayName || d.data().email
                }));
                // Ensure unique values (in case email and displayname are duplicated or multiple devs have same name, maybe edge case, but safe)
                setDevelopers(devs);
            } catch (err) {
                console.error("Erreur lors de la récupération des développeurs:", err);
            }
        };
        fetchDevelopers();

        const updateStatusIfNeeded = async (ticketData) => {
            if (ticketData.status === STATUS.NEW) {
                try {
                    await updateDoc(docRef, { status: STATUS.IN_PROGRESS });
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
            assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : (data.assignedTo ? [data.assignedTo] : []),
            tags: data.tags ? data.tags.join(', ') : '',
            devPhase: data.devPhase || 'PLANNING'
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
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox' && name === 'assignedTo') {
            setEditFormData(prev => {
                const currentAssigned = [...prev.assignedTo];
                if (checked) {
                    if (!currentAssigned.includes(value)) currentAssigned.push(value);
                } else {
                    const idx = currentAssigned.indexOf(value);
                    if (idx > -1) currentAssigned.splice(idx, 1);
                }
                return { ...prev, assignedTo: currentAssigned };
            });
        } else {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        const docRef = doc(db, "tickets", ticketId);
        try {
        const tagsArray = editFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        await updateDoc(docRef, {
            priority: editFormData.priority,
            assignedTo: editFormData.assignedTo || null,
            tags: tagsArray,
            devPhase: editFormData.devPhase || 'PLANNING'
        });
        handleEditModalClose();
        } catch (err) {
        console.error("Erreur lors de la mise à jour du ticket: ", err);
        showAlert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
        }
    };

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
                    const fileName = `ticket_${ticketId}_managerreply_${Date.now()}_img${i}_${currentUser.uid}.${fileExtension}`;
                    const storageRef = ref(storage, `tickets/${fileName}`);
                    const snapshot = await uploadBytes(storageRef, replyImages[i]);
                    const url = await getDownloadURL(snapshot.ref);
                    attachmentUrls.push(url);
                }
            }

            const newConversationEntry = { 
                author: 'Manager', 
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Manager',
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
                hasNewClientMessage: false,
                managerLastReadTimestamp: new Date() // auto mark our own as read
            });
            
            autoScrolled.current = true;
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
                author: 'Manager',
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Manager',
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
                hasNewDeveloperMessage: false,
                hasNewManagerMessage: true,
                managerLastReadTimestamp: new Date() // auto mark our own as read
            });

            autoScrolled.current = true;
            setInternalNoteText('');
            setNoteReplyingTo(null);
            setNoteImages([]);
            setNotePreviews([]);
            setNoteImageError('');
        } catch (err) {
            console.error("Erreur lors de l'envoi de la note interne: ", err);
            showAlert('Erreur', 'Une erreur est survenue.');
        } finally {
            setIsNoteSubmitting(false);
        }
    };

    const handleApproveResolution = async () => {
        showConfirmation('Approuver la résolution', 'Confirmez-vous la résolution de ce ticket ? Vous pourrez ensuite le clôturer.', async () => {
            const docRef = doc(db, "tickets", ticketId);
            const approvalNote = {
                author: 'Manager',
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Manager',
                photoURL: currentUser.photoURL || null,
                text: 'Résolution du ticket approuvée.',
                timestamp: new Date()
            };
            try {
                await updateDoc(docRef, {
                    status: STATUS.IN_PROGRESS,
                    hasNewDeveloperMessage: false,
                    internalNotes: arrayUnion(approvalNote),
                    hasNewManagerMessage: true,
                    lastUpdate: serverTimestamp()
                });
            } catch (err) {
                console.error("Erreur lors de l'approbation: ", err);
                showAlert('Erreur', 'Une erreur est survenue.');
            }
        });
    };

    const handleRejectResolution = async () => {
        showPrompt('Demander une modification', 'Veuillez indiquer les modifications à apporter au développeur :', async (note) => {
            if (note && note.trim() !== '') {
                const docRef = doc(db, "tickets", ticketId);
                const newInternalNote = {
                    author: 'Manager',
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || 'Manager',
                    photoURL: currentUser.photoURL || null,
                    text: `REJET DE LA SOLUTION : ${note}`,
                    timestamp: new Date()
                };
                try {
                    await updateDoc(docRef, {
                        status: STATUS.IN_PROGRESS,
                        internalNotes: arrayUnion(newInternalNote),
                        hasNewDeveloperMessage: false,
                        hasNewManagerMessage: true,
                        lastUpdate: serverTimestamp()
                    });
                } catch (err) {
                    console.error("Erreur lors du rejet: ", err);
                    showAlert('Erreur', 'Une erreur est survenue.');
                }
            }
        });
    };
    
    const handleCloseTicket = async () => {
        showConfirmation('Clôturer le ticket', 'Êtes-vous sûr de vouloir clôturer ce ticket ?', async () => {
            const docRef = doc(db, "tickets", ticketId);
            try {
                const closureMessage = {
                    text: '🔒 Ticket clôturé par le Manager.',
                    author: 'Système',
                    displayName: 'Système',
                    timestamp: new Date()
                };
                await updateDoc(docRef, { 
                    status: STATUS.CLOSED, 
                    lastUpdate: serverTimestamp(),
                    conversation: arrayUnion(closureMessage)
                });
            } catch (err) {
                console.error("Erreur lors de la clôture du ticket: ", err);
                showAlert('Erreur', 'Une erreur est survenue.');
            }
        });
    };

    const handleReopenTicket = async () => {
        showConfirmation('Réouvrir le ticket', 'Êtes-vous sûr de vouloir réouvrir ce ticket ? Il sera de nouveau visible dans les tickets en cours pour tous les utilisateurs.', async () => {
            const docRef = doc(db, "tickets", ticketId);
            try {
                const reopenMessage = {
                    text: '🔓 Ticket réouvert par le Manager.',
                    author: 'Système',
                    displayName: 'Système',
                    timestamp: new Date()
                };
                await updateDoc(docRef, { 
                    status: STATUS.IN_PROGRESS, 
                    archived: false,
                    lastUpdate: serverTimestamp(),
                    conversation: arrayUnion(reopenMessage)
                });
            } catch (err) {
                console.error("Erreur lors de la réouverture du ticket: ", err);
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
    const isTicketClosed = ticket.status === STATUS.CLOSED;
    const isPendingValidation = ticket.status === STATUS.PENDING_VALIDATION;
    return (
        <>
        <Container className="mt-2 mt-md-4 pb-5 px-2 px-md-3">
            <Breadcrumb className="d-none d-md-flex">
                <LinkContainer to="/manager">
                    <Breadcrumb.Item>Tableau de bord</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>Ticket #{ticket.id}</Breadcrumb.Item>
            </Breadcrumb>
            
            {/* Bouton retour mobile */}
            <div className="d-md-none mb-3">
                <Link to="/manager" className="text-decoration-none bg-white px-3 py-2 rounded shadow-sm text-primary fw-bold border d-inline-block">
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
                                        {ticket.conversation?.slice().sort((a, b) => {
                                            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                                            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                                            return timeA - timeB;
                                        }).map((msg, index, arr) => {
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
                                        <Form onSubmit={handleReplySubmit} className="bg-light p-3 rounded shadow-sm border mt-4">
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
                                            <Form.Group className="mb-4" controlId="managerResponse">
                                                <Form.Label className="h5 mb-3 d-block">Répondre au client</Form.Label>
                                                <MentionTextarea 
                                                rows={4} 
                                                placeholder="Votre réponse ici... (utilisez @ pour mentionner)" 
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                className="border-primary"
                                                ticket={ticket}
                                                />
                                            </Form.Group>
                                            
                                            <Form.Group className="mb-4">
                                                <Form.Label htmlFor="manager-reply-images" className="fw-bold mb-2">Captures d'écran en lien avec le message (Max 4 images)</Form.Label>
                                                <MultiImageUpload 
                                                    id="manager-reply-images"
                                                    images={replyImages}
                                                    previews={replyPreviews}
                                                    onAddImage={(file) => handleAddImage(file, setReplyImages, setReplyPreviews, setReplyImageError)}
                                                    onRemoveImage={(idx) => handleRemoveImage(idx, setReplyImages, setReplyPreviews, setReplyImageError)}
                                                    error={replyImageError}
                                                    maxImages={4}
                                                />
                                            </Form.Group>

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
                                    {ticket.hasNewDeveloperMessage && <Badge bg="danger" pill className="ms-2">!</Badge>}
                                </span>
                            }>
                                <Card.Body className="p-3 p-md-4">
                                    <ListGroup variant="flush" className="mb-3 border rounded shadow-sm p-2 bg-light mobile-expand-list desktop-fixed-list" id="internal-notes-list">
                                        {ticket.internalNotes?.map((note, index, arr) => {
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
                                            <Form.Group className="mb-4" controlId="managerInternalNote">
                                                <Form.Label className="h5 mb-3 d-block">Ajouter une note interne</Form.Label>
                                                <MentionTextarea 
                                                name="managerInternalNote"
                                                rows={4} 
                                                placeholder="Note pour le développeur... (utilisez @ pour mentionner)" 
                                                value={internalNoteText}
                                                onChange={(e) => setInternalNoteText(e.target.value)}
                                                className="border-secondary"
                                                ticket={ticket}
                                                />
                                            </Form.Group>

                                            <Form.Group className="mb-4">
                                                <Form.Label htmlFor="manager-note-images" className="fw-bold mb-2">Captures d'écran en lien avec le message (Max 4 images)</Form.Label>
                                                <MultiImageUpload 
                                                    id="manager-note-images"
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
                    <Card.Title className="mb-3 pb-2 border-bottom">Détails & Actions</Card.Title>
                    <p><strong>Client:</strong> {ticket.clientName || ticket.client || ticket.clientId}</p>
                    <p><strong>Soumis le:</strong> {ticket.submittedAt?.toDate ? ticket.submittedAt.toDate().toLocaleString('fr-FR') : 'Date inconnue'}</p>
                    <div className="mb-2">
                        <strong>Phase de développement:</strong>{' '}
                        <Badge bg={DEV_PHASE_COLORS[ticket.devPhase] || DEV_PHASE_COLORS.PLANNING}>
                            {DEV_PHASE_LABELS[ticket.devPhase] || DEV_PHASE_LABELS.PLANNING}
                        </Badge>
                    </div>
                    <div>
                        <strong>Priorité:</strong>{' '}
                        <Badge bg={priorityVariant[ticket.priority] || 'light'} text={priorityVariant[ticket.priority] === 'warning' ? 'dark' : 'white'}>{ticket.priority}</Badge>
                    </div>
                    <div className="mt-2">
                        <strong>Tags:</strong>{' '}
                        {ticket.tags?.map(tag => <Badge key={tag} pill bg="info" className="me-1">{tag}</Badge>)}
                    </div>
                    <div className="mt-2">
                        <strong>Assigné à :</strong>{' '}
                        {Array.isArray(ticket.assignedTo) ? (
                            ticket.assignedTo.length > 0 ? (
                                ticket.assignedTo.map(dev => <Badge key={dev} bg="light" text="dark" className="border me-1">{dev}</Badge>)
                            ) : 'Personne'
                        ) : (ticket.assignedTo || 'Personne')}
                    </div>
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
                            <Button variant="outline-secondary" onClick={handleEditModalOpen} disabled={isTicketClosed}>
                                Modifier Phase dev / Tags / Priorité / Assignation
                            </Button>
                            {isTicketClosed ? (
                                <Button variant="warning" onClick={handleReopenTicket}>Réouvrir le ticket</Button>
                            ) : (
                                <Button variant="success" onClick={handleCloseTicket}>Clôturer le ticket</Button>
                            )}
                        </div>
                    )}
                    </Card.Body>
                </Card>
                </Col>
            </Row>
        </Container>
        <Modal show={showEditModal} onHide={handleEditModalClose} centered>
            <Modal.Header closeButton>
            <Modal.Title>Modifier le Ticket</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleEditSubmit}>
            <Modal.Body>
                <FloatingLabel controlId="devPhaseSelect" label="Phase de développement" className="mb-3">
                    <Form.Select name="devPhase" value={editFormData.devPhase} onChange={handleEditFormChange}>
                        {Object.entries(DEV_PHASE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </Form.Select>
                </FloatingLabel>
                <FloatingLabel controlId="prioritySelect" label="Priorité" className="mb-3">
                <Form.Select name="priority" value={editFormData.priority} onChange={handleEditFormChange}>
                    <option value="Faible">Faible</option>
                    <option value="Normale">Normale</option>
                    <option value="Haute">Haute</option>
                    <option value="Critique">Critique</option>
                </Form.Select>
                </FloatingLabel>
                <Form.Group className="mb-3 border p-3 rounded bg-light">
                    <Form.Label className="fw-bold mb-2">Assigner à (plusieurs possibles)</Form.Label>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {developers.length === 0 && <small className="text-muted d-block">Aucun développeur trouvé.</small>}
                        {developers.map(dev => (
                            <Form.Check 
                                key={dev.id}
                                type="checkbox"
                                id={`dev-${dev.id}`}
                                label={dev.name}
                                name="assignedTo"
                                value={dev.name}
                                checked={editFormData.assignedTo.includes(dev.name)}
                                onChange={handleEditFormChange}
                                className="mb-1"
                            />
                        ))}
                    </div>
                </Form.Group>
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

        <ImageModal 
            show={showImageModal} 
            onHide={() => setShowImageModal(false)} 
            imageUrl={currentImageUrl} 
        />
        </>
    );
}
