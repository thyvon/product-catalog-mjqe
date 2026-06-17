import React, { useState, useRef } from "react";
import {
  XCircle as CloseCircle,
  FileText,
  Download,
  AlertCircle as DangerCircle,
  CheckCircle,
  CloudUpload,
  Eye,
  RefreshCw as Refresh,
  Layers,
} from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate a fully compliant Excel (.xlsx) template file client-side
  const downloadExcelTemplate = () => {
    // Column Headers matching the required fields
    const headers = [
      "Product Code",
      "Product Name",
      "UoM",
      "Category",
      "Sub Category",
      "Status",
      "Price (Optional)",
      "Stock (Optional)"
    ];

    // Some actual starting sample catalog rows
    const sampleRows = [
      [
        "PROD-EL-901",
        "AeroListen Silent Headphones XL",
        "Pcs",
        "Electronics",
        "Audio Gear",
        "Active",
        "199.99",
        "50"
      ],
      [
        "PROD-HL-055",
        "ThermaKeep Intelligent Thermos",
        "Box",
        "Home & Lifestyle",
        "Smart Kitchen",
        "Active",
        "24.50",
        "120"
      ],
      [
        "PROD-OT-211",
        "GelGrip Solid Ink Pen 0.7mm",
        "Doz",
        "Office Tools",
        "Pens",
        "Inactive",
        "12.00",
        "0"
      ]
    ];

    const worksheetData = [headers, ...sampleRows];
    
    // Build actual SheetJS workbook
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catalog Template");

    // Write binary container & trigger download
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "Catalog_Import_Template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessCount(null);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessCount(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Parse Excel / CSV files client side
  const processFile = (selectedFile: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setErrorMsg("Invalid file format. Please upload a spreadsheet file (.xlsx, .xls or .csv).");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook;

        if (ext === ".csv") {
          workbook = XLSX.read(data, { type: "string" });
        } else {
          workbook = XLSX.read(data, { type: "binary" });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("No parsed data recognized inside this spreadsheet.");
        }

        // Standardize column keys mapping
        const formatted = rawJson.map((row: any) => {
          // Normalize matching values
          const codeVal = row["Product Code"] || row["ProductCode"] || row["Code"] || row["productCode"] || row["PRODUCT CODE"];
          const nameVal = row["Product Name"] || row["ProductName"] || row["Name"] || row["productName"] || row["PRODUCT NAME"] || row["Product Name/Description"];
          const descriptionVal = row["Description"] || row["description"] || row["Product Name/Description"] || "";
          const uomVal = row["UoM"] || row["UOM"] || row["uom"] || row["Unit"] || "Pcs";
          const catVal = row["Category"] || row["category"] || row["CATEGORY"] || "General";
          const subCatVal = row["Sub Category"] || row["SubCategory"] || row["subcategory"] || "";
          const statusVal = row["Status"] || row["status"] || "Active";
          
          const priceVal = row["Price"] || row["price"] || row["Price (Optional)"] || undefined;
          const stockVal = row["Stock"] || row["stock"] || row["Stock (Optional)"] || undefined;

          return {
            productCode: codeVal ? String(codeVal).toUpperCase().trim() : "",
            name: nameVal ? String(nameVal).trim() : "",
            description: descriptionVal ? String(descriptionVal).trim() : (nameVal ? String(nameVal).trim() : ""),
            uom: uomVal ? String(uomVal).trim() : "Pcs",
            category: catVal ? String(catVal).trim() : "General",
            subCategory: subCatVal ? String(subCatVal).trim() : "General",
            status: ["Active", "Inactive", "Discontinued"].includes(statusVal) ? statusVal : "Active",
            price: priceVal ? parseFloat(priceVal) : undefined,
            stock: stockVal ? parseInt(stockVal, 10) : undefined,
          };
        });

        // Basic sanity check: Is there a Product Code and Name on rows?
        const validatedRows = formatted.filter(r => r.productCode && r.name);
        
        if (validatedRows.length === 0) {
          throw new Error("Could not detect any rows matching headers 'Product Code' and 'Product Name'. Please download our template to see formatting!");
        }

        setParsedRows(validatedRows);
      } catch (err: any) {
        console.error("Excel format error:", err);
        setErrorMsg(err.message || "Unable to extract items from your spreadsheet.");
        setFile(null);
        setParsedRows([]);
      } finally {
        setLoading(false);
      }
    };

    if (ext === ".csv") {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsBinaryString(selectedFile);
    }
  };

  // Submit batch payload to backend
  const triggerImportSubmit = async () => {
    if (parsedRows.length === 0) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRows),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to commit spreadsheet upload.");
      }

      setSuccessCount(data.count);
      setParsedRows([]);
      setFile(null);

      // Trigger hot state callback
      setTimeout(() => {
        onImportComplete();
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred uploading batch entries.");
    } finally {
      setLoading(false);
    }
  };

  const clearStagedFile = () => {
    setFile(null);
    setParsedRows([]);
    setErrorMsg("");
    setSuccessCount(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop filter */}
        <motion.div
          id="import-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Floating Modal Frame */}
        <motion.div
          id="import-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative bg-white dark:bg-gray-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-gray-800 flex flex-col z-10 max-h-[88vh]"
        >
          {/* Header Panel */}
          <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Import Catalog from Excel or CSV
              </h2>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                Bulk register, update, and manage products from `.xlsx`, `.xls` or `.csv` files
              </p>
            </div>
            <button
              id="close-import-btn"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 rounded-full transition-colors cursor-pointer"
            >
              <CloseCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
            {/* Guide & Template download */}
            <div className="bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">
                  Column Specification Standard
                </span>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed max-w-lg">
                  Ensure headers contain: <strong className="text-slate-700 dark:text-gray-200">Product Code</strong>, <strong className="text-slate-700 dark:text-gray-200">Product Name</strong>, <strong className="text-slate-700 dark:text-gray-200">UoM</strong>, <strong className="text-slate-700 dark:text-gray-200">Category</strong>, <strong className="text-slate-700 dark:text-gray-200">Sub Category</strong>, and <strong className="text-slate-700 dark:text-gray-200">Status</strong>.
                </p>
              </div>

              <button
                id="btn-download-excel-template"
                onClick={downloadExcelTemplate}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-750 dark:hover:text-indigo-300 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-150/40 dark:border-indigo-800/40 shadow-sm flex items-center gap-1 cursor-pointer shrink-0 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
              </button>
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                <DangerCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success notifications */}
            {successCount !== null && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-150/30 dark:border-emerald-800 rounded-xl text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-gray-100">Batch Ingestion Successful!</h4>
                <p className="text-[11px] text-emerald-650 dark:text-emerald-400 font-mono">
                  Succesfully ingested {successCount} products into database v2 catalog! Reloading grid...
                </p>
              </div>
            )}

            {/* File Drag-and-drop zone */}
            {!file && successCount === null && (
              <div
                id="excel-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-indigo-500 bg-slate-50/20 dark:bg-gray-800/20 hover:bg-indigo-50/5 dark:hover:bg-indigo-900/10 p-10 rounded-2xl text-center space-y-3 cursor-pointer transition-all"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 flex items-center justify-center mx-auto group-hover:text-indigo-600 transition-colors">
                  <CloudUpload className="w-6 h-6 text-slate-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-gray-300">
                    Drag and drop your spreadsheet here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1 font-mono">
                    Supports Microsoft Excel (.xlsx, .xls) and raw Comma Separated (.csv) files
                  </p>
                </div>
              </div>
            )}

            {/* Ingestion Table preview stage */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Staging Spreadsheet Preview ({parsedRows.length} valid rows detected)
                  </span>
                  <button
                    id="btn-remove-file"
                    onClick={clearStagedFile}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-bold transition-all cursor-pointer"
                  >
                    Clear Spreadsheet
                  </button>
                </div>

                {/* Staging grid table preview */}
                <div className="border border-slate-100 dark:border-gray-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-gray-800/30 max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 font-mono tracking-wider font-bold uppercase sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2 w-1/5">Code</th>
                        <th className="px-3.5 py-2 w-1/3">Name/Title</th>
                        <th className="px-3 py-2">UoM</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-sans">
                      {parsedRows.slice(0, 15).map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/50 bg-white dark:bg-gray-900 transition-colors">
                          <td className="px-3.5 py-1.5 font-bold font-mono text-slate-700 dark:text-gray-200 uppercase tracking-wide">
                            {row.productCode}
                          </td>
                          <td className="px-3.5 py-1.5 text-slate-800 dark:text-gray-100 line-clamp-1 truncate mt-0.5 font-medium">
                            {row.name}
                          </td>
                          <td className="px-3 py-1.5 text-indigo-750 dark:text-indigo-400 font-bold font-mono">
                            {row.uom}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 dark:text-gray-400 font-medium">
                            {row.category}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              row.status === "Active" 
                                ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" 
                                : row.status === "Inactive"
                                  ? "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                  : "bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 15 && (
                    <div className="text-[10px] text-center text-slate-400 dark:text-gray-500 py-2.5 font-mono border-t border-slate-100 dark:border-gray-800 bg-slate-50/20 dark:bg-gray-800/20">
                      ...and {parsedRows.length - 15} additional rows ready in staging buffer
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dialog Action buttons */}
          <div className="p-4 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 bg-slate-50/30 dark:bg-gray-800/30">
            <button
              id="import-cancel-btn"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              id="import-finalize-btn"
              onClick={triggerImportSubmit}
              disabled={loading || parsedRows.length === 0}
              className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                loading || parsedRows.length === 0
                  ? "bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {loading ? (
                <>
                  <Refresh className="w-4 h-4 animate-spin text-slate-400" />
                  Finalizing upload ingestion...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Finalize and Upload {parsedRows.length} items
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
