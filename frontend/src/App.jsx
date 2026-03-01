import { Routes, Route, Navigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

import MainLayout from './layouts/MainLayout';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import ClientTicketDetailPage from './pages/client/ClientTicketDetailPage';
import NewTicketPage from './pages/client/NewTicketPage';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import ManagerTicketDetailPage from './pages/manager/ManagerTicketDetailPage';
import DeveloperDashboardPage from './pages/developer/DeveloperDashboardPage';
import DeveloperTicketDetailPage from './pages/developer/DeveloperTicketDetailPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import MyAccountPage from './pages/shared/MyAccountPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import UpdateNotification from './components/shared/UpdateNotification';
import RoleRedirect from './components/shared/RoleRedirect';
import ProtectedRoute from './components/shared/ProtectedRoute';
import RoleBasedRoute from './components/shared/RoleBasedRoute';

import ModalProvider from './contexts/ModalProvider';
import { AuthProvider } from './contexts/AuthProvider';

export default function App() {
  const {
    needRefresh: [needRefresh, _setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return (
    <AuthProvider>
      <ModalProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <UpdateNotification show={needRefresh} />
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />

          {/* Routes protégées */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            {/* Route racine - Redirection automatique selon le rôle */}
            <Route path="/" element={<RoleRedirect />} />
            
            {/* Route profil utilisateur */}
            <Route path="/mon-compte" element={<MyAccountPage />} />
            
            {/* Routes Client */}
            <Route 
              path="/client" 
              element={
                <RoleBasedRoute allowedRoles={['client', 'manager']}>
                  <ClientDashboardPage />
                </RoleBasedRoute>
              } 
            />
            <Route 
              path="/nouveau-ticket" 
              element={
                <RoleBasedRoute allowedRoles={['client', 'manager']}>
                  <NewTicketPage />
                </RoleBasedRoute>
              } 
            />
            <Route 
              path="/ticket/:ticketId" 
              element={
                <RoleBasedRoute allowedRoles={['client', 'manager']}>
                  <ClientTicketDetailPage />
                </RoleBasedRoute>
              } 
            />

            {/* Routes Manager */}
            <Route 
              path="/manager" 
              element={
                <RoleBasedRoute allowedRoles={['manager']}>
                  <ManagerDashboardPage />
                </RoleBasedRoute>
              } 
            />
            <Route 
              path="/manager/ticket/:ticketId" 
              element={
                <RoleBasedRoute allowedRoles={['manager']}>
                  <ManagerTicketDetailPage />
                </RoleBasedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <RoleBasedRoute allowedRoles={['manager']}>
                  <AdminUsersPage />
                </RoleBasedRoute>
              } 
            />

            {/* Routes Développeur */}
            <Route 
              path="/dev" 
              element={
                <RoleBasedRoute allowedRoles={['developer', 'manager']}>
                  <DeveloperDashboardPage />
                </RoleBasedRoute>
              } 
            />
            <Route 
              path="/dev/ticket/:ticketId" 
              element={
                <RoleBasedRoute allowedRoles={['developer', 'manager']}>
                  <DeveloperTicketDetailPage />
                </RoleBasedRoute>
              } 
            />
          </Route>

          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ModalProvider>
    </AuthProvider>
  );
}