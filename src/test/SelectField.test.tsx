import { render, screen, fireEvent } from '@testing-library/react';
import SelectField from '@/features/shared/components/SelectField';

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

function openCombobox() {
  const input = screen.getByRole('combobox');
  fireEvent.pointerDown(input);
  fireEvent.mouseDown(input);
}

describe('SelectField', () => {
  it('renders with placeholder', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} placeholder="Pick one" />);
    expect(screen.getByPlaceholderText('Pick one')).toBeInTheDocument();
  });

  it('shows selected option label', () => {
    render(<SelectField value="2" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole('combobox')).toHaveValue('Option 2');
  });

  it('opens dropdown on pointer down', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} />);
    openCombobox();
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', () => {
    const onChange = vi.fn();
    render(<SelectField value="" onChange={onChange} options={options} />);
    openCombobox();
    const option = screen.getByRole('option', { name: 'Option 2' });
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('closes dropdown after selection', () => {
    const onChange = vi.fn();
    render(<SelectField value="" onChange={onChange} options={options} />);
    openCombobox();
    const option = screen.getByRole('option', { name: 'Option 2' });
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    expect(screen.queryByRole('option', { name: 'Option 1' })).not.toBeInTheDocument();
  });

  it('disables input when disabled is true', () => {
    render(<SelectField value="" onChange={vi.fn()} options={options} disabled={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
