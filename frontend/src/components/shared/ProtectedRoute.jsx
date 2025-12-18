import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Container, Spinner } from 'react-bootstrap';

export default function ProtectedRoute({ children }) {
  const { currentUser, userStatus, loading } = useAuth();

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

  // Vérifier si le compte est approuvé
  if (userStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (userStatus === 'rejected') {
    return <Navigate to="/account-rejected" replace />;
  }

  return children;
}
