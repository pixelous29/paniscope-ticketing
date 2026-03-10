import { Outlet } from 'react-router-dom';
import AppNavbar from '../components/shared/Navbar';
import { useAuth } from '../hooks/useAuth';

export default function MainLayout() {
  useAuth();
  
  return (
    <div className="d-flex flex-column flex-lg-row vh-100 overflow-hidden bg-light w-100">
      <AppNavbar />
      <main className="flex-grow-1 overflow-auto bg-white position-relative d-flex flex-column h-100 w-100">
        <Outlet />
      </main>
    </div>
  );
}