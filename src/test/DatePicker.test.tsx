import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from '@/features/shared/components/DatePicker';

describe('DatePicker', () => {
  it('renders with placeholder', () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Choose date" />);
    expect(screen.getByPlaceholderText('Choose date')).toBeInTheDocument();
  });

  it('shows formatted selected date', () => {
    render(<DatePicker value="2024-03-15" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Mar 15, 2024')).toBeInTheDocument();
  });

  it('opens calendar on click', () => {
    render(<DatePicker value="2024-03-15" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('textbox'));
    expect(screen.getByText('March 2024')).toBeInTheDocument();
  });

  it('calls onChange when a day is clicked', () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('textbox'));
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayBtns = document.querySelectorAll('[class*="flex h-8 items-center justify-center rounded-full"]');
    const todayBtn = Array.from(dayBtns).find(
      (btn) => btn.textContent === String(today.getDate()) && !btn.classList.contains('text-slate-300')
    );
    if (todayBtn) fireEvent.click(todayBtn);
    expect(onChange).toHaveBeenCalledWith(todayStr);
  });

  it('renders label when provided', () => {
    render(<DatePicker value="" onChange={vi.fn()} label="Birth date" />);
    expect(screen.getByText('Birth date')).toBeInTheDocument();
  });

  it('shows required asterisk', () => {
    render(<DatePicker value="" onChange={vi.fn()} label="Date" required={true} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('disables input when disabled is true', () => {
    render(<DatePicker value="" onChange={vi.fn()} disabled={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
