import React from 'react';
import { Card } from 'react-bootstrap';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STATUS } from '../../constants/status';

// Couleurs pastel selon la priorité
const PRIORITY_BG = {
  'Critique': '#fde2e2',   // rouge pastel
  'Haute':    '#fff3cd',   // jaune/orange pastel
  'Normale':  '#d4edda',   // vert pastel
  'Faible':   '#e9ecef',   // gris pastel
};
const NEW_TICKET_BG = '#d0e8ff'; // bleu pastel pour les nouveaux tickets

// Couleur du point indicateur de priorité (petit rond à côté du titre)
const PRIORITY_DOT = {
  'Critique': '#dc3545',
  'Haute':    '#fd7e14',
  'Normale':  '#28a745',
  'Faible':   '#6c757d',
};

// Extraire les initiales : première lettre de chaque mot
// "Yves Le Signor" → "YLS", "Nicolas Raynaud" → "NR"
// Si c'est un email, on prend la partie avant le @
function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  // Si c'est un email, prendre la partie avant @
  const cleanName = name.includes('@') ? name.split('@')[0].replace(/[._-]/g, ' ') : name;
  const parts = cleanName.trim().split(/\s+/);
  return parts.map(p => p.charAt(0).toUpperCase()).join('');
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
    marginBottom: '10px',
    touchAction: 'none'
  };

  const isNewTicket = ticket.status === STATUS.NEW;
  const cardBg = isNewTicket ? NEW_TICKET_BG : (PRIORITY_BG[ticket.priority] || '#f8f9fa');

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className="shadow-sm border-0 h-100 position-relative" 
        style={{ minHeight: '90px', cursor: 'pointer', backgroundColor: cardBg, borderRadius: '8px' }}
        onClick={(e) => {
            e.stopPropagation();
            if (onClick) onClick();
        }}
      >
        <Card.Body className="p-2 d-flex flex-column">
          {/* Indicateur "Nouveau" pour les tickets non encore traités */}
          {isNewTicket && (
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#0d6efd', textTransform: 'uppercase', marginBottom: '4px' }}>
              ● Nouveau
            </div>
          )}

          {/* Titre complet du ticket + indicateur de priorité */}
          <div className="d-flex align-items-start gap-1 mb-2">
            <span 
              className="rounded-circle mt-1 flex-shrink-0" 
              style={{ 
                width: '8px', height: '8px', 
                backgroundColor: PRIORITY_DOT[ticket.priority] || '#6c757d', 
                display: 'inline-block' 
              }}
              title={ticket.priority}
            ></span>
            <div className="fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.3', wordBreak: 'break-word' }}>
              {ticket.subject}
            </div>
          </div>

          {/* Footer : Client à gauche, Avatars dev à droite */}
          <div className="mt-auto d-flex justify-content-between align-items-end">
             <div style={{ fontSize: '0.72rem', color: '#5e6c84' }}>
                {ticket.clientName || ticket.client || 'Client inconnu'}
             </div>
             
             {ticket.assignedTo && (
                <div className="d-flex" style={{ gap: '2px' }}>
                  {(Array.isArray(ticket.assignedTo) ? ticket.assignedTo : [ticket.assignedTo]).slice(0, 3).map((dev, idx) => (
                    <span 
                      key={idx} 
                      className="d-flex align-items-center justify-content-center rounded-circle border" 
                      style={{ 
                        width: '22px', height: '22px', 
                        fontSize: '0.55rem', fontWeight: 'bold',
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
                          width: '22px', height: '22px', 
                          fontSize: '0.55rem', fontWeight: 'bold',
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
