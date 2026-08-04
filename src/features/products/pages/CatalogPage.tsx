import { useState, useEffect, useCallback, useRef } from "react";
import {
  PlusCircle as AddCircle,
  RefreshCw as Refresh,
  AlertCircle as DangerCircle,
  ShoppingBag as Bag,
  FileText,
  Download,
  LayoutGrid as Widget,
  List,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Product, ProductInput } from "@/features/shared/types";
import { useAuth } from "@/features/auth/AuthContext";
import ProductGalleryView from "@/features/products/components/ProductGalleryView";
import ProductListView from "@/features/products/components/ProductListView";
import ProductDetailModal from "@/features/products/components/ProductDetailModal";
import ProductFormModal from "@/features/products/components/ProductFormModal";
import ExcelImportModal from "@/features/products/components/ExcelImportModal";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { useConfirmModal } from "@/features/shared/hooks";
import { motion, AnimatePresence } from "motion/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

export default function CatalogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "Admin";

  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortBy, setSortBy] = useState<"name" | "code">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUoms, setAllUoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback((overrides: Record<string, any> = {}) => {
    const p = {
      page: currentPage,
      pageSize,
      search: searchQuery,
      category: selectedCategory,
      status: statusFilter,
      sort: sortBy,
      ...overrides,
    };
    return new URLSearchParams(
      Object.entries(p).filter(([, v]) => v !== "" && v !== undefined && v !== "all").map(([k, v]) => [k, String(v)])
    ).toString();
  }, [currentPage, pageSize, searchQuery, selectedCategory, statusFilter, sortBy]);

  const fetchCatalog = useCallback(async (overrides: Record<string, any> = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/products?${buildParams(overrides)}`);
      if (!res.ok) throw new Error("Could not load products catalog from database server APIs.");
      const data = await res.json();
      setProducts(data.data ?? []);
      setTotal(data.total ?? 0);
      setCategories(data.categories ?? []);
      setAllUoms(data.uoms ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to establish real-time link with catalog databases.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Refetch on filter/page/sort changes; debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchCatalog(), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [fetchCatalog]);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    setCurrentPage(1);
  };

  const resetPage = () => setCurrentPage(1);

  const handleOpenDetailModal = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  }, []);

  const handleAddEditProduct = useCallback(async (productData: ProductInput | Product) => {
    try {
      const isEdit = "id" in productData;
      const url = isEdit ? `/api/products/${(productData as Product).id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to persist catalog product changes.");
      }
      setIsFormOpen(false);
      setEditingProduct(null);
      await fetchCatalog();
      toast.success(isEdit ? "Product has been updated." : "Product has been created.");
    } catch (err: any) {
      toast.error(`Error submitting product details config: ${err.message}`);
    }
  }, [fetchCatalog, toast]);

  const handleDeleteProduct = useCallback(async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    confirm(
      "Confirm Deletion",
      `Are you sure you want to permanently delete SKU "${target.productCode}" (${target.name}) from catalog database?`,
      async () => {
        closeConfirm();
        try {
          const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Unable to execute delete commands on the server.");
          await fetchCatalog();
          toast.success("Product has been deleted.");
        } catch (err: any) {
          toast.error(`Error removing SKU from database: ${err.message}`);
        }
      },
    );
  }, [products, fetchCatalog, confirm, closeConfirm, toast]);

  const triggerExportCSV = useCallback(async () => {
    try {
      const res = await fetch(`/api/products?${buildParams({ page: 1, pageSize: 0 })}`);
      if (!res.ok) return;
      const data = await res.json();
      const all: Product[] = data.data;
      if (all.length === 0) return;
      const headers = ["Product Code", "Product Name", "Description", "UoM", "Category", "Sub Category", "Status", "Price", "Stock", "Image URL"];
      const rows = all.map((p) => [
        p.productCode, p.name, p.description.replace(/"/g, '""'), p.uom, p.category,
        p.subCategory, p.status,
        p.price !== undefined ? String(p.price) : "",
        p.stock !== undefined ? String(p.stock) : "",
        p.imageUrl || "",
      ]);
      const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `Premium_Catalog_Export_${new Date().toISOString().split("T")[0]}.csv`);
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
        title="PRODUCT CATALOG"
        totalCount={total}
        description={`Showing ${products.length} of ${total} registered specs`}
        actions={(
          <>
            <Tooltip>
              <TooltipTrigger render={<Button onClick={() => fetchCatalog()} variant="outline" size="icon">
                <Refresh className={loading ? "animate-spin" : ""} />
              </Button>} />
              <TooltipContent>Reload catalog</TooltipContent>
            </Tooltip>
            <Button onClick={triggerExportCSV} disabled={total === 0} variant="outline">
              <Download /> Export CSV
            </Button>
            {isAdmin && (
              <>
                <Button onClick={() => setIsImportOpen(true)}>
                  <FileText /> Import Excel/CSV
                </Button>
                <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}>
                  <AddCircle /> Register SKU
                </Button>
              </>
            )}
          </>
        )}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search products by SKU Code or name specifications..."
        activeFilterCount={[selectedCategory, statusFilter !== "active" ? statusFilter : ""].filter(Boolean).length}
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
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="All Lifecycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lifecycles</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Staged</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: "name" | "code") => { setSortBy(v); resetPage(); }}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="Sort: Name (A-Z)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Product Name (A-Z)</SelectItem>
                <SelectItem value="code">Sort: Product Code</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        filterEnd={(
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "gallery" | "list")}>
            <TabsList>
              <TabsTrigger value="gallery"><Widget /> Gallery</TabsTrigger>
              <TabsTrigger value="list"><List /> Table</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      >
        {error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 space-y-4">
            <DangerCircle className="w-10 h-10 text-destructive mx-auto animate-bounce" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-destructive">Connection Interrupted</h3>
            <p className="text-xs text-destructive leading-relaxed font-medium">{error}</p>
            <Button onClick={() => fetchCatalog()} variant="outline">Retry</Button>
          </div>
        ) : !loading && total === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-3xl max-w-xl mx-auto mt-8 p-8 space-y-4 shadow-sm">
            <Bag className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-foreground">No Matching Products Found</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                No product SKU matched your filters. Modify parameters or import spreadsheets.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                onClick={() => { setSearchQuery(""); setSelectedCategory(""); setStatusFilter("all"); }}
                variant="outline"
              >
                Reset Search Filters
              </Button>
              {isAdmin && (
                <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}>
                  Register Single SKU
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
                      isAdmin={isAdmin}
                      onView={handleOpenDetailModal}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteProduct}
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
                    isAdmin={isAdmin}
                    onView={handleOpenDetailModal}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteProduct}
                    loading={loading}
                    pagination={paginationConfig}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <ProductDetailModal
          product={selectedProduct}
          isOpen={isDetailOpen}
          onClose={() => { setIsDetailOpen(false); setSelectedProduct(null); }}
        />

        <ProductFormModal
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingProduct(null); }}
          onSubmit={handleAddEditProduct}
          editingProduct={editingProduct}
          allCategories={categories}
          allUoms={allUoms}
        />

        <ExcelImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={async () => {
            setIsImportOpen(false);
            await fetchCatalog();
            toast.success("Products imported successfully.");
          }}
        />

        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />
      </ListPageLayout>
    </PageContent>
  );
}
