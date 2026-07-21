import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useAuth } from '../../hooks/useAuth';
import { Lock, Eye, EyeOff, LogOut, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const passwordSchema = z.object({
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'Veuillez confirmer votre mot de passe')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
});

export default function ForceChangePasswordPage() {
  const { setPasswordResetCompleted, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema)
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Aucun utilisateur n'est connecté.");
      }

      // 1. Mettre à jour le mot de passe dans Firebase Auth
      await updatePassword(user, data.password);

      // 2. Mettre à jour le statut dans Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        needsPasswordReset: false
      });

      // 3. Notifier le context d'authentification
      setPasswordResetCompleted();

      toast.success('Votre mot de passe a été mis à jour avec succès !');
      
      // 4. Rediriger vers l'accueil
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Erreur lors du changement de mot de passe :', err);
      if (err.code === 'auth/requires-recent-login') {
        setError("Pour des raisons de sécurité, veuillez vous déconnecter et vous reconnecter avec votre mot de passe temporaire pour effectuer cette action.");
      } else {
        setError(err.message || 'Une erreur est survenue lors de la mise à jour de votre mot de passe.');
      }
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Erreur lors de la déconnexion :', err);
      toast.error('Impossible de se déconnecter');
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center px-3 px-md-0" style={{ minHeight: '100dvh' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <Card className="shadow-sm border-0 animate-fade-in">
          <Card.Body className="p-4 p-md-5">
            <div className="text-center mb-4">
              <h1 className="h2 fw-bold mb-4">Sécurité</h1>
              <img
                src="/pwa-192x192.png"
                alt="Logo Paniscope"
                style={{ width: '128px', height: 'auto', marginBottom: '1.5rem' }}
              />
              <h4 className="fw-bold mb-2">Définir votre mot de passe</h4>
              <p className="text-muted small text-center px-2">
                Un mot de passe temporaire vous a été attribué. Pour accéder au support, veuillez définir un nouveau mot de passe sécurisé.
              </p>
            </div>

            {error && <Alert variant="danger" className="small">{error}</Alert>}

            <Form onSubmit={handleSubmit(onSubmit)}>
              <Form.Group className="mb-3" controlId="newPassword">
                <Form.Label className="small fw-semibold text-start w-100 d-block">
                  <Lock size={14} className="me-2" />
                  Nouveau mot de passe
                </Form.Label>
                <div className="position-relative">
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Au moins 6 caractères"
                    {...register('password')}
                    isInvalid={!!errors.password}
                  />
                  <button
                    type="button"
                    className="btn position-absolute top-50 end-0 translate-middle-y border-0 pe-3"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} className="text-muted" /> : <Eye size={18} className="text-muted" />}
                  </button>
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                </div>
              </Form.Group>

              <Form.Group className="mb-4" controlId="confirmPassword">
                <Form.Label className="small fw-semibold text-start w-100 d-block">
                  <Lock size={14} className="me-2" />
                  Confirmer le mot de passe
                </Form.Label>
                <div className="position-relative">
                  <Form.Control
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Saisissez à nouveau le mot de passe"
                    {...register('confirmPassword')}
                    isInvalid={!!errors.confirmPassword}
                  />
                  <button
                    type="button"
                    className="btn position-absolute top-50 end-0 translate-middle-y border-0 pe-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} className="text-muted" /> : <Eye size={18} className="text-muted" />}
                  </button>
                  <Form.Control.Feedback type="invalid">
                    {errors.confirmPassword?.message}
                  </Form.Control.Feedback>
                </div>
              </Form.Group>

              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isLoading}
                  className="d-flex align-items-center justify-content-center py-2"
                >
                  {isLoading ? 'Enregistrement...' : (
                    <>
                      <Check size={18} className="me-2" />
                      Enregistrer et Continuer
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline-secondary"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="d-flex align-items-center justify-content-center py-2 mt-2"
                >
                  <LogOut size={16} className="me-2" />
                  Se déconnecter
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
