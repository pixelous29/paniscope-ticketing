import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, InputGroup, Alert } from 'react-bootstrap';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Building, Globe, Upload } from 'lucide-react';
import { resizeImage } from '../../utils/imageResize';

export default function CompanyDomainModal({ show, onHide, user, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    companyDomain: '',
    companyLogoBase64: ''
  });

  // Charger les données de la compagnie s'il y a déjà un domaine, ou utiliser les infos du user
  useEffect(() => {
    if (show && user) {
      if (user.companyDomain) {
        fetchCompanyData(user.companyDomain);
      } else {
        setFormData({
          companyName: user.company || '',
          companyDomain: '',
          companyLogoBase64: ''
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, user]);

  const fetchCompanyData = async (domain) => {
    try {
      setLoading(true);
      const companyDoc = await getDoc(doc(db, 'companies', domain));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setFormData({
          companyName: data.name || user.company || '',
          companyDomain: domain,
          companyLogoBase64: data.logoBase64 || ''
        });
      } else {
        // Le domaine est renseigné sur l'utilisateur mais la compagnie n'existe pas encore en base
        setFormData({
          companyName: user.company || '',
          companyDomain: domain,
          companyLogoBase64: ''
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la compagnie:', error);
      toast.error('Erreur lors du chargement des informations de la société');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainChange = async (e) => {
    let domain = e.target.value.toLowerCase().trim();
    // Enlever le http://, https://, www. ou @ s'ils ont été collés
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/^@/, '');
    
    setFormData(prev => ({ ...prev, companyDomain: domain }));
    
    // Si un domaine est saisi, on tente de voir si une boîte existe déjà pour préremplir le logo/nom
    if (domain.includes('.')) {
        try {
            const companyDoc = await getDoc(doc(db, 'companies', domain));
            if (companyDoc.exists()) {
                const data = companyDoc.data();
                setFormData(prev => ({
                    ...prev,
                    companyName: data.name || prev.companyName,
                    companyLogoBase64: data.logoBase64 || prev.companyLogoBase64
                }));
            }
        } catch (error) {
            console.error("Erreur domaine: ", error);
        }
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const resizedBase64 = await resizeImage(file, 200, 200);
        setFormData(prev => ({ ...prev, companyLogoBase64: resizedBase64 }));
      } catch (error) {
        console.error("Erreur de l'image:", error);
        toast.error("Format d'image non supporté ou image invalide.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const domain = formData.companyDomain.toLowerCase().trim();
      
      // 1. Mise à jour ou création de la compagnie dans la collection `companies` si un domaine est fourni
      if (domain) {
        const companyRef = doc(db, 'companies', domain);
        await setDoc(companyRef, {
            name: formData.companyName,
            domain: domain,
            logoBase64: formData.companyLogoBase64,
            updatedAt: new Date()
        }, { merge: true });
      }

      // 2. Mise à jour de l'utilisateur
      const userRef = doc(db, 'users', user.id);
      const userUpdates = {
        company: formData.companyName, // Pour retro-compatibilité et affichage rapide
        companyDomain: domain || null // Null si on retire le domaine
      };
      
      await updateDoc(userRef, userUpdates);

      toast.success('Informations de la société mises à jour');
      if (onUpdate) {
        onUpdate(user.id, { ...userUpdates });
      }
      onHide();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Building className="me-2 text-primary" size={24} />
          Société & Domaine d'assistance
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info" className="small">
            Liez ce client à un nom de domaine (ex: <strong>entreprise.fr</strong>) 
            pour qu'il puisse voir tous les tickets de sa société, et que les futurs 
            emails de ce domaine soient automatiquement rattachés à cette entreprise.
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Nom de la société</Form.Label>
            <InputGroup>
              <InputGroup.Text><Building size={18} /></InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Ex : Antoinette Pain & Brioche"
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              />
            </InputGroup>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Domaine de rattachement (optionnel)</Form.Label>
            <InputGroup>
              <InputGroup.Text><Globe size={18} /></InputGroup.Text>
              <Form.Control
                type="text"
                value={formData.companyDomain}
                onChange={handleDomainChange}
              />
            </InputGroup>
            <Form.Text className="text-muted">
              Saisissez uniquement le domaine sans le @ (ex: monentreprise.com).
            </Form.Text>
          </Form.Group>

          {formData.companyDomain && (
              <Form.Group className="mb-3">
                <Form.Label>Logo de la société</Form.Label>
                <div className="d-flex align-items-center gap-3">
                    {formData.companyLogoBase64 ? (
                        <div className="position-relative">
                            <img 
                                src={formData.companyLogoBase64} 
                                alt="Logo" 
                                style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }} 
                            />
                            <Button 
                                variant="danger" 
                                size="sm" 
                                className="position-absolute top-0 start-100 translate-middle rounded-circle p-1"
                                style={{ width: '24px', height: '24px', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setFormData({...formData, companyLogoBase64: ''})}
                            >
                                &times;
                            </Button>
                        </div>
                    ) : (
                        <div 
                            style={{ width: '60px', height: '60px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ced4da' }}
                            className="d-flex align-items-center justify-content-center text-muted"
                        >
                            <Building size={24} opacity={0.5} />
                        </div>
                    )}
                    <div className="flex-grow-1">
                        <Form.Control 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload}
                            size="sm"
                        />
                    </div>
                </div>
              </Form.Group>
          )}

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
