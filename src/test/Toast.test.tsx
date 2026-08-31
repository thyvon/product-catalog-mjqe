import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '@/features/shared/components/Toast';

function TestConsumer() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success!')}>Show success</button>
      <button onClick={() => toast.error('Error!')}>Show error</button>
      <button onClick={() => toast.info('Info!')}>Show info</button>
      <button onClick={() => toast.warning('Warning!')}>Show warning</button>
    </div>
  );
}

describe('Toast', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <p>App content</p>
      </ToastProvider>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('shows success toast', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show success'));
    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });

  it('shows error toast', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show error'));
    await waitFor(() => {
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });
  });

  it('shows toast title when provided', async () => {
    function TestTitle() {
      const { toast } = useToast();
      return <button onClick={() => toast.success('Body', 'Title text')}>Show</button>;
    }
    render(
      <ToastProvider>
        <TestTitle />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show'));
    await waitFor(() => {
      expect(screen.getByText('Title text')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
    });
  });

  it('removes toast when close button is clicked', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show success'));
    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    const allBtns = screen.getAllByRole('button');
    const toastClose = allBtns.find(
      b => b.querySelector('svg') && !b.textContent?.includes('Show')
    );
    if (toastClose) fireEvent.click(toastClose);

    await waitFor(() => {
      expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    });
  });

  it('useToast throws without ToastProvider', () => {
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow('useToast must be used within ToastProvider');
  });
});
