import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { UserPlus, Mail, Lock, User, Briefcase, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function AddClientPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: ''
  });
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("L'image ne doit pas dépasser 2 Mo.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result);
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoBase64(null);
      setPhotoPreview(null);
    }
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
        photoBase64
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
                
                <Form.Group className="mb-3" controlId="photo">
                  <Form.Label>Photo / Avatar (optionnel)</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-muted border-end-0">
                      <ImageIcon size={18} />
                    </span>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="border-start-0"
                    />
                  </div>
                  {photoPreview && (
                    <div className="mt-2 text-center">
                      <img 
                        src={photoPreview} 
                        alt="Aperçu" 
                        className="rounded-circle object-fit-cover shadow-sm" 
                        style={{ width: '80px', height: '80px' }} 
                      />
                    </div>
                  )}
                </Form.Group>

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
