import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleBasedRoute from '../components/shared/RoleBasedRoute';
import * as useAuthModule from '../hooks/useAuth';

// Mock du hook useAuth
vi.mock('../hooks/useAuth');

// Mock de react-router-dom Navigate
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="navigate-mock">Redirected to {to}</div>
}));

describe('RoleBasedRoute - Validation des règles d\'accès', () => {
  it('bloque l\'accès au Client sur les routes Manager', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      currentUser: { uid: '123', email: 'client@example.com' },
      userRole: 'client',
      loading: false
    });

    render(
      <RoleBasedRoute allowedRoles={['manager']}>
        <div>Contenu Réserve Manager</div>
      </RoleBasedRoute>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu Réserve Manager')).not.toBeInTheDocument();
  });

  it('bloque l\'accès au Développeur sur les routes Manager', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      currentUser: { uid: '456', email: 'dev@example.com' },
      userRole: 'developer',
      loading: false
    });

    render(
      <RoleBasedRoute allowedRoles={['manager']}>
        <div>Contenu Réserve Manager</div>
      </RoleBasedRoute>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu Réserve Manager')).not.toBeInTheDocument();
  });

  it('bloque l\'accès au Manager sur les routes Développeur', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      currentUser: { uid: '789', email: 'manager@example.com' },
      userRole: 'manager',
      loading: false
    });

    render(
      <RoleBasedRoute allowedRoles={['developer']}>
        <div>Contenu Réserve Développeur</div>
      </RoleBasedRoute>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu Réserve Développeur')).not.toBeInTheDocument();
  });

  it('autorise l\'accès au Développeur sur les routes Développeur', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      currentUser: { uid: '456', email: 'dev@example.com' },
      userRole: 'developer',
      loading: false
    });

    render(
      <RoleBasedRoute allowedRoles={['developer']}>
        <div>Contenu Développeur OK</div>
      </RoleBasedRoute>
    );

    expect(screen.getByText('Contenu Développeur OK')).toBeInTheDocument();
  });

  it('autorise l\'accès au Manager sur les routes Manager', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      currentUser: { uid: '789', email: 'manager@example.com' },
      userRole: 'manager',
      loading: false
    });

    render(
      <RoleBasedRoute allowedRoles={['manager']}>
        <div>Contenu Manager OK</div>
      </RoleBasedRoute>
    );

    expect(screen.getByText('Contenu Manager OK')).toBeInTheDocument();
  });
});
