import { api } from "@/features/shared/api/client";

export interface SettingsResponse {
  [key: string]: string;
}

export const settingsApi = {
  get: () => api.get<SettingsResponse>("/api/settings"),
  save: (settings: Record<string, string>) => api.put<SettingsResponse>("/api/settings", settings),
};
