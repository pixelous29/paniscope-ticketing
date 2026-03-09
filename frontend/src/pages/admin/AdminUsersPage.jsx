import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Container, Card, Table, Form, Button, Spinner, Alert, Badge, OverlayTrigger, Tooltip, Stack } from 'react-bootstrap';
import { Shield, User, Code, Check, X, Clock, Copy, Building, Edit2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import CompanyDomainModal from '../../components/admin/CompanyDomainModal';

// Email du super admin protégé : ne peut être ni bloqué, ni révoqué, ni modifié
const SUPER_ADMIN_EMAIL = 'yves@paniscope.fr';

const truncateText = (text, maxLength = 20) => {
  if (!text) return { text: '', isTruncated: false };
  if (text.length > maxLength) {
    return { text: text.substring(0, maxLength) + '...', isTruncated: true };
  }
  return { text, isTruncated: false };
};

const styles = `
  .company-cell-interactive {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .company-cell-interactive:hover {
    background-color: rgba(13, 110, 253, 0.08) !important;
  }
`;

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [temporaryPasswords, setTemporaryPasswords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [selectedUserForCompany, setSelectedUserForCompany] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCompanyUpdate = (userId, updatedData) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, company: updatedData.company, companyDomain: updatedData.companyDomain } : u
    ));
  };

  const fetchUsers = async () => {
    try {
      const [usersSnapshot, tempPwdSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'temporaryPasswords'))
      ]);
      
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const tempPwdData = {};
      tempPwdSnapshot.docs.forEach(doc => {
        tempPwdData[doc.id] = doc.data().password;
      });

      setUsers(usersData);
      setTemporaryPasswords(tempPwdData);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de la récupération des utilisateurs:', err);
      setError('Impossible de charger les utilisateurs');
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast.success('Rôle mis à jour avec succès');
    } catch (err) {
      console.error('Erreur lors de la mise à jour du rôle:', err);
      toast.error('Erreur lors de la mise à jour du rôle');
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus
      });
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      const statusText = newStatus === 'approved' ? 'approuvé' : 'rejeté';
      toast.success(`Compte ${statusText} avec succès`);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      client: { icon: User, variant: 'primary', text: 'Client' },
      manager: { icon: Shield, variant: 'warning', text: 'Manager' },
      developer: { icon: Code, variant: 'info', text: 'Développeur' }
    };
    return badges[role] || badges.client;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, variant: 'warning', text: 'En attente' },
      approved: { icon: Check, variant: 'success', text: 'Approuvé' },
      rejected: { icon: X, variant: 'danger', text: 'Rejeté' }
    };
    return badges[status] || badges.pending;
  };

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true;
    return user.status === filter;
  }).sort((a, b) => {
    if (a.email === SUPER_ADMIN_EMAIL) return -1;
    if (b.email === SUPER_ADMIN_EMAIL) return 1;
    
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return dateB - dateA;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mot de passe copié !');
    } catch (err) {
      console.error('Erreur de copie:', err);
      toast.error('Erreur lors de la copie');
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center mt-5">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <style>{styles}</style>
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">
              <Shield size={24} className="me-2" />
              Gestion des utilisateurs
            </h4>
            {pendingCount > 0 && (
              <Badge bg="warning" text="dark">
                {pendingCount} en attente
              </Badge>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <Alert variant="info">
            <strong>Note:</strong> Approuvez les nouveaux comptes et modifiez les rôles des utilisateurs pour contrôler leurs accès à l'application.
          </Alert>

          <div className="mb-3">
            <Form.Label htmlFor="statusFilter">Filtrer par statut :</Form.Label>
            <Form.Select id="statusFilter" name="statusFilter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: '200px' }}>
              <option value="all">Tous les utilisateurs</option>
              <option value="pending">En attente ({users.filter(u => u.status === 'pending').length})</option>
              <option value="approved">Approuvés ({users.filter(u => u.status === 'approved').length})</option>
              <option value="rejected">Rejetés ({users.filter(u => u.status === 'rejected').length})</option>
            </Form.Select>
          </div>
          
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Société</th>
                <th>Email</th>
                <th>Dernière connexion</th>
                <th>Statut</th>
                <th>Rôle</th>
                <th>Actions</th>
                <th>Création</th>
                <th style={{ width: '1%', textAlign: 'center', lineHeight: '1.2' }} className="align-middle">Accès<br />provisoire</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const roleBadge = getRoleBadge(user.role);
                const statusBadge = getStatusBadge(user.status || 'approved');
                const RoleIcon = roleBadge.icon;
                const StatusIcon = statusBadge.icon;
                const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
                const isEditableCompany = user.role === 'client' && !isSuperAdmin;
                
                return (
                  <tr key={user.id}>
                    <td className="align-middle">
                      <div className="d-flex align-items-center">
                        {(user.photoBase64 || user.photoURL) ? (
                          <img
                            src={user.photoBase64 || user.photoURL}
                            alt="Avatar"
                            className="rounded-circle me-2"
                            referrerPolicy="no-referrer"
                            style={{ width: '32px', height: '32px' }}
                          />
                        ) : (
                          <div
                            className="rounded-circle bg-secondary d-flex align-items-center justify-content-center me-2"
                            style={{ width: '32px', height: '32px', minWidth: '32px' }}
                          >
                            <span className="text-white fw-bold">
                              {user.lastName?.charAt(0).toUpperCase() || user.displayName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                        <span className="fw-bold">
                          {user.firstName || ''} {user.lastName || (user.displayName ? user.displayName : 'Sans nom')}
                        </span>
                      </div>
                    </td>
                    <td 
                      className={`align-middle ${isEditableCompany ? 'company-cell-interactive' : ''}`}
                      onClick={isEditableCompany ? () => {
                        setSelectedUserForCompany(user);
                        setShowCompanyModal(true);
                      } : undefined}
                      title={isEditableCompany ? "Cliquez pour modifier la société" : undefined}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <div className="d-flex flex-column">
                        {user.company ? (
                          (() => {
                            const { text, isTruncated } = truncateText(user.company, 20);
                            const content = <span className="fw-medium">{text}</span>;
                            return isTruncated ? (
                              <OverlayTrigger
                                placement="top"
                                delay={{ show: 1000, hide: 0 }}
                                overlay={<Tooltip id={`tooltip-comp-${user.id}`}>{user.company}</Tooltip>}
                              >
                                {content}
                              </OverlayTrigger>
                            ) : content;
                          })()
                        ) : (
                          <span className="text-muted fst-italic">Non renseignée</span>
                        )}
                        
                        {user.companyDomain && (
                          (() => {
                            const { text, isTruncated } = truncateText(user.companyDomain, 20);
                            const content = (
                              <div className="text-muted small mt-1">
                                <Globe size={12} className="me-1" style={{ display: 'inline', verticalAlign: 'text-bottom' }} />
                                {text}
                              </div>
                            );
                            return isTruncated ? (
                              <OverlayTrigger
                                placement="top"
                                delay={{ show: 1000, hide: 0 }}
                                overlay={<Tooltip id={`tooltip-dom-${user.id}`}>{user.companyDomain}</Tooltip>}
                              >
                                {content}
                              </OverlayTrigger>
                            ) : content;
                          })()
                        )}
                      </div>
                    </td>
                    <td className="align-middle" style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>
                      {(() => {
                        const { text, isTruncated } = truncateText(user.email, 25);
                        const content = <span>{text}</span>;
                        return isTruncated ? (
                          <OverlayTrigger
                            placement="top"
                            delay={{ show: 1000, hide: 0 }}
                            overlay={<Tooltip id={`tooltip-email-${user.id}`}>{user.email}</Tooltip>}
                          >
                            {content}
                          </OverlayTrigger>
                        ) : content;
                      })()}
                    </td>
                    <td className="align-middle">
                      {user.lastConnection ? (
                        <>
                          <div>{user.lastConnection.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                          <div className="text-muted small">{user.lastConnection.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </>
                      ) : (
                        <span className="text-muted fst-italic">Jamais</span>
                      )}
                    </td>

                    <td className="align-middle">
                      <Badge bg={statusBadge.variant} className="text-nowrap">
                        <StatusIcon size={14} className="me-1" />
                        {statusBadge.text}
                      </Badge>
                    </td>
                    <td className="align-middle">
                      {isSuperAdmin ? (
                        <Badge bg={roleBadge.variant} className="text-nowrap">
                          <RoleIcon size={14} className="me-1" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Form.Select
                          id={`role-select-${user.id}`}
                          name={`role-select-${user.id}`}
                          aria-label={`Modifier le rôle de ${user.displayName || 'cet utilisateur'}`}
                          size="sm"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          style={{ minWidth: '110px' }}
                        >
                          <option value="client">Client</option>
                          <option value="manager">Manager</option>
                          <option value="developer">Développeur</option>
                        </Form.Select>
                      )}
                    </td>
                    <td className="align-middle">
                      {isSuperAdmin ? (
                        <span className="text-muted fst-italic">—</span>
                      ) : (
                        <div className="d-flex gap-1 flex-nowrap">
                          {user.status === 'pending' && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleStatusChange(user.id, 'approved')}
                                title="Approuver"
                                className="text-nowrap"
                              >
                                <Check size={16} />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleStatusChange(user.id, 'rejected')}
                                title="Rejeter"
                                className="text-nowrap"
                              >
                                <X size={16} />
                              </Button>
                            </>
                          )}
                          {user.status === 'approved' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="text-nowrap d-flex align-items-center"
                              onClick={() => handleStatusChange(user.id, 'rejected')}
                              title="Bloquer"
                            >
                              <X size={16} className="me-1" />
                              Bloquer
                            </Button>
                          )}
                          {user.status === 'rejected' && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="text-nowrap d-flex align-items-center"
                              onClick={() => handleStatusChange(user.id, 'approved')}
                              title="Réactiver"
                            >
                              <Check size={16} className="me-1" />
                              Réactiver
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="align-middle">
                      {user.createdAt?.toDate ? 
                        (
                          <span className="text-nowrap">{user.createdAt.toDate().toLocaleDateString('fr-FR')}</span>
                        ) : 
                        'Date inconnue'
                      }
                    </td>
                    <td className="align-middle text-center" style={{ width: '1%', whiteSpace: 'nowrap' }}>
                      {temporaryPasswords[user.id] ? (
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Copier le mot de passe généré</Tooltip>}
                        >
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            className="text-nowrap"
                            onClick={() => copyToClipboard(temporaryPasswords[user.id])}
                          >
                            <Copy size={14} className="me-1" />
                            Copier
                          </Button>
                        </OverlayTrigger>
                      ) : (
                        <span className="text-muted fst-italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {filteredUsers.length === 0 && (
            <Alert variant="info" className="text-center">
              Aucun utilisateur trouvé pour ce filtre
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Modale d'édition de la société */}
      <CompanyDomainModal
        show={showCompanyModal}
        onHide={() => {
          setShowCompanyModal(false);
          setSelectedUserForCompany(null);
        }}
        user={selectedUserForCompany}
        onUpdate={handleCompanyUpdate}
      />
    </Container>
  );
}
