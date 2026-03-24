import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign } from "lucide-react";

interface CostRow {
  fuelType: string;
  totalQuantityMt: string;
  totalCost: string;
}

interface Props {
  vesselId: string;
  voyageNo?: string;
}

function fmt(value: string | number | null | undefined, decimals = 2): string {
  const n = Number(value);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const FUEL_COLORS: Record<string, string> = {
  HFO:   "bg-blue-100 text-blue-800",
  VLSFO: "bg-indigo-100 text-indigo-800",
  LSMGO: "bg-cyan-100 text-cyan-800",
  MGO:   "bg-teal-100 text-teal-800",
  LPG:   "bg-purple-100 text-purple-800",
};

export default function BunkerCostSummary({ vesselId, voyageNo }: Props) {
  const params = new URLSearchParams({ vesselId });
  if (voyageNo) params.set("voyageNo", voyageNo);

  const { data, isLoading } = useQuery<CostRow[]>({
    queryKey: ["/api/nr-bunker-cost", vesselId, voyageNo],
    queryFn: () => fetch(`/technical/api/nr-bunker-cost?${params}`).then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const grandTotalCost = (data ?? []).reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
  const grandTotalQty  = (data ?? []).reduce((sum, row) => sum + Number(row.totalQuantityMt || 0), 0);
  const hasData = (data ?? []).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-green-600" />
          Bunker Cost Summary
          {voyageNo && (
            <span className="ml-auto text-xs font-normal text-gray-500">Voyage {voyageNo}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !hasData ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No bunkering events recorded yet.
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-3 gap-2 mb-2 px-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Fuel</span>
              <span className="text-right">Qty (MT)</span>
              <span className="text-right">Total (USD)</span>
            </div>

            {(data ?? []).map(row => (
              <div
                key={row.fuelType}
                className="grid grid-cols-3 gap-2 items-center py-2 border-b border-gray-100 last:border-0"
                data-testid={`cost-row-${row.fuelType}`}
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                    FUEL_COLORS[row.fuelType] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {row.fuelType}
                </span>
                <span className="text-right text-sm tabular-nums" data-testid={`qty-${row.fuelType}`}>
                  {fmt(row.totalQuantityMt, 3)}
                </span>
                <span className="text-right text-sm font-medium tabular-nums" data-testid={`cost-${row.fuelType}`}>
                  ${fmt(row.totalCost, 0)}
                </span>
              </div>
            ))}

            {/* Grand total */}
            <div className="grid grid-cols-3 gap-2 items-center pt-3 mt-1">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-right text-sm font-semibold tabular-nums" data-testid="total-quantity">
                {fmt(grandTotalQty, 3)} MT
              </span>
              <span className="text-right text-base font-bold text-green-700 tabular-nums" data-testid="total-cost">
                ${fmt(grandTotalCost, 0)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
