import { useState } from 'react';

/** An open/closed flag plus the row the modal is acting on. */
export interface ModalState<T> {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  entity: T | null;
  setEntity: (entity: T | null) => void;
}

export function useModalState<T>(): ModalState<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [entity, setEntity] = useState<T | null>(null);
  return { isOpen, setIsOpen, entity, setEntity };
}

/**
 * The add/edit modal trio the data contexts carry: a flag for the add modal
 * (which starts from a blank form, so it needs no row) and a {@link ModalState}
 * for the edit modal. Callers rename the fields at the destructuring site —
 * `editing: editingAsset` — so the shape they publish stays unchanged.
 */
export interface EntityModals<T> {
  isAddModalOpen: boolean;
  setIsAddModalOpen: (isOpen: boolean) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (isOpen: boolean) => void;
  editing: T | null;
  setEditing: (entity: T | null) => void;
}

export function useEntityModals<T>(): EntityModals<T> {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const edit = useModalState<T>();

  return {
    isAddModalOpen,
    setIsAddModalOpen,
    isEditModalOpen: edit.isOpen,
    setIsEditModalOpen: edit.setIsOpen,
    editing: edit.entity,
    setEditing: edit.setEntity,
  };
}
