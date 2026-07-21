import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import InternalKanbanBoard from '../../components/shared/InternalKanbanBoard';
import { useAuth } from '../../hooks/useAuth';

export default function KanbanPage() {
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();
  const developerName = currentUser?.displayName || currentUser?.email;
  const isDeveloperMode = userRole === 'developer';

  return (
    <div className="d-flex flex-column h-100 w-100 bg-light">
      <div className="bg-white border-bottom px-3 px-md-4 py-3 flex-shrink-0">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" className="rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }} onClick={() => navigate(-1)} title="Retour">
            <i className="bi bi-arrow-left fs-5 text-secondary"></i>
          </Button>
          <h4 className="m-0 fw-bold text-dark d-flex align-items-center">
            <i className="bi bi-kanban me-2"></i>Développement
          </h4>
        </div>
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
