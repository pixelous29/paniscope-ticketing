import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { UserPlus, Mail, Lock, User, Briefcase, Eye, EyeOff } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function AddClientPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    company: ''
  });
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const functions = getFunctions();
    const createClientAccount = httpsCallable(functions, 'createClientAccount');

    try {
      const result = await createClientAccount({
        ...formData,
        sendWelcomeEmail
      });
      if (result.data.success) {
        toast.success(result.data.message);
        navigate('/admin/users');
      }
    } catch (err) {
      console.error('Erreur lors de la création du compte :', err);
      // Firebase functions usually pass the error message in err.message
      setError(err.message || 'Une erreur est survenue lors de la création du compte.');
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white border-bottom-0 pt-4 pb-0">
              <h2 className="fs-4 mb-0 fw-bold d-flex align-items-center">
                <UserPlus size={24} className="me-2 text-primary" />
                Ajouter un client
              </h2>
            </Card.Header>
            <Card.Body className="p-4">
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit} autoComplete="off">
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="firstName">
                      <Form.Label>Prénom *</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <User size={18} />
                        </span>
                        <Form.Control
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          placeholder="Prénom"
                          className="border-start-0"
                          required
                          autoComplete="off"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="lastName">
                      <Form.Label>Nom *</Form.Label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted border-end-0">
                          <User size={18} />
                        </span>
                        <Form.Control
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          placeholder="Nom"
                          className="border-start-0"
                          required
                          autoComplete="off"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3" controlId="company">
                  <Form.Label>Société</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-muted border-end-0">
                      <Briefcase size={18} />
                    </span>
                    <Form.Control
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder="Nom de la société (optionnel)"
                      className="border-start-0"
                      autoComplete="off"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="mb-3" controlId="email">
                  <Form.Label>Adresse email *</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-muted border-end-0">
                      <Mail size={18} />
                    </span>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="email@exemple.com"
                      className="border-start-0"
                      required
                      autoComplete="new-email"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="mb-4" controlId="password">
                  <Form.Label>Mot de passe provisoire *</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-muted border-end-0">
                      <Lock size={18} />
                    </span>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 6 caractères"
                      className="border-start-0 border-end-0"
                      required
                      minLength="6"
                      autoComplete="new-password"
                    />
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="border-start-0 d-flex align-items-center"
                      style={{ zIndex: 0 }}
                      tabIndex="-1"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  <Form.Text className="text-muted">
                    Le client pourra modifier ce mot de passe depuis son espace "Mon compte".
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4" controlId="sendWelcomeEmail">
                  <Form.Check 
                    type="checkbox"
                    label="Envoyer un email de bienvenue avec les identifiants au client"
                    checked={sendWelcomeEmail}
                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                    className="fw-medium text-primary"
                  />
                </Form.Group>

                <div className="d-flex justify-content-center gap-3 align-items-center">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                    className="fw-medium"
                  >
                    {loading ? 'Création en cours...' : 'Créer le compte client'}
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    type="button"
                    onClick={() => navigate('/admin/users')}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
