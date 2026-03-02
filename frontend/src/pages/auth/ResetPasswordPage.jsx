import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';

import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const resetSchema = z.object({
  email: z.string().email('Email invalide')
});

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetSchema)
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      await resetPassword(data.email);
      setSuccess(true);
      toast.success('Email de réinitialisation envoyé !');
    } catch (err) {
      console.error('Erreur de réinitialisation:', err);
      
      if (err.code === 'auth/user-not-found') {
        setError('Aucun compte associé à cet email');
      } else {
        setError('Une erreur est survenue lors de l\'envoi de l\'email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center px-3 px-md-0 py-3" style={{ minHeight: '100dvh' }}>
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
              <h4 className="fw-bold mb-0">Mot de passe oublié ?</h4>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && (
              <Alert variant="success">
                Un email de réinitialisation a été envoyé à votre adresse.
                Vérifiez votre boîte de réception (et vos spams).
              </Alert>
            )}

            {!success && (
              <Form onSubmit={handleSubmit(onSubmit)}>
                <Form.Group className="mb-4" controlId="resetEmail">
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
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Mail size={18} className="me-2" />
                        Envoyer le lien
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            )}

            <div className="text-center mt-4">
              <Link to="/login" className="text-decoration-none d-flex align-items-center justify-content-center">
                <ArrowLeft size={16} className="me-2" />
                Retour à la connexion
              </Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
