import { Outlet } from 'react-router-dom';
import AppNavbar from '../components/shared/Navbar'; // Le nom a changé

export default function MainLayout() {
  return (
    <div>
      <AppNavbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}