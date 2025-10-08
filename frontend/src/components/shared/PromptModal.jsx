import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

export default function PromptModal({ show, onConfirm, onCancel, title, body }) {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    onConfirm(inputValue);
  };

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{body}</p>
        <Form.Control
          as="textarea"
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirmer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
