import { useState } from "react";

interface ListPageStateOptions {
  initialPageSize?: number;
}

export function useListPageState(opts?: ListPageStateOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts?.initialPageSize ?? 10);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSortChange = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    setCurrentPage(1);
  };

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortState: sortKey ? { key: sortKey, dir: sortDir } : undefined,
    onSortChange: handleSortChange,
  };
}
