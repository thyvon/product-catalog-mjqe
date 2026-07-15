import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from '@/features/shared/components/DataTable';

interface TestRow {
  id: number;
  name: string;
  email: string;
}

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email' },
];

const data: TestRow[] = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' },
];

describe('DataTable', () => {
  it('renders data rows', () => {
    render(
      <DataTable columns={columns} data={data} rowKey={(r) => r.id} />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders headers', () => {
    render(
      <DataTable columns={columns} data={data} rowKey={(r) => r.id} />
    );
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    const { container } = render(
      <DataTable columns={columns} data={[]} loading={true} rowKey={(r) => r.id} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no data', () => {
    render(
      <DataTable columns={columns} data={[]} rowKey={(r) => r.id} emptyMessage="Nothing here" />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows empty action button', () => {
    const onClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
        emptyAction={{ label: 'Add item', onClick }}
      />
    );
    fireEvent.click(screen.getByText('Add item'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders pagination when pagination prop is provided', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
        pagination={{ currentPage: 1, pageSize: 10, total: 20, onPageChange: vi.fn() }}
      />
    );
    expect(screen.getByText('20 items')).toBeInTheDocument();
  });

  it('calls onSort when sortable header is clicked', () => {
    const onSort = vi.fn();
    render(
      <DataTable columns={columns} data={data} rowKey={(r) => r.id} onSort={onSort} />
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
  });

  it('calls onPageChange when pagination button is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
        pagination={{ currentPage: 1, pageSize: 10, total: 50, onPageChange, pageSizeOptions: [10, 25, 50] }}
      />
    );
    const allBtns = screen.getAllByRole('button');
    const nextBtn = allBtns.find(b => b.querySelector('.lucide-chevron-right'));
    if (nextBtn) fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('uses custom render function', () => {
    const cols = [
      { key: 'name', header: 'Name', render: (row: TestRow) => <strong>{row.name}</strong> },
    ];
    render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} />);
    expect(screen.getByText('Alice').tagName).toBe('STRONG');
  });

  it('shows dash for missing values', () => {
    const cols = [{ key: 'email', header: 'Email' }];
    const rows = [{ id: 1, email: undefined as string | undefined }];
    render(<DataTable columns={cols} data={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
