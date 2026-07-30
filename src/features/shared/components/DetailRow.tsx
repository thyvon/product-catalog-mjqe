interface DetailRowProps {
  label: string;
  value: string;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">{label}</span>
      <span className="text-xs text-foreground font-medium">{value}</span>
    </div>
  );
}
