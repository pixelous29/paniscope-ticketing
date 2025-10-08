import React, { useState } from 'react';
import { ModalContext } from './ModalContext';
import AlertModal from '../components/shared/AlertModal';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import PromptModal from '../components/shared/PromptModal';

export default function ModalProvider({ children }) {
  const [alertModal, setAlertModal] = useState({ show: false, title: '', body: '' });
  const [confirmationModal, setConfirmationModal] = useState({ show: false, title: '', body: '', onConfirm: () => {} });
  const [promptModal, setPromptModal] = useState({ show: false, title: '', body: '', onConfirm: () => {} });

  const showAlert = (title, body) => {
    setAlertModal({ show: true, title, body });
  };

  const showConfirmation = (title, body, onConfirm) => {
    setConfirmationModal({ show: true, title, body, onConfirm });
  };

  const showPrompt = (title, body, onConfirm) => {
    setPromptModal({ show: true, title, body, onConfirm });
  };

  const handleAlertClose = () => {
    setAlertModal({ show: false, title: '', body: '' });
  };

  const handleConfirmationCancel = () => {
    setConfirmationModal({ show: false, title: '', body: '', onConfirm: () => {} });
  };

  const handleConfirmationConfirm = () => {
    confirmationModal.onConfirm();
    handleConfirmationCancel();
  };

  const handlePromptCancel = () => {
    setPromptModal({ show: false, title: '', body: '', onConfirm: () => {} });
  };

  const handlePromptConfirm = (value) => {
    promptModal.onConfirm(value);
    handlePromptCancel();
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirmation, showPrompt }}>
      {children}
      <AlertModal 
        show={alertModal.show} 
        onClose={handleAlertClose} 
        title={alertModal.title} 
        body={alertModal.body} 
      />
      <ConfirmationModal 
        show={confirmationModal.show} 
        onConfirm={handleConfirmationConfirm} 
        onCancel={handleConfirmationCancel}
        title={confirmationModal.title}
        body={confirmationModal.body}
      />
      <PromptModal
        show={promptModal.show}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
        title={promptModal.title}
        body={promptModal.body}
      />
    </ModalContext.Provider>
  );
}
