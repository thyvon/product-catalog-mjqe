import { useState, useMemo } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  label: labelText,
  required,
  disabled,
  className,
  containerClassName,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const date = useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" disabled={disabled} className={cn("w-full justify-start font-normal", !date && "text-muted-foreground", className)} />}>
        {date ? format(date, "MMM dd, yyyy") : <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );

  if (containerClassName) {
    return <div className={containerClassName}>{picker}</div>;
  }

  if (labelText) {
    return (
      <div className="space-y-1">
        <Label>
          {labelText}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {picker}
      </div>
    );
  }

  return picker;
}
