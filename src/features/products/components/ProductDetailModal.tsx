import {
  Calendar,
  Package as Box,
} from "lucide-react";
import { Product } from "@/features/shared/types";
import BaseModal from "@/features/shared/components/BaseModal";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailRow } from "@/features/shared/components/DetailRow";

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

const badgeStyle = "bg-muted text-foreground border-border";

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
}: ProductDetailModalProps) {


  return (
    <BaseModal
      isOpen={isOpen && !!product}
      onClose={onClose}
      size="3xl"
      maxHeight="max-h-[90vh]"
      rounded="rounded-3xl"
      backdropBlur="backdrop-blur-md"
      className="overflow-y-auto no-scrollbar flex flex-col p-6 md:p-8"
    >
      {product && (
        <>
          <div className="flex justify-between items-center border-b border-border pb-4 mb-5 shrink-0">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest font-mono text-muted-foreground font-medium block">
                Catalog Sheet Spec
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 font-mono text-xs font-semibold bg-primary text-primary-foreground rounded-md tracking-wider">
                  {product.productCode}
                </span>

                <Badge variant={product.status === "Active" ? "default" : "secondary"} className="text-xs font-medium uppercase tracking-wider font-mono">
                  {product.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1 overflow-visible">
            {product.imageUrl ? (
              <div className="md:col-span-5 w-full aspect-square rounded-2xl overflow-hidden bg-muted border border-border shadow-sm relative shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            ) : (
              <div className="md:col-span-5 w-full aspect-square rounded-2xl bg-muted border border-border flex flex-col items-center justify-center text-muted-foreground p-4 shrink-0">
                <Box className="w-12 h-12 stroke-[1.5]" />
                <span className="text-xs font-medium font-mono uppercase tracking-wider mt-2">No Image Provided</span>
              </div>
            )}

            <div className="md:col-span-7 flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground font-medium block">Product Name</span>
                  <h2 className="text-base md:text-lg font-bold text-foreground leading-snug tracking-tight font-sans mt-0.5">
                    {product.name}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3.5 bg-muted/70 rounded-2xl p-4 border border-border/50">
                  <DetailRow label="Category" value={product.category} />
                  <DetailRow label="Sub Category" value={product.subCategory || "General"} />
                  <DetailRow label="UoM" value={product.uom || "Pcs"} />
                  <DetailRow label="Availability" value={product.status} />
                </div>
              </div>

              <Separator className="my-4" />
              <div className="pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Created: {new Date(product.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </span>
                <span>
                  Modified: {new Date(product.updatedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </BaseModal>
  );
}
