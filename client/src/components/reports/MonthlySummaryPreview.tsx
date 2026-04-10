import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, TrendingUp, TrendingDown, ArrowRight, CheckCircle, AlertTriangle, Clock, XCircle, Wrench, FileWarning, ShieldCheck, AlertCircle, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CategoryData {
  count: number;
  woIds: string[];
}

interface MovementData {
  newJobsEntered: CategoryData;
  completedInMonth: CategoryData;
  postponedInMonth: CategoryData;
  newlyOverdue: CategoryData;
  unplannedRaised: CategoryData;
  sentToPendingApproval: CategoryData;
}

interface Indicators {
  completionRate: number;
  overdueChange: number;
  postponementCount: number;
  unplannedCount: number;
}

interface SnapshotMeta {
  id: number;
  type: string;
  category: string;
  count: number;
  generatedAt: string;
  timestamp: string;
  workOrderIds: string[];
}

export interface MonthlySummaryData {
  vesselName: string;
  month: string;
  opening: Record<string, CategoryData>;
  movement: MovementData;
  closing: Record<string, CategoryData>;
  indicators: Indicators;
  snapshotMeta: SnapshotMeta[];
}

interface DrilldownRow {
  workOrderNo: string;
  jobTitle: string;
  componentCode: string;
  componentName: string;
  dueDate: string;
  status: string;
  maintenanceBasis: string;
  department: string;
}

interface MonthlySummaryPreviewProps {
  data: MonthlySummaryData;
  vesselId: string;
  year: number;
  month: number;
  isLoading?: boolean;
  error?: string | null;
  onRegenerate: () => Promise<void>;
}

const CATEGORIES = ['Planned', 'Due', 'Overdue', 'Postponed', 'Unplanned', 'Pending Approval', 'Completed'] as const;

const CATEGORY_STYLES: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  'Planned': { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  'Due': { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  'Overdue': { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  'Postponed': { icon: FileWarning, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  'Unplanned': { icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  'Pending Approval': { icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  'Completed': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function MonthlySummaryLoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="monthly-summary-skeleton">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center space-y-2">
              <Skeleton className="h-3 w-20 mx-auto" />
              <Skeleton className="h-8 w-12 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 pt-3 px-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MonthlySummaryErrorPanel({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-red-200 dark:border-red-800" data-testid="monthly-summary-error">
      <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-400">Snapshot Generation Failed</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry-snapshot">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

const MonthlySummaryPreview: React.FC<MonthlySummaryPreviewProps> = ({ data, vesselId, year, month, isLoading, error, onRegenerate }) => {
  const { toast } = useToast();
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownData, setDrilldownData] = useState<DrilldownRow[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);

  if (isLoading) {
    return <MonthlySummaryLoadingSkeleton />;
  }

  if (error) {
    return <MonthlySummaryErrorPanel error={error} onRetry={() => onRegenerate()} />;
  }

  const { opening, movement, closing, indicators, snapshotMeta } = data;
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const openingTotal = CATEGORIES.reduce((sum, c) => sum + (opening[c]?.count || 0), 0);
  const closingTotal = CATEGORIES.reduce((sum, c) => sum + (closing[c]?.count || 0), 0);

  const handleSnapshotDrilldown = async (type: 'opening' | 'closing', category: string) => {
    const count = type === 'opening' ? (opening[category]?.count || 0) : (closing[category]?.count || 0);
    if (count === 0) return;

    setDrilldownTitle(`${type === 'opening' ? 'Opening' : 'Closing'} — ${category} (${count})`);
    setDrilldownLoading(true);
    setDrilldownOpen(true);

    try {
      const res = await fetch(`/technical/api/reports/maintenance/monthly-summary/snapshot-detail?vesselId=${vesselId}&year=${year}&month=${month}&type=${type}&category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error('Failed to fetch drilldown');
      const rows = await res.json();
      setDrilldownData(rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setDrilldownData([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleMovementDrilldown = async (movementType: string, label: string, count: number) => {
    if (count === 0) return;

    setDrilldownTitle(`Movement — ${label} (${count})`);
    setDrilldownLoading(true);
    setDrilldownOpen(true);

    try {
      const res = await fetch(`/technical/api/reports/maintenance/monthly-summary/snapshot-detail?vesselId=${vesselId}&year=${year}&month=${month}&type=movement&category=${movementType}`);
      if (!res.ok) throw new Error('Failed to fetch drilldown');
      const rows = await res.json();
      setDrilldownData(rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setDrilldownData([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
      toast({ title: 'Success', description: 'Snapshots regenerated' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  const renderClickableCount = (count: number, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`font-bold text-lg tabular-nums transition-colors ${count > 0 ? 'cursor-pointer hover:text-blue-600 hover:underline' : 'cursor-default text-muted-foreground'}`}
      data-testid="drilldown-count"
    >
      {count}
    </button>
  );

  const hasIndicatorDenominator = openingTotal > 0 || movement.completedInMonth.count > 0;

  return (
    <div className="space-y-4" data-testid="monthly-summary-preview">
      {hasIndicatorDenominator && (
        <div className="grid grid-cols-4 gap-3" data-testid="section-indicators">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
              <p className={`text-2xl font-bold ${indicators.completionRate >= 80 ? 'text-green-600' : indicators.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`} data-testid="indicator-completion-rate">
                {indicators.completionRate}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Overdue Change</p>
              <div className="flex items-center justify-center gap-1" data-testid="indicator-overdue-change">
                {indicators.overdueChange > 0 ? <TrendingUp className="h-4 w-4 text-red-500" /> : indicators.overdueChange < 0 ? <TrendingDown className="h-4 w-4 text-green-500" /> : null}
                <p className={`text-2xl font-bold ${indicators.overdueChange > 0 ? 'text-red-600' : indicators.overdueChange < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {indicators.overdueChange > 0 ? `+${indicators.overdueChange}` : indicators.overdueChange}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Postponements</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="indicator-postponements">{indicators.postponementCount}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Unplanned Jobs</p>
              <p className="text-2xl font-bold text-purple-600" data-testid="indicator-unplanned">{indicators.unplannedCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card data-testid="section-opening">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200">A</Badge>
              Opening Position
            </CardTitle>
            <p className="text-xs text-muted-foreground">1st {MONTH_NAMES[month - 1]} {year}</p>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {CATEGORIES.map(cat => {
              const style = CATEGORY_STYLES[cat];
              const Icon = style.icon;
              const count = opening[cat]?.count || 0;
              return (
                <div key={cat} className={`flex items-center justify-between px-2 py-1.5 rounded ${style.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                    <span className="text-xs font-medium">{cat}</span>
                  </div>
                  {renderClickableCount(count, () => handleSnapshotDrilldown('opening', cat))}
                </div>
              );
            })}
            <div className="flex items-center justify-between px-2 py-1.5 mt-1 border-t border-border">
              <span className="text-xs font-semibold">Total</span>
              <span className="font-bold text-lg tabular-nums">{openingTotal}</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="section-movement">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200">B</Badge>
              Monthly Movement
            </CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {[
              { key: 'newJobsEntered', label: 'New Jobs Entered', icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
              { key: 'completedInMonth', label: 'Completed', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
              { key: 'postponedInMonth', label: 'Postponed', icon: FileWarning, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
              { key: 'newlyOverdue', label: 'Newly Overdue', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
              { key: 'unplannedRaised', label: 'Unplanned Raised', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
              { key: 'sentToPendingApproval', label: 'Sent to Pending Approval', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
            ].map(item => {
              const Icon = item.icon;
              const count = movement[item.key as keyof MovementData]?.count || 0;
              return (
                <div key={item.key} className={`flex items-center justify-between px-2 py-1.5 rounded ${item.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  {renderClickableCount(count, () => handleMovementDrilldown(item.key, item.label, count))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card data-testid="section-closing">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200">C</Badge>
              Closing Position
            </CardTitle>
            <p className="text-xs text-muted-foreground">End of {MONTH_NAMES[month - 1]} {year}</p>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {CATEGORIES.map(cat => {
              const style = CATEGORY_STYLES[cat];
              const Icon = style.icon;
              const count = closing[cat]?.count || 0;
              const openCount = opening[cat]?.count || 0;
              const diff = count - openCount;
              return (
                <div key={cat} className={`flex items-center justify-between px-2 py-1.5 rounded ${style.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                    <span className="text-xs font-medium">{cat}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {diff !== 0 && (
                      <span className={`text-[10px] font-medium ${diff > 0 ? (cat === 'Completed' ? 'text-green-500' : 'text-red-500') : (cat === 'Completed' ? 'text-red-500' : 'text-green-500')}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                    {renderClickableCount(count, () => handleSnapshotDrilldown('closing', cat))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-2 py-1.5 mt-1 border-t border-border">
              <span className="text-xs font-semibold">Total</span>
              <span className="font-bold text-lg tabular-nums">{closingTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVerificationOpen(!verificationOpen)}
          data-testid="toggle-verification"
        >
          {verificationOpen ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
          Snapshot Verification
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
          data-testid="regenerate-snapshots"
        >
          {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Regenerate Snapshots
        </Button>
      </div>

      {verificationOpen && (
        <Card data-testid="snapshot-verification-panel">
          <CardContent className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-1 px-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-1 px-2 font-medium text-muted-foreground">Count</th>
                    <th className="text-left py-1 px-2 font-medium text-muted-foreground">Generated At</th>
                    <th className="text-left py-1 px-2 font-medium text-muted-foreground">Work Order IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotMeta.map((s, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1 px-2">
                        <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                      </td>
                      <td className="py-1 px-2">{s.category}</td>
                      <td className="py-1 px-2 text-right font-mono">{s.count}</td>
                      <td className="py-1 px-2 text-muted-foreground">
                        {s.generatedAt ? new Date(s.generatedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-1 px-2 text-muted-foreground max-w-[200px]">
                        <div className="truncate font-mono text-[10px]" title={s.workOrderIds?.join(', ') || '-'}>
                          {s.workOrderIds && s.workOrderIds.length > 0
                            ? `${s.workOrderIds.slice(0, 3).join(', ')}${s.workOrderIds.length > 3 ? ` (+${s.workOrderIds.length - 3} more)` : ''}`
                            : '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="drilldown-title">{drilldownTitle}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {drilldownLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading work orders...</span>
              </div>
            ) : drilldownData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No work orders found</p>
            ) : (
              <table className="w-full text-sm" data-testid="drilldown-table">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">WO No</th>
                    <th className="text-left py-2 px-3 font-medium">Job Title</th>
                    <th className="text-left py-2 px-3 font-medium">Component</th>
                    <th className="text-left py-2 px-3 font-medium">Due Date</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 px-3 font-mono text-xs">{row.workOrderNo}</td>
                      <td className="py-1.5 px-3">{row.jobTitle}</td>
                      <td className="py-1.5 px-3">
                        <span className="text-xs text-muted-foreground">{row.componentCode}</span>
                        {row.componentName !== '-' && <span className="block text-xs">{row.componentName}</span>}
                      </td>
                      <td className="py-1.5 px-3 text-xs">{row.dueDate}</td>
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                      </td>
                      <td className="py-1.5 px-3 text-xs">{row.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlySummaryPreview;
