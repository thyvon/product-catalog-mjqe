import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/features/shared/api/client";

export function useFetchQuery<T>(
  key: string[],
  path: string,
  params?: Record<string, string>,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<T>(path, params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30_000,
  });
}

export function useCrudMutation<TData, TVariables>(
  method: "post" | "put" | "delete",
  path: string | ((variables: TVariables) => string),
  queryKeyToInvalidate?: string[]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => {
      const url = typeof path === "function" ? path(variables) : path;
      if (method === "delete") return api.delete<TData>(url, variables);
      if (method === "post") return api.post<TData>(url, variables);
      return api.put<TData>(url, variables);
    },
    onSuccess: () => {
      if (queryKeyToInvalidate) {
        queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
      }
    },
  });
}
