import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageContent from "@/features/shared/components/PageContent";
import { useToast } from "@/features/shared/components/Toast";
import { pmRefs } from "@/features/product-management/api";
import type { PMRefs } from "@/features/shared/types";
import PmProductsTab from "@/features/product-management/components/PmProductsTab";
import PmVariantsTab from "@/features/product-management/components/PmVariantsTab";
import PmCategoriesTab from "@/features/product-management/components/PmCategoriesTab";
import PmProductGroupsTab from "@/features/product-management/components/PmProductGroupsTab";
import PmAssignmentTab from "@/features/product-management/components/PmAssignmentTab";
import PmBrandsTab from "@/features/product-management/components/PmBrandsTab";
import PmUomsTab from "@/features/product-management/components/PmUomsTab";
import PmStandardsTab from "@/features/product-management/components/PmStandardsTab";
import PmVariationTemplatesTab from "@/features/product-management/components/PmVariationTemplatesTab";

const EMPTY_REFS: PMRefs = {
  categories: [],
  productGroups: [],
  brands: [],
  uoms: [],
  products: [],
  variants: [],
  standards: [],
  variationTemplates: [],
};

const TABS = [
  { value: "products", label: "Products" },
  { value: "variants", label: "Variants" },
  { value: "categories", label: "Categories" },
  { value: "product-groups", label: "Product Groups" },
  { value: "assignments", label: "Assignments" },
  { value: "brands", label: "Brands" },
  { value: "uoms", label: "UoMs" },
  { value: "standards", label: "Standards" },
  { value: "variation-templates", label: "Variation Templates" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function ProductManagementPage() {
  const { toast } = useToast();
  const [refs, setRefs] = useState<PMRefs>(EMPTY_REFS);
  const [activeTab, setActiveTab] = useState<TabValue>("products");

  const refreshRefs = useCallback(async () => {
    try {
      setRefs(await pmRefs());
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [toast]);

  useEffect(() => {
    refreshRefs();
  }, [refreshRefs]);

  return (
    <PageContent>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="cursor-pointer px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="products" className="pt-4">
          <PmProductsTab productGroups={refs.productGroups} brands={refs.brands} refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="variants" className="pt-4">
          <PmVariantsTab products={refs.products} />
        </TabsContent>
        <TabsContent value="categories" className="pt-4">
          <PmCategoriesTab categories={refs.categories} refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="product-groups" className="pt-4">
          <PmProductGroupsTab categories={refs.categories} refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="assignments" className="pt-4">
          <PmAssignmentTab productGroups={refs.productGroups} categories={refs.categories} refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="brands" className="pt-4">
          <PmBrandsTab refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="uoms" className="pt-4">
          <PmUomsTab refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="standards" className="pt-4">
          <PmStandardsTab productGroups={refs.productGroups} variants={refs.variants} refreshRefs={refreshRefs} />
        </TabsContent>
        <TabsContent value="variation-templates" className="pt-4">
          <PmVariationTemplatesTab refreshRefs={refreshRefs} />
        </TabsContent>
      </Tabs>
    </PageContent>
  );
}