import { api } from "@/features/shared/api/client";

export interface User {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  telegramId: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;
  telegramId?: string;
  smtp_pass?: string;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {
  id: string;
}

export const usersApi = {
  list: () => api.get<User[]>("/api/users"),
  create: (data: CreateUserInput) => api.post<User>("/api/users", data),
  update: (data: UpdateUserInput) => api.put<User>(`/api/users/${data.id}`, data),
  remove: (id: string) => api.delete<{ success: boolean }>(`/api/users/${id}`),
};
