import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadItems = useCallback(async (search?: string) => {
    setLoading(true);
    setSessionError(false);
    try {
      const data = await fetchEpurchaseItemCodes(search);
      if (!search) {
        setItems(data);
      } else {
        setItems((prev) => {
          const map = new Map(prev.map((i) => [i.code, i]));
          for (const item of data) map.set(item.code, item);
          return Array.from(map.values());
        });
      }
      loadedRef.current = true;
    } catch {
      setItems([]);
      setSessionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (value) loadItems(value);
  }, [loadItems, value]);

  useEffect(() => {
    setQuery(value || "");
    syncDoneRef.current = false;
  }, [value]);

  useEffect(() => {
    if (loadedRef.current && value && onSelectItem && !syncDoneRef.current) {
      const matched = items.find((i) => i.code === value);
      if (matched) {
        syncDoneRef.current = true;
        onSelectItem(matched);
      }
    }
  }, [items, value, onSelectItem]);

  const handleInputChange = useCallback((v: string) => {
    setQuery(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = v.trim();
    if (trimmed.length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        loadItems(trimmed);
      }, 400);
    }
  }, [loadItems]);

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
      itemToStringValue={(item) => {
        const ep = item as unknown as EpurchaseItem;
        return ep.code;
      }}
      inputValue={query}
      onInputValueChange={(v) => handleInputChange(String(v ?? ""))}
      items={items}
      filter={(item, q) => {
        const ep = item as unknown as EpurchaseItem;
        const search = q.toLowerCase();
        return ep.code.toLowerCase().includes(search) || ep.description.toLowerCase().includes(search);
      }}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && !loadedRef.current) loadItems();
      }}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={loading ? "Searching..." : sessionError ? "Type item code..." : placeholder}
        disabled={disabled || loading}
        showClear={!!value}
        className={className}
        autoFocus
      />
      {loading && (
        <div className="pointer-events-none absolute inset-y-0 end-10 flex items-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <ComboboxContent>
        {sessionError && items.length === 0 && (
          <ComboboxEmpty>
            <span className="text-muted-foreground">Type an item code manually</span>
          </ComboboxEmpty>
        )}
        {!sessionError && (
          <ComboboxEmpty>
            {loading ? "Searching..." : "No items found."}
          </ComboboxEmpty>
        )}
        <ComboboxList>
          {items.map((item) => (
            <ComboboxItem key={item.code} value={item.code}>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium">{item.code}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.description}</span>
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
