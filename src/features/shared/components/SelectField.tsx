import { useEffect, useMemo, useRef, useState, memo } from "react";
import { Check, ChevronDown } from "lucide-react";

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

const SelectField = memo(function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  containerClassName = "w-full",
  disabled = false,
  id,
  name,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={`relative ${containerClassName}`.trim()}>
      <button
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-[38px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`.trim()}
      >
        <span className={selectedOption ? "text-slate-700 dark:text-gray-200" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-2 w-full overflow-y-auto max-h-[360px] rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/20">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[11px] font-medium transition-colors cursor-pointer ${
                  isSelected ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export default SelectField;
