import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useConfirmModal } from "@/features/shared/hooks";
import {
  PlusCircle,
  RefreshCw,
  Building2,
  SquarePen,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Supplier, SupplierInput } from "@/features/shared/types";
import SupplierFormModal from "@/features/suppliers/components/SupplierFormModal";
import { useToast } from "@/features/shared/components/Toast";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import DataTable from "@/features/shared/components/DataTable";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import PageContent from "@/features/shared/components/PageContent";
import SelectField from "@/features/shared/components/SelectField";
import { Separator } from "@/components/ui/separator";
import BaseModal from "@/features/shared/components/BaseModal";
import { DetailRow } from "@/features/shared/components/DetailRow";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export default function SupplierRegisterPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filterValues, setFilterValues] = useState<{ statuses: string[]; applicationTypes: string[] }>({
    statuses: [],
    applicationTypes: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const { confirmState, confirm, closeConfirm } = useConfirmModal();

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers.");
      const data = await res.json();
      setSuppliers(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterValues = async () => {
    try {
      const res = await fetch("/api/suppliers/filters/values");
      if (res.ok) {
        setFilterValues(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchSuppliers();
    fetchFilterValues();
  }, []);

  const handleSubmit = async (data: SupplierInput) => {
    try {
      const isEdit = !!editingSupplier;
      const url = isEdit ? `/api/suppliers/${editingSupplier!.id}` : "/api/suppliers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save supplier.");
      }

      setIsFormOpen(false);
      setEditingSupplier(null);
      await fetchSuppliers();
      toast.success(isEdit ? "Supplier has been updated." : "Supplier has been registered.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = (supplier: Supplier) => {
    confirm(
      "Delete Supplier",
      `Are you sure you want to delete "${supplier.companyName}"? This action cannot be undone.`,
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete supplier.");
          await fetchSuppliers();
          toast.success(`Supplier "${supplier.companyName}" has been deleted.`);
        } catch (err: any) {
          toast.error(err.message);
        }
      },
    );
  };

  const filtered = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      s.companyName.toLowerCase().includes(q) ||
      (s.companyNameKhmer || "").toLowerCase().includes(q) ||
      (s.oldSupplierCode || "").toLowerCase().includes(q) ||
      (s.productServiceType || "").toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesType = !typeFilter || s.applicationType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filtered.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filtered, pageSize]);

  const statusOptions = useMemo(() => [
    { value: "", label: "All Status" },
    ...filterValues.statuses.map((status) => ({ value: status, label: status })),
  ], [filterValues.statuses]);

  const typeOptions = useMemo(() => [
    { value: "", label: "All Types" },
    ...filterValues.applicationTypes.map((type) => ({ value: type, label: type === "update" ? "Update" : "New" })),
  ], [filterValues.applicationTypes]);

  return (
    <PageContent>
      <ListPageLayout
      title="Supplier Registration"
      description={`${filtered.length} supplier${filtered.length !== 1 ? "s" : ""} found`}
      actions={(
        <>
          <Tooltip>
            <TooltipTrigger render={<Button
            variant="outline"
            size="icon"
            onClick={fetchSuppliers}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>} />
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
          >
            <PlusCircle />
            <span>Register Supplier</span>
          </Button>
        </>
      )}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search suppliers by name, contact, email, or phone..."
      activeFilterCount={[statusFilter, typeFilter].filter(Boolean).length}
      filters={(
        <>
          <SelectField
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
            containerClassName="min-w-[140px]"
            options={statusOptions}
          />
          <SelectField
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Types"
            containerClassName="min-w-[140px]"
            options={typeOptions}
          />
        </>
      )}
    >
      <DataTable<Supplier>
        columns={[
          {
            accessorKey: "companyName",
            header: "Company",
            cell: ({ row }) => {
              const s = row.original;
              return (
                <div>
                  <div className="font-medium text-foreground">{s.companyName}</div>
                  {s.companyNameKhmer ? <div className="text-xs text-muted-foreground mt-0.5">{s.companyNameKhmer}</div> : null}
                </div>
              );
            },
          },
          { accessorKey: "contactPerson", header: "Contact", meta: { className: "text-muted-foreground" } },
          { accessorKey: "email", header: "Email", meta: { className: "text-muted-foreground" } },
          { accessorKey: "phone", header: "Phone", meta: { className: "text-muted-foreground font-mono" } },
          { accessorKey: "productServiceType", header: "Service Type", meta: { className: "text-muted-foreground" } },
          {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
              const variant = ({ Pending: "secondary", Approved: "default", Rejected: "destructive" } as Record<string, string>)[row.original.status] || "outline";
              return <Badge variant={variant as any} className="text-xs">{row.original.status}</Badge>;
            },
          },
          {
            accessorKey: "applicationType",
            header: "Type",
            cell: ({ row }) => (
              <Badge variant={row.original.applicationType === "update" ? "default" : "secondary"}>
                {row.original.applicationType === "update" ? "Update" : "New"}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: "Actions",
            meta: { align: "right" },
            cell: ({ row }) => {
              const supplier = row.original;
              return (
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => { setViewingSupplier(supplier); setIsViewOpen(true); }}>
                      <Eye />
                    </Button>} />
                    <TooltipContent>View details</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => { setEditingSupplier(supplier); setIsFormOpen(true); }}>
                      <SquarePen />
                    </Button>} />
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => handleDelete(supplier)}>
                      <Trash2 />
                    </Button>} />
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              );
            },
          },
        ] satisfies ColumnDef<Supplier>[]}
        data={paginatedSuppliers}
        loading={loading}
        emptyIcon={<Building2 className="w-8 h-8" />}
        emptyMessage={searchQuery ? "No suppliers match your search." : "No suppliers registered yet."}
        emptyAction={{ label: "Register one now", onClick: () => { setEditingSupplier(null); setIsFormOpen(true); } }}
        skeletonRows={5}
        getRowId={(supplier) => supplier.id}
        pagination={{
          currentPage,
          pageSize,
          total: filtered.length,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />

      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleSubmit}
        editingSupplier={editingSupplier}
      />

      <BaseModal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title="Vendor Registration"
        description="ទម្រង់ស្នើចុះបញ្ជីអ្នកផ្គត់ផ្គង់"
        size="2xl"
        maxHeight="max-h-[calc(100dvh-4rem)]"
        className="flex flex-col overflow-hidden"
      >
        {viewingSupplier && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Document header */}
            <div className="shrink-0 border-b border-border bg-card py-4 text-center">
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Vendor Registration Application Form</h3>
              <p className="mt-1 text-lg font-semibold text-foreground">{viewingSupplier.companyName}</p>
              {viewingSupplier.companyNameKhmer && (
                <p className="text-xs text-muted-foreground">{viewingSupplier.companyNameKhmer}</p>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <Badge variant={viewingSupplier.applicationType === "update" ? "default" : "secondary"}>
                  {viewingSupplier.applicationType === "update" ? "Update existing supplier" : "New supplier"}
                </Badge>
                <Badge variant={({ Pending: "secondary", Approved: "default", Rejected: "destructive" } as Record<string, string>)[viewingSupplier.status] || "outline" as any}>
                  {viewingSupplier.status}
                </Badge>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6">
              <ViewSection title="Supplier Information" kh="ព័ត៌មានអ្នកផ្គត់ផ្គង់">
                <DetailRow label="Company Name (Khmer)" value={viewingSupplier.companyNameKhmer || "—"} />
                <DetailRow label="Registration Type" value={viewingSupplier.registrationType === "vat" ? "VAT / Overseas" : "Non-VAT"} />
                <DetailRow label="Country of Origin" value={viewingSupplier.countryOfOrigin || "—"} />
                <DetailRow label="Foreign Trade Operator" value={viewingSupplier.foreignTradeOperator ? "Yes" : "No"} />
                <DetailRow label="Established Year" value={viewingSupplier.establishedYear || "—"} />
                <DetailRow label="Business Activity" value={viewingSupplier.businessActivity || "—"} />
                <DetailRow label="Product / Service" value={viewingSupplier.productServiceType || "—"} />
                <DetailRow label="Other Documents" value={viewingSupplier.otherDocuments || "—"} />
                <div className="col-span-2">
                  <DetailRow label="Business Address" value={viewingSupplier.address || "—"} />
                </div>
                {viewingSupplier.addressKhmer && (
                  <div className="col-span-2">
                    <DetailRow label="អាសយដ្ឋានអាជីវកម្ម" value={viewingSupplier.addressKhmer} />
                  </div>
                )}
                {(viewingSupplier.cityProvince || viewingSupplier.districtKhan) && (
                  <>
                    <DetailRow label="City / Province" value={viewingSupplier.cityProvince || "—"} />
                    <DetailRow label="District / Khan" value={viewingSupplier.districtKhan || "—"} />
                  </>
                )}
              </ViewSection>

              <Separator />

              <ViewSection title="Legal Documents" kh="ឯកសារច្បាប់">
                <DetailRow label="Business License" value={viewingSupplier.businessLicense || "—"} />
                <DetailRow label="Commercial Registration" value={viewingSupplier.commercialRegistration || "—"} />
                <DetailRow label="Tax Registration" value={viewingSupplier.taxRegistration || "—"} />
                <DetailRow label="VAT Certificate" value={viewingSupplier.vatCertificate || "—"} />
                <DetailRow label="Patent Tax" value={viewingSupplier.patentTaxCertificate || "—"} />
                <DetailRow label="National ID" value={viewingSupplier.nationalId || "—"} />
              </ViewSection>

              <Separator />

              <ViewSection title="Contact Person" kh="ព័ត៌មានទំនាក់ទំនង">
                <DetailRow label="Contact Person" value={viewingSupplier.contactPerson || "—"} />
                <DetailRow label="Position" value={viewingSupplier.position || "—"} />
                <DetailRow label="Phone" value={viewingSupplier.phone || "—"} />
                <DetailRow label="Mobile" value={viewingSupplier.mobile || "—"} />
                <DetailRow label="Email" value={viewingSupplier.email || "—"} />
                <DetailRow label="Website" value={viewingSupplier.website || "—"} />
              </ViewSection>

              <Separator />

              <ViewSection title="2. Account Information" kh="ព័ត៌មានគណនីធនាគារ">
                <DetailRow label="Bank Name" value={viewingSupplier.bankName || "—"} />
                <DetailRow label="Branch" value={viewingSupplier.bankBranch || "—"} />
                <DetailRow label="Account Name" value={viewingSupplier.accountHolderName || "—"} />
                <DetailRow label="Account Number" value={viewingSupplier.bankAccount || "—"} />
                <DetailRow label="Check Authorization Letter" value={viewingSupplier.checkAuthorization ? "Yes" : "No"} />
                <DetailRow label="SWIFT Code" value={viewingSupplier.swiftCode || "—"} />
                <DetailRow label="IBAN" value={viewingSupplier.iban || "—"} />
              </ViewSection>

              <Separator />

              <ViewSection title="3. Payment Instruction" kh="វិធីសាស្ត្រ និងកាលកំណត់ទូទាត់">
                <DetailRow label="Payment Method" value={formatPaymentMethod(viewingSupplier)} />
                <DetailRow label="Payment Term" value={formatPaymentTerm(viewingSupplier)} />
              </ViewSection>

              <Separator />

              <ViewSection title="4. Conflict of Interest" kh="ការប្រកាសទំនាស់ផលប្រយោជន៍">
                <DetailRow label="Has a relationship with MJQE / procurement staff" value={viewingSupplier.conflictOfInterest ? "Yes" : "No"} />
                {viewingSupplier.conflictDetails && (
                  <div className="col-span-2">
                    <DetailRow label="Details" value={viewingSupplier.conflictDetails} />
                  </div>
                )}
              </ViewSection>

              <Separator />

              <ViewSection title="5. Declaration & Approval" kh="ការប្រកាស និងការអនុម័ត">
                <DetailRow label="Supplier Representative" value={viewingSupplier.supplierDeclarationName || "—"} />
                <DetailRow label="Declaration Date" value={viewingSupplier.supplierDeclarationDate || "—"} />
                <DetailRow label="Buyer Completed By" value={viewingSupplier.buyerCompletedName || "—"} />
                <DetailRow label="Buyer Completion Date" value={viewingSupplier.buyerCompletedDate || "—"} />
                <DetailRow label="Code of Conduct" value={viewingSupplier.codeOfConductAck ? "Acknowledged" : "Not Acknowledged"} />
              </ViewSection>

              {(viewingSupplier.companyProfile || viewingSupplier.notes) && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    {viewingSupplier.companyProfile && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Company Profile</h4>
                        <p className="text-xs text-foreground leading-relaxed">{viewingSupplier.companyProfile}</p>
                      </div>
                    )}
                    {viewingSupplier.notes && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</h4>
                        <p className="text-xs text-foreground">{viewingSupplier.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </BaseModal>

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

function ViewSection({ title, kh, children }: { title: string; kh: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
        {kh} <span className="font-normal normal-case text-muted-foreground">/ {title}</span>
      </h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">{children}</div>
    </section>
  );
}

function formatPaymentMethod(supplier: Supplier) {
  const labels: Record<Supplier["paymentMethod"], string> = {
    "bank-transfer": "Bank transfer",
    cheque: "Cheque",
    cash: "Cash",
    other: supplier.paymentMethodOther || "Other",
  };
  return labels[supplier.paymentMethod] || "-";
}

function formatPaymentTerm(supplier: Supplier) {
  const labels: Record<Supplier["paymentTerm"], string> = {
    "no-credit": "No credit",
    "one-week": "Credit 1 week",
    "two-weeks": "Credit 2 weeks",
    "one-month": "Credit 1 month",
    other: supplier.paymentTermOther || "Other",
  };
  return labels[supplier.paymentTerm] || "-";
}
