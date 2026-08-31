import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
  containerClassName?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export default function SelectField({
  value,
  onChange,
  placeholder = "Select...",
  options,
  containerClassName,
  className,
  disabled,
  id,
}: SelectFieldProps) {
  const selected = options.find((opt) => opt.value === value) ?? null;

  return (
    <div className={containerClassName}>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(item) => onChange(item ? String(item.value) : "")}
        itemToStringLabel={(opt) => opt.label}
        itemToStringValue={(opt) => opt.value}
        isItemEqualToValue={(a, b) => !!a && !!b && a.value === b.value}
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          showClear={!disabled && !!selected}
          className={className}
        />
        <ComboboxContent>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {(opt) => (
              <ComboboxItem key={opt.value} value={opt}>
                <span className="flex-1 truncate">{opt.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}