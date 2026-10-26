import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateSpareClassification as validateSharedSpareClassification, OPTIMUM_CATEGORY as OPTIMUM_CATEGORY_KEY, MAX_OPTIMUM_QTY } from "@shared/spareClassification";

export interface SpareCategoryOption {
  id?: number;
  listKey: string;
  listValue: string;
  isActive?: boolean;
}

export { OPTIMUM_CATEGORY_KEY, MAX_OPTIMUM_QTY };

export function useSpareCategories() {
  return useQuery<SpareCategoryOption[]>({
    queryKey: ["/technical/api/fleet/master-lists", "spareCategory"],
    queryFn: async () => {
      const response = await fetch("/technical/api/fleet/master-lists?listType=spareCategory", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load spare categories");
      const rows = await response.json();
      return (Array.isArray(rows) ? rows : []).filter((item: SpareCategoryOption) => item.isActive !== false);
    },
  });
}

export function validateSpareClassification(category: string, quantity: string | number | null | undefined) {
  try {
    validateSharedSpareClassification({
      spareCategory: category,
      optimumQty: category === OPTIMUM_CATEGORY_KEY ? quantity : null,
    }, { required: true });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid Spare Category or Optimum Qty.";
  }
}

interface Props {
  category: string;
  quantity: string;
  onCategoryChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  idPrefix?: string;
  required?: boolean;
}

export function SpareCategoryFields({ category, quantity, onCategoryChange, onQuantityChange, idPrefix = "spare", required = true }: Props) {
  const { data: categories = [], isLoading, error, refetch } = useSpareCategories();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Spare Category{required ? " *" : ""}</Label>
        <Select value={category || ""} onValueChange={onCategoryChange}>
          <SelectTrigger id={`${idPrefix}-category`} aria-label="Spare Category">
            <SelectValue placeholder={isLoading ? "Loading categories…" : "Select category"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map(option => <SelectItem key={option.listKey} value={option.listKey}>{option.listValue}</SelectItem>)}
          </SelectContent>
        </Select>
        {error && (
          <p className="text-xs text-destructive">
            Categories could not be loaded.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-optimum`}>Optimum Qty{category === OPTIMUM_CATEGORY_KEY ? " *" : ""}</Label>
        <Input
          id={`${idPrefix}-optimum`}
          type="number"
          min={1}
          max={MAX_OPTIMUM_QTY}
          step={1}
          inputMode="numeric"
          value={category === OPTIMUM_CATEGORY_KEY ? quantity : ""}
          disabled={category !== OPTIMUM_CATEGORY_KEY}
          onChange={event => onQuantityChange(event.target.value)}
          placeholder={category === OPTIMUM_CATEGORY_KEY ? "Enter a whole number" : "Only for Optimum"}
        />
        <p className="text-xs text-muted-foreground">Only the stable “optimum” category uses this quantity.</p>
      </div>
    </div>
  );
}
