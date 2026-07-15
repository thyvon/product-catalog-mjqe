import { render, screen, fireEvent } from '@testing-library/react';
import Checkbox from '@/features/shared/components/Checkbox';

describe('Checkbox', () => {
  it('renders label', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Accept terms" />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });

  it('calls onChange when clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept" />);
    fireEvent.click(screen.getByText('Accept'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows checked state', () => {
    render(<Checkbox checked={true} onChange={vi.fn()} label="Checked" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('shows Khmer text when kh prop is provided', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Active" kh="សកម្ម" />);
    expect(screen.getByText((content) => content.includes('សកម្ម'))).toBeInTheDocument();
  });

  it('shows description when provided', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Test" description="This is a hint" />);
    expect(screen.getByText('This is a hint')).toBeInTheDocument();
  });

  it('disables checkbox when disabled is true', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Test" disabled={true} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
