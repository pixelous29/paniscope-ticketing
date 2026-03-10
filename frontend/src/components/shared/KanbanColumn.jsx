import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ id, title, color, tickets, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      columnId: id
    }
  });

  return (
    <div className="d-flex flex-column h-100 rounded user-select-none" style={{ flex: 1, minWidth: '280px', backgroundColor: isOver ? '#eef2f5' : '#f4f5f7', padding: '10px' }}>
      <div className="d-flex align-items-center justify-content-between mb-3 px-1">
        <h6 className="m-0 fw-bold d-flex align-items-center" style={{ color: '#42526e' }}>
            <span className={`me-2 rounded-circle bg-${color}`} style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
            {title}
        </h6>
        <span className="badge bg-secondary rounded-pill">{tickets.length}</span>
      </div>
      
      <div 
        ref={setNodeRef} 
        className="flex-grow-1 overflow-auto custom-scrollbar"
        style={{ minHeight: '200px' }}
      >
        <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map(ticket => (
            <KanbanCard 
              key={ticket.id} 
              ticket={ticket} 
              onClick={() => onCardClick(ticket.id)}
            />
          ))}
        </SortableContext>
        
        {tickets.length === 0 && (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted" style={{ border: '2px dashed #ccc', borderRadius: '4px', minHeight: '100px' }}>
                <small>Glissez un ticket ici</small>
            </div>
        )}
      </div>
    </div>
  );
}
