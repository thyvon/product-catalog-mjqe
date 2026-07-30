import React, { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import BaseModal from "@/features/shared/components/BaseModal";
import SelectField from "@/features/shared/components/SelectField";
import DatePicker from "@/features/shared/components/DatePicker";
import Checkbox from "@/features/shared/components/Checkbox";
import { Field } from "@/features/shared/components/Field";
import { SectionTitle } from "@/features/shared/components/SectionTitle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier, SupplierInput } from "@/features/shared/types";

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierInput) => Promise<void>;
  editingSupplier: Supplier | null;
}



const STEPS = [
  { id: 1, label: "Company", sub: "Application and legal details" },
  { id: 2, label: "Business & Contact", sub: "Activity, address, and contact" },
  { id: 3, label: "Banking & Payment", sub: "Account and payment details" },
  { id: 4, label: "Declaration", sub: "Conflict and final sign-off" },
];

const STEP_SECTIONS: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
  4: [7, 8],
};

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
  const [optionValues, setOptionValues] = useState<{ statuses: string[]; applicationTypes: string[]; registrationTypes: string[]; paymentMethods: string[]; paymentTerms: string[] }>({
    statuses: [],
    applicationTypes: [],
    registrationTypes: [],
    paymentMethods: [],
    paymentTerms: [],
  });

  const fetchOptionValues = async () => {
    try {
      const res = await fetch("/api/suppliers/filters/values");
      if (res.ok) {
        setOptionValues(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchOptionValues();
    }
  }, [isOpen]);

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

  const optionLabel = (value: string, labels: Record<string, string>) => labels[value] || value;

  const applicationTypeOptions = optionValues.applicationTypes.length > 0
    ? optionValues.applicationTypes.map((v) => ({ value: v, label: optionLabel(v, { new: "New supplier", update: "Update existing supplier" }) }))
    : [{ value: "new", label: "New supplier" }, { value: "update", label: "Update existing supplier" }];

  const registrationTypeOptions = optionValues.registrationTypes.length > 0
    ? optionValues.registrationTypes.map((v) => ({ value: v, label: optionLabel(v, { vat: "VAT registered", "non-vat": "Non-VAT" }) }))
    : [{ value: "vat", label: "VAT registered" }, { value: "non-vat", label: "Non-VAT" }];

  const paymentMethodOptions = optionValues.paymentMethods.length > 0
    ? optionValues.paymentMethods.map((v) => ({ value: v, label: optionLabel(v, { "bank-transfer": "Bank transfer", cheque: "Cheque", cash: "Cash", other: "Other" }) }))
    : [{ value: "bank-transfer", label: "Bank transfer" }, { value: "cheque", label: "Cheque" }, { value: "cash", label: "Cash" }, { value: "other", label: "Other" }];

  const paymentTermOptions = optionValues.paymentTerms.length > 0
    ? optionValues.paymentTerms.map((v) => ({ value: v, label: optionLabel(v, { "no-credit": "No credit", "one-week": "Credit 1 week", "two-weeks": "Credit 2 weeks", "one-month": "Credit 1 month", other: "Other" }) }))
    : [{ value: "no-credit", label: "No credit" }, { value: "one-week", label: "Credit 1 week" }, { value: "two-weeks", label: "Credit 2 weeks" }, { value: "one-month", label: "Credit 1 month" }, { value: "other", label: "Other" }];

  const statusOptions = optionValues.statuses.length > 0
    ? optionValues.statuses.map((v) => ({ value: v, label: v }))
    : [{ value: "Pending", label: "Pending" }, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }];

  const renderSection = (section: number) => {
    switch (section) {
      case 1:
        return (
          <motion.div key="application" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="1. Application Type" kh="ប្រភេទពាក្យសុំ: អ្នកផ្គត់ផ្គង់ថ្មី ឬ ធ្វើបច្ចុប្បន្ន" />
            <Field label="Application Type" kh="អ្នកផ្គត់ផ្គង់ថ្មី / បច្ចុប្បន្នភាព">
              <SelectField value={form.applicationType} onChange={(v) => handleChange("applicationType", v as SupplierInput["applicationType"])} options={applicationTypeOptions} />
            </Field>
            <Field label="Old Supplier Code" kh="លេខកូដអ្នកផ្គត់ផ្គង់ចាស់">
              <Input value={form.oldSupplierCode} onChange={(e) => handleChange("oldSupplierCode", e.target.value)} placeholder="Fill only when updating an existing supplier" disabled={form.applicationType !== "update"} />
            </Field>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="company" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="2. Company / Legal Information" kh="ព័ត៌មានក្រុមហ៊ុន / ច្បាប់" />
            <Field label="Company / Shop Name in English" kh="ឈ្មោះក្រុមហ៊ុន / ហាង (អង់គ្លេស)">
              <Input value={form.companyName} onChange={(e) => handleChange("companyName", e.target.value)} required />
            </Field>
            <Field label="Company / Shop Name in Khmer" kh="ឈ្មោះក្រុមហ៊ុន / ហាង (ខ្មែរ)">
              <Input value={form.companyNameKhmer} onChange={(e) => handleChange("companyNameKhmer", e.target.value)} />
            </Field>
            <Field label="Tax Registration" kh="ចុះបញ្ជីពន្ធដារ">
              <Input value={form.taxRegistration} onChange={(e) => handleChange("taxRegistration", e.target.value)} />
            </Field>
            <Field label="Commercial Registration Certificate" kh="វិញ្ញាបនបត្រចុះបញ្ជីពាណិជ្ជកម្ម">
              <Input value={form.commercialRegistration} onChange={(e) => handleChange("commercialRegistration", e.target.value)} />
            </Field>
            <Field label="Patent Tax Certificate" kh="បណ្ណពន្ធប៉ាតង់">
              <Input value={form.patentTaxCertificate} onChange={(e) => handleChange("patentTaxCertificate", e.target.value)} />
            </Field>
            <Field label="National ID Number" kh="លេខអត្តសញ្ញាណបណ្ណ">
              <Input value={form.nationalId} onChange={(e) => handleChange("nationalId", e.target.value)} />
            </Field>
            <Checkbox
              checked={form.foreignTradeOperator}
              onChange={(v) => handleChange("foreignTradeOperator", v)}
              label="Registration for Foreign Trade Operators"
              kh="ប្រតិបត្តិករពាណិជ្ជកម្មបរទេស"
              description="International suppliers only."
              className="md:col-span-2"
            />
          </motion.div>
        );

      case 3:
        return (
          <motion.div key="business" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="3. Business Details" kh="ឆ្នាំបង្កើត, សកម្មភាព, ផលិតផល/សេវា, អាសយដ្ឋាន" />
            <Field label="Business Address" kh="អាសយដ្ឋានអាជីវកម្ម" wide>
              <Textarea value={form.address} onChange={(e) => handleChange("address", e.target.value)} className="min-h-20 resize-y" />
            </Field>
            <Field label="VAT Status" kh="ស្ថានភាព VAT">
              <SelectField value={form.registrationType} onChange={(v) => handleChange("registrationType", v as SupplierInput["registrationType"])} options={registrationTypeOptions} />
            </Field>
            <Field label="Established Year" kh="ឆ្នាំបង្កើត">
              <Input value={form.establishedYear} onChange={(e) => handleChange("establishedYear", e.target.value)} placeholder="Example: 2020" />
            </Field>
            <Field label="Business Activity" kh="ប្រភេទអាជីវកម្ម / សកម្មភាពអាជីវករ">
              <Input value={form.businessActivity} onChange={(e) => handleChange("businessActivity", e.target.value)} />
            </Field>
            <Field label="Product / Service Type" kh="ប្រភេទផលិតផល / សេវាកម្ម">
              <Input value={form.productServiceType} onChange={(e) => handleChange("productServiceType", e.target.value)} />
            </Field>
            <Field label="Other Documents" kh="ឯកសារផ្សេងៗ" wide>
              <Textarea value={form.otherDocuments} onChange={(e) => handleChange("otherDocuments", e.target.value)} className="min-h-16 resize-y" />
            </Field>
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="4. Contact Person" kh="ព័ត៌មានទំនាក់ទំនង" />
            <Field label="Contact Person" kh="អ្នកទំនាក់ទំនង">
              <Input value={form.contactPerson} onChange={(e) => handleChange("contactPerson", e.target.value)} />
            </Field>
            <Field label="Position" kh="តួនាទី">
              <Input value={form.position} onChange={(e) => handleChange("position", e.target.value)} />
            </Field>
            <Field label="Phone" kh="លេខទូរសព្ទ">
              <Input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </Field>
            <Field label="Mobile" kh="លេខទូរសព្ទដៃ">
              <Input value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} />
            </Field>
            <Field label="Email" kh="សារអេឡិចត្រូនិក">
              <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
            </Field>
            <Field label="Website" kh="គេហទំព័រ">
              <Input value={form.website} onChange={(e) => handleChange("website", e.target.value)} />
            </Field>
          </motion.div>
        );

      case 5:
        return (
          <motion.div key="bank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="5. Bank Account Information" kh="ព័ត៌មានគណនីធនាគារ" />
            <Field label="Bank Name" kh="ឈ្មោះធនាគារ">
              <Input value={form.bankName} onChange={(e) => handleChange("bankName", e.target.value)} />
            </Field>
            <Field label="Branch" kh="សាខា">
              <Input value={form.bankBranch} onChange={(e) => handleChange("bankBranch", e.target.value)} />
            </Field>
            <Field label="Account Name" kh="ឈ្មោះគណនី">
              <Input value={form.accountHolderName} onChange={(e) => handleChange("accountHolderName", e.target.value)} />
            </Field>
            <Field label="Account Number" kh="លេខគណនី">
              <Input value={form.bankAccount} onChange={(e) => handleChange("bankAccount", e.target.value)} />
            </Field>
            <Checkbox
              checked={form.checkAuthorization}
              onChange={(v) => handleChange("checkAuthorization", v)}
              label="Check collection authorization letter is available"
              kh="មានលិខិតអនុញ្ញាតិប្រមូលមូលប្បទានប័ត្រ"
              className="md:col-span-2"
            />
            <Field label="SWIFT Code" kh="លេខកូដ SWIFT">
              <Input value={form.swiftCode} onChange={(e) => handleChange("swiftCode", e.target.value)} />
            </Field>
            <Field label="IBAN" kh="លេខ IBAN">
              <Input value={form.iban} onChange={(e) => handleChange("iban", e.target.value)} />
            </Field>
          </motion.div>
        );

      case 6:
        return (
          <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="6. Payment Instruction" kh="វិធីសាស្រ្ត និងកាលកំណត់ទូទាត់" />
            <Field label="Payment Method" kh="វិធីសាស្រ្តទូទាត់">
              <SelectField value={form.paymentMethod} onChange={(v) => handleChange("paymentMethod", v as SupplierInput["paymentMethod"])} options={paymentMethodOptions} />
            </Field>
            <Field label="Other Payment Method" kh="វិធីសាស្រ្តទូទាត់ផ្សេងទៀត">
              <Input value={form.paymentMethodOther} onChange={(e) => handleChange("paymentMethodOther", e.target.value)} disabled={form.paymentMethod !== "other"} />
            </Field>
            <Field label="Payment Term" kh="កាលកំណត់ទូទាត់">
              <SelectField value={form.paymentTerm} onChange={(v) => handleChange("paymentTerm", v as SupplierInput["paymentTerm"])} options={paymentTermOptions} />
            </Field>
            <Field label="Other Payment Term" kh="កាលកំណត់ទូទាត់ផ្សេងទៀត">
              <Input value={form.paymentTermOther} onChange={(e) => handleChange("paymentTermOther", e.target.value)} disabled={form.paymentTerm !== "other"} />
            </Field>
          </motion.div>
        );

      case 7:
        return (
          <motion.div key="conflict" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="7. Conflict of Interest Declaration" kh="ការប្រកាសទំនាស់ផលប្រយោជន៍" />
            <Checkbox
              checked={form.conflictOfInterest}
              onChange={(v) => handleChange("conflictOfInterest", v)}
              label="Supplier has a relationship with MJQE or procurement staff"
              kh="មានទំនាក់ទំនងជាមួយ MJQE ឬ បុគ្គលិកលទ្ធកម្ម"
              description="If yes, provide the name and relationship details."
              className="md:col-span-2"
            />
            <Field label="Conflict Details" kh="សូមបញ្ជាក់" wide>
              <Textarea value={form.conflictDetails} onChange={(e) => handleChange("conflictDetails", e.target.value)} className="min-h-24 resize-y" disabled={!form.conflictOfInterest} />
            </Field>
          </motion.div>
        );

      case 8:
        return (
          <motion.div key="declaration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionTitle title="8. Final Declaration" kh="ការប្រកាសចុងក្រោយ" />
            <Field label="Supplier Representative Name" kh="ឈ្មោះអ្នកផ្គត់ផ្គង់">
              <Input value={form.supplierDeclarationName} onChange={(e) => handleChange("supplierDeclarationName", e.target.value)} />
            </Field>
            <Field label="Supplier Declaration Date" kh="ថ្ងៃខែឆ្នាំ">
              <DatePicker value={form.supplierDeclarationDate} onChange={(v) => handleChange("supplierDeclarationDate", v)} />
            </Field>
            <Field label="Buyer Name" kh="ឈ្មោះអ្នកទិញ">
              <Input value={form.buyerCompletedName} onChange={(e) => handleChange("buyerCompletedName", e.target.value)} />
            </Field>
            <Field label="Buyer Completion Date" kh="ថ្ងៃខែឆ្នាំ">
              <DatePicker value={form.buyerCompletedDate} onChange={(v) => handleChange("buyerCompletedDate", v)} />
            </Field>
            <Field label="Internal Status" kh="ស្ថានភាព" wide>
              <SelectField value={form.status} onChange={(v) => handleChange("status", v as SupplierInput["status"])} options={statusOptions} />
            </Field>
            <Checkbox
              checked={form.codeOfConductAck}
              onChange={(v) => handleChange("codeOfConductAck", v)}
              label="Supplier Code of Conduct acknowledged"
              kh="បានទទួលស្គាល់ក្រមសីលធម៌អ្នកផ្គត់ផ្គង់"
              className="md:col-span-2"
            />
            <Field label="Notes" kh="ចំណាំ" wide>
              <Textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} className="min-h-20 resize-y" />
            </Field>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const renderStep = () => (
    <div className="space-y-7">
      {STEP_SECTIONS[step].map((section) => (
        <React.Fragment key={section}>{renderSection(section)}</React.Fragment>
      ))}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      maxHeight="max-h-[92vh]"
      rounded="rounded-2xl"
      className="flex flex-col flex-1"
    >
      <div className="flex shrink-0 items-start border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {editingSupplier ? "Edit Vendor Registration" : "Vendor Registration Application Form"}
          </h2>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">ទម្រង់ស្នើចុះបញ្ជីអ្នកផ្គត់ផ្គង់</p>
        </div>
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-border px-3 py-3 sm:px-5">
        <div className="flex min-w-max gap-1">
          {STEPS.map((s) => (
            <Button key={s.id} variant="ghost" onClick={() => setStep(s.id)} className="w-48 min-w-48 justify-start gap-2 px-2 py-1.5 text-left">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.id === step ? "bg-primary text-primary-foreground" : s.id < step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s.id < step ? <Check /> : s.id}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">{s.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{renderStep()}</div>

      <Separator className="my-4" />
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <Button
          variant={step === 1 ? "outline" : "ghost"}
          size={step === 1 ? "default" : "sm"}
          onClick={step === 1 ? onClose : prevStep}
        >
          <ChevronLeft />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        <span className="text-xs font-medium text-muted-foreground">
          Step {step} of {STEPS.length}
        </span>

        {step < STEPS.length ? (
          <Button onClick={nextStep}>
            Next
            <ChevronRight />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.companyName.trim()}
          >
            {submitting && <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {editingSupplier ? "Save Changes" : "Submit Registration"}
          </Button>
        )}
      </div>
    </BaseModal>
  );
}
