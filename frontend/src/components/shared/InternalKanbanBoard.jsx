import React, { useState, useEffect, useRef } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from '../../firebaseConfig';
import { STATUS } from '../../constants/status';
import { DEV_PHASE, DEV_PHASE_LABELS, DEV_PHASE_COLORS, DEV_PHASES_ORDER } from '../../constants/phases';
import { useModal } from '../../hooks/useModal';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import { useNavigate } from 'react-router-dom';

const priorityOrder = { 'Critique': 4, 'Haute': 3, 'Normale': 2, 'Faible': 1 };

export default function InternalKanbanBoard({ role, isDeveloperMode = false }) {
  const [columns, setColumns] = useState({});
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showAlert } = useModal();
  const navigate = useNavigate();

  // Ref pour mémoriser la colonne d'origine au début du drag
  const dragOriginRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("status", "!=", STATUS.CLOSED)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Grouper par devPhase
      const grouped = {};
      DEV_PHASES_ORDER.forEach(phase => grouped[phase] = []);
      
      allTickets.forEach(ticket => {
        let targetPhase = ticket.devPhase;
        if (!targetPhase || !DEV_PHASES_ORDER.includes(targetPhase)) {
            targetPhase = DEV_PHASE.PLANNING; 
        }

        if(grouped[targetPhase]) {
            grouped[targetPhase].push(ticket);
        }
      });

      // Tri des tickets dans chaque colonne :
      // 1. Nouveaux tickets (status "Nouveau") toujours en tête
      // 2. Par priorité décroissante (Critique > Haute > Normale > Faible)
      // 3. Par date de création ascendante (plus ancien en premier)
      Object.keys(grouped).forEach(k => {
          grouped[k].sort((a, b) => {
              const aIsNew = a.status === STATUS.NEW ? 1 : 0;
              const bIsNew = b.status === STATUS.NEW ? 1 : 0;
              if (aIsNew !== bIsNew) return bIsNew - aIsNew;

              const aPriority = priorityOrder[a.priority] || 0;
              const bPriority = priorityOrder[b.priority] || 0;
              if (aPriority !== bPriority) return bPriority - aPriority;

              const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return aTime - bTime;
          });
      });

      setColumns(grouped);
      setLoading(false);
    }, (err) => {
      console.error("Erreur chargement du kanban :", err);
      setError("Erreur lors de la récupération des tickets.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDragStart = (event) => {
    const { active } = event;
    const ticketId = active.id;
    
    // Mémoriser la colonne d'origine AVANT tout déplacement
    const originColumn = findContainerOfItem(ticketId);
    dragOriginRef.current = originColumn;

    for (const [, tickets] of Object.entries(columns)) {
        const found = tickets.find(t => t.id === ticketId);
        if (found) {
            setActiveTicket(found);
            return;
        }
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const id = active.id;
    const overId = over.id;

    if (id === overId) return;

    const activeContainer = findContainerOfItem(id);
    const overContainer = findContainerOfItem(overId) || (DEV_PHASES_ORDER.includes(overId) ? overId : null);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Déplacement temporaire entre colonnes (mise à jour UI optimiste)
    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];

      const activeIndex = activeItems.findIndex((t) => t.id === id);
      const overIndex = DEV_PHASES_ORDER.includes(overId) 
        ? overItems.length + 1 
        : overItems.findIndex((t) => t.id === overId);

      return {
        ...prev,
        [activeContainer]: activeItems.filter((t) => t.id !== id),
        [overContainer]: [
          ...overItems.slice(0, overIndex),
          activeItems[activeIndex],
          ...overItems.slice(overIndex, overItems.length),
        ],
      };
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const activeId = active.id;
    const overId = over?.id;

    if (!overId) {
        setActiveTicket(null);
        dragOriginRef.current = null;
        return;
    }

    // Colonne d'origine mémorisée au dragStart (AVANT le déplacement optimiste)
    const originalContainer = dragOriginRef.current;
    // Colonne finale (là où la carte est maintenant)
    const currentContainer = findContainerOfItem(activeId) || (DEV_PHASES_ORDER.includes(overId) ? overId : null);

    if (!originalContainer || !currentContainer) {
      setActiveTicket(null);
      dragOriginRef.current = null;
      return;
    }

    const ticketToUpdate = activeTicket;

    if (originalContainer === currentContainer) {
      // Même colonne : juste réordonner localement
      const activeIndex = columns[currentContainer]?.findIndex((t) => t.id === activeId);
      const overIndex = columns[currentContainer]?.findIndex((t) => t.id === overId);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setColumns((prev) => ({
          ...prev,
          [currentContainer]: arrayMove(prev[currentContainer], activeIndex, overIndex),
        }));
      }
    } else {
        // Changement de phase ! On met à jour Firestore
        try {
            const docRef = doc(db, "tickets", ticketToUpdate.id);
            await updateDoc(docRef, {
                devPhase: currentContainer,
            });
        } catch (err) {
            console.error("Erreur update devPhase:", err);
            showAlert("Erreur", "Le changement de phase n'a pas pu être enregistré.");
        }
    }

    setActiveTicket(null);
    dragOriginRef.current = null;
  };

  const findContainerOfItem = (itemId) => {
    for (const [key, items] of Object.entries(columns)) {
      if (items.some((t) => t.id === itemId)) {
        return key;
      }
    }
    return null;
  };

  const handleCardClick = (ticketId) => {
      const isDev = role === 'developer' || isDeveloperMode;
      const route = isDev ? `/dev/ticket/${ticketId}` : `/manager/ticket/${ticketId}`;
      navigate(route);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  if (loading) return <Container className="text-center mt-4"><Spinner animation="border" /></Container>;
  if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;

  return (
    <div className="w-100 overflow-auto pb-3" style={{ minHeight: 'calc(100vh - 250px)' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="d-flex gap-3 h-100 align-items-stretch justify-content-center" style={{ height: '100%', minWidth: 'min-content', paddingBottom: '1rem' }}>
          {DEV_PHASES_ORDER.map((phaseId) => (
              <KanbanColumn
                key={phaseId}
                id={phaseId}
                title={DEV_PHASE_LABELS[phaseId]}
                color={DEV_PHASE_COLORS[phaseId]}
                tickets={columns[phaseId] || []}
                onCardClick={handleCardClick}
              />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTicket ? (
            <div style={{ transform: 'rotate(2deg)' }}>
               <KanbanCard ticket={activeTicket} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
