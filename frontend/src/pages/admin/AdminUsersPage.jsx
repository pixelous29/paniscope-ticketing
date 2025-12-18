import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Container, Card, Table, Form, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { Shield, User, Code, Check, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
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
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

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
            <Form.Label>Filtrer par statut :</Form.Label>
            <Form.Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: '200px' }}>
              <option value="all">Tous les utilisateurs</option>
              <option value="pending">En attente ({users.filter(u => u.status === 'pending').length})</option>
              <option value="approved">Approuvés ({users.filter(u => u.status === 'approved').length})</option>
              <option value="rejected">Rejetés ({users.filter(u => u.status === 'rejected').length})</option>
            </Form.Select>
          </div>
          
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Rôle actuel</th>
                <th>Modifier le rôle</th>
                <th>Actions</th>
                <th>Date de création</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const roleBadge = getRoleBadge(user.role);
                const statusBadge = getStatusBadge(user.status || 'approved');
                const RoleIcon = roleBadge.icon;
                const StatusIcon = statusBadge.icon;
                
                return (
                  <tr key={user.id}>
                    <td className="align-middle">
                      <div className="d-flex align-items-center">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt="Avatar"
                            className="rounded-circle me-2"
                            style={{ width: '32px', height: '32px' }}
                          />
                        ) : (
                          <div
                            className="rounded-circle bg-secondary d-flex align-items-center justify-content-center me-2"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <span className="text-white fw-bold">
                              {user.displayName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                        <span>{user.displayName || 'Sans nom'}</span>
                      </div>
                    </td>
                    <td className="align-middle">{user.email}</td>
                    <td className="align-middle">
                      <Badge bg={statusBadge.variant}>
                        <StatusIcon size={14} className="me-1" />
                        {statusBadge.text}
                      </Badge>
                    </td>
                    <td className="align-middle">
                      <Badge bg={roleBadge.variant}>
                        <RoleIcon size={14} className="me-1" />
                        {roleBadge.text}
                      </Badge>
                    </td>
                    <td className="align-middle">
                      <Form.Select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        style={{ maxWidth: '200px' }}
                      >
                        <option value="client">Client</option>
                        <option value="manager">Manager</option>
                        <option value="developer">Développeur</option>
                      </Form.Select>
                    </td>
                    <td className="align-middle">
                      {user.status === 'pending' && (
                        <div className="d-flex gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleStatusChange(user.id, 'approved')}
                          >
                            <Check size={16} className="me-1" />
                            Approuver
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleStatusChange(user.id, 'rejected')}
                          >
                            <X size={16} className="me-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                      {user.status === 'approved' && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleStatusChange(user.id, 'rejected')}
                        >
                          <X size={16} className="me-1" />
                          Bloquer
                        </Button>
                      )}
                      {user.status === 'rejected' && (
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleStatusChange(user.id, 'approved')}
                        >
                          <Check size={16} className="me-1" />
                          Réactiver
                        </Button>
                      )}
                    </td>
                    <td className="align-middle">
                      {user.createdAt?.toDate ? 
                        user.createdAt.toDate().toLocaleDateString('fr-FR') : 
                        'Date inconnue'
                      }
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
    </Container>
  );
}
