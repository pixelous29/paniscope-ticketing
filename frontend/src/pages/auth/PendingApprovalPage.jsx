import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Alert, Button } from 'react-bootstrap';
import { Clock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function PendingApprovalPage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <Card className="shadow-lg">
          <Card.Body className="p-5 text-center">
            <div className="mb-4">
              <Clock size={64} className="text-warning mb-3" />
              <h2 className="fw-bold">Compte en attente d'approbation</h2>
            </div>

            <Alert variant="info" className="text-start">
              <Alert.Heading>
                <Mail size={20} className="me-2" />
                Bienvenue !
              </Alert.Heading>
              <p className="mb-0">
                Votre compte a été créé avec succès. Un administrateur doit maintenant approuver votre compte 
                et vous attribuer les permissions appropriées avant que vous puissiez accéder à l'application.
              </p>
            </Alert>

            <div className="bg-light p-4 rounded mb-4">
              <h5 className="mb-3">Informations de votre compte</h5>
              <div className="text-start">
                <p className="mb-2">
                  <strong>Email :</strong> {currentUser?.email}
                </p>
                <p className="mb-2">
                  <strong>Nom :</strong> {currentUser?.displayName}
                </p>
                <p className="mb-0">
                  <strong>Statut :</strong>{' '}
                  <span className="badge bg-warning text-dark">En attente d'approbation</span>
                </p>
              </div>
            </div>

            <Alert variant="secondary" className="text-start">
              <strong>Que faire maintenant ?</strong>
              <ul className="mb-0 mt-2">
                <li>Vous recevrez un email une fois votre compte approuvé</li>
                <li>Vous pourrez alors vous reconnecter et accéder à l'application</li>
                <li>Si vous avez des questions, contactez un administrateur</li>
              </ul>
            </Alert>

            <div className="d-grid gap-2 mt-4">
              <Button variant="outline-secondary" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
