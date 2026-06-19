import React, { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Supplier, SupplierInput } from "../types";

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierInput) => Promise<void>;
  editingSupplier: Supplier | null;
}

const STEPS = [
  { id: 1, label: "Application", sub: "New or update" },
  { id: 2, label: "Company", sub: "Legal information" },
  { id: 3, label: "Business", sub: "Activity and address" },
  { id: 4, label: "Contact", sub: "Contact person" },
  { id: 5, label: "Bank", sub: "Bank account" },
  { id: 6, label: "Payment", sub: "Payment instruction" },
  { id: 7, label: "Conflict", sub: "Interest declaration" },
  { id: 8, label: "Declaration", sub: "Sign-off" },
];

const emptyForm: SupplierInput = {
  applicationType: "new",
  oldSupplierCode: "",
  companyName: "",
  companyNameKhmer: "",
  registrationType: "vat",
  foreignTradeOperator: false,
  contactPerson: "",
  position: "",
  email: "",
  phone: "",
  mobile: "",
  website: "",
  address: "",
  addressKhmer: "",
  cityProvince: "",
  districtKhan: "",
  businessLicense: "",
  commercialRegistration: "",
  taxRegistration: "",
  vatCertificate: "",
  patentTaxCertificate: "",
  nationalId: "",
  establishedYear: "",
  businessActivity: "",
  productServiceType: "",
  otherDocuments: "",
  bankName: "",
  bankBranch: "",
  bankAccount: "",
  accountHolderName: "",
  swiftCode: "",
  iban: "",
  checkAuthorization: false,
  paymentMethod: "bank-transfer",
  paymentMethodOther: "",
  paymentTerm: "no-credit",
  paymentTermOther: "",
  conflictOfInterest: false,
  conflictDetails: "",
  supplierDeclarationName: "",
  supplierDeclarationDate: "",
  buyerCompletedName: "",
  buyerCompletedDate: "",
  companyProfile: "",
  codeOfConductAck: false,
  status: "Pending",
  notes: "",
};

export default function SupplierFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingSupplier,
}: SupplierFormModalProps) {
  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingSupplier) {
      setForm({
        ...emptyForm,
        ...editingSupplier,
        applicationType: editingSupplier.applicationType || "new",
        registrationType: editingSupplier.registrationType || "vat",
        paymentMethod: editingSupplier.paymentMethod || "bank-transfer",
        paymentTerm: editingSupplier.paymentTerm || "no-credit",
        status: editingSupplier.status || "Pending",
      });
    } else {
      setForm(emptyForm);
    }
    setStep(1);
  }, [editingSupplier, isOpen]);

  const handleChange = <K extends keyof SupplierInput>(field: K, value: SupplierInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep((current) => Math.min(current + 1, STEPS.length));
  const prevStep = () => setStep((current) => Math.max(current - 1, 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800 dark:focus:ring-indigo-900/40";
  const labelClass = "text-[11px] font-bold text-slate-600 dark:text-gray-300";
  const helperClass = "text-[10px] font-semibold text-slate-400 dark:text-gray-500";
  const checkClass = "mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500";

  const Field = ({
    label,
    kh,
    children,
    wide = false,
  }: {
    label: string;
    kh?: string;
    children: React.ReactNode;
    wide?: boolean;
  }) => (
    <label className={wide ? "col-span-1 md:col-span-2" : ""}>
      <span className={labelClass}>
        {label}
        {kh && <span className={helperClass}> / {kh}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );

  const SectionTitle = ({ title, kh }: { title: string; kh: string }) => (
    <div className="col-span-1 md:col-span-2 border-b border-slate-100 pb-2 dark:border-gray-800">
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-gray-100">{title}</h3>
      <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-gray-500">{kh}</p>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="application" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="1. Application Type" kh="First line in the document: new supplier or update existing supplier." />
            <Field label="Application Type" kh="អ្នកផ្គត់ផ្គង់ថ្មី / បច្ចុប្បន្នភាព">
              <select value={form.applicationType} onChange={(e) => handleChange("applicationType", e.target.value as SupplierInput["applicationType"])} className={inputClass}>
                <option value="new">New supplier</option>
                <option value="update">Update existing supplier</option>
              </select>
            </Field>
            <Field label="Old Supplier Code" kh="លេខកូដអ្នកផ្គត់ផ្គង់ចាស់">
              <input value={form.oldSupplierCode} onChange={(e) => handleChange("oldSupplierCode", e.target.value)} className={inputClass} placeholder="Fill only when updating an existing supplier" disabled={form.applicationType !== "update"} />
            </Field>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="company" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="2. Company / Legal Information" kh="This follows the first supplier information rows in the document." />
            <Field label="Company / Shop Name in Khmer" kh="ឈ្មោះក្រុមហ៊ុន / ហាង (ខ្មែរ)">
              <input value={form.companyNameKhmer} onChange={(e) => handleChange("companyNameKhmer", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Company / Shop Name in English" kh="ឈ្មោះក្រុមហ៊ុន / ហាង (អង់គ្លេស)">
              <input value={form.companyName} onChange={(e) => handleChange("companyName", e.target.value)} className={inputClass} required />
            </Field>
            <Field label="Commercial Registration Certificate" kh="វិញ្ញាបនបត្រចុះបញ្ជីពាណិជ្ជកម្ម">
              <input value={form.commercialRegistration} onChange={(e) => handleChange("commercialRegistration", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Tax Registration" kh="ចុះបញ្ជីពន្ធដារ">
              <input value={form.taxRegistration} onChange={(e) => handleChange("taxRegistration", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Patent Tax Certificate" kh="បណ្ណពន្ធប៉ាតង់">
              <input value={form.patentTaxCertificate} onChange={(e) => handleChange("patentTaxCertificate", e.target.value)} className={inputClass} />
            </Field>
            <Field label="National ID Number" kh="លេខអត្តសញ្ញាណបណ្ណ">
              <input value={form.nationalId} onChange={(e) => handleChange("nationalId", e.target.value)} className={inputClass} />
            </Field>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-gray-700 md:col-span-2">
              <input type="checkbox" checked={form.foreignTradeOperator} onChange={(e) => handleChange("foreignTradeOperator", e.target.checked)} className={checkClass} />
              <span>
                <span className="font-bold text-slate-700 dark:text-gray-200">Registration for Foreign Trade Operators</span>
                <span className="block text-[10px] text-slate-400 dark:text-gray-500">International suppliers only. The document lists this after National ID.</span>
              </span>
            </label>
          </motion.div>
        );

      case 3:
        return (
          <motion.div key="business" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="3. Business Details" kh="Established year, activity, product/service, address, and other documents." />
            <Field label="VAT Status" kh="Internal helper for supplier tax type">
              <select value={form.registrationType} onChange={(e) => handleChange("registrationType", e.target.value as SupplierInput["registrationType"])} className={inputClass}>
                <option value="vat">VAT registered</option>
                <option value="non-vat">Non-VAT</option>
              </select>
            </Field>
            <Field label="Established Year" kh="ឆ្នាំបង្កើត">
              <input value={form.establishedYear} onChange={(e) => handleChange("establishedYear", e.target.value)} className={inputClass} placeholder="Example: 2020" />
            </Field>
            <Field label="Business Activity" kh="ប្រភេទអាជីវកម្ម / សកម្មភាពអាជីវករ">
              <input value={form.businessActivity} onChange={(e) => handleChange("businessActivity", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Product / Service Type" kh="ប្រភេទផលិតផល / សេវាកម្ម">
              <input value={form.productServiceType} onChange={(e) => handleChange("productServiceType", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Business Address" kh="អាសយដ្ឋានអាជីវកម្ម" wide>
              <textarea value={form.address} onChange={(e) => handleChange("address", e.target.value)} className={`${inputClass} min-h-20 resize-y`} />
            </Field>
            <Field label="Other Documents" kh="ឯកសារផ្សេងៗ" wide>
              <textarea value={form.otherDocuments} onChange={(e) => handleChange("otherDocuments", e.target.value)} className={`${inputClass} min-h-16 resize-y`} />
            </Field>
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="4. Contact Person" kh="Contact rows appear after the business details in the document." />
            <Field label="Contact Person" kh="អ្នកទំនាក់ទំនង">
              <input value={form.contactPerson} onChange={(e) => handleChange("contactPerson", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Position" kh="តួនាទី">
              <input value={form.position} onChange={(e) => handleChange("position", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone" kh="លេខទូរសព្ទ">
              <input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Mobile">
              <input value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Email" kh="សារអេឡិចត្រូនិក">
              <input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Website">
              <input value={form.website} onChange={(e) => handleChange("website", e.target.value)} className={inputClass} />
            </Field>
          </motion.div>
        );

      case 5:
        return (
          <motion.div key="bank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="5. Bank Account Information" kh="Bank section follows contact information in the document." />
            <Field label="Bank Name" kh="ឈ្មោះធនាគារ">
              <input value={form.bankName} onChange={(e) => handleChange("bankName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Branch" kh="សាខា">
              <input value={form.bankBranch} onChange={(e) => handleChange("bankBranch", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Account Name" kh="ឈ្មោះគណនី">
              <input value={form.accountHolderName} onChange={(e) => handleChange("accountHolderName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Account Number" kh="លេខគណនី">
              <input value={form.bankAccount} onChange={(e) => handleChange("bankAccount", e.target.value)} className={inputClass} />
            </Field>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-gray-700 md:col-span-2">
              <input type="checkbox" checked={form.checkAuthorization} onChange={(e) => handleChange("checkAuthorization", e.target.checked)} className={checkClass} />
              <span className="font-bold text-slate-700 dark:text-gray-200">Check collection authorization letter is available</span>
            </label>
            <Field label="SWIFT Code" kh="International only">
              <input value={form.swiftCode} onChange={(e) => handleChange("swiftCode", e.target.value)} className={inputClass} />
            </Field>
            <Field label="IBAN" kh="International only">
              <input value={form.iban} onChange={(e) => handleChange("iban", e.target.value)} className={inputClass} />
            </Field>
          </motion.div>
        );

      case 6:
        return (
          <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="6. Payment Instruction" kh="Payment method and payment term follow the bank information." />
            <Field label="Payment Method" kh="វិធីសាស្រ្តទូទាត់">
              <select value={form.paymentMethod} onChange={(e) => handleChange("paymentMethod", e.target.value as SupplierInput["paymentMethod"])} className={inputClass}>
                <option value="bank-transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Other Payment Method">
              <input value={form.paymentMethodOther} onChange={(e) => handleChange("paymentMethodOther", e.target.value)} className={inputClass} disabled={form.paymentMethod !== "other"} />
            </Field>
            <Field label="Payment Term" kh="កាលកំណត់ទូទាត់">
              <select value={form.paymentTerm} onChange={(e) => handleChange("paymentTerm", e.target.value as SupplierInput["paymentTerm"])} className={inputClass}>
                <option value="no-credit">No credit</option>
                <option value="one-week">Credit 1 week</option>
                <option value="two-weeks">Credit 2 weeks</option>
                <option value="one-month">Credit 1 month</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Other Payment Term">
              <input value={form.paymentTermOther} onChange={(e) => handleChange("paymentTermOther", e.target.value)} className={inputClass} disabled={form.paymentTerm !== "other"} />
            </Field>
          </motion.div>
        );

      case 7:
        return (
          <motion.div key="conflict" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="7. Conflict of Interest Declaration" kh="This follows payment instruction in the document." />
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-gray-700 md:col-span-2">
              <input type="checkbox" checked={form.conflictOfInterest} onChange={(e) => handleChange("conflictOfInterest", e.target.checked)} className={checkClass} />
              <span>
                <span className="font-bold text-slate-700 dark:text-gray-200">Supplier has a relationship with MJQE or procurement staff</span>
                <span className="block text-[10px] text-slate-400 dark:text-gray-500">If yes, provide the name and relationship details.</span>
              </span>
            </label>
            <Field label="Conflict Details" kh="សូមបញ្ជាក់" wide>
              <textarea value={form.conflictDetails} onChange={(e) => handleChange("conflictDetails", e.target.value)} className={`${inputClass} min-h-24 resize-y`} disabled={!form.conflictOfInterest} />
            </Field>
          </motion.div>
        );

      case 8:
        return (
          <motion.div key="declaration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="8. Final Declaration" kh="Supplier declaration first, then buyer completion, matching the final part of the document." />
            <Field label="Supplier Representative Name" kh="ឈ្មោះអ្នកផ្គត់ផ្គង់">
              <input value={form.supplierDeclarationName} onChange={(e) => handleChange("supplierDeclarationName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Supplier Declaration Date" kh="ថ្ងៃខែឆ្នាំ">
              <input type="date" value={form.supplierDeclarationDate} onChange={(e) => handleChange("supplierDeclarationDate", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Buyer Name" kh="ឈ្មោះអ្នកទិញ">
              <input value={form.buyerCompletedName} onChange={(e) => handleChange("buyerCompletedName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Buyer Completion Date" kh="ថ្ងៃខែឆ្នាំ">
              <input type="date" value={form.buyerCompletedDate} onChange={(e) => handleChange("buyerCompletedDate", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Internal Status" kh="ស្ថានភាព">
              <select value={form.status} onChange={(e) => handleChange("status", e.target.value as SupplierInput["status"])} className={inputClass}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Suspended">Suspended</option>
              </select>
            </Field>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-gray-700">
              <input type="checkbox" checked={form.codeOfConductAck} onChange={(e) => handleChange("codeOfConductAck", e.target.checked)} className={checkClass} />
              <span className="font-bold text-slate-700 dark:text-gray-200">Supplier Code of Conduct acknowledged</span>
            </label>
            <Field label="Notes" kh="ចំណាំ" wide>
              <textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} className={`${inputClass} min-h-20 resize-y`} />
            </Field>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">
                  {editingSupplier ? "Edit Vendor Registration" : "Vendor Registration Application Form"}
                </h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-gray-500">ទម្រង់ស្នើចុះបញ្ជីអ្នកផ្គត់ផ្គង់</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-gray-800" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="shrink-0 overflow-x-auto border-b border-slate-100 px-3 py-3 dark:border-gray-800 sm:px-5">
              <div className="flex min-w-max gap-1">
                {STEPS.map((s) => (
                  <button key={s.id} onClick={() => setStep(s.id)} className="flex w-32 min-w-32 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-gray-800">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        s.id === step ? "bg-slate-900 text-white dark:bg-indigo-600" : s.id < step ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 dark:bg-gray-800"
                      }`}
                    >
                      {s.id < step ? <Check className="h-3.5 w-3.5" /> : s.id}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black text-slate-700 dark:text-gray-200">{s.label}</span>
                      <span className="block truncate text-[9px] text-slate-400 dark:text-gray-500">{s.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{renderStep()}</div>

            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={step === 1 ? onClose : prevStep}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {step === 1 ? "Cancel" : "Back"}
              </button>

              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500">
                Step {step} of {STEPS.length}
              </span>

              {step < STEPS.length ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !form.companyName.trim()}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {editingSupplier ? "Save Changes" : "Submit Registration"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
