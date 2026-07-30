import React from "react";
import {
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  CheckCircle,
  TriangleAlert as DangerTriangle,
  Copy,
} from "lucide-react";
import { Product } from "@/features/shared/types";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ProductGalleryViewProps {
  products: Product[];
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const BLANK_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect fill="#f1f5f9" width="400" height="400"/><text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">NO IMAGE</text></svg>`);

export default function ProductGalleryView({
  products,
  isAdmin,
  onView,
  onEdit,
  onDelete,
 }: ProductGalleryViewProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div id="product-gallery-grid" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 sm:gap-5">
      {products.map((product) => {
        const imageUrl = product.imageUrl || BLANK_PLACEHOLDER; 
        
        return (
          <motion.div
            key={product.id}
            id={`gallery-item-${product.id}`}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            onClick={() => onView(product)}
            className={`group bg-card rounded-2xl overflow-hidden border border-border/80 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06)] hover:border-border/90 transition-all duration-305 flex flex-col h-full cursor-pointer relative ${
              product.status === "Inactive" ? "opacity-90 border-dashed border-border" : ""
            }`}
          >
            {/* Visual Header Image Container */}
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              {/* Product Photo */}
              <img
                src={imageUrl}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = BLANK_PLACEHOLDER;
                }}
              />

              {/* Status Badge */}
              <div className="absolute top-2.5 right-2.5 flex items-start z-10 pointer-events-none">
                <Badge variant={product.status === "Active" ? "default" : "secondary"} className="text-xs font-medium tracking-wide uppercase shadow-md flex items-center gap-1">
                    {product.status === "Active" ? <CheckCircle className="w-2.5 h-2.5" /> : <DangerTriangle className="w-2.5 h-2.5" />} {product.status}
                  </Badge>
              </div>

              {/* Float action elements overlay for admins on card hover */}
              {isAdmin && (
                <div className="absolute top-10 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 bg-card/95 backdrop-blur-md p-1 rounded-lg shadow-sm border border-border">
                  <Tooltip>
                    <TooltipTrigger render={<Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    variant="ghost"
                    size="icon-xs"
                  >
                    <PenNewSquare />
                  </Button>} />
                    <TooltipContent>Modify Specification</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product.id);
                    }}
                    variant="ghost"
                    size="icon-xs"
                  >
                    <TrashBinMinimalistic />
                  </Button>} />
                    <TooltipContent>Delete SKU</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Bottom fade scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              {/* Dynamic code & UoM badge overlay */}
              <div className="absolute bottom-2.5 inset-x-2.5 flex justify-between items-end z-10 text-white">
                <div>
                  <span className="text-xs text-white/60 font-mono tracking-widest block uppercase font-medium">PRODUCT CODE</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold font-mono tracking-wider text-white">
                      {product.productCode}
                    </span>
                    <Tooltip>
                      <TooltipTrigger render={<Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(product.productCode);
                      }}
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="z-10"
                    >
                      {copiedCode === product.productCode ? (
                        <CheckCircle className="text-foreground" />
                      ) : (
                        <Copy />
                      )}
                    </Button>} />
                      <TooltipContent>Copy Product Code</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="px-1.5 py-0.5 bg-card/95 backdrop-blur-md text-foreground rounded-md font-medium text-xs font-mono shadow-sm border border-white/20">
                  UoM: {product.uom || "Pcs"}
                </div>
              </div>
            </div>

            {/* Product description content info */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h3
                  id={`product-title-${product.id}`}
                  className="text-xs font-semibold text-foreground transition-colors font-sans leading-snug line-clamp-2"
                >
                  {product.name}
                </h3>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
