import { render, screen, fireEvent } from '@testing-library/react';
import SelectField from '@/features/shared/components/SelectField';

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

describe('SelectField', () => {
  it('renders with placeholder', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows selected option label', () => {
    render(<SelectField value="2" onChange={vi.fn()} options={options} />);
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', () => {
    const onChange = vi.fn();
    render(<SelectField value="" onChange={onChange} options={options} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option 2'));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('closes dropdown after selection', () => {
    const onChange = vi.fn();
    render(<SelectField value="" onChange={onChange} options={options} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option 2'));
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('disables button when disabled is true', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} disabled={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
