import { Routes, Route } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';

import MainLayout from './layouts/MainLayout';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import ClientTicketDetailPage from './pages/client/ClientTicketDetailPage';
import NewTicketPage from './pages/client/NewTicketPage';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import ManagerTicketDetailPage from './pages/manager/ManagerTicketDetailPage';
import DeveloperDashboardPage from './pages/developer/DeveloperDashboardPage';
import DeveloperTicketDetailPage from './pages/developer/DeveloperTicketDetailPage';
import UpdateNotification from './components/shared/UpdateNotification';

import { ModalProvider } from './contexts/ModalProvider';

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
    <ModalProvider>
      <UpdateNotification show={needRefresh} />
      <Routes>
        <Route element={<MainLayout />}>
          {/* Routes Client */}
          <Route path="/" element={<ClientDashboardPage />} />
          <Route path="/nouveau-ticket" element={<NewTicketPage />} />
          <Route path="/ticket/:ticketId" element={<ClientTicketDetailPage />} />

          {/* Routes Manager */}
          <Route path="/manager" element={<ManagerDashboardPage />} />
          <Route path="/manager/ticket/:ticketId" element={<ManagerTicketDetailPage />} />

          {/* Routes Développeur */}
          <Route path="/dev" element={<DeveloperDashboardPage />} />
          <Route path="/dev/ticket/:ticketId" element={<DeveloperTicketDetailPage />} />
        </Route>
      </Routes>
    </ModalProvider>
  );
}