import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw as Refresh,
  AlertCircle as DangerCircle,
  ShoppingBag as Bag,
  LayoutGrid as Widget,
  List,
  Download,
} from "lucide-react";
import { Product } from "@/features/shared/types";
import ProductGalleryView from "@/features/products/components/ProductGalleryView";
import ProductListView from "@/features/products/components/ProductListView";
import ProductDetailModal from "@/features/products/components/ProductDetailModal";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortBy, setSortBy] = useState<"name" | "code">("name");
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback((overrides: Record<string, any> = {}) => {
    const p = { page: currentPage, pageSize, search: searchQuery, category: selectedCategory, status: statusFilter, sort: sortBy, ...overrides };
    return new URLSearchParams(
      Object.entries(p).filter(([, v]) => v !== "" && v !== undefined && v !== "all").map(([k, v]) => [k, String(v)])
    ).toString();
  }, [currentPage, pageSize, searchQuery, selectedCategory, statusFilter, sortBy]);

  const fetchCatalog = useCallback(async (overrides: Record<string, any> = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/products?${buildParams(overrides)}`);
      if (!res.ok) throw new Error("Could not load products catalog.");
      const data = await res.json();
      setProducts(data.data ?? []);
      setTotal(data.total ?? 0);
      setCategories(data.categories ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load catalog.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetch("/api/visit/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "/product-list" }) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchCatalog(), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [fetchCatalog]);

  const resetPage = () => setCurrentPage(1);

  const triggerExportCSV = useCallback(async () => {
    try {
      const res = await fetch(`/api/products?${buildParams({ page: 1, pageSize: 0 })}`);
      if (!res.ok) return;
      const data = await res.json();
      const all: Product[] = data.data;
      if (all.length === 0) return;
      const headers = ["Product Code", "Product Name", "Description", "UoM", "Category", "Sub Category", "Status", "Price", "Stock", "Image URL"];
      const rows = all.map((p) => [
        p.productCode, p.name, p.description.replace(/"/g, '""'),
        p.uom, p.category, p.subCategory, p.status,
        p.price !== undefined ? String(p.price) : "",
        p.stock !== undefined ? String(p.stock) : "",
        p.imageUrl || "",
      ]);
      const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `Catalog_Export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { /* ignore */ }
  }, [buildParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const paginationConfig = {
    currentPage,
    pageSize,
    total,
    onPageChange: setCurrentPage,
    onPageSizeChange: (s: number) => { setPageSize(s); setCurrentPage(1); },
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };

  return (
    <PageContent>
      <ListPageLayout
        title="Product Catalog"
        description={`${products.length} of ${total} product${total !== 1 ? "s" : ""} shown`}
        actions={(
          <>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon" onClick={() => fetchCatalog()}>
                <Refresh className={loading ? "animate-spin" : ""} />
              </Button>} />
              <TooltipContent>Reload catalog</TooltipContent>
            </Tooltip>
            <Button onClick={triggerExportCSV} disabled={total === 0} variant="outline" size="sm">
              <Download /> Export CSV
            </Button>
          </>
        )}
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); resetPage(); }}
        searchPlaceholder="Search by SKU code or name..."
        filters={(
          <>
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); resetPage(); }}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: "all" | "active" | "inactive") => { setStatusFilter(v); resetPage(); }}>
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="All Lifecycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lifecycles</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: "name" | "code") => { setSortBy(v); resetPage(); }}>
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Sort: Name (A-Z)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
                <SelectItem value="code">Sort: Product Code</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "gallery" | "list")}>
              <TabsList>
                <TabsTrigger value="gallery"><Widget /></TabsTrigger>
                <TabsTrigger value="list"><List /></TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      >
        {error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 space-y-4">
            <DangerCircle className="w-10 h-10 text-destructive mx-auto animate-bounce" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-destructive">Connection Interrupted</h3>
            <p className="text-xs text-destructive leading-relaxed font-medium">{error}</p>
            <Button onClick={() => fetchCatalog()}>Try Again</Button>
          </div>
        ) : !loading && total === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-3xl max-w-xl mx-auto mt-8 p-8 space-y-4 shadow-sm">
            <Bag className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Products Found</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              No products match your filters or search terms.
            </p>
            <Button
              onClick={() => { setSearchQuery(""); setSelectedCategory(""); setStatusFilter("active"); }}
              variant="outline"
              size="sm"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {viewMode === "gallery" ? (
                <>
                  <ProductGalleryView
                    products={products}
                    isAdmin={false}
                    onView={(p) => { setSelectedProduct(p); setIsDetailOpen(true); }}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center mt-6">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                              className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                          {(() => {
                            const pages: (number | "...")[] = [];
                            if (totalPages <= 5) {
                              for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                              pages.push(1);
                              if (currentPage > 3) pages.push("...");
                              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                              if (currentPage < totalPages - 2) pages.push("...");
                              pages.push(totalPages);
                            }
                            return pages.map((page, i) =>
                              page === "..." ? (
                                <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                              ) : (
                                <PaginationItem key={page}>
                                  <PaginationLink isActive={page === currentPage} onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}>{page}</PaginationLink>
                                </PaginationItem>
                              ),
                            );
                          })()}
                          <PaginationItem>
                            <PaginationNext
                              onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <ProductListView
                  products={products}
                  isAdmin={false}
                  onView={(p) => { setSelectedProduct(p); setIsDetailOpen(true); }}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  loading={loading}
                  pagination={paginationConfig}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </ListPageLayout>

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedProduct(null); }}
      />
    </PageContent>
  );
}
