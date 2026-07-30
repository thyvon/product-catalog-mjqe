import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import BaseModal from "@/features/shared/components/BaseModal";
import TextField from "@/features/shared/components/TextField";
import { useToast } from "@/features/shared/components/Toast";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileData {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  telegramId: string;
  avatarUrl: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProfile(null);
    setLoading(true);
    if (!user?.username) { setLoading(false); return; }
    fetch(`/api/users/profile?username=${encodeURIComponent(user.username)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `API error (${r.status})`);
        }
        return r.json();
      })
      .then((data) => setProfile(data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [user?.username, isOpen]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const r = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profile.username,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          position: profile.position,
          telegramId: profile.telegramId,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      const data = await r.json();
      setProfile(data);
      updateProfile({ fullName: data.fullName });
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} showCloseButton size="md">
      <div className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-5">My Profile</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !profile ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">Profile not found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <TextField
              label="Full Name"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            />

            <TextField
              label="Email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />

            <TextField
              label="Phone"
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />

            <TextField
              label="Position"
              value={profile.position}
              onChange={(e) => setProfile({ ...profile, position: e.target.value })}
            />

            <TextField
              label="Telegram ID"
              value={profile.telegramId}
              onChange={(e) => setProfile({ ...profile, telegramId: e.target.value })}
            />

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
