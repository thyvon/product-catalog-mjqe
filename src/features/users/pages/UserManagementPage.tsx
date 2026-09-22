import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw, Pencil, Trash2, Shield, ShieldOff } from "lucide-react";
import DataTable from "@/features/shared/components/DataTable";
import PageContent from "@/features/shared/components/PageContent";
import ListPageLayout from "@/features/shared/components/ListPageLayout";
import TextField from "@/features/shared/components/TextField";
import SelectField from "@/features/shared/components/SelectField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { useConfirmModal } from "@/features/shared/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { Navigate } from "react-router-dom";
import { FormLabel } from "@/features/shared/components/FormLabel";
import { Badge } from "@/components/ui/badge";
import { usersApi, type User, type CreateUserInput } from "@/features/users/api";

const ROLES = ["Admin", "Procurement", "User"];

export default function UserManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirmModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "User",
    fullName: "",
    email: "",
    phone: "",
    position: "",
    telegramId: "",
  });

  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; values: Record<string, string> }) =>
      data.id ? usersApi.update({ id: data.id, ...data.values }) : usersApi.create(data.values as unknown as CreateUserInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(editing ? "User updated." : "User created.");
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message || "An error occurred"),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.fullName, u.email, u.role, u.position].some((v) => v?.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ username: "", password: "", role: "User", fullName: "", email: "", phone: "", position: "", telegramId: "" });
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setFormData({
      username: user.username,
      password: "",
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      position: user.position,
      telegramId: user.telegramId,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.username) {
      toast.error("Username is required.");
      return;
    }
    if (!editing && !formData.password) {
      toast.error("Password is required for new users.");
      return;
    }
    const values: Record<string, string> = {
      role: formData.role,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      position: formData.position,
      telegramId: formData.telegramId,
    };
    if (!editing) {
      values.username = formData.username;
      values.password = formData.password;
    } else if (formData.password) {
      values.password = formData.password;
    }
    saveMutation.mutate({ id: editing?.id, values });
  };

  const handleDelete = useCallback((user: User) => {
    confirm(
      "Delete User",
      `Delete "${user.username}" (${user.fullName || "no name"})? This cannot be undone.`,
      () => {
        closeConfirm();
        deleteMutation.mutate(user.id);
      },
      "Delete",
    );
  }, [confirm, closeConfirm, deleteMutation]);

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: "username",
      header: "Username",
      meta: { className: "font-medium text-foreground" },
    },
    {
      accessorKey: "fullName",
      header: "Full Name",
      meta: { className: "text-muted-foreground" },
      cell: ({ row }) => row.original.fullName || <span className="text-muted-foreground italic">-</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      meta: { className: "text-muted-foreground" },
    },
    {
      accessorKey: "role",
      header: "Role",
      meta: { align: "center" },
      cell: ({ row }) => (
        <Badge variant={row.original.role === "Admin" ? "default" : "outline"}>
          {row.original.role === "Admin" ? <Shield className="w-3 h-3 mr-1" /> : row.original.role === "Procurement" ? <ShieldOff className="w-3 h-3 mr-1" /> : null}
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: "position",
      header: "Position",
      meta: { className: "text-muted-foreground" },
      cell: ({ row }) => row.original.position || <span className="text-muted-foreground italic">-</span>,
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

  if (user?.role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <PageContent>
      <ListPageLayout
        title="User Management"
        description={`${filtered.length} user${filtered.length !== 1 ? "s" : ""} found`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["users"] })}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add User
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
        searchPlaceholder="Search users..."
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
          size="md"
          title={editing ? "Edit User" : "New User"}
        >
          <div className="p-6 space-y-4">
            <div>
              <FormLabel required>Username</FormLabel>
              <TextField
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. john.doe"
                disabled={!!editing}
              />
            </div>
            <div>
              <FormLabel required={!editing}>Password</FormLabel>
              <TextField
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editing ? "Leave blank to keep current" : "Enter password"}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>Role</FormLabel>
                <SelectField
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value })}
                  options={ROLES.map((r) => ({ value: r, label: r }))}
                />
              </div>
              <div>
                <FormLabel>Full Name</FormLabel>
                <TextField
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Vun Thy"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>Email</FormLabel>
                <TextField
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <FormLabel>Phone</FormLabel>
                <TextField
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+855 xx xxx xxx"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>Position</FormLabel>
                <TextField
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g. Procurement Officer"
                />
              </div>
              <div>
                <FormLabel>Telegram ID</FormLabel>
                <TextField
                  value={formData.telegramId}
                  onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                  placeholder="@username"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </BaseModal>

        <DataTable<User>
          columns={columns}
          data={paginatedUsers}
          loading={loading}
          emptyMessage="No users found."
          pagination={{
            currentPage,
            pageSize,
            total: filtered.length,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
            pageSizeOptions: [10, 25, 50, 100],
          }}
        />
      </ListPageLayout>
    </PageContent>
  );
}
