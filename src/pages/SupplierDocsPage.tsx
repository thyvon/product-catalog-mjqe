import { FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SupplierDocsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-black text-slate-900 dark:text-gray-100 tracking-tight">
            Supplier Docs
          </h1>
        </div>
      </div>

      <div className="grid gap-4">
        <a
          href="/Supplier%20Docs/20260616_Supplier%20Code%20of%20Conduct%20Acknowledgement%20Form%E2%80%8B%20V1.2_Khmer.pdf"
          target="_blank"
          className="block bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
              <FileText className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                Supplier Code of Conduct Acknowledgement Form V1.2 (Khmer)
              </h3>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                PDF Document
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-500 font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              Open &rarr;
            </span>
          </div>
        </a>

        <a
          href="/Supplier%20Docs/20260617_%20Vendor_%20Registration%20and%20Onboarding%20_Guideline.docx"
          target="_blank"
          className="block bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                Vendor Registration and Onboarding Guideline
              </h3>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                Word Document
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-500 font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              Open &rarr;
            </span>
          </div>
        </a>
      </div>

      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-5">
        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
          These documents contain the official Supplier Code of Conduct, Vendor Registration,
          and Onboarding guidelines. Click on a document to open it in a new tab.
        </p>
      </div>
    </div>
  );
}
