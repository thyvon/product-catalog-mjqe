import { useState, useEffect, useMemo } from "react";
import {
  PlusCircle as AddCircle,
  Search as Magnifer,
  Filter,
  RefreshCw as Refresh,
  AlertCircle as DangerCircle,
  ShoppingBag as Bag,
  ArrowDownAZ as SortByAlphabet,
  FileText,
  Download,
  LayoutGrid as Widget,
  List,
  ChevronLeft as AltArrowLeft,
  ChevronRight as AltArrowRight,
} from "lucide-react";
import { Product, ProductInput } from "../types";
import { useAuth } from "../contexts/AuthContext";
import ProductGalleryView from "../components/ProductGalleryView";
import ProductListView from "../components/ProductListView";
import ProductDetailModal from "../components/ProductDetailModal";
import ProductFormModal from "../components/ProductFormModal";
import ExcelImportModal from "../components/ExcelImportModal";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import { motion, AnimatePresence } from "motion/react";

export default function CatalogPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "Admin";
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sortBy, setSortBy] = useState<"name" | "code" | "price-asc" | "price-desc">("name");

  const [priceBudget, setPriceBudget] = useState<number>(500);
  const [maxAvailablePrice, setMaxAvailablePrice] = useState<number>(500);

  const [showFilters, setShowFilters] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertOpen(true);
  };

  const fetchCatalog = async () => {
    setLoading(true);
    setError("");
    try {
      const prodRes = await fetch("/api/products");
      if (!prodRes.ok) throw new Error("Could not load products catalog from database server APIs.");
      const prodData = await prodRes.json();
      setProducts(prodData);

      const validPrices = prodData.filter((p: Product) => p.price !== undefined).map((p: Product) => p.price);
      if (validPrices.length > 0) {
        const maxP = Math.ceil(Math.max(...validPrices));
        setMaxAvailablePrice(maxP);
        setPriceBudget((prev) => (prev === 500 || prev === 200 ? maxP : prev));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to establish real-time link with catalog databases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleAddEditProduct = async (productData: ProductInput | Product) => {
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
    } catch (err: any) {
      showAlert(`Error submitting product details config: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    setConfirmState({
      isOpen: true,
      title: "Confirm Deletion",
      message: `Are you sure you want to permanently delete SKU "${target.productCode}" (${target.name}) from catalog database?`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Unable to execute delete commands on the server.");
          }

          await fetchCatalog();
        } catch (err: any) {
          showAlert(`Error removing SKU from database: ${err.message}`);
        }
      },
    });
  };

  const triggerExportCSV = () => {
    if (products.length === 0) return;

    const headers = ["Product Code", "Product Name", "Description", "UoM", "Category", "Sub Category", "Status", "Price", "Stock", "Image URL"];
    const rows = products.map((p) => [
      p.productCode,
      p.name,
      p.description.replace(/"/g, '""'),
      p.uom,
      p.category,
      p.subCategory,
      p.status,
      p.price !== undefined ? String(p.price) : "",
      p.stock !== undefined ? String(p.stock) : "",
      p.imageUrl || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Premium_Catalog_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === "" ||
      p.name.toLowerCase().includes(query) ||
      p.productCode.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      (p.subCategory && p.subCategory.toLowerCase().includes(query));

    const matchesCategory = selectedCategory === "" || p.category === selectedCategory;

    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus = p.status === "Active";
    } else if (statusFilter === "inactive") {
      matchesStatus = p.status === "Inactive";
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "code":
        return a.productCode.localeCompare(b.productCode);
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const productUoms = useMemo(() => {
    const uoms = new Set(products.map((p) => p.uom).filter(Boolean));
    return Array.from(uoms).sort();
  }, [products]);

  const [pageSize, setPageSize] = useState<number>(12);
  const [currentPage, setCurrentPage] = useState(1);
  const size = pageSize === 0 ? sortedProducts.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / size));
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * size,
    currentPage * size
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, statusFilter, sortBy, pageSize]);

  const activeCount = products.filter((p) => p.status === "Active").length;

  return (
    <div className="p-4 lg:p-6 flex flex-col min-h-0 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
            <Bag className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-gray-100 font-sans tracking-tight">
            PRODUCT CATALOG for PROD CEN WH - ឃ្លាំងលទ្ធកម្មសាខាកណ្ដាល
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all flex items-center justify-center h-9"
            title="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={fetchCatalog}
            title="Reload catalog"
            className="p-2.5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all flex items-center justify-center h-9"
          >
            <Refresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={triggerExportCSV}
            disabled={products.length === 0}
            className="h-9 px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setIsImportOpen(true)}
                className="h-9 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all dark:bg-emerald-700 dark:hover:bg-emerald-800"
              >
                <FileText className="w-4 h-4" /> Import Excel/CSV
              </button>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsFormOpen(true);
                }}
                className="h-9 px-3.5 py-2 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all dark:bg-indigo-700 dark:hover:bg-indigo-800"
              >
                <AddCircle className="w-4 h-4" /> Register SKU
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-4 mb-5 shadow-sm space-y-3 ${
        showFilters ? "block" : "hidden lg:block"
      }`}>
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-stretch gap-3 flex-1">
            <div className="relative flex-1">
              <Magnifer className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by SKU Code or name specifications..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-700 rounded-2xl text-xs bg-slate-50/20 dark:bg-gray-800/50 hover:bg-slate-50/45 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-gray-200"
              />
            </div>
            <div className="sm:w-56 shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-slate-500 dark:text-gray-400 focus:border-indigo-500 focus:outline-none bg-slate-50/40 dark:bg-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer min-h-[36px]"
              >
                <option value="">All Categories ({products.length})</option>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat).length;
                  return (
                    <option key={cat} value={cat}>
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-500 dark:text-gray-400 focus:border-indigo-500 focus:outline-none bg-slate-50/40 dark:bg-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <option value="all">All Lifecycles</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Staged</option>

              </select>
            </div>

            <div>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-500 dark:text-gray-400 focus:border-indigo-500 focus:outline-none bg-slate-50/40 dark:bg-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <option value="name">Sort: Product Name (A-Z)</option>
                <option value="code">Sort: Product Code</option>
              </select>
            </div>

            <div className="flex items-center border border-slate-200 dark:border-gray-700 rounded-xl p-1 bg-slate-50/60 dark:bg-gray-800/60 ml-1.5">
              <button
                onClick={() => setViewMode("gallery")}
                title="Gallery view layout"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "gallery"
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 shadow-sm"
                    : "text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
                }`}
              >
                <Widget className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="Detailed list view layout"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 shadow-sm"
                    : "text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Refresh className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 space-y-4">
            <DangerCircle className="w-10 h-10 text-rose-500 mx-auto animate-bounce" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800">Connection Interrupted</h3>
            <p className="text-xs text-rose-600 leading-relaxed font-medium">
              {error}
            </p>
            <button
              onClick={fetchCatalog}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all"
            >
              Verify Connections
            </button>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-3xl max-w-xl mx-auto mt-8 p-8 space-y-4 shadow-sm">
            <Bag className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200">No Matching Products Found</h3>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
                We couldn't locate any product SKU matching your filters or search terms inside this category. Modify parameters or import spreadsheets.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("");
                  setStatusFilter("all");
                  setPriceBudget(maxAvailablePrice);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Reset Search Filters
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setIsFormOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  Register Single SKU
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 px-1">
              <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase tracking-widest font-bold flex items-center gap-1">
                <SortByAlphabet className="w-3.5 h-3.5 text-indigo-500" /> Showing {paginatedProducts.length} of {products.length} registered specs
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
                {selectedCategory && (
                  <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 py-0.5 px-3 rounded-full uppercase tracking-wider">
                    {selectedCategory}
                  </span>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {viewMode === "gallery" ? (
                  <ProductGalleryView
                    products={paginatedProducts}
                    isAdmin={isAdmin}
                    onView={handleOpenDetailModal}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteProduct}
                  />
                ) : (
                  <ProductListView
                    products={paginatedProducts}
                    isAdmin={isAdmin}
                    onView={handleOpenDetailModal}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteProduct}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 dark:border-gray-700 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <AltArrowLeft className="w-4 h-4" />
                </button>
                {(() => {
                  const pages: (number | "...")[] = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[36px] h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          page === currentPage
                            ? "bg-slate-900 dark:bg-indigo-700 text-white shadow-sm"
                            : "border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <AltArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedProduct(null);
        }}
      />

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleAddEditProduct}
        editingProduct={editingProduct}
        allCategories={categories}
        allUoms={productUoms}
      />

      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
        }}
        onImportComplete={async () => {
          setIsImportOpen(false);
          await fetchCatalog();
        }}
      />

      <AlertModal
        isOpen={isAlertOpen}
        message={alertMessage}
        onClose={() => setIsAlertOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
