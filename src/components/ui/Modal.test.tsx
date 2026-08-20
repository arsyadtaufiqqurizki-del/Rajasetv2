import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

function ModalWithTrigger({ onClose, closeOnEscape }: { onClose: () => void; closeOnEscape?: boolean }) {
  return (
    <div>
      <button>Outside trigger</button>
      <Modal isOpen onClose={onClose} closeOnEscape={closeOnEscape}>
        <button>First</button>
        <button>Second</button>
        <button>Last</button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <button>Hidden</button>
      </Modal>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('sets role="dialog" and aria-modal, and moves focus into the panel on open', () => {
    render(<ModalWithTrigger onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<ModalWithTrigger onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose on Escape by default', () => {
    const onClose = vi.fn();
    render(<ModalWithTrigger onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when closeOnEscape is false', () => {
    const onClose = vi.fn();
    render(<ModalWithTrigger onClose={onClose} closeOnEscape={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus: wraps from last to first, and Shift+Tab from first to last', () => {
    render(<ModalWithTrigger onClose={() => {}} />);
    const first = screen.getByText('First');
    const last = screen.getByText('Last');

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'External Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal isOpen onClose={() => {}}>
        <button>Inside</button>
      </Modal>
    );
    expect(screen.getByText('Inside')).toHaveFocus();

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        <button>Inside</button>
      </Modal>
    );
    expect(trigger).toHaveFocus();

    document.body.removeChild(trigger);
  });
});
