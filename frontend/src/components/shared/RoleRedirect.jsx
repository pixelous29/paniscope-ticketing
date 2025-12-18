import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Container, Spinner } from 'react-bootstrap';

export default function RoleRedirect() {
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" />
      </Container>
    );
  }

  // Redirection selon le rôle
  if (userRole === 'manager') {
    return <Navigate to="/manager" replace />;
  } else if (userRole === 'developer') {
    return <Navigate to="/dev" replace />;
  } else {
    // Client par défaut
    return <Navigate to="/client" replace />;
  }
}
