import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw, Pencil, Trash2 } from "lucide-react";
import DataTable from "@/features/shared/components/DataTable";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { useConfirmModal } from "@/features/shared/hooks";
import { FormLabel } from "@/features/shared/components/FormLabel";
import TextField from "@/features/shared/components/TextField";
import { debitNotesApi, type DnContact } from "@/features/debit-notes/api";

export default function ContactsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DnContact | null>(null);
  const [formData, setFormData] = useState({ email: "", name: "" });

  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ["dn-contacts", searchQuery],
    queryFn: () => debitNotesApi.contacts.list(searchQuery ? { q: searchQuery } : undefined),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; values: { email: string; name: string } }) =>
      data.id
        ? debitNotesApi.contacts.update(data.id, data.values)
        : debitNotesApi.contacts.create(data.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dn-contacts"] });
      toast.success(editing ? "Contact updated." : "Contact created.");
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message || "An error occurred"),
  });

  const deleteMutation = useMutation({
    mutationFn: debitNotesApi.contacts.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dn-contacts"] });
      toast.success("Contact deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return contacts.slice(start, start + pageSize);
  }, [currentPage, contacts, pageSize]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ email: "", name: "" });
    setShowForm(true);
  };

  const openEdit = (contact: DnContact) => {
    setEditing(contact);
    setFormData({ email: contact.email, name: contact.name });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Valid email is required.");
      return;
    }
    saveMutation.mutate({ id: editing?.id, values: formData });
  };

  const handleDelete = useCallback((contact: DnContact) => {
    confirm(
      "Delete Contact",
      `Delete "${contact.name || contact.email}"? This will remove it from all email configs.`,
      () => {
        closeConfirm();
        deleteMutation.mutate(contact.id);
      },
      "Delete",
    );
  }, [confirm, closeConfirm, deleteMutation]);

  const columns = useMemo<ColumnDef<DnContact>[]>(() => [
    {
      accessorKey: "email",
      header: "Email",
      meta: { className: "font-medium text-foreground" },
    },
    {
      accessorKey: "name",
      header: "Name",
      meta: { className: "text-muted-foreground" },
      cell: ({ row }) => row.original.name || <span className="text-muted-foreground italic">-</span>,
    },
    {
      id: "actions",
      header: "",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [handleDelete]);

  return (
    <PageContent>
      <ListPageLayout
        title="Contacts"
        description={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""} found`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["dn-contacts"] })}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
        searchPlaceholder="Search contacts..."
      >
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel ?? "Delete"}
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />

        <BaseModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          size="sm"
          title={editing ? "Edit Contact" : "New Contact"}
        >
          <div className="p-6 space-y-4">
            <div>
              <FormLabel required>Email</FormLabel>
              <TextField
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@example.com"
                disabled={!!editing}
              />
            </div>
            <div>
              <FormLabel>Name</FormLabel>
              <TextField
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Vun Thy"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </BaseModal>

        <DataTable<DnContact>
          columns={columns}
          data={paginatedContacts}
          loading={loading}
          emptyMessage="No contacts found."
          pagination={{
            currentPage,
            pageSize,
            total: contacts.length,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
            pageSizeOptions: [10, 25, 50, 100],
          }}
        />
      </ListPageLayout>
    </PageContent>
  );
}
