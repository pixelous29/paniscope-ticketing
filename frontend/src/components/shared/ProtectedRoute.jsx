import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Container, Spinner } from 'react-bootstrap';

export default function ProtectedRoute({ children, allowForcePasswordReset = false }) {
  const { currentUser, userStatus, needsPasswordReset, loading } = useAuth();

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

  // Redirection forcée si l'utilisateur doit réinitialiser son mot de passe
  if (needsPasswordReset && !allowForcePasswordReset) {
    return <Navigate to="/force-change-password" replace />;
  }

  // Redirection vers l'accueil si le reset n'est pas requis mais que l'utilisateur tente d'accéder à la page de reset
  if (!needsPasswordReset && allowForcePasswordReset) {
    return <Navigate to="/" replace />;
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
