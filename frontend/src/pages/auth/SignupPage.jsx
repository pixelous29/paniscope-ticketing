import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';

import { Mail, Lock, User, UserPlus, Briefcase } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const signupSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  company: z.string().min(2, 'La société doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
});

export default function SignupPage() {
  const { signup, signInWithGoogle, currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema)
  });

  // Rediriger si l'utilisateur est déjà connecté
  useEffect(() => {
    if (!loading && currentUser) {
      navigate('/');
    }
  }, [currentUser, loading, navigate]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    
    try {
      await signup(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company
      });
      toast.success('Compte créé avec succès !');
      // La redirection se fera automatiquement (vers pending-approval ou dashboard)
      // Note: on ne réinitialise pas isLoading ici car la redirection va se faire
    } catch (err) {
      console.error('Erreur d\'inscription:', err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible');
      } else {
        setError('Une erreur est survenue lors de l\'inscription');
      }
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await signInWithGoogle();
      toast.success('Compte créé avec succès !');
      // La redirection se fera automatiquement (vers pending-approval ou dashboard)
      // Note: on ne réinitialise pas isLoading ici car la redirection va se faire
    } catch (err) {
      console.error('Erreur de connexion Google:', err);
      setError('Erreur lors de la connexion avec Google');
      setIsLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '450px' }}>
        <Card className="shadow-lg">
          <Card.Body className="p-5">
            <div className="text-center mb-4">
              <img
                src="/logo36x36.png"
                alt="Support Paniscope"
                style={{ width: '64px', height: '64px', marginBottom: '1rem' }}
              />
              <h2 className="fw-bold">Créer un compte</h2>
              <p className="text-muted">Rejoignez notre plateforme de support</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit(onSubmit)}>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3" controlId="signupFirstName">
                    <Form.Label>
                      <User size={16} className="me-2" />
                      Prénom
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Jean"
                      {...register('firstName')}
                      isInvalid={!!errors.firstName}
                      autoComplete="given-name"
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.firstName?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3" controlId="signupLastName">
                    <Form.Label>
                      <User size={16} className="me-2" />
                      Nom
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Dupont"
                      {...register('lastName')}
                      isInvalid={!!errors.lastName}
                      autoComplete="family-name"
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.lastName?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              <Form.Group className="mb-3" controlId="signupCompany">
                <Form.Label>
                  <Briefcase size={16} className="me-2" />
                  Société
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Nom de votre société"
                  {...register('company')}
                  isInvalid={!!errors.company}
                  autoComplete="organization"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.company?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3" controlId="signupEmail">
                <Form.Label>
                  <Mail size={16} className="me-2" />
                  Email
                </Form.Label>
                <Form.Control
                  type="email"
                  placeholder="votre@email.com"
                  {...register('email')}
                  isInvalid={!!errors.email}
                  autoComplete="email"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.email?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3" controlId="signupPassword">
                <Form.Label>
                  <Lock size={16} className="me-2" />
                  Mot de passe
                </Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  isInvalid={!!errors.password}
                  autoComplete="new-password"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.password?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-4" controlId="signupConfirmPassword">
                <Form.Label>
                  <Lock size={16} className="me-2" />
                  Confirmer le mot de passe
                </Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  isInvalid={!!errors.confirmPassword}
                  autoComplete="new-password"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.confirmPassword?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <div className="d-grid gap-2">
                <Button 
                  variant="primary" 
                  type="submit" 
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} className="me-2" />
                      Créer mon compte
                    </>
                  )}
                </Button>

                <div className="position-relative my-3">
                  <hr />
                  <span 
                    className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted"
                    style={{ fontSize: '0.875rem' }}
                  >
                    OU
                  </span>
                </div>

                <Button
                  variant="outline-secondary"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    alt="Google"
                    style={{ width: '18px', marginRight: '8px' }}
                  />
                  Continuer avec Google
                </Button>
              </div>
            </Form>

            <div className="text-center mt-4">
              <p className="text-muted mb-0">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-decoration-none fw-bold">
                  Se connecter
                </Link>
              </p>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
