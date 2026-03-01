import React from 'react';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User, Shield, Code } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AppNavbar() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();

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

  // Ne pas afficher la navbar sur les pages d'authentification
  if (!currentUser) {
    return null;
  }

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

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
          <img
            src="/logo36x36.png"
            alt="Support Paniscope logo"
            className="navbar-logo me-2"
          />
          Support Paniscope
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {userRole === 'client' && (
              <Nav.Link as={NavLink} to="/" end>
                <User size={16} className="me-1" />
                Mes Tickets
              </Nav.Link>
            )}
            {userRole === 'manager' && (
              <Nav.Link as={NavLink} to="/manager">
                <Shield size={16} className="me-1" />
                Gestion
              </Nav.Link>
            )}
            {userRole === 'developer' && (
              <Nav.Link as={NavLink} to="/dev">
                <Code size={16} className="me-1" />
                Développement
              </Nav.Link>
            )}
          </Nav>
          <Nav>
            <NavDropdown
              title={
                <span className="d-inline-flex align-items-center">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="rounded-circle me-2"
                      style={{ width: '32px', height: '32px' }}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-primary d-flex align-items-center justify-content-center me-2"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <span className="text-white fw-bold">
                        {getUserDisplayName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-white">{getUserDisplayName()}</span>
                </span>
              }
              id="user-dropdown"
              align="end"
            >
              <NavDropdown.Item disabled>
                <RoleIcon size={16} className="me-2" />
                {roleBadge.text}
              </NavDropdown.Item>
              <NavDropdown.Divider />
              {userRole === 'manager' && (
                <>
                  <NavDropdown.Item as={NavLink} to="/admin/users">
                    <Shield size={16} className="me-2" />
                    Gestion des utilisateurs
                  </NavDropdown.Item>
                  <NavDropdown.Divider />
                </>
              )}
              <NavDropdown.Item as={NavLink} to="/mon-compte">
                <User size={16} className="me-2" />
                Mon compte
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <LogOut size={16} className="me-2" />
                Déconnexion
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}