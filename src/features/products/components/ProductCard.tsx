import { memo } from "react";
import {
  Eye,
  SquarePen as PenNewSquare,
  Trash2 as TrashBinMinimalistic,
  Layers,
  CheckCircle,
  TriangleAlert as DangerTriangle,
} from "lucide-react";
import { Product } from "@/features/shared/types";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  isAdmin: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const ProductCard = memo(function ProductCard({
  product,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: ProductCardProps) {

  return (
    <motion.div
      id={`product-card-${product.id}`}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.04)] hover:border-border transition-all duration-300 flex flex-col h-full ${
        product.status === "Inactive" ? "opacity-90 border-dashed border-border" : ""
      }`}
    >
      {/* Upper Color Block / Visual representation */}
      <div className="relative h-28 bg-muted overflow-hidden px-4 py-3 flex flex-col justify-between">
        {/* Categories Row */}
        <div className="flex justify-between items-start">
          <span className="px-2.5 py-0.5 text-xs font-medium bg-background/80 text-foreground rounded-md tracking-wider uppercase font-mono border border-border">
            {product.category}
          </span>

          {/* Status badge */}
          <Badge variant={product.status === "Active" ? "default" : "secondary"} className="text-xs font-medium tracking-wider uppercase font-mono shadow-sm flex items-center gap-1">
            {product.status === "Active" ? <CheckCircle className="w-3 h-3 shrink-0" /> : <DangerTriangle className="w-3 h-3 shrink-0" />}
            {product.status}
          </Badge>
        </div>

        {/* Dynamic code & UoM badge */}
        <div className="flex justify-between items-end">
          <div>
            <span className="text-xs text-muted-foreground font-mono tracking-widest block uppercase font-medium">Product Code</span>
            <span className="text-sm font-semibold text-foreground font-mono tracking-wider">
              {product.productCode}
            </span>
          </div>

          <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded-md font-medium text-xs font-mono shadow-sm">
            UoM: {product.uom || "Pcs"}
          </div>
        </div>
      </div>

      {/* Main product data info body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          {/* Sub category & Code tag label */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono font-medium uppercase tracking-wider">
            <Layers className="w-3 h-3 text-muted-foreground" />
            <span>{product.subCategory || "General"}</span>
          </div>

          {/* Title */}
          <h4
            id={`product-title-${product.id}`}
            onClick={() => onView(product)}
            className="text-sm font-semibold text-foreground hover:text-foreground transition-colors font-sans leading-snug tracking-tight cursor-pointer line-clamp-2"
            title="Click to view full specs"
          >
            {product.name}
          </h4>

          {/* Trimmed description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {product.description || "No product catalog description provided."}
          </p>
        </div>

        {/* Operations footer */}
        <Separator className="my-4" />
        <div className="pt-3.5 flex justify-between items-center">
          {/* Inventory info if present */}
          <div className="text-xs font-mono text-muted-foreground font-medium uppercase">
            {product.price !== undefined ? (
              <div>
                <span className="text-muted-foreground block text-xs">Value Estimate</span>
                <span className="text-foreground font-bold font-sans text-xs">${product.price.toFixed(2)}</span>
              </div>
            ) : (
              <span>Cataloged Item</span>
            )}
          </div>

          {/* Action pills row */}
          <div className="flex items-center gap-1.5">
            <Button
              id={`btn-open-details-${product.id}`}
              onClick={() => onView(product)}
              variant="ghost"
              size="sm"
            >
              <Eye /> Specs
            </Button>

            {isAdmin && (
              <div className="flex items-center gap-1 border-l border-border pl-1.5">
                <Tooltip>
                  <TooltipTrigger render={<Button
                  id={`btn-edit-${product.id}`}
                  onClick={() => onEdit(product)}
                  variant="ghost"
                  size="icon-xs"
                >
                  <PenNewSquare />
                </Button>} />
                  <TooltipContent>Modify Entry</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<Button
                  id={`btn-delete-${product.id}`}
                  onClick={() => onDelete(product.id)}
                  variant="ghost"
                  size="icon-xs"
                >
                  <TrashBinMinimalistic />
                </Button>} />
                  <TooltipContent>Remove from Catalog</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
