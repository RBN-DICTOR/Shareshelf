import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthFormPanel } from './AuthFormPanel';
import { Modal } from './Modal';

export function AuthModal() {
  const { authModalOpen, authModalReason, closeAuthModal } = useAuth();

  return (
    <Modal
      open={authModalOpen}
      onClose={closeAuthModal}
      title="Sign in to ShareShelf"
      maxWidthClass="max-w-4xl"
      hideHeader
    >
      <AuthFormPanel reason={authModalReason} />
    </Modal>
  );
}
