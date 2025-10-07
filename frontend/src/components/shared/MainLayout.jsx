import { Outlet } from 'react-router-dom';
import AppNavbar from '../components/shared/Navbar';
import { Container } from 'react-bootstrap';

export default function MainLayout() {
  return (
    <div>
      <AppNavbar />
      {/* Ajout de la classe "my-4" pour une marge verticale */}
      <Container fluid="lg" className="my-4">
        <main>
          <Outlet />
        </main>
      </Container>
    </div>
  );
}