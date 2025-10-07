// Ce fichier centralise toutes nos données fictives pour l'application.
export const mockAllTickets = [
  {
    id: 'TICKET-001',
    subject: 'Problème de connexion à l\'application',
    client: 'Client A (ACME Corp)',
    status: 'En cours',
    priority: 'Haute',
    assignedTo: 'Yves',
    description: 'Les utilisateurs de notre filiale de Lyon ne peuvent plus se connecter depuis ce matin.',
    submittedAt: '2024-10-29 09:30:00',
    tags: ['Authentification', 'Backend'],
    conversation: [
        { author: 'Client A', text: 'Les utilisateurs de notre filiale de Lyon ne peuvent plus se connecter depuis ce matin.', timestamp: '2024-10-29 09:30:00' }
    ]
  },
  {
    id: 'TICKET-002',
    subject: 'Module de facturation lent',
    client: 'Client C (Wayne Ent.)',
    status: 'Nouveau',
    priority: 'Critique',
    assignedTo: null,
    description: 'Bonjour, depuis la dernière mise à jour, la génération des factures mensuelles prend plus de 5 minutes, alors qu\'elle était quasi instantanée avant. Pouvez-vous regarder ? Merci.',
    submittedAt: '2024-10-28 10:15:00',
    tags: ['Performance', 'Backend'],
    conversation: [
        { author: 'Client C', text: 'Bonjour, depuis la dernière mise à jour...', timestamp: '2024-10-28 10:15:00' }
    ]
  },
  {
    id: 'TICKET-003',
    subject: 'Erreur lors de l\'export des données',
    client: 'Client B (Stark Ind.)',
    status: 'Nouveau',
    priority: 'Normale',
    assignedTo: null,
    description: 'L\'export CSV des ventes du mois dernier génère une erreur 500.',
    submittedAt: '2024-10-29 11:00:00',
    tags: ['Export', 'Frontend'],
    conversation: [
        { author: 'Client B', text: 'L\'export CSV des ventes du mois dernier génère une erreur 500.', timestamp: '2024-10-29 11:00:00' }
    ]
  },
  // ... ajouter d'autres tickets si besoin
];
