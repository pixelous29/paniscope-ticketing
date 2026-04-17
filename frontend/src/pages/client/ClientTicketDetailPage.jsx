import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Form, Button, Badge, Spinner, Alert, ListGroup, Container } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';
import { STATUS } from '../../constants/status';
import StatusBadge from '../../components/shared/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { Reply, X } from 'lucide-react';
import MultiImageUpload from '../../components/shared/MultiImageUpload';
import ImageModal from '../../components/shared/ImageModal';
import MessageBubble from '../../components/shared/MessageBubble';
import MentionTextarea from '../../components/shared/MentionTextarea';

export default function ClientTicketDetailPage() {
    const { ticketId } = useParams();
    const { currentUser } = useAuth();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const { showAlert } = useModal();

    // États pour l'upload d'images
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [imageError, setImageError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefusing, setIsRefusing] = useState(false);

    // États pour la modale d'image
    const [showImageModal, setShowImageModal] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState('');

    const [localLastRead, setLocalLastRead] = useState(null);
    const maxSeenRef = React.useRef(0);
    const updateTimeoutRef = React.useRef(null);
    const autoScrolled = React.useRef(false);

    useEffect(() => {
        if (ticket && localLastRead === null && ticket.conversation) {
            const dbVal = ticket.clientLastReadTimestamp;
            // Fallback: si dbVal n'existe pas, on met 0, tous les messages seront nouveaux,
            // OU pour la migration des anciens tickets: si c'est null, on met la date limite d'aujourd'hui ?
            // L'utilisateur dit "quand un client se reconnecte... les DEUX nouveaux messages". On assume que les anciens messages ont des timestamps dans le passé.
            // Si dbVal est undefined, mark everything before as read? No let's just use 0, so they get highlighted once.
            let ms = dbVal ? (dbVal.toMillis ? dbVal.toMillis() : new Date(dbVal).getTime()) : 0;
            // Optionnel: si dbVal n'existe pas, initialiser avec le timestamp du dernier message moins 1 seconde
            // On le garde à 0 pour l'instant.
            setLocalLastRead(ms);
            maxSeenRef.current = ms;
        }
    }, [ticket, localLastRead]);

    const handleMessageVisible = (msgTimestamp) => {
        if (!msgTimestamp) return;
        const ms = msgTimestamp.toMillis ? msgTimestamp.toMillis() : new Date(msgTimestamp).getTime();
        
        if (ms > maxSeenRef.current) {
            maxSeenRef.current = ms;
            setLocalLastRead(ms); // L'UI s'update: badge disparait

            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = setTimeout(() => {
                const docRef = doc(db, "tickets", ticketId);
                updateDoc(docRef, {
                    clientLastReadTimestamp: new Date(maxSeenRef.current)
                }).catch(e => console.error(e));
            }, 1000);
        }
    };

    useEffect(() => {
        if (localLastRead !== null && !autoScrolled.current) {
            const scrollToLastMessage = () => {
                const validationBox = document.getElementById('validation-box');
                if (validationBox) {
                    validationBox.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    autoScrolled.current = true;
                    return true;
                }

                const firstUnread = document.getElementById('first-unread-msg');
                if (firstUnread) {
                    firstUnread.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    autoScrolled.current = true;
                    return true;
                }
                const allMessages = document.querySelectorAll('.list-group-item');
                if (allMessages.length > 0) {
                    const lastMsg = allMessages[allMessages.length - 1];
                    lastMsg.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    autoScrolled.current = true;
                    return true;
                }
                return false;
            };

            setTimeout(() => {
                if (!scrollToLastMessage()) {
                    setTimeout(() => {
                        scrollToLastMessage();
                        autoScrolled.current = true;
                    }, 1000);
                }
            }, 800);
        }
    }, [localLastRead, ticket]);

    useEffect(() => {
        setLoading(true);
        const docRef = doc(db, "tickets", ticketId);

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

    const handleAddImage = (file) => {
        if (!file.type.startsWith('image/')) {
            setImageError("Veuillez sélectionner uniquement des fichiers image.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError("L'image est trop volumineuse (max 5 Mo).");
            return;
        }
        setImages(prev => [...prev, file]);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviews(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
        setImageError('');
    };

    const handleRemoveImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
        setImageError('');
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        
        let trimmedReply = replyText.trim();
        
        if (!trimmedReply && images.length === 0) {
            showAlert('Erreur', 'Veuillez entrer une réponse ou joindre une image.');
            return;
        }

        setIsSubmitting(true);
        try {
            const uploadedUrls = [];
            for (let i = 0; i < images.length; i++) {
                const file = images[i];
                const storageRef = ref(storage, `tickets/${ticketId}/client_reply_${Date.now()}_${i}-${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                uploadedUrls.push(url);
            }

            const newMessage = {
                author: 'Client',
                text: trimmedReply,
                timestamp: new Date(),
                uid: currentUser.uid,
                displayName: (currentUser.displayName && currentUser.company) ? `${currentUser.displayName} (${currentUser.company})` : (currentUser.displayName || 'Client'),
                attachmentUrls: uploadedUrls.length > 0 ? uploadedUrls : []
            };

            if (replyingTo) {
                newMessage.replyTo = {
                    author: replyingTo.author,
                    displayName: replyingTo.displayName || replyingTo.author,
                    text: replyingTo.text,
                    timestamp: replyingTo.timestamp
                };
            }

            const docRef = doc(db, "tickets", ticketId);
            const updateData = {
                conversation: arrayUnion(newMessage),
                hasNewDeveloperMessage: false, // On reset si on répondait au dev
                hasNewClientMessage: true, // Signale au manager une maj
                ccEmails: arrayUnion(currentUser.email) // Ajoute la personne à la boucle des envois mail
            };

            // Si le ticket était en attente (ou autre), la réponse du client le repasse "En cours"
            if (ticket.status === STATUS.PENDING || (isRefusing && ticket.status === STATUS.PENDING_VALIDATION)) {
                updateData.status = STATUS.IN_PROGRESS;
                setIsRefusing(false);
            }

            await updateDoc(docRef, updateData);

            // On met directement un timestamp plus élevé pour éviter que le propre message du client s'affiche comme "Nouveau" pour lui !
            autoScrolled.current = true;
            setReplyText('');
            setReplyingTo(null);
            setImages([]);
            setPreviews([]);
            setImageError('');
            
        } catch (err) {
            console.error("Erreur lors de l'envoi de la réponse: ", err);
            showAlert('Erreur', 'Une erreur est survenue lors de l\'envoi de votre réponse.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAcceptValidation = async () => {
        setIsSubmitting(true);
        try {
            const newMessage = {
                author: 'Client',
                text: "✅ **Validation client :** J'ai validé les travaux. Tout est conforme, le ticket peut être clôturé par l'équipe.",
                timestamp: new Date(),
                uid: currentUser.uid,
                displayName: (currentUser.displayName && currentUser.company) ? `${currentUser.displayName} (${currentUser.company})` : (currentUser.displayName || 'Client'),
            };
            const docRef = doc(db, "tickets", ticketId);
            await updateDoc(docRef, {
                conversation: arrayUnion(newMessage),
                status: STATUS.IN_PROGRESS, // Pour que le manager puisse le voir dans ses tickets "en cours" et le fermer.
                hasNewClientMessage: true,
                hasNewDeveloperMessage: false,
                ccEmails: arrayUnion(currentUser.email)
            });
            showAlert('Succès', 'Votre validation a été transmise au manager qui s\'occupera de clore le ticket définitivement.');
            autoScrolled.current = true;
        } catch (err) {
            console.error("Erreur de validation: ", err);
            showAlert('Erreur', 'Une erreur est survenue lors de la validation.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Fonction utilitaire pour rendre les images de manière uniforme
    const renderImages = (urls) => {
        if (!urls || urls.length === 0) return null;
        return (
            <div className="d-flex flex-wrap gap-2 mt-2">
                {urls.map((url, idx) => (
                    <div key={idx} className="position-relative" style={{ width: '100px', height: '100px', cursor: 'pointer' }} onClick={() => { setCurrentImageUrl(url); setShowImageModal(true); }}>
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

    if (loading) {
        return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    }
    if (error || !ticket) {
        return <Container className="mt-4"><Alert variant="danger">{error || "Ticket non trouvé."}</Alert></Container>;
    }
    
    const isTicketClosed = ticket.status === STATUS.CLOSED;
    
    return (
        <div className="d-flex flex-column h-100 w-100 bg-white">
            {/* En-tête du ticket : fixe en haut */}
            <div className="flex-shrink-0 border-bottom bg-white d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center p-3 p-md-4 sticky-top z-2">
                <div className="d-flex align-items-center gap-3 w-100 mb-3 mb-md-0">
                    <Link to="/" className="text-secondary hover-primary text-decoration-none d-flex align-items-center justify-content-center bg-light rounded-circle p-2" title="Retour aux tickets">
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

            {/* Zone principale : défilement */}
            <div className="flex-grow-1 overflow-auto d-flex flex-column">
                <div className="w-100 mx-auto d-flex flex-column flex-grow-1" style={{ maxWidth: '900px' }}>
                    
                    {/* Conteneur des messages (ListGroup retiré car on veut un flux naturel) */}
                    <div className="flex-grow-1 p-3 p-md-4 d-flex flex-column gap-1">
                        
                        {ticket.conversation?.slice().sort((a, b) => {
                            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                            return timeA - timeB;
                        }).map((msg, index, arr) => {
                            let msgToRender = msg;
                            // Injecter les pièces jointes initiales du ticket dans le tout premier message si elles n'y sont pas déjà (pour la rétrocompatibilité)
                            if (index === 0 && !msg.attachmentUrls && !msg.attachmentUrl) {
                                if (ticket.attachmentUrls && ticket.attachmentUrls.length > 0) {
                                    msgToRender = { ...msg, attachmentUrls: ticket.attachmentUrls };
                                } else if (ticket.attachmentUrl) {
                                    msgToRender = { ...msg, attachmentUrls: [ticket.attachmentUrl] };
                                }
                            }
                            
                            const msgMs = msgToRender.timestamp?.toMillis ? msgToRender.timestamp.toMillis() : new Date(msgToRender.timestamp).getTime();
                            const isNew = localLastRead !== null && msgMs > localLastRead;
                            
                            // Chercher si c'est le tout premier message non lu
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
                    </div>
                    
                    {/* Zone de réponse */}
                    {!isTicketClosed && ticket.status === STATUS.PENDING_VALIDATION && !isRefusing ? (
                        <div id="validation-box" className="p-4 bg-white border-top mt-auto">
                            <div className="rounded p-4 text-center mx-auto" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bce8f1', maxWidth: '750px' }}>
                                <h5 className="fw-bold mb-3" style={{ color: '#005e8e' }}><i className="bi bi-check-circle me-2"></i>Validation requise</h5>
                                <p className="text-secondary mb-4">Le développeur a indiqué avoir terminé les tâches liées à ce ticket. Veuillez vérifier et nous indiquer votre décision concernant ces travaux.</p>
                                <div className="d-flex justify-content-center gap-3 flex-wrap">
                                    <Button variant="outline-danger" onClick={() => setIsRefusing(true)}>
                                        <i className="bi bi-x-circle me-2"></i>Je ne valide pas
                                    </Button>
                                    <Button variant="success" onClick={handleAcceptValidation} disabled={isSubmitting}>
                                        {isSubmitting ? <Spinner size="sm" /> : <><i className="bi bi-check-circle me-2"></i>Je valide</>}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : !isTicketClosed && (
                        <div className="p-3 p-md-4 bg-white border-top mt-auto">
                        <Form onSubmit={handleReplySubmit} className="rounded" style={{ backgroundColor: '#f8f9fc', padding: '20px', border: '1px solid #e2e8f0' }}>
                            {isRefusing && (
                                <Alert variant="warning" className="mb-4" onClose={() => setIsRefusing(false)} dismissible>
                                    <strong>Vous avez refusé la validation.</strong> Veuillez expliquer ci-dessous en détails pourquoi vous refusez la validation afin que nos équipes puissent corriger. Le ticket repassera "En cours".
                                </Alert>
                            )}
                            {replyingTo && (
                                <div className="mb-3 p-2 bg-white rounded border-start border-3 border-primary shadow-sm d-flex justify-content-between align-items-start position-relative">
                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
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
                            <Form.Group className="mb-4" controlId="clientResponse">
                                <Form.Label className="h5 mb-3 d-block">Répondre</Form.Label>
                                <MentionTextarea
                                    rows={4}
                                    placeholder="Tapez votre message ici... (utilisez @ pour mentionner)"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="border-primary"
                                    ticket={ticket}
                                    excludeStaff={true}
                                />
                            </Form.Group>

                            <Form.Group className="mb-4">
                                <Form.Label htmlFor="reply-images" className="fw-bold mb-2">Captures d'écran en lien avec le message (Max 4 images)</Form.Label>
                                <MultiImageUpload 
                                    id="reply-images"
                                images={images}
                                    previews={previews}
                                    onAddImage={handleAddImage}
                                    onRemoveImage={handleRemoveImage}
                                    error={imageError}
                                    maxImages={4}
                                />
                            </Form.Group>

                            <div className="d-flex justify-content-end border-top pt-3">
                                <Button variant="primary" type="submit" disabled={isSubmitting} className="px-4">
                                    {isSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Envoi en cours...</> : 'Envoyer la réponse'}
                                </Button>
                            </div>
                        </Form>
                        </div>
                    )}
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
