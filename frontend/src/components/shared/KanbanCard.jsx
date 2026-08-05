import React from 'react';
import { Card } from 'react-bootstrap';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STATUS } from '../../constants/status';
import { getTicketPastelBg } from '../../constants/type';

const PRIORITY_DOT = {
  'Critique': '#dc3545',
  'Haute':    '#fd7e14',
  'Normale':  '#28a745',
  'Faible':   '#6c757d',
};

function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const cleanName = name.includes('@') ? name.split('@')[0].replace(/[._-]/g, ' ') : name;
  const parts = cleanName.trim().split(/\s+/);
  return parts.map(p => p.charAt(0).toUpperCase()).join('');
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp));
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function KanbanCard({ ticket, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id, data: { ...ticket } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    marginBottom: '6px',
    touchAction: 'none'
  };

const NEW_TICKET_BG = '#d0e8ff';

  const isNewTicket = ticket.status === STATUS.NEW;
  const isPendingClient = ticket.status === STATUS.PENDING;
  const isPendingValidation = ticket.status === STATUS.PENDING_VALIDATION;
  const cardBg = isNewTicket ? NEW_TICKET_BG : getTicketPastelBg(ticket.type);

  const displayDate = formatDate(ticket.lastUpdate || ticket.createdAt);
  const tags = Array.isArray(ticket.tags) ? ticket.tags : [];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className={`shadow-sm border-0 position-relative user-select-none ${isPendingClient ? 'border-start border-3 border-warning' : (isNewTicket ? 'border-start border-3 border-primary' : '')}`}
        style={{ 
          minHeight: '65px', 
          cursor: 'pointer', 
          backgroundColor: cardBg, 
          borderRadius: '6px' 
        }}
        onClick={(e) => {
            e.stopPropagation();
            if (onClick) onClick();
        }}
      >
        <Card.Body className="p-2 d-flex flex-column gap-1">
          {/* En-tête de carte : Badges de Statut */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-1" style={{ fontSize: '0.65rem' }}>
            {isNewTicket && (
              <span className="fw-bold text-primary text-uppercase bg-primary bg-opacity-10 px-1.5 py-0.5 rounded border border-primary">
                ● Nouveau
              </span>
            )}
            {isPendingClient && (
              <span className="fw-bold text-warning text-dark text-uppercase bg-warning bg-opacity-25 px-1.5 py-0.5 rounded border border-warning">
                ⏳ Attente Client
              </span>
            )}
            {isPendingValidation && (
              <span className="fw-bold text-info text-uppercase bg-info bg-opacity-25 px-1.5 py-0.5 rounded border border-info">
                ✓ En validation
              </span>
            )}
            {displayDate && (
              <span className="ms-auto text-muted" style={{ fontSize: '0.62rem' }}>
                {displayDate}
              </span>
            )}
          </div>

          {/* Titre complet du ticket + indicateur de priorité */}
          <div className="d-flex align-items-start gap-1.5">
            <span 
              className="rounded-circle mt-1 flex-shrink-0" 
              style={{ 
                width: '7px', height: '7px', 
                backgroundColor: PRIORITY_DOT[ticket.priority] || '#6c757d', 
                display: 'inline-block' 
              }}
              title={ticket.priority}
            ></span>
            <div className="fw-bold text-dark" style={{ fontSize: '0.82rem', lineHeight: '1.25', wordBreak: 'break-word' }}>
              {ticket.subject}
            </div>
          </div>

          {/* Tags du ticket */}
          {tags.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mt-0.5">
              {tags.slice(0, 3).map((tag, idx) => (
                <span 
                  key={idx}
                  className="bg-white bg-opacity-75 text-secondary border rounded px-1"
                  style={{ fontSize: '0.62rem', lineHeight: '1.2' }}
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-muted" style={{ fontSize: '0.62rem' }}>
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer : Client à gauche, Avatars dev à droite */}
          <div className="mt-1 d-flex justify-content-between align-items-center">
             <div className="text-truncate me-1" style={{ fontSize: '0.7rem', color: '#5e6c84', maxWidth: '65%' }}>
                {ticket.clientName || ticket.client || 'Client inconnu'}
             </div>
             
             {ticket.assignedTo && (
                <div className="d-flex flex-shrink-0" style={{ gap: '2px' }}>
                  {(Array.isArray(ticket.assignedTo) ? ticket.assignedTo : [ticket.assignedTo]).slice(0, 3).map((dev, idx) => (
                    <span 
                      key={idx} 
                      className="d-flex align-items-center justify-content-center rounded-circle border" 
                      style={{ 
                        width: '20px', height: '20px', 
                        fontSize: '0.52rem', fontWeight: 'bold',
                        backgroundColor: '#e7f1ff', color: '#0d6efd',
                        border: '1.5px solid #0d6efd',
                      }} 
                      title={dev}
                    >
                      {typeof dev === 'string' ? getInitials(dev) : '?'}
                    </span>
                  ))}
                  {(Array.isArray(ticket.assignedTo) && ticket.assignedTo.length > 3) && (
                      <span 
                        className="d-flex align-items-center justify-content-center rounded-circle" 
                        style={{ 
                          width: '20px', height: '20px', 
                          fontSize: '0.52rem', fontWeight: 'bold',
                          backgroundColor: '#6c757d', color: '#fff' 
                        }}
                      >
                        +{ticket.assignedTo.length - 3}
                      </span>
                  )}
                </div>
             )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
