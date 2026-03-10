import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ListGroup, Image, Badge, OverlayTrigger, Tooltip, Button } from 'react-bootstrap';
import { useInView } from 'react-intersection-observer';
import { User, ShieldCheck, Code, Bot, SmilePlus, Reply } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../hooks/useAuth';

// Cache en mémoire pour réduire les appels Firestore inutiles aux profils
const userProfileCache = {};

export default function MessageBubble({ msg, renderImages, ticket, isNew, onVisible, id, onReply }) {
    const { currentUser } = useAuth();
    const [showEmojis, setShowEmojis] = useState(false);
    const containerRef = useRef(null);
    const [userData, setUserData] = useState({
        displayName: msg.displayName || msg.author,
        photoURL: msg.photoBase64 || msg.photoURL || null
    });

    const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👀', '✅'];

    const { ref: inViewRef, inView } = useInView({
        threshold: 0.3,
        triggerOnce: true
    });

    const setRefs = useCallback(
        (node) => {
            containerRef.current = node;
            inViewRef(node);
        },
        [inViewRef],
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowEmojis(false);
            }
        };

        if (showEmojis) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showEmojis]);

    useEffect(() => {
        if (inView && isNew && onVisible) {
            onVisible(msg.timestamp);
        }
    }, [inView, isNew, msg.timestamp, onVisible]);

    useEffect(() => {
        let isMounted = true;
        
        const fetchUserData = async () => {
            let targetUid = msg.uid;
            
            // Fallback pour les messages existants
            if (!targetUid && msg.author === 'Client' && ticket?.clientUid) {
                targetUid = ticket.clientUid;
            }

            if (targetUid) {
                try {
                    const now = Date.now();
                    const cached = userProfileCache[targetUid];
                    
                    // Cache valide pendant 5 minutes
                    if (cached && cached.timestamp && (now - cached.timestamp < 5 * 60 * 1000)) {
                        if (isMounted) {
                            setUserData({
                                displayName: cached.displayName,
                                photoURL: cached.photoBase64 || cached.photoURL
                            });
                        }
                        return;
                    }
                    
                    const userDoc = await getDoc(doc(db, 'users', targetUid));
                    
                    if (userDoc.exists() && isMounted) {
                        const data = userDoc.data();
                        let fullName = '';
                        if (data.firstName || data.lastName) {
                            fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                        }
                        
                        const profile = {
                            displayName: (data.role === 'client' && data.company) 
                                ? data.company 
                                : (fullName || data.displayName || msg.displayName || msg.author),
                            photoBase64: data.photoBase64 || null,
                            photoURL: data.photoBase64 || data.photoURL || msg.photoURL || null,
                            timestamp: now
                        };
                        
                        userProfileCache[targetUid] = profile;
                        
                        setUserData({
                            displayName: profile.displayName,
                            photoURL: profile.photoURL
                        });
                    }
                } catch (error) {
                    if (error.code !== 'permission-denied') {
                        console.error("Erreur de récupération du profil:", error);
                    }
                }
            }
        };

        if (msg.uid || (msg.author === 'Client' && ticket?.clientUid)) {
            fetchUserData();
        }

        return () => { isMounted = false; };
    }, [msg, ticket]);

    // Détermination de la configuration visuelle selon l'auteur
    let bgColor = '#f8f9fa';
    let textColor = 'text-primary';
    let borderColor = '#0d6efd';
    let IconComponent = User;

    switch (msg.author) {
        case 'Manager':
            bgColor = '#fff8e1';
            textColor = 'text-warning';
            borderColor = '#ffc107';
            IconComponent = ShieldCheck;
            break;
        case 'Développeur':
            bgColor = '#e3f2fd';
            textColor = 'text-info';
            borderColor = '#0dcaf0';
            IconComponent = Code;
            break;
        case 'Système':
            bgColor = '#f1f8ed';
            textColor = 'text-success';
            borderColor = '#198754';
            IconComponent = Bot;
            break;
        case 'Client':
        default:
            bgColor = '#f8f9fa';
            textColor = 'text-primary';
            borderColor = '#0d6efd';
            IconComponent = User;
            break;
    }

    // Seul le tout premier message "Système" (description du ticket) affiche "Ouverture du ticket"
    // Les messages de clôture/réouverture gardent "Système"
    const isOpeningMessage = msg.author === 'Système' && !msg.text?.startsWith('🔒') && !msg.text?.startsWith('🔓');
    const displayName = userData.displayName === 'Système' ? (isOpeningMessage ? 'Ouverture du ticket' : 'Système') : userData.displayName;
    const displayAuthor = msg.author === 'Système' ? (isOpeningMessage ? 'Ouverture du ticket' : 'Système') : msg.author;

    // Rendu du texte avec mise en surbrillance des @mentions
    // Supporte le format @[Prénom Nom] (noms avec espaces) et aussi @Prénom (ancien format sans espaces)
    const renderTextWithMentions = (text) => {
        if (!text) return null;
        // Cherche @[Nom Complet] ou @MotSimple
        const parts = text.split(/(@\[[^\]]+\]|@[a-zA-ZÀ-ÿ0-9_-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@[') && part.endsWith(']')) {
                // Format @[Nom Complet] → affiche @Nom Complet
                const name = part.slice(2, -1);
                return (
                    <span key={i} style={{ 
                        color: '#0d6efd', 
                        fontWeight: '600',
                        backgroundColor: '#e7f1ff',
                        borderRadius: '3px',
                        padding: '1px 4px'
                    }}>
                        @{name}
                    </span>
                );
            }
            if (part.startsWith('@') && part.length > 1) {
                // Ancien format @MotSimple
                return (
                    <span key={i} style={{ 
                        color: '#0d6efd', 
                        fontWeight: '600',
                        backgroundColor: '#e7f1ff',
                        borderRadius: '3px',
                        padding: '1px 4px'
                    }}>
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const handleReaction = async (emoji) => {
        if (!ticket || !currentUser) return;
        
        const isSameMessage = (m1, m2) => {
            if (m1.timestamp && m2.timestamp) {
                const t1 = m1.timestamp.toMillis ? m1.timestamp.toMillis() : new Date(m1.timestamp).getTime();
                const t2 = m2.timestamp.toMillis ? m2.timestamp.toMillis() : new Date(m2.timestamp).getTime();
                return t1 === t2 && m1.text === m2.text;
            }
            return m1.text === m2.text;
        };

        let arrayName = 'conversation';
        let msgIndex = ticket.conversation?.findIndex(m => isSameMessage(m, msg));
        
        if (msgIndex === -1 || msgIndex === undefined) {
            msgIndex = ticket.internalNotes?.findIndex(m => isSameMessage(m, msg));
            if (msgIndex !== -1 && msgIndex !== undefined) {
                arrayName = 'internalNotes';
            } else {
                return; // message introuvable
            }
        }

        const docRef = doc(db, "tickets", ticket.id);
        const originArray = ticket[arrayName];
        const targetMsg = { ...originArray[msgIndex] };
        
        if (!targetMsg.reactions) targetMsg.reactions = {};
        if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];
        
        const existingReactIdx = targetMsg.reactions[emoji].findIndex(u => (u.uid || u) === currentUser.uid);
        
        if (existingReactIdx > -1) {
            targetMsg.reactions[emoji].splice(existingReactIdx, 1);
            if (targetMsg.reactions[emoji].length === 0) {
                delete targetMsg.reactions[emoji];
            }
        } else {
            targetMsg.reactions[emoji].push({ uid: currentUser.uid, displayName: currentUser.displayName || 'Moi' });
        }
        
        const newArray = [...originArray];
        newArray[msgIndex] = targetMsg;
        
        try {
            await updateDoc(docRef, { [arrayName]: newArray });
        } catch (err) {
            console.error("Erreur lors de l'ajout de la réaction:", err);
            if (err.code !== 'permission-denied') {
                // Ignore perm denied
            }
        }
    };

    return (
        <div 
            id={id}
            ref={setRefs}
            onClick={() => setShowEmojis(!showEmojis)}
            style={{ 
                backgroundColor: isNew ? `${borderColor}1A` : bgColor, 
                borderRadius: '0.75rem',
                borderLeft: `4px solid ${borderColor}`,
                position: 'relative',
                transition: 'background-color 1s ease-out',
                cursor: 'pointer'
            }}
            className={`d-flex flex-column px-3 py-3 shadow-sm list-group-item ${isNew ? 'bg-opacity-25' : ''}`} 
        >
            {isNew && (
                <div className="position-absolute top-0 mt-2" style={{ right: showEmojis ? '45px' : '15px', transition: 'right 0.2s ease-in-out', zIndex: 1 }}>
                    <Badge bg="danger" pill>Nouveau !</Badge>
                </div>
            )}
            
            {/* Barre d'émojis au clic */}
            <div 
                className={`position-absolute top-0 end-0 mt-2 me-2 bg-white border shadow-sm rounded-pill d-flex align-items-center px-2 py-1 gap-2 transition-all ${showEmojis ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ zIndex: 10, visibility: showEmojis ? 'visible' : 'hidden', pointerEvents: showEmojis ? 'auto' : 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {AVAILABLE_EMOJIS.map(emoji => (
                    <span 
                        key={emoji} 
                        style={{ cursor: 'pointer', fontSize: '1.2rem', transition: 'transform 0.1s' }} 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleReaction(emoji);
                            setShowEmojis(false);
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.3)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        title={`Réagir avec ${emoji}`}
                    >
                        {emoji}
                    </span>
                ))}
                
                {onReply && (
                    <>
                        <div className="border-start border-secondary mx-1 h-100" style={{ opacity: 0.3 }}></div>
                        <Button 
                            variant="link" 
                            className="p-0 text-secondary" 
                            title="Répondre à ce message"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReply(msg);
                                setShowEmojis(false);
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                            style={{ transition: 'transform 0.1s' }}
                        >
                            <Reply size={20} />
                        </Button>
                    </>
                )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2 pb-2">
                <div className="d-flex align-items-center gap-2">
                    {/* Avatar ou Icône par défaut */}
                    {userData.photoURL ? (
                        <Image 
                            src={userData.photoURL} 
                            alt={`Avatar de ${displayName}`} 
                            roundedCircle 
                            referrerPolicy="no-referrer"
                            style={{ width: '38px', height: '38px', objectFit: 'cover', border: `2px solid ${borderColor}` }}
                        />
                    ) : (
                        <div 
                            className="rounded-circle d-flex align-items-center justify-content-center bg-white shadow-sm"
                            style={{ width: '38px', height: '38px', border: `2px solid ${borderColor}` }}
                        >
                            <IconComponent size={20} className={textColor.replace('text-', 'text-')} style={{ color: borderColor }} />
                        </div>
                    )}
                    
                    <div className="d-flex flex-column lh-1 ms-1">
                        <strong className="text-dark" style={{ fontSize: '1rem', marginBottom: '4px' }}>
                            {displayName}
                        </strong>
                        <div className="d-flex align-items-center">
                            <Badge 
                                bg="none" 
                                className={`px-2 py-1 d-flex align-items-center ${textColor}`} 
                                style={{ 
                                    fontSize: '0.7rem', 
                                    fontWeight: '700', 
                                    letterSpacing: '0.5px',
                                    textTransform: 'uppercase',
                                    border: `1px solid ${borderColor}`,
                                    backgroundColor: `${borderColor}15`,
                                    borderRadius: '4px'
                                }}
                            >
                                <IconComponent size={10} className="me-1" /> {displayAuthor}
                            </Badge>
                        </div>
                    </div>
                </div>
                
                <small className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString('fr-FR') : (msg.timestamp ? new Date(msg.timestamp).toLocaleString('fr-FR') : 'Date inconnue')}
                </small>
            </div>

            {/* Block de citation (Réponse à un précédent message) */}
            {msg.replyTo && (
                <div 
                    className="mb-2 p-2 rounded text-muted bg-white border-start border-3 border-secondary" 
                    style={{ fontSize: '0.85rem', cursor: 'pointer', opacity: 0.8 }}
                    onClick={(e) => {
                        // Optionnel : Scroll vers le message original si on a un id, 
                        // mais ça dépendra de comment on id les messages à terme
                        e.stopPropagation();
                    }}
                >
                    <div className="d-flex align-items-center mb-1 fw-bold">
                        <Reply size={12} className="me-1" />
                        {msg.replyTo.displayName || msg.replyTo.author}
                    </div>
                    <div className="text-truncate" style={{ whiteSpace: 'nowrap' }}>
                        {msg.replyTo.text || "Message avec pièce jointe"}
                    </div>
                </div>
            )}
            
            <div className="mb-1 mt-2 text-dark" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.95rem' }}>
                {renderTextWithMentions(msg.text)}
            </div>
            
            {/* Affichage des images jointes au message */}
            {msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                <div 
                    className="mt-3 bg-white p-2 rounded border border-light"
                    onClick={(e) => e.stopPropagation()}
                >
                    <small className="d-block mb-2 text-muted fw-semibold">Pièce(s) jointe(s) :</small>
                    {renderImages(msg.attachmentUrls)}
                </div>
            )}

            {/* Affichage des réactions existantes */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                    {Object.entries(msg.reactions).map(([emoji, users]) => {
                        if (!users || users.length === 0) return null;
                        const hasReacted = currentUser && users.some(u => (u.uid || u) === currentUser.uid);
                        
                        // Préparation du texte du ToolTip (Qui a réagi)
                        const tooltipText = users.map(u => {
                            if (u.uid === currentUser?.uid) return "Vous";
                            return u.displayName || "Utilisateur";
                        }).join(', ');

                        return (
                            <OverlayTrigger
                                key={emoji}
                                placement="top"
                                overlay={<Tooltip>{tooltipText}</Tooltip>}
                            >
                                <Badge 
                                    pill 
                                    bg={hasReacted ? 'primary' : 'light'} 
                                    text={hasReacted ? 'white' : 'dark'} 
                                    className={`border d-flex align-items-center gap-1 px-2 py-1 ${hasReacted ? 'border-primary bg-opacity-25 text-primary' : 'border-secondary'}`}
                                    style={{ cursor: 'pointer', fontSize: '0.9rem', backgroundColor: hasReacted ? `${borderColor}22` : undefined }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleReaction(emoji);
                                    }}
                                >
                                    <span>{emoji}</span> 
                                    {users.length > 1 && <span className="fw-bold">{users.length}</span>}
                                </Badge>
                            </OverlayTrigger>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
