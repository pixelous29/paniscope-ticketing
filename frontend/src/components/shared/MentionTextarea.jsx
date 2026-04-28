import React, { useState, useRef, useEffect } from 'react';
import { Form, ListGroup } from 'react-bootstrap';
import { useMentionableUsers } from '../../hooks/useMentionableUsers';

const MentionTextarea = ({ value, onChange, ticket, excludeClients = false, excludeStaff = false }) => {
    const users = useMentionableUsers(ticket, excludeClients, excludeStaff);
    const [mentionState, setMentionState] = useState(null);
    const editorRef = useRef(null);

    // Synchronisation initiale ou effacement (quand value === '')
    useEffect(() => {
        if (editorRef.current) {
            if (!value && editorRef.current.innerHTML !== '') {
                editorRef.current.innerHTML = '';
            } else if (value && editorRef.current.innerHTML === '') {
                // Convertit les @[Nom](UID) initiaux en pastilles graphiques
                const htmlValue = value.replace(/@\[([^\]]+)\](?:\(([^)]+)\))?/g, (match, name, uid) => {
                    return `&nbsp;<span class="badge bg-primary rounded-pill text-white px-2 py-1 mx-1 mention-badge" contenteditable="false" data-uid="${uid || ''}">@${name}</span>&nbsp;`;
                });
                editorRef.current.innerHTML = htmlValue.replace(/\n/g, '<br>');
            }
        }
    }, [value]);

    const handleInput = () => {
        const el = editorRef.current;
        if (!el) return;

        // Parse le DOM pour générer le format texte plat @[Nom](UID) attendu par le backend
        let textValue = '';
        const parseNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                textValue += node.textContent.replace(/\u00A0/g, ' '); // Replace &nbsp; with space
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('mention-badge')) {
                    const uid = node.getAttribute('data-uid');
                    const name = node.textContent.replace(/^@/, '');
                    if (uid) {
                        textValue += `@[${name}](${uid})`;
                    } else {
                        textValue += `@[${name}]`;
                    }
                } else if (node.nodeName === 'BR') {
                    textValue += '\n';
                } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
                    if (textValue.length > 0 && !textValue.endsWith('\n')) textValue += '\n';
                    Array.from(node.childNodes).forEach(parseNode);
                } else {
                    Array.from(node.childNodes).forEach(parseNode);
                }
            }
        };
        Array.from(el.childNodes).forEach(parseNode);
        
        // Notifier le parent du changement textuel brut
        onChange({ target: { value: textValue } });

        // Vérifier s'il faut ouvrir le dropdown de mention
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
                const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                
                if (lastAtIndex !== -1) {
                    const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
                    if (!afterAt.includes('\n') && !afterAt.includes(' ')) {
                        const query = afterAt.toLowerCase();
                        const matches = users.filter(u => 
                            u.name.toLowerCase().startsWith(query) ||
                            u.name.toLowerCase().includes(query)
                        );
                        
                        if (matches.length > 0) {
                            setMentionState({
                                query,
                                textNode: range.startContainer,
                                startIndex: lastAtIndex,
                                endIndex: range.startOffset,
                                suggestions: matches,
                                selectedIndex: 0
                            });
                            return;
                        }
                    }
                }
            }
        }
        setMentionState(null);
    };

    const insertMention = (user) => {
        if (!mentionState || !editorRef.current) return;
        
        const { textNode, startIndex, endIndex } = mentionState;
        
        // Focus l'éditeur
        editorRef.current.focus();

        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);
        
        // Supprimer le texte `@...` tapé par l'utilisateur
        range.deleteContents();
        
        // Créer les éléments de la pastille
        const spaceBefore = document.createTextNode('\u00A0'); // &nbsp;
        const badge = document.createElement('span');
        badge.className = "badge bg-primary rounded-pill text-white px-2 py-1 mx-1 mention-badge";
        badge.setAttribute("contenteditable", "false");
        badge.setAttribute("data-uid", user.id);
        badge.textContent = `@${user.name}`;
        const spaceAfter = document.createTextNode('\u00A0'); // &nbsp;
        
        const frag = document.createDocumentFragment();
        frag.appendChild(spaceBefore);
        frag.appendChild(badge);
        frag.appendChild(spaceAfter);
        
        range.insertNode(frag);
        
        // Placer le curseur juste après la pastille
        range.setStartAfter(spaceAfter);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        
        setMentionState(null);
        handleInput(); // Forcer la mise à jour de la valeur
    };

    const handleKeyDown = (e) => {
        if (!mentionState) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionState(prev => ({
                ...prev,
                selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length
            }));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionState(prev => ({
                ...prev,
                selectedIndex: (prev.selectedIndex - 1 + prev.suggestions.length) % prev.suggestions.length
            }));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (mentionState.suggestions.length > 0) {
                e.preventDefault();
                insertMention(mentionState.suggestions[mentionState.selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setMentionState(null);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {mentionState && mentionState.suggestions.length > 0 && (
                <ListGroup 
                    className="shadow-lg mention-dropdown" 
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        zIndex: 1050,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        width: 'max-content',
                        minWidth: '220px',
                        border: '1px solid #ddd',
                        marginBottom: '4px',
                        backgroundColor: '#fff'
                    }}
                >
                    {mentionState.suggestions.map((user, index) => (
                        <ListGroup.Item 
                            key={user.id} 
                            active={index === mentionState.selectedIndex}
                            onClick={(e) => {
                                e.preventDefault();
                                insertMention(user);
                            }}
                            onMouseDown={(e) => e.preventDefault()} // Empêche la perte de focus
                            style={{ cursor: 'pointer', padding: '8px 12px' }}
                            action
                        >
                            <div className="d-flex align-items-center justify-content-between w-100">
                                <span className="fw-bold">{user.name}</span>
                                <span className="text-muted ms-3" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                                    {user.role}
                                </span>
                            </div>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
            
            <div
                className="form-control"
                ref={editorRef}
                contentEditable="true"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                style={{
                    minHeight: '100px',
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word'
                }}
            />
        </div>
    );
};

export default MentionTextarea;
