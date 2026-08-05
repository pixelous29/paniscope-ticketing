import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Spinner, Alert, Button, Badge, Form } from 'react-bootstrap';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
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

export default function InternalKanbanBoard({ role, isDeveloperMode = false, developerName }) {
  const [columns, setColumns] = useState({});
  const [allTickets, setAllTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [filterMode, setFilterMode] = useState('todo'); // 'todo' | 'pending' | 'all'
  const [searchTerm, setSearchTerm] = useState('');

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
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
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
      let tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (isDeveloperMode && developerName) {
        tickets = tickets.filter(ticket => {
          if (Array.isArray(ticket.assignedTo)) {
            return ticket.assignedTo.includes(developerName);
          }
          return ticket.assignedTo === developerName;
        });
      }
      
      setAllTickets(tickets);
      setLoading(false);
    }, (err) => {
      console.error("Erreur chargement du kanban :", err);
      setError("Erreur lors de la récupération des tickets.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [developerName, isDeveloperMode]);

  // Calcul des compteurs globaux
  const counts = useMemo(() => {
    const todo = allTickets.filter(t => t.status === STATUS.NEW || t.status === STATUS.IN_PROGRESS).length;
    const pending = allTickets.filter(t => t.status === STATUS.PENDING || t.status === STATUS.PENDING_VALIDATION).length;
    const all = allTickets.length;
    return { todo, pending, all };
  }, [allTickets]);

  // Recalcul des colonnes en fonction des filtres actifs
  useEffect(() => {
    let filtered = [...allTickets];

    // 1. Filtrage par statut
    if (filterMode === 'todo') {
      filtered = filtered.filter(t => t.status === STATUS.NEW || t.status === STATUS.IN_PROGRESS);
    } else if (filterMode === 'pending') {
      filtered = filtered.filter(t => t.status === STATUS.PENDING || t.status === STATUS.PENDING_VALIDATION);
    }

    // 2. Filtrage par terme de recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const subjectMatch = (t.subject || '').toLowerCase().includes(term);
        const clientMatch = (t.clientName || t.client || '').toLowerCase().includes(term);
        const tagMatch = Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(term));
        return subjectMatch || clientMatch || tagMatch;
      });
    }

    // 3. Regroupement par devPhase
    const grouped = {};
    DEV_PHASES_ORDER.forEach(phase => grouped[phase] = []);
    
    filtered.forEach(ticket => {
      let targetPhase = ticket.devPhase;
      if (!targetPhase || !DEV_PHASES_ORDER.includes(targetPhase)) {
        targetPhase = DEV_PHASE.PLANNING; 
      }

      if(grouped[targetPhase]) {
        grouped[targetPhase].push(ticket);
      }
    });

    // 4. Tri des tickets dans chaque colonne
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
  }, [allTickets, filterMode, searchTerm]);

  const handleDragStart = (event) => {
    const { active } = event;
    const ticketId = active.id;
    
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

    setColumns((prev) => {
      const activeItems = prev[activeContainer] || [];
      const overItems = prev[overContainer] || [];

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

    const originalContainer = dragOriginRef.current;
    const currentContainer = findContainerOfItem(activeId) || (DEV_PHASES_ORDER.includes(overId) ? overId : null);

    if (!originalContainer || !currentContainer) {
      setActiveTicket(null);
      dragOriginRef.current = null;
      return;
    }

    const ticketToUpdate = activeTicket;

    if (originalContainer === currentContainer) {
      const activeIndex = columns[currentContainer]?.findIndex((t) => t.id === activeId);
      const overIndex = columns[currentContainer]?.findIndex((t) => t.id === overId);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setColumns((prev) => ({
          ...prev,
          [currentContainer]: arrayMove(prev[currentContainer], activeIndex, overIndex),
        }));
      }
    } else {
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
    <div className="w-100 d-flex flex-column h-100">
      {/* Barre de filtres et recherche */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 bg-white p-2.5 px-3 rounded shadow-sm border flex-shrink-0">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button 
            variant={filterMode === 'todo' ? 'primary' : 'outline-secondary'} 
            size="sm"
            className="fw-bold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={() => setFilterMode('todo')}
          >
            <span>À traiter</span>
            <Badge bg={filterMode === 'todo' ? 'light' : 'secondary'} text={filterMode === 'todo' ? 'dark' : 'white'} pill>
              {counts.todo}
            </Badge>
          </Button>

          <Button 
            variant={filterMode === 'pending' ? 'warning' : 'outline-secondary'} 
            size="sm"
            className={`fw-bold d-flex align-items-center gap-1.5 shadow-sm ${filterMode === 'pending' ? 'text-dark' : ''}`}
            onClick={() => setFilterMode('pending')}
          >
            <span>⏳ En attente client</span>
            <Badge bg={filterMode === 'pending' ? 'dark' : 'secondary'} text="white" pill>
              {counts.pending}
            </Badge>
          </Button>

          <Button 
            variant={filterMode === 'all' ? 'dark' : 'outline-secondary'} 
            size="sm"
            className="fw-bold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={() => setFilterMode('all')}
          >
            <span>Tous</span>
            <Badge bg={filterMode === 'all' ? 'light' : 'secondary'} text={filterMode === 'all' ? 'dark' : 'white'} pill>
              {counts.all}
            </Badge>
          </Button>
        </div>

        <div className="position-relative" style={{ maxWidth: '280px', width: '100%' }}>
          <Form.Control
            type="text"
            placeholder="Rechercher (sujet, client, tag)..."
            size="sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pe-4 shadow-sm"
          />
          {searchTerm && (
            <Button 
              variant="link" 
              size="sm" 
              className="position-absolute top-50 end-0 translate-middle-y text-muted text-decoration-none p-1 me-1"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="w-100 overflow-auto pb-3 user-select-none flex-grow-1" style={{ minHeight: 'calc(100vh - 250px)' }}>
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
    </div>
  );
}
