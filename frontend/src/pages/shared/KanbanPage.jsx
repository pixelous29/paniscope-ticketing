import React from 'react';
import InternalKanbanBoard from '../../components/shared/InternalKanbanBoard';
import { useAuth } from '../../hooks/useAuth';

export default function KanbanPage() {
  const { currentUser, userRole } = useAuth();
  const developerName = currentUser?.displayName || currentUser?.email;
  const isDeveloperMode = userRole === 'developer';

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="bg-white border-bottom px-3 px-md-4 pt-4 pb-3 flex-shrink-0">
        <h4 className="m-0 fw-bold text-dark">
          <i className="bi bi-kanban me-2"></i>Développement
        </h4>
      </div>
      
      <div className="flex-grow-1 overflow-auto p-3 p-md-4 bg-light">
        <div className="h-100 w-100 mx-auto">
          <InternalKanbanBoard 
            role={userRole} 
            developerName={isDeveloperMode ? developerName : undefined} 
            isDeveloperMode={isDeveloperMode} 
          />
        </div>
      </div>
    </div>
  );
}
