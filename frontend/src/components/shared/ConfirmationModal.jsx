import React from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function ConfirmationModal({ show, onConfirm, onCancel, title, body }) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Confirmer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
