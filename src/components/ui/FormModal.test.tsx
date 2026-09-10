import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormModal from './FormModal';

// Step 5 of "refactoring v2.md". FormModal is the chrome lifted out of AddAssetModal
// verbatim — header + X + <form> + error banner + Cancel/Save footer — on top of ui/Modal.
// These tests pin that chrome so Step 6/7 can move more callers onto it safely.

function renderFormModal(props: Partial<React.ComponentProps<typeof FormModal>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  render(
    <FormModal
      isOpen
      titleId="test-modal-title"
      title="Add New Asset"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Save Asset"
      {...props}
    >
      <input name="assetNumber" defaultValue="" />
    </FormModal>
  );
  return { onClose, onSubmit };
}

describe('FormModal — chrome', () => {
  it('renders nothing when closed', () => {
    renderFormModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('labels the dialog with the heading it renders', () => {
    renderFormModal();

    const heading = screen.getByRole('heading', { name: 'Add New Asset' });
    expect(heading).toHaveAttribute('id', 'test-modal-title');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'test-modal-title');
  });

  it('renders the children inside the form, above the footer', () => {
    renderFormModal();

    const form = document.querySelector('form') as HTMLFormElement;
    expect(form).toContainElement(document.querySelector('input[name="assetNumber"]'));
    expect(form).toContainElement(screen.getByRole('button', { name: 'Save Asset' }));
    expect(form).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('submits through onSubmit when the footer button is pressed', () => {
    const { onSubmit } = renderFormModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Asset' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from Cancel, from the X button and from Esc', () => {
    const { onClose, onSubmit } = renderFormModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // the X button carries only an icon, so it is the one button with no accessible name
    const closeButton = screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;
    fireEvent.click(closeButton);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaults the panel to the wide, scrollable asset-form shape and lets a caller override it', () => {
    const { unmount } = render(
      <FormModal isOpen titleId="t" title="T" onClose={() => {}} onSubmit={() => {}} submitLabel="Save">
        <span />
      </FormModal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-2xl');
    unmount();

    render(
      <FormModal isOpen titleId="t" title="T" onClose={() => {}} onSubmit={() => {}} submitLabel="Save" className="max-w-4xl">
        <span />
      </FormModal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-4xl');
  });
});

describe('FormModal — error banner', () => {
  it('renders no banner when error is null', () => {
    renderFormModal();
    expect(document.querySelector('.text-error')).toBeNull();
  });

  it('renders the message when error is set', () => {
    renderFormModal({ error: 'Failed to save asset: boom' });
    expect(screen.getByText('Failed to save asset: boom')).toBeInTheDocument();
  });
});

describe('FormModal — saving state', () => {
  it('disables every control and swaps the submit label for the spinner copy', () => {
    renderFormModal({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Asset' })).not.toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: /Saving\.\.\./ });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('honours a custom savingLabel', () => {
    renderFormModal({ isSaving: true, savingLabel: 'Updating...' });
    expect(screen.getByRole('button', { name: /Updating\.\.\./ })).toBeInTheDocument();
  });

  it('stops Esc from closing the dialog while saving', () => {
    const { onClose } = renderFormModal({ isSaving: true });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('honours a custom cancelLabel', () => {
    renderFormModal({ cancelLabel: 'Discard' });
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });
});
