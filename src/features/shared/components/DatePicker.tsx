import { useEffect, useMemo, useRef, useState, memo } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  containerClassName?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthLabels = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
}

function formatDateValue(value: string): string {
  const parsed = parseDateValue(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(viewDate: Date) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const lastOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const startDay = firstOfMonth.getDay();
  const days: Date[] = [];

  for (let i = startDay - 1; i >= 0; i -= 1) {
    const date = new Date(firstOfMonth);
    date.setDate(firstOfMonth.getDate() - i - 1);
    days.push(date);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    const lastDate = days[days.length - 1];
    const nextDay = new Date(lastDate);
    nextDay.setDate(lastDate.getDate() + 1);
    days.push(nextDay);
  }

  return days;
}

const DatePicker = memo(function DatePicker({
  value,
  onChange,
  label,
  className = "",
  containerClassName = "w-full",
  id,
  name,
  placeholder,
  disabled = false,
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDateValue(value) ?? new Date());
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

  useEffect(() => {
    if (!value) return;
    const parsed = parseDateValue(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openPicker = () => {
    if (disabled) return;
    setViewDate(selectedDate ?? new Date());
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setIsOpen(true);
  };

  const selectDate = (date: Date) => {
    onChange(formatInputValue(date));
    setViewDate(date);
    setIsOpen(false);
  };

  return (
    <div ref={triggerRef} className={`relative ${containerClassName}`.trim()}>
      {label ? (
        <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-gray-400">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          name={name}
          readOnly
          value={selectedDate ? formatDateValue(value) : ""}
          onClick={openPicker}
          onFocus={openPicker}
          disabled={disabled}
          required={required}
          placeholder={placeholder ?? "Select date"}
          className={`h-[38px] w-full cursor-pointer rounded-xl border border-slate-200 bg-white/90 px-3 pr-10 text-[11px] font-medium text-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`.trim()}
        />
        <button
          type="button"
          onClick={openPicker}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 cursor-pointer"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, minWidth: Math.max(280, dropdownPosition.width), zIndex: 9999 }}
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/20"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-slate-700 dark:text-gray-200">
              {monthLabels[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
            {weekdayLabels.map((label) => (
              <div key={label} className="flex h-8 items-center justify-center">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = selectedDate ? day.toDateString() === selectedDate.toDateString() : false;
              const isToday = day.toDateString() === new Date().toDateString();

              return (
                <button
                  key={`${day.toDateString()}-${index}`}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`flex h-8 items-center justify-center rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    isCurrentMonth ? "text-slate-700 dark:text-gray-200" : "text-slate-300 dark:text-gray-600"
                  } ${isSelected ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-slate-100 dark:hover:bg-gray-800"} ${isToday && !isSelected ? "ring-1 ring-indigo-200 dark:ring-indigo-500/30" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default DatePicker;
