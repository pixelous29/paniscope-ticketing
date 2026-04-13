import React, { useState, useRef } from 'react';
import { Form, ListGroup } from 'react-bootstrap';
import { useMentionableUsers } from '../../hooks/useMentionableUsers';

const MentionTextarea = ({ value, onChange, ticket, excludeClients = false, ...props }) => {
    const users = useMentionableUsers(ticket, excludeClients);
    const [mentionState, setMentionState] = useState(null);
    const textareaRef = useRef(null);

    const handleTextChange = (e) => {
        const text = e.target.value;
        const cursorPosition = e.target.selectionStart;
        onChange(e); // keep parent sync

        // On cherche le dernier '@' avant le curseur
        const textBeforeCursor = text.substring(0, cursorPosition);
        
        // Cherche le dernier @ suivi éventuellement de caractères (lettres, accents, espaces, chiffres, tirets, underscores)
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
            
            // On vérifie que ce qui suit le @ ne contient pas de retour à la ligne (sinon ce n'est pas une mention)
            if (!afterAt.includes('\n')) {
                const query = afterAt.toLowerCase();
                
                // On filtre les utilisateurs
                const matches = users.filter(u => 
                    u.name.toLowerCase().startsWith(query) ||
                    u.name.toLowerCase().includes(query)
                );
                
                if (matches.length > 0) {
                    setMentionState({
                        query,
                        startIndex: lastAtIndex,
                        cursorPosition,
                        suggestions: matches,
                        selectedIndex: 0
                    });
                } else {
                    setMentionState(null);
                }
            } else {
                setMentionState(null);
            }
        } else {
            setMentionState(null);
        }
    };

    const insertMention = (user) => {
        if (!mentionState) return;
        
        const textBeforeMention = value.substring(0, mentionState.startIndex);
        const mentionText = `@[${user.name}] `; 
        const textAfterMention = value.substring(mentionState.cursorPosition);
        
        const newText = textBeforeMention + mentionText + textAfterMention;

        const syntheticEvent = { target: { value: newText } };
        onChange(syntheticEvent);
        setMentionState(null);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = textBeforeMention.length + mentionText.length;
                textareaRef.current.selectionStart = newCursorPos;
                textareaRef.current.selectionEnd = newCursorPos;
            }
        }, 0);
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
                            onClick={() => insertMention(user)}
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
            
            <Form.Control
                as="textarea"
                ref={textareaRef}
                value={value}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                {...props}
            />
        </div>
    );
};

export default MentionTextarea;
