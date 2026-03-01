import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Container, Card, Form, Button, ListGroup, Badge, Spinner, Alert, Breadcrumb } from 'react-bootstrap';
import { useModal } from '../../hooks/useModal';
import { LinkContainer } from 'react-router-bootstrap';
import { STATUS, STATUS_VARIANT } from '../../constants/status';
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
                displayName: currentUser.displayName,
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
            await updateDoc(docRef, {
                conversation: arrayUnion(newMessage),
                hasNewDeveloperMessage: false, // On reset si on répondait au dev
                hasNewClientMessage: true // Signale au manager une maj
            });

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
        <Container className="mt-4 pb-5">
            <Breadcrumb>
                <LinkContainer to="/">
                    <Breadcrumb.Item>Tableau de bord</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>Ticket #{ticket?.id}</Breadcrumb.Item>
            </Breadcrumb>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">{ticket.subject}</h4>
                    <Badge bg={STATUS_VARIANT[ticket.status] || 'secondary'} pill>{ticket.status}</Badge>
                </Card.Header>
                <Card.Body className="p-4">
                    <h5 className="mb-4">Conversation</h5>
                    
                    <ListGroup variant="flush" className="mb-4 border rounded shadow-sm p-2" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        
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
                    </ListGroup>
                    
                    {!isTicketClosed && (
                        <>
                        <h5 className="mt-4 mb-3">Répondre</h5>
                        <Form onSubmit={handleReplySubmit} className="bg-light p-3 rounded shadow-sm border">
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
                                <MentionTextarea
                                    rows={4}
                                    placeholder="Tapez votre message ici... (utilisez @ pour mentionner)"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="border-primary"
                                    ticket={ticket}
                                />
                            </Form.Group>

                            <MultiImageUpload 
                                images={images}
                                previews={previews}
                                onAddImage={handleAddImage}
                                onRemoveImage={handleRemoveImage}
                                error={imageError}
                                maxImages={4}
                            />

                            <div className="d-flex justify-content-end border-top pt-3">
                                <Button variant="primary" type="submit" disabled={isSubmitting} className="px-4">
                                    {isSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Envoi en cours...</> : 'Envoyer la réponse'}
                                </Button>
                            </div>
                        </Form>
                        </>
                    )}
                </Card.Body>
            </Card>

            <ImageModal 
                show={showImageModal} 
                onHide={() => setShowImageModal(false)} 
                imageUrl={currentImageUrl} 
            />
        </Container>
    );
}
