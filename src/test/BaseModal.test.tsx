import { render, screen, fireEvent } from '@testing-library/react';
import BaseModal from '@/features/shared/components/BaseModal';

describe('BaseModal', () => {
  it('renders children when isOpen is true', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </BaseModal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <BaseModal isOpen={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </BaseModal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('shows close button when showCloseButton is true', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} showCloseButton={true}>
        <p>Modal content</p>
      </BaseModal>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} showCloseButton={true}>
        <p>Modal content</p>
      </BaseModal>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} closeOnBackdrop={true}>
        <p>Modal content</p>
      </BaseModal>
    );
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).toBeInTheDocument();
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose on backdrop click when closeOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} closeOnBackdrop={false}>
        <p>Modal content</p>
      </BaseModal>
    );
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('accepts custom maxWidth', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} maxWidth="max-w-3xl">
        <p>Modal content</p>
      </BaseModal>
    );
    const panel = document.querySelector('[class*="max-w-3xl"]');
    expect(panel).toBeInTheDocument();
  });
});
