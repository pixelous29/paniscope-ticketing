import React, { useState } from 'react';
import { Nav, NavDropdown, Offcanvas, Button } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User, Shield, Code, UserPlus, Menu, LayoutDashboard, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';

export default function AppNavbar() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);

  // Ne pas rendre la navbar sur la page de login etc.
  if (!currentUser) return null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Déconnexion réussie');
      navigate('/login');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const getUserDisplayName = () => {
    return currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur';
  };

  const getRoleBadge = () => {
    const badges = {
      client: { icon: User, text: 'Client', variant: 'primary' },
      manager: { icon: Shield, text: 'Manager', variant: 'warning' },
      developer: { icon: Code, text: 'Développeur', variant: 'info' }
    };
    return badges[userRole] || badges.client;
  };

  const roleBadge = getRoleBadge();
  const RoleIcon = roleBadge.icon;

  const handleClose = () => setShowSidebar(false);
  const handleShow = () => setShowSidebar(true);

  // Contenu réutilisé entre la sidebar fixe (desktop) et offcanvas (mobile)
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const sidebarPadding = isAndroid ? 'calc(1.5rem + max(env(safe-area-inset-top), 55px))' : 'calc(1rem + env(safe-area-inset-top))';
  
  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 bg-dark text-white px-3 pb-3 sidebar-container" style={{ width: '280px', paddingTop: sidebarPadding }}>
      <NavLink to="/" className="d-flex flex-column align-items-center w-100 mb-4 mt-2 text-white text-decoration-none px-2 text-center" onClick={handleClose}>
        <img
          src="/paniscope_sans_slogan.png"
          alt="Paniscope logo"
          className="mb-2"
          style={{ width: '160px', height: 'auto', objectFit: 'contain' }}
        />
        <span className="fs-5 fw-semibold mt-1">Support Client</span>
      </NavLink>
      
      <hr className="text-secondary mt-0 mb-3 opacity-25" />
      
      <Nav className="flex-column mb-auto gap-1">
        <span className="text-uppercase text-secondary fw-bold mb-2 px-3 mt-2" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
          Tableau de bord
        </span>
        
        {userRole === 'client' && (
          <Nav.Link as={NavLink} to="/" end className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
            <LayoutDashboard size={18} className="me-3 opacity-75" />
            Mes Tickets
          </Nav.Link>
        )}
        {userRole === 'manager' && (
          <>
            <Nav.Link as={NavLink} to="/manager" end className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <LayoutDashboard size={18} className="me-3 opacity-75" />
              Gestion des Tickets
            </Nav.Link>
            <Nav.Link as={NavLink} to="/manager/new-ticket" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <PlusCircle size={18} className="me-3 opacity-75" />
              Nouveau ticket interne
            </Nav.Link>
            <Nav.Link as={NavLink} to="/kanban" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <Code size={18} className="me-3 opacity-75" />
              Développement
            </Nav.Link>
          </>
        )}
        {userRole === 'developer' && (
          <>
            <Nav.Link as={NavLink} to="/dev" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <LayoutDashboard size={18} className="me-3 opacity-75" />
              Mes Tickets
            </Nav.Link>
            <Nav.Link as={NavLink} to="/kanban" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <Code size={18} className="me-3 opacity-75" />
              Développement
            </Nav.Link>
          </>
        )}
        
        {userRole === 'manager' && (
          <>
            <span className="text-uppercase text-secondary fw-bold mb-2 px-3 mt-4" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
              Administration
            </span>
            <Nav.Link as={NavLink} to="/admin/users" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <Shield size={18} className="me-3 opacity-75" />
              Utilisateurs
            </Nav.Link>
            <Nav.Link as={NavLink} to="/admin/add-client" className="text-white d-flex align-items-center rounded px-3 py-2 sidebar-nav-link border-0" onClick={handleClose}>
              <UserPlus size={18} className="me-3 opacity-75" />
              Ajouter Compte
            </Nav.Link>
          </>
        )}
      </Nav>

      <div className="mt-auto">
        <hr className="text-secondary opacity-25" />
        <NavDropdown
          title={
            <div className="d-flex align-items-center text-white p-2 rounded sidebar-user-btn" style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}>
              {currentUser?.photoBase64 || currentUser?.photoURL ? (
                <img
                  src={currentUser.photoBase64 || currentUser.photoURL}
                  alt="Avatar"
                  className="rounded-circle me-3"
                  style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="rounded-circle bg-primary d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                  style={{ width: '36px', height: '36px' }}
                >
                  <span className="text-white fw-bold fs-6">
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="d-flex flex-column text-start" style={{ lineHeight: '1.2' }}>
                  <span className="fw-semibold text-truncate" style={{ maxWidth: '160px', fontSize: '0.9rem' }}>{getUserDisplayName()}</span>
                  <span className="text-secondary mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                    <RoleIcon size={12} /> {roleBadge.text}
                  </span>
              </div>
            </div>
          }
          id="user-dropdown-sidebar"
          drop="up"
          className="sidebar-user-dropdown border-0"
        >
          <NavDropdown.Item as={NavLink} to="/mon-compte" onClick={handleClose} className="d-flex align-items-center py-2">
            <User size={16} className="me-3 text-secondary" />
            Mon compte
          </NavDropdown.Item>
          <NavDropdown.Divider />
          <NavDropdown.Item onClick={handleLogout} className="text-danger d-flex align-items-center py-2">
            <LogOut size={16} className="me-3" />
            Déconnexion
          </NavDropdown.Item>
        </NavDropdown>
      </div>
    </div>
  );

  const mobileHeight = isAndroid ? 'calc(60px + max(env(safe-area-inset-top), 45px))' : 'calc(60px + env(safe-area-inset-top))';
  const mobilePadding = isAndroid ? 'calc(0.5rem + max(env(safe-area-inset-top), 45px))' : 'calc(0.5rem + env(safe-area-inset-top))';

  return (
    <>
      {/* ----------- MOBILE TOP BAR ----------- */}
      <div className="d-lg-none bg-dark p-2 d-flex justify-content-between align-items-center w-100 position-fixed top-0 z-3" style={{ height: mobileHeight, paddingTop: mobilePadding }}>
        <div className="d-flex align-items-center text-white px-2 mt-auto mb-auto">
          <img src="/logo36x36.png" alt="Logo" className="me-2" style={{ width: '28px' }} />
          <span className="fw-semibold fs-5">Support</span>
        </div>
        <Button variant="link" onClick={handleShow} className="text-white p-0 px-2 me-1 mt-auto mb-auto">
          <Menu size={28} />
        </Button>
      </div>
      
      {/* Espace vide pour descendre le contenu sous la topbar mobile */}
      <div className="d-lg-none w-100 flex-shrink-0" style={{ height: mobileHeight }}></div>

      {/* ----------- DESKTOP SIDEBAR ----------- */}
      <div className="d-none d-lg-block h-100 flex-shrink-0" style={{ width: '280px' }}>
        <SidebarContent />
      </div>

      {/* ----------- MOBILE OFFCANVAS ----------- */}
      <Offcanvas show={showSidebar} onHide={handleClose} placement="start" className="bg-dark text-white border-end-0" style={{ width: '280px' }}>
        <Offcanvas.Body className="p-0 overflow-hidden d-flex flex-column h-100">
          <SidebarContent />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}