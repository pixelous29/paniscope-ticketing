import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import ClientTicketDetailPage from './pages/client/ClientTicketDetailPage';
import NewTicketPage from './pages/client/NewTicketPage';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import ManagerTicketDetailPage from './pages/manager/ManagerTicketDetailPage';
import DeveloperDashboardPage from './pages/developer/DeveloperDashboardPage';
import DeveloperTicketDetailPage from './pages/developer/DeveloperTicketDetailPage';

export default function App() {
  return (
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
  );
}