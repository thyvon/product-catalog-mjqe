import { useState, useEffect } from "react";
import { useToast } from "@/features/shared/components/Toast";
import TextField from "@/features/shared/components/TextField";
import SelectField from "@/features/shared/components/SelectField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Settings2 } from "lucide-react";
import { FormLabel } from "@/features/shared/components/FormLabel";
import PageContent from "@/features/shared/components/PageContent";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) throw new Error("Failed to save");
      setSettings(await r.json());
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageContent>
      <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary text-primary-foreground rounded-xl">
          <Settings2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">System configuration</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>SMTP Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField label="SMTP Host" value={settings.smtp_host || ""} onChange={(e) => set("smtp_host", e.target.value)} />
            <div className="flex gap-3">
              <TextField label="SMTP Port" value={settings.smtp_port || ""} onChange={(e) => set("smtp_port", e.target.value)} className="flex-1" />
              <div className="flex-1">
                <FormLabel>SMTP Secure</FormLabel>
                <SelectField
                  value={settings.smtp_secure || ""}
                  onChange={(value) => set("smtp_secure", value)}
                  options={[
                    { value: "", label: "No (port 587)" },
                    { value: "true", label: "Yes (port 465)" },
                  ]}
                  placeholder="Select"
                />
              </div>
            </div>
            <TextField label="SMTP User" value={settings.smtp_user || ""} onChange={(e) => set("smtp_user", e.target.value)} />
            <TextField label="SMTP Password" type="password" value={settings.smtp_pass || ""} onChange={(e) => set("smtp_pass", e.target.value)} />
            <TextField label="From Address" value={settings.mail_from_address || ""} onChange={(e) => set("mail_from_address", e.target.value)} />
            <TextField label="From Name" value={settings.mail_from_name || ""} onChange={(e) => set("mail_from_name", e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField label="Bot Token" value={settings.telegram_bot_token || ""} onChange={(e) => set("telegram_bot_token", e.target.value)} />
            <TextField label="Chat ID" value={settings.telegram_chat_id || ""} onChange={(e) => set("telegram_chat_id", e.target.value)} />
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
    </PageContent>
  );
}
