import { useMasterListOptions } from "@/hooks/useDepartments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const OPTIMUM_SPARE_CATEGORY = "optimum";
export const MAX_OPTIMUM_QTY = 2147483647;

interface SpareClassificationFieldsProps {
  spareCategory: string;
  optimumQty: string;
  onCategoryChange: (value: string) => void;
  onOptimumQtyChange: (value: string) => void;
  idPrefix?: string;
  className?: string;
}

export function SpareClassificationFields({
  spareCategory,
  optimumQty,
  onCategoryChange,
  onOptimumQtyChange,
  idPrefix = "spare",
  className = "grid grid-cols-1 sm:grid-cols-2 gap-4",
}: SpareClassificationFieldsProps) {
  const { options, isLoading, error } = useMasterListOptions("spareCategory");

  const changeCategory = (nextCategory: string) => {
    if (spareCategory === OPTIMUM_SPARE_CATEGORY &&
        nextCategory !== OPTIMUM_SPARE_CATEGORY &&
        optimumQty.trim() &&
        !window.confirm("Changing from Optimum will clear the existing Optimum Qty. Continue?")) {
      return;
    }
    onCategoryChange(nextCategory);
    if (nextCategory !== OPTIMUM_SPARE_CATEGORY) onOptimumQtyChange("");
  };

  const changeQty = (nextQty: string) => {
    if (optimumQty.trim() && !nextQty.trim() &&
        !window.confirm("Clearing the existing Optimum Qty will require a new valid quantity before saving. Continue?")) {
      return;
    }
    onOptimumQtyChange(nextQty);
  };

  return (
    <div className={className}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-spare-category`}>Spare Category <span className="text-red-600">*</span></Label>
        <Select value={spareCategory || "unselected"} onValueChange={value => changeCategory(value === "unselected" ? "" : value)}>
          <SelectTrigger id={`${idPrefix}-spare-category`} data-testid={`${idPrefix}-spare-category`}>
            <SelectValue placeholder={isLoading ? "Loading categories..." : "Select category"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unselected">Select category</SelectItem>
            {spareCategory && !options.some(option => option.value === spareCategory) && (
              <SelectItem value={spareCategory}>{spareCategory}</SelectItem>
            )}
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-red-600">Could not load spare categories. Retry after the master list is available.</p>}
      </div>
      {spareCategory === OPTIMUM_SPARE_CATEGORY && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-optimum-qty`}>Optimum Qty <span className="text-red-600">*</span></Label>
          <Input
            id={`${idPrefix}-optimum-qty`}
            data-testid={`${idPrefix}-optimum-qty`}
            type="number"
            min={1}
            max={MAX_OPTIMUM_QTY}
            step={1}
            inputMode="numeric"
            value={optimumQty}
            onChange={event => changeQty(event.target.value)}
            placeholder="Enter positive whole number"
          />
        </div>
      )}
    </div>
  );
}

export function isValidSpareClassification(category: string | null | undefined, qty: string | number | null | undefined) {
  if (!category?.trim()) return false;
  if (category !== OPTIMUM_SPARE_CATEGORY) return true;
  const value = typeof qty === "number" ? qty : Number(qty);
  return Number.isInteger(value) && value > 0 && value <= MAX_OPTIMUM_QTY;
}

export function normalizeOptimumQty(category: string | null | undefined, qty: string | number | null | undefined) {
  return category === OPTIMUM_SPARE_CATEGORY ? Number(qty) : null;
}
