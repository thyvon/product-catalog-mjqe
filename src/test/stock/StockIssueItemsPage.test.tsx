import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/features/shared/components/Toast';
import StockIssueItemsPage from '@/features/stock/pages/StockIssueItemsPage';

function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const mockItems = [
  { id: '1', itemCode: 'ITEM-001', description: 'Laptop', quantity: 2, uom: 'Pcs', unitPrice: 1200, totalPrice: 2400, transactionDate: '2026-06-01', warehouse: 'WH-A', division: 'Admin', department: 'IT', campus: 'PP', requesterName: 'Alice', referenceNo: 'IO-001', transactionType: 'Issue', accountCode: 'ACC-001', remarks: 'Office use' },
  { id: '2', itemCode: 'ITEM-002', description: 'Monitor', quantity: 5, uom: 'Pcs', unitPrice: 300, totalPrice: 1500, transactionDate: '2026-06-02', warehouse: 'WH-B', division: 'Finance', department: 'Accounting', campus: 'SR', requesterName: 'Bob', referenceNo: 'IO-002', transactionType: 'Transfer', accountCode: 'ACC-002', remarks: 'Finance dept' },
  { id: '3', itemCode: 'ITEM-003', description: 'Keyboard', quantity: 10, uom: 'Pcs', unitPrice: 25, totalPrice: 250, transactionDate: '2026-06-03', warehouse: 'WH-A', division: 'Admin', department: 'HR', campus: 'PP', requesterName: 'Charlie', referenceNo: 'IO-003', transactionType: 'Issue', accountCode: 'ACC-001', remarks: 'HR request' },
];

function createFetchMock(overrides?: { items?: typeof mockItems; total?: number }) {
  const items = overrides?.items ?? mockItems;
  const total = overrides?.total ?? mockItems.length;
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, count: total }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items, total }),
    });
  });
}

describe('StockIssueItemsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title and description', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    expect(screen.getByText('Stock Issue Items')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('3 items found')).toBeInTheDocument();
    });
  });

  it('renders data rows from API response', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
      expect(screen.getByText('Monitor')).toBeInTheDocument();
      expect(screen.getByText('Keyboard')).toBeInTheDocument();
    });
  });

  it('renders filter selects after clicking Filters toggle', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Issue Items')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(screen.getAllByText('All Warehouses').length).toBeGreaterThan(0);
      expect(screen.getAllByText('All Departments').length).toBeGreaterThan(0);
      expect(screen.getAllByText('All Campuses').length).toBeGreaterThan(0);
      expect(screen.getAllByText('All Transaction Types').length).toBeGreaterThan(0);
    });
  });

  it('fetches data on mount with page=1 and pageSize=10', async () => {
    const fetch = createFetchMock();
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/stock-issue-items?page=1&pageSize=10'));
    });
  });

  it('re-fetches when warehouse filter changes', async () => {
    const fetch = createFetchMock();
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fetch.mockClear();

    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      const warehouseBtn = screen.getAllByText('All Warehouses')[0].closest('button');
      if (warehouseBtn) fireEvent.click(warehouseBtn);
    });
    await waitFor(() => {
      const option = screen.getByRole('button', { name: 'WH-A' });
      if (option) fireEvent.click(option);
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('warehouse=WH-A'));
    });
  });

  it('re-fetches when search input changes', async () => {
    const fetch = createFetchMock();
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fetch.mockClear();
    const searchInput = screen.getByPlaceholderText(/Search by code/);
    fireEvent.change(searchInput, { target: { value: 'Laptop' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=Laptop'));
    });
  });

  it('renders Delete All button when items exist', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });
  });

  it('shows error toast when Delete All clicked without active filters', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Delete All'));
    await waitFor(() => {
      expect(screen.getByText('Please apply at least one filter before deleting all items.')).toBeInTheDocument();
    });
  });

  it('opens confirm modal on Delete All click when filter is active', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(screen.getByText('Delete All')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      const btn = screen.getAllByText('All Warehouses')[0].closest('button');
      if (btn) fireEvent.click(btn);
    });
    await waitFor(() => {
      const opt = screen.getByRole('button', { name: 'WH-A' });
      if (opt) fireEvent.click(opt);
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete All'));
    });
    await waitFor(() => {
      expect(screen.getByText('Delete All Filtered Items')).toBeInTheDocument();
      expect(screen.getByText(/Delete all 3 items/)).toBeInTheDocument();
    });
  });

  it('calls bulk delete API on confirm', async () => {
    const fetch = createFetchMock();
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(screen.getByText('Delete All')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      const btn = screen.getAllByText('All Warehouses')[0].closest('button');
      if (btn) fireEvent.click(btn);
    });
    await waitFor(() => {
      const opt = screen.getByRole('button', { name: 'WH-A' });
      if (opt) fireEvent.click(opt);
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete All'));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/stock-issue-items/bulk'), expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('shows success toast after bulk delete', async () => {
    vi.stubGlobal('fetch', createFetchMock());
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(screen.getByText('Delete All')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      const btn = screen.getAllByText('All Warehouses')[0].closest('button');
      if (btn) fireEvent.click(btn);
    });
    await waitFor(() => {
      const opt = screen.getByRole('button', { name: 'WH-A' });
      if (opt) fireEvent.click(opt);
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete All'));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });
    await waitFor(() => {
      expect(screen.getByText('Deleted 3 items.')).toBeInTheDocument();
    });
  });

  it('clears filters when Clear all is clicked', async () => {
    const fetch = createFetchMock();
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fetch.mockClear();
    fireEvent.click(screen.getByText('Filters'));
    await waitFor(() => {
      const warehouseBtn = screen.getAllByText('All Warehouses')[0].closest('button');
      if (warehouseBtn) fireEvent.click(warehouseBtn);
    });
    await waitFor(() => {
      const option = screen.getByRole('button', { name: 'WH-A' });
      if (option) fireEvent.click(option);
    });
    await waitFor(() => {
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Clear all'));
    await waitFor(() => {
      expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
    });
  });

  it('does not show Delete All when items is empty', async () => {
    const fetch = createFetchMock({ items: [], total: 0 });
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
    });
  });

  it('shows Import from Excel empty action when no items', async () => {
    const fetch = createFetchMock({ items: [], total: 0 });
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('Import from Excel')).toBeInTheDocument();
    });
  });

  it('paginates with correct total', async () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      itemCode: `ITEM-${String(i + 1).padStart(3, '0')}`,
      description: `Item ${i + 1}`,
      quantity: 1,
      uom: 'Pcs',
      unitPrice: 10,
      totalPrice: 10,
      transactionDate: '2026-06-01',
      warehouse: 'WH-A',
      division: 'Admin',
      department: 'IT',
      campus: 'PP',
      requesterName: 'User',
      referenceNo: `IO-${String(i + 1).padStart(3, '0')}`,
      transactionType: 'Issue',
      accountCode: 'ACC-001',
      remarks: '',
    }));
    const fetch = createFetchMock({ items: manyItems.slice(0, 10), total: 25 });
    vi.stubGlobal('fetch', fetch);
    renderWithToast(<StockIssueItemsPage />);
    await waitFor(() => {
      expect(screen.getByText('25 items')).toBeInTheDocument();
    });
  });
});
