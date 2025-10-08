import React from 'react';
import { Modal } from 'react-bootstrap';

export default function UpdateNotification({ show }) {
  return (
    <Modal show={show} backdrop="static" keyboard={false} centered size="sm" contentClassName="text-center">
      <Modal.Body>
        <p className="mb-0">Nouvelle version détectée.</p>
        <p className="mb-0">Mise à jour en cours...</p>
      </Modal.Body>
    </Modal>
  );
}
