import { useId } from "react";
import { Checkbox as CheckboxPrimitive } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
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
  disabled,
  className,
}: CheckboxProps) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${className || ""}`}>
      <CheckboxPrimitive
        id={id}
        checked={checked}
        onCheckedChange={(val) => onChange(val === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      {(label || kh || description) && (
        <Label htmlFor={id} className="space-y-0.5 leading-snug">
          {label && <span className="font-medium text-sm">{label}</span>}
          {kh && <span className="block text-xs text-muted-foreground">{kh}</span>}
          {description && (
            <span className="block text-xs text-muted-foreground">{description}</span>
          )}
        </Label>
      )}
    </div>
  );
}
