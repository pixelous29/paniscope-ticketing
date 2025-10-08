import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

export default function AppNavbar() {
  return (
    // Ajout de sticky="top"
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
          <img
            src="/logo36x36.png"
            alt="Support Paniscope logo"
            className="navbar-logo me-2"
          />
          Support Paniscope
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={NavLink} to="/" end>Vue Client</Nav.Link>
            <Nav.Link as={NavLink} to="/manager">Vue Manager</Nav.Link>
            <Nav.Link as={NavLink} to="/dev">Vue Développeur</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}