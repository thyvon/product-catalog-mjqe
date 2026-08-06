interface SectionTitleProps {
  title: string;
  kh: string;
}

export function SectionTitle({ title, kh }: SectionTitleProps) {
  return (
    <div className="col-span-1 border-b border-border pb-2 md:col-span-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{kh}</h3>
      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{title}</p>
    </div>
  );
}