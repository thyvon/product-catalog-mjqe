import { api } from "@/features/shared/api/client";
import type {
  PMBrand,
  PMCategory,
  PMProduct,
  PMProductGroup,
  PMRefs,
  PMStandard,
  PMVariant,
  PMVariantUom,
  PMUom,
  PMVariationTemplate,
  PMVariationTemplateValue,
} from "@/features/shared/types";

export const pmRefs = () => api.get<PMRefs>("/api/pm/refs");

export const pmCategories = () => api.get<PMCategory[]>("/api/pm/categories");
export const pmSaveCategory = (body: Partial<PMCategory>, id?: string) =>
  id ? api.put<PMCategory>(`/api/pm/categories/${id}`, body) : api.post<PMCategory>("/api/pm/categories", body);
export const pmDeleteCategory = (id: string) => api.delete(`/api/pm/categories/${id}`);

export const pmProductGroups = () => api.get<PMProductGroup[]>("/api/pm/product-groups");
export const pmSaveProductGroup = (body: Partial<PMProductGroup>, id?: string) =>
  id ? api.put<PMProductGroup>(`/api/pm/product-groups/${id}`, body) : api.post<PMProductGroup>("/api/pm/product-groups", body);
export const pmDeleteProductGroup = (id: string) => api.delete(`/api/pm/product-groups/${id}`);

export const pmBrands = () => api.get<PMBrand[]>("/api/pm/brands");
export const pmSaveBrand = (body: Partial<PMBrand>, id?: string) =>
  id ? api.put<PMBrand>(`/api/pm/brands/${id}`, body) : api.post<PMBrand>("/api/pm/brands", body);
export const pmDeleteBrand = (id: string) => api.delete(`/api/pm/brands/${id}`);

export const pmUoms = () => api.get<PMUom[]>("/api/pm/uoms");
export const pmSaveUom = (body: Partial<PMUom>, id?: string) =>
  id ? api.put<PMUom>(`/api/pm/uoms/${id}`, body) : api.post<PMUom>("/api/pm/uoms", body);
export const pmDeleteUom = (id: string) => api.delete(`/api/pm/uoms/${id}`);

export const pmProducts = (params?: Record<string, string>) =>
  api.get<{ data: PMProduct[]; total: number }>("/api/pm/products", params);
export const pmProduct = (id: string) => api.get<PMProduct & { variants: PMVariant[] }>(`/api/pm/products/${id}`);
export const pmSaveProduct = (body: Partial<PMProduct>, id?: string) =>
  id ? api.put<PMProduct>(`/api/pm/products/${id}`, body) : api.post<PMProduct>("/api/pm/products", body);
export const pmDeleteProduct = (id: string) => api.delete(`/api/pm/products/${id}`);
export const pmMergeVariation = (body: {
  parentId: string;
  templateIds: string[];
  assignments: { productId: string; valueIds: string[] }[];
}) => api.post<PMProduct>("/api/pm/products/merge-variation", body);
export const pmImportProducts = (rows: Record<string, unknown>[]) => api.post<{ imported: number; skipped: number; errors?: string[] }>("/api/pm/products/import", rows);
export const pmImportFile = (fileName: string, base64: string) =>
  api.post<{ imported: number; skipped: number; errors?: string[] }>("/api/pm/products/import", { fileName, base64 });

export const pmVariants = (params?: Record<string, string>) => api.get<PMVariant[]>("/api/pm/variants", params);
export const pmSaveVariant = (body: Partial<PMVariant>, id?: string) =>
  id ? api.put<PMVariant>(`/api/pm/variants/${id}`, body) : api.post<PMVariant>("/api/pm/variants", body);
export const pmDeleteVariant = (id: string) => api.delete(`/api/pm/variants/${id}`);

export const pmStandards = () => api.get<PMStandard[]>("/api/pm/standards");
export const pmSaveStandard = (body: Partial<PMStandard>, id?: string) =>
  id ? api.put<PMStandard>(`/api/pm/standards/${id}`, body) : api.post<PMStandard>("/api/pm/standards", body);
export const pmDeleteStandard = (id: string) => api.delete(`/api/pm/standards/${id}`);

export const pmVariantUoms = (variantId: string) => api.get<PMVariantUom[]>("/api/pm/variant-uoms", { variant_id: variantId });
export const pmSaveVariantUom = (body: Partial<PMVariantUom>, id?: string) =>
  id ? api.put<PMVariantUom>(`/api/pm/variant-uoms/${id}`, body) : api.post<PMVariantUom>("/api/pm/variant-uoms", body);
export const pmDeleteVariantUom = (id: string) => api.delete(`/api/pm/variant-uoms/${id}`);

export const pmVariationTemplates = (params?: Record<string, string>) =>
  api.get<PMVariationTemplate[]>("/api/pm/variation-templates", params);
export const pmSaveVariationTemplate = (body: Omit<Partial<PMVariationTemplate>, "values"> & { values?: Partial<PMVariationTemplateValue>[] }, id?: string) =>
  id
    ? api.put<PMVariationTemplate>(`/api/pm/variation-templates/${id}`, body)
    : api.post<PMVariationTemplate>("/api/pm/variation-templates", body);
export const pmDeleteVariationTemplate = (id: string) => api.delete(`/api/pm/variation-templates/${id}`);

export const pmSaveStandardItem = (body: Record<string, unknown>) => api.post("/api/pm/standard-items", body);
export const pmDeleteStandardItem = (id: string) => api.delete(`/api/pm/standard-items/${id}`);