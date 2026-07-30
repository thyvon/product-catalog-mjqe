import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, id, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <Label htmlFor={id}>{label}</Label>}
        <Input ref={ref} id={id} className={className} {...props} />
      </div>
    );
  }
);
TextField.displayName = "TextField";

export default TextField;
