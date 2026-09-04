import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import TextField from "@/features/shared/components/TextField";

interface Contact {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  configCount: number;
}

export default function ContactsPage() {
  const { toast } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({ email: "", name: "" });

  const fetchContacts = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/dn-contacts?q=${encodeURIComponent(q)}` : "/api/dn-contacts";
      const res = await fetch(url);
      if (res.ok) setContacts(await res.json());
    } catch { /* ignored */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchContacts(searchQuery || undefined), searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchQuery, fetchContacts]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return contacts.slice(start, start + pageSize);
  }, [currentPage, contacts, pageSize]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ email: "", name: "" });
    setShowForm(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setFormData({ email: contact.email, name: contact.name });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Valid email is required.");
      return;
    }
    try {
      if (editing) {
        const res = await fetch(`/api/dn-contacts/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Contact updated.");
      } else {
        const res = await fetch("/api/dn-contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to create");
        }
        toast.success("Contact created.");
      }
      setShowForm(false);
      fetchContacts(searchQuery || undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const handleDelete = useCallback((contact: Contact) => {
    confirm(
      "Delete Contact",
      `Delete "${contact.name || contact.email}"? This will remove it from all email configs.`,
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/dn-contacts/${contact.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete");
          toast.success("Contact deleted.");
          fetchContacts(searchQuery || undefined);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to delete");
        }
      },
      "Delete",
    );
  }, [confirm, closeConfirm, toast, fetchContacts, searchQuery]);

  const columns = useMemo<ColumnDef<Contact>[]>(() => [
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
      accessorKey: "configCount",
      header: "Used In",
      meta: { align: "center" },
      cell: ({ row }) => (
        <Badge variant={row.original.configCount > 0 ? "default" : "outline"}>
          {row.original.configCount} config{row.original.configCount !== 1 ? "s" : ""}
        </Badge>
      ),
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
            <Button variant="outline" size="icon" onClick={() => fetchContacts(searchQuery || undefined)}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
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
              <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </BaseModal>

        <DataTable<Contact>
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
