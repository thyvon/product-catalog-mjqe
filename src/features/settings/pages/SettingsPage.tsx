import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/features/shared/components/Toast";
import TextField from "@/features/shared/components/TextField";
import SelectField from "@/features/shared/components/SelectField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Settings2 } from "lucide-react";
import { FormLabel } from "@/features/shared/components/FormLabel";
import PageContent from "@/features/shared/components/PageContent";
import { settingsApi } from "@/features/settings/api";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const isEditing = Object.keys(localSettings).length > 0;
  const displaySettings = isEditing ? localSettings : (settings ?? {});

  const saveMutation = useMutation({
    mutationFn: settingsApi.save,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setLocalSettings({});
      toast.success("Settings saved successfully");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const set = (key: string, value: string) =>
    setLocalSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => saveMutation.mutate(displaySettings);

  if (isLoading) {
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
            <TextField label="SMTP Host" value={displaySettings.smtp_host || ""} onChange={(e) => set("smtp_host", e.target.value)} />
            <div className="flex gap-3">
              <TextField label="SMTP Port" value={displaySettings.smtp_port || ""} onChange={(e) => set("smtp_port", e.target.value)} className="flex-1" />
              <div className="flex-1">
                <FormLabel>SMTP Secure</FormLabel>
                <SelectField
                  value={displaySettings.smtp_secure || ""}
                  onChange={(value) => set("smtp_secure", value)}
                  options={[
                    { value: "", label: "No (port 587)" },
                    { value: "true", label: "Yes (port 465)" },
                  ]}
                  placeholder="Select"
                />
              </div>
            </div>
            <TextField label="SMTP User" value={displaySettings.smtp_user || ""} onChange={(e) => set("smtp_user", e.target.value)} />
            <TextField label="SMTP Password" type="password" value={displaySettings.smtp_pass || ""} onChange={(e) => set("smtp_pass", e.target.value)} />
            <TextField label="From Address" value={displaySettings.mail_from_address || ""} onChange={(e) => set("mail_from_address", e.target.value)} />
            <TextField label="From Name" value={displaySettings.mail_from_name || ""} onChange={(e) => set("mail_from_name", e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField label="Bot Token" value={displaySettings.telegram_bot_token || ""} onChange={(e) => set("telegram_bot_token", e.target.value)} />
            <TextField label="Chat ID" value={displaySettings.telegram_chat_id || ""} onChange={(e) => set("telegram_chat_id", e.target.value)} />
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {saveMutation.isPending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
    </PageContent>
  );
}
