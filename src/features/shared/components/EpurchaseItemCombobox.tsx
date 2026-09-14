import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { fetchEpurchaseItemCodes } from "@/features/product-management/api";

interface EpurchaseItemComboboxProps {
  value: string;
  onChange: (code: string) => void;
  onSelectItem?: (item: { code: string; description: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface EpurchaseItem {
  code: string;
  description: string;
}

export default function EpurchaseItemCombobox({
  value,
  onChange,
  onSelectItem,
  placeholder = "Search E-Purchase item...",
  disabled = false,
  className,
}: EpurchaseItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [items, setItems] = useState<EpurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const loadedRef = useRef(false);
  const syncDoneRef = useRef(false);

  const loadItems = useCallback(async (search?: string) => {
    setLoading(true);
    setSessionError(false);
    try {
      const data = await fetchEpurchaseItemCodes(search);
      setItems(data);
      loadedRef.current = true;
    } catch {
      setItems([]);
      setSessionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setQuery(value || "");
    syncDoneRef.current = false;
  }, [value]);

  // When items load and value exists, fire onSelectItem once so parent can auto-fill description
  useEffect(() => {
    if (loadedRef.current && value && onSelectItem && !syncDoneRef.current) {
      const matched = items.find((i) => i.code === value);
      if (matched) {
        syncDoneRef.current = true;
        onSelectItem(matched);
      }
    }
  }, [items, value, onSelectItem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [items, query]);

  const queryValue = query.trim();
  const canType = queryValue.length > 0 && !items.some((i) => i.code.toLowerCase() === queryValue.toLowerCase());

  return (
    <Combobox
      value={value}
      onValueChange={(v) => {
        const code = v === null ? "" : String(v);
        onChange(code);
        setQuery(code);
        const matched = items.find((i) => i.code === code);
        if (matched && onSelectItem) onSelectItem(matched);
      }}
      inputValue={query}
      onInputValueChange={(v) => setQuery(String(v ?? ""))}
      items={filtered}
      filter={null}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && !loadedRef.current) loadItems();
      }}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={loading ? "Loading..." : sessionError ? "Type item code..." : placeholder}
        disabled={disabled || loading}
        showClear={!!value}
        className={className}
      />
      <ComboboxContent className="min-w-80">
        {sessionError && filtered.length === 0 && (
          <ComboboxEmpty>
            <span className="text-muted-foreground">Type an item code manually</span>
          </ComboboxEmpty>
        )}
        {!sessionError && filtered.length === 0 && !loading && (
          <ComboboxEmpty>No items found.</ComboboxEmpty>
        )}
        <ComboboxList>
          {filtered.map((item) => (
            <ComboboxItem key={item.code} value={item.code}>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium">{item.code}</span>
                  {value === item.code && <Check className="size-3.5 shrink-0 text-primary" />}
                </div>
                <span className="truncate text-xs text-muted-foreground">{item.description}</span>
              </div>
            </ComboboxItem>
          ))}
          {canType && (
            <ComboboxItem value={queryValue}>
              <span className="text-xs text-muted-foreground">
                Use &quot;{queryValue}&quot;
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
