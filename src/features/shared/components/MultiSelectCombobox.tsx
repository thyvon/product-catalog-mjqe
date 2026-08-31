import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

export interface ComboboxOption {
  id: string;
  label: string;
  meta?: string;
}

interface PseudoOption extends ComboboxOption {
  creatable?: boolean;
  creatableLabel?: string;
}

interface MultiSelectComboboxProps {
  options: ComboboxOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  onCreate?: (label: string) => void | Promise<void>;
  footer?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function MultiSelectCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  emptyMessage = "No items found.",
  onCreate,
  footer,
  disabled = false,
  className,
}: MultiSelectComboboxProps) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");

  const loweredQuery = query.trim().toLowerCase();
  const exactExists = options.some((o) => o.label.trim().toLowerCase() === loweredQuery);
  const canCreate = !!onCreate && loweredQuery.length > 0 && !exactExists;

  const filtered = useMemo(
    () => options.filter((o) => !loweredQuery || o.label.toLowerCase().includes(loweredQuery)),
    [options, loweredQuery]
  );

  const viewItems: PseudoOption[] = useMemo(() => {
    if (!canCreate) return filtered;
    return [
      ...filtered,
      {
        id: `create:${loweredQuery}`,
        label: `Create "${query.trim()}"`,
        creatable: true,
        creatableLabel: query.trim(),
      },
    ];
  }, [filtered, canCreate, loweredQuery, query]);

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.id)),
    [options, value]
  );

  const commitCreate = async (label: string) => {
    if (onCreate) await onCreate(label);
    setQuery("");
  };

  const handleValueChange = (next: PseudoOption[] | PseudoOption | null) => {
    const arr = Array.isArray(next) ? next : next ? [next] : [];
    const creatable = arr.find((o) => o.creatable);
    if (creatable?.creatableLabel) {
      void commitCreate(creatable.creatableLabel);
      return;
    }
    onValueChange(arr.filter((o) => !o.creatable).map((o) => o.id));
    setQuery("");
  };

  return (
    <Combobox
      items={viewItems}
      multiple
      value={selected}
      onValueChange={handleValueChange}
      inputValue={query}
      onInputValueChange={(v) => setQuery(String(v ?? ""))}
      filter={null}
      disabled={disabled}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.id}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {selected.map((o) => (
            <ComboboxChip key={o.id}>{o.label}</ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) {
              e.preventDefault();
              void commitCreate(query.trim());
            }
          }}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {viewItems.map((o) => (
            <ComboboxItem key={o.id} value={o}>
              <span className="flex-1 truncate">{o.label}</span>
              {o.meta && <span className="shrink-0 font-mono text-xs text-muted-foreground">{o.meta}</span>}
            </ComboboxItem>
          ))}
        </ComboboxList>
        {footer}
      </ComboboxContent>
    </Combobox>
  );
}
