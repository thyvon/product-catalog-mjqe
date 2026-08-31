import { render, screen, fireEvent } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '@/features/shared/components/DataTable';

interface TestRow {
  id: number;
  name: string;
  email: string | undefined;
}

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'email', header: 'Email' },
];

const data: TestRow[] = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' },
];

describe('DataTable', () => {
  it('renders data rows', () => {
    render(
      <DataTable columns={columns} data={data} getRowId={(r) => String(r.id)} />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders headers', () => {
    render(
      <DataTable columns={columns} data={data} getRowId={(r) => String(r.id)} />
    );
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    const { container } = render(
      <DataTable columns={columns} data={[]} loading={true} getRowId={(r) => String(r.id)} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no data', () => {
    render(
      <DataTable columns={columns} data={[]} getRowId={(r) => String(r.id)} emptyMessage="Nothing here" />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows empty action button', () => {
    const onClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowId={(r) => String(r.id)}
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
        getRowId={(r) => String(r.id)}
        pagination={{
          currentPage: 1,
          pageSize: 10,
          total: 20,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
          pageSizeOptions: [10, 25, 50],
        }}
      />
    );
    expect(screen.getByText(/of\s+20/)).toBeInTheDocument();
  });

  it('calls onPageChange when next button is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => String(r.id)}
        pagination={{
          currentPage: 1,
          pageSize: 10,
          total: 50,
          onPageChange,
          onPageSizeChange: vi.fn(),
          pageSizeOptions: [10, 25, 50],
        }}
      />
    );
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('uses custom cell function', () => {
    const cols: ColumnDef<TestRow>[] = [
      { accessorKey: 'name', header: 'Name', cell: ({ row }) => <strong>{row.original.name}</strong> },
    ];
    render(<DataTable columns={cols} data={data} getRowId={(r) => String(r.id)} />);
    expect(screen.getByText('Alice').tagName).toBe('STRONG');
  });

  it('shows dash for missing values', () => {
    const cols: ColumnDef<TestRow>[] = [{ accessorKey: 'email', header: 'Email' }];
    const rows: TestRow[] = [{ id: 1, name: 'Test', email: undefined }];
    render(<DataTable columns={cols} data={rows} getRowId={(r) => String(r.id)} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
