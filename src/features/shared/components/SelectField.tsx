import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  return (
    <div className={containerClassName}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
