interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  kh?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  kh,
  description,
  disabled = false,
  className = "",
}: CheckboxProps) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-800/50 ${disabled ? "opacity-60" : "cursor-pointer hover:border-slate-300 dark:hover:border-gray-600"} ${className}`.trim()}
    >
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={`h-5 w-5 rounded-md border-2 transition-all ${
            checked
              ? "border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500"
              : "border-slate-300 bg-white dark:border-gray-600 dark:bg-gray-800"
          } ${disabled ? "" : "peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/30"}`}
        >
          {checked && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full p-0.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <span className="text-[11px] font-bold text-slate-700 dark:text-gray-200">
          {label}
          {kh && <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500"> / {kh}</span>}
        </span>
        {description && (
          <span className="block text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{description}</span>
        )}
      </div>
    </label>
  );
}
