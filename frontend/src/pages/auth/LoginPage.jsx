import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';

import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères')
});

export default function LoginPage() {
  const { login, currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
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
      await login(data.email, data.password);
      toast.success('Connexion réussie !');
      // La redirection se fera automatiquement via ProtectedRoute
      // Note: on ne réinitialise pas isLoading ici car la redirection va se faire
    } catch (err) {
      console.error('Erreur de connexion:', err);
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email ou mot de passe incorrect');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Veuillez réessayer plus tard.');
      } else {
        setError('Une erreur est survenue lors de la connexion');
      }
      setIsLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center px-3 px-md-0" style={{ minHeight: '100dvh' }}>
      <div style={{ width: '100%', maxWidth: '450px' }}>
        <Card className="shadow-sm shadow-md-lg border-0 border-md">
          <Card.Body className="p-4 p-md-5">
            <div className="text-center mb-4 mb-md-5">
              <h1 className="h2 fw-bold mb-4">Support Paniscope</h1>
              <img
                src="/pwa-192x192.png"
                alt="Support Paniscope Logo"
                style={{ width: '192px', height: 'auto', marginBottom: '2rem' }}
              />
              <h4 className="fw-bold mb-0">Connexion</h4>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit(onSubmit)}>
              <Form.Group className="mb-3" controlId="loginEmail">
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

              <Form.Group className="mb-3" controlId="loginPassword">
                <Form.Label>
                  <Lock size={16} className="me-2" />
                  Mot de passe
                </Form.Label>
                <div className="position-relative">
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    isInvalid={!!errors.password}
                    autoComplete="current-password"
                  />
                  <Button
                    variant="link"
                    className="position-absolute end-0 top-50 translate-middle-y text-muted p-0 me-3"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ zIndex: 5 }}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
                <Form.Control.Feedback type="invalid">
                  {errors.password?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <Form.Check type="checkbox" id="loginRememberMe" label="Se souvenir de moi" />
                <Link to="/reset-password" className="text-decoration-none">
                  Mot de passe oublié ?
                </Link>
              </div>

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
                      Connexion...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} className="me-2" />
                      Se connecter
                    </>
                  )}
                </Button>


              </div>
            </Form>

            <div className="text-center mt-4">
              <p className="text-muted mb-0">
                Pas encore de compte ?{' '}
                <Link to="/signup" className="text-decoration-none fw-bold">
                  S'inscrire
                </Link>
              </p>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
