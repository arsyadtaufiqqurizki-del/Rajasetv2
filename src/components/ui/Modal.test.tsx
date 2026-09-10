import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Modal — focus survives re-renders (B6)', () => {
  // The focus/scroll/keydown effect keys on `isOpen` alone. Callers recreate `onClose`
  // on every render and flip `closeOnEscape` while saving; before the fix either one
  // re-ran the effect and pulled focus back to the panel's first focusable element,
  // so typing in a form modal jumped to the close button after every keystroke.
  function TypingModal({ closeOnEscape, onClose }: { closeOnEscape?: boolean; onClose?: () => void }) {
    const [value, setValue] = useState('');
    return (
      <Modal isOpen onClose={onClose ?? (() => {})} closeOnEscape={closeOnEscape}>
        <button>Close</button>
        <input aria-label="Description" value={value} onChange={e => setValue(e.target.value)} />
      </Modal>
    );
  }

  it('leaves focus in the field while the caller re-renders with a fresh onClose', async () => {
    const user = userEvent.setup();
    render(<TypingModal />);

    const input = screen.getByLabelText('Description');
    await user.click(input);
    await user.type(input, 'MacBook Pro M3');

    expect(input).toHaveValue('MacBook Pro M3');
    expect(input).toHaveFocus();
  });

  it('does not let a typed space reach the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TypingModal onClose={onClose} />);

    const input = screen.getByLabelText('Description');
    await user.click(input);
    await user.keyboard('A B');

    expect(input).toHaveValue('A B');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps focus put when closeOnEscape flips, e.g. when a save starts', () => {
    const { rerender } = render(<ModalWithTrigger onClose={() => {}} closeOnEscape={true} />);
    const last = screen.getByText('Last');
    last.focus();

    rerender(<ModalWithTrigger onClose={() => {}} closeOnEscape={false} />);

    expect(last).toHaveFocus();
  });

  it('still calls the latest onClose on Escape after a re-render', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<ModalWithTrigger onClose={stale} />);

    rerender(<ModalWithTrigger onClose={fresh} />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it('still honours the latest closeOnEscape after a re-render', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ModalWithTrigger onClose={onClose} closeOnEscape={true} />);

    rerender(<ModalWithTrigger onClose={onClose} closeOnEscape={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    rerender(<ModalWithTrigger onClose={onClose} closeOnEscape={true} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
