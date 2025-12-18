import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Container, Spinner, Alert } from 'react-bootstrap';

export default function RoleBasedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <Alert.Heading>Accès refusé</Alert.Heading>
          <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </Alert>
      </Container>
    );
  }

  return children;
}
