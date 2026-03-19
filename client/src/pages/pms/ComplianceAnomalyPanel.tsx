import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUIRole } from "@/contexts/UIRoleContext";
import {
  AlertTriangle,
  Calendar,
  BarChart3,
  TrendingDown,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Search,
} from "lucide-react";

interface CycleSkipBreakdown {
  rank: string;
  totalWOs: number;
  skippedWOs: number;
  rate: number;
  severity: "green" | "yellow" | "red";
}

interface BackdatedEntry {
  woCode: string;
  jobTitle: string;
  completionDate: string;
  submittedDate: string;
  daysDiff: number;
  performedBy: string;
}

interface BulkCompletionEvent {
  date: string;
  totalCompleted: number;
  overdueCompleted: number;
  performedBy: string;
}

interface ComplianceAnomalies {
  cycleSkipRate: {
    highestRate: number;
    highestRank: string;
    severity: "green" | "yellow" | "red";
    breakdown: CycleSkipBreakdown[];
  };
  backdatingFrequency: {
    percentage: number;
    severity: "green" | "yellow" | "red";
    recentBackdated: BackdatedEntry[];
  };
  bulkCompletions: {
    eventCount: number;
    severity: "green" | "yellow" | "red";
    events: BulkCompletionEvent[];
  };
  scheduleDrift: {
    averageDaysLate: number;
    severity: "green" | "yellow" | "red";
    median: number;
    worst: { woCode: string; jobTitle: string; daysLate: number } | null;
    bestOnTimeCount: number;
    trend: "increasing" | "decreasing" | "stable";
  };
}

const severityColors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  red: { border: "#d32f2f", bg: "#FFEBEE", text: "#c62828", badge: "#d32f2f" },
  yellow: { border: "#f9a825", bg: "#FFF8E1", text: "#f57f17", badge: "#f9a825" },
  green: { border: "#2e7d32", bg: "#E8F5E9", text: "#1b5e20", badge: "#2e7d32" },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function SeverityBadge({ severity }: { severity: "green" | "yellow" | "red" }) {
  const labels = { green: "Good", yellow: "Warning", red: "Alert" };
  const colors = severityColors[severity];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "10px",
        fontWeight: 600,
        color: "#fff",
        background: colors.badge,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
      data-testid={`badge-severity-${severity}`}
    >
      {labels[severity]}
    </span>
  );
}

function DetailModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
      data-testid="modal-overlay"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "720px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#212121", margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" style={{ color: "#757575" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CycleSkipDetails({ data, isRestricted }: { data: ComplianceAnomalies["cycleSkipRate"]; isRestricted: boolean }) {
  if (isRestricted) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        Detailed crew breakdown is restricted to senior officers.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Crew Member (Rank)</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Total WOs</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Skipped Cycles</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Skip Rate</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.breakdown.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-skip-rate-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{row.rank}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.totalWOs}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.skippedWOs}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: severityColors[row.severity].text }}>
              {row.rate}%
            </td>
            <td style={{ textAlign: "center", padding: "8px" }}>
              <SeverityBadge severity={row.severity} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BackdatingDetails({ data, isRestricted }: { data: ComplianceAnomalies["backdatingFrequency"]; isRestricted: boolean }) {
  if (data.recentBackdated.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        No backdated entries found in the last 30 days.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>WO Code</th>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Job Title</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Completion Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Submitted Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Days Backdated</th>
          {!isRestricted && <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Performed By</th>}
        </tr>
      </thead>
      <tbody>
        {data.recentBackdated.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-backdated-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{row.woCode}</td>
            <td style={{ padding: "8px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.jobTitle}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{formatDate(row.completionDate)}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{formatDate(row.submittedDate)}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: "#d32f2f" }}>{row.daysDiff} days</td>
            {!isRestricted && <td style={{ padding: "8px" }}>{row.performedBy}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulkCompletionDetails({ data, isRestricted }: { data: ComplianceAnomalies["bulkCompletions"]; isRestricted: boolean }) {
  if (data.events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#757575", fontSize: "13px" }}>
        No bulk completion events detected in the last 90 days.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
          <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Date</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>WOs Completed</th>
          <th style={{ textAlign: "center", padding: "8px", color: "#616161" }}>Overdue WOs</th>
          {!isRestricted && <th style={{ textAlign: "left", padding: "8px", color: "#616161" }}>Performed By</th>}
        </tr>
      </thead>
      <tbody>
        {data.events.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }} data-testid={`row-bulk-event-${i}`}>
            <td style={{ padding: "8px", fontWeight: 500 }}>{formatDate(row.date)}</td>
            <td style={{ textAlign: "center", padding: "8px" }}>{row.totalCompleted}</td>
            <td style={{ textAlign: "center", padding: "8px", fontWeight: 600, color: "#d32f2f" }}>{row.overdueCompleted}</td>
            {!isRestricted && <td style={{ padding: "8px" }}>{row.performedBy}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleDriftDetails({ data }: { data: ComplianceAnomalies["scheduleDrift"] }) {
  const trendLabels = { increasing: "Getting worse", decreasing: "Improving", stable: "Stable" };
  const trendColors = { increasing: "#d32f2f", decreasing: "#2e7d32", stable: "#757575" };

  return (
    <div style={{ padding: "8px 0", fontSize: "13px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Average Drift</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: severityColors[data.severity].text }}>
            {data.averageDaysLate} days late
          </div>
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Median Drift</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#424242" }}>
            {data.median} days late
          </div>
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>Worst</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#d32f2f" }}>
            {data.worst ? `${data.worst.daysLate} days (${data.worst.woCode})` : "N/A"}
          </div>
          {data.worst && (
            <div style={{ fontSize: "11px", color: "#757575", marginTop: "2px" }}>{data.worst.jobTitle}</div>
          )}
        </div>
        <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px" }}>
          <div style={{ color: "#757575", fontSize: "11px", marginBottom: "4px" }}>On Time</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#2e7d32" }}>
            {data.bestOnTimeCount} WOs
          </div>
        </div>
      </div>
      <div style={{ background: "#f5f5f5", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: "#757575", fontSize: "12px" }}>Trend:</span>
        <span style={{ fontWeight: 600, color: trendColors[data.trend], fontSize: "13px" }}>
          {trendLabels[data.trend]}
        </span>
        {data.trend === "increasing" && <TrendingDown className="w-4 h-4" style={{ color: "#d32f2f", transform: "scaleY(-1)" }} />}
        {data.trend === "decreasing" && <TrendingDown className="w-4 h-4" style={{ color: "#2e7d32" }} />}
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  label: string;
  severity: "green" | "yellow" | "red" | "grey";
  onClick: () => void;
  testId: string;
}

function MetricCard({ icon, title, value, label, severity, onClick, testId }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = severity === "grey"
    ? { border: "#bdbdbd", bg: "#f5f5f5", text: "#9e9e9e", badge: "#bdbdbd" }
    : severityColors[severity];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: "#f9fafb",
        borderRadius: "8px",
        padding: "16px",
        borderLeft: `3px solid ${colors.border}`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
        transform: isHovered ? "translateY(-2px)" : "none",
        flex: 1,
        minWidth: 0,
      }}
      data-testid={testId}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon}
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#616161", textTransform: "uppercase", letterSpacing: "0.3px" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: "32px", fontWeight: 700, color: colors.text, lineHeight: 1.1, marginBottom: "6px" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#757575", lineHeight: 1.4 }}>
        {label}
      </div>
      <div style={{ marginTop: "8px", fontSize: "11px", color: "#1565C0", fontWeight: 500 }}>
        View Details →
      </div>
    </div>
  );
}

interface ComplianceAnomalyPanelProps {
  vesselId?: string;
}

export function ComplianceAnomalyPanel({ vesselId }: ComplianceAnomalyPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { isSailAdmin, isClientAdmin, isHeadOfDept, isVessel } = useUIRole();

  const canViewPanel = isSailAdmin;
  const isRestricted = isVessel;

  const queryUrl = vesselId && vesselId !== "all"
    ? `/technical/api/dashboard/compliance-anomalies?vesselId=${vesselId}`
    : "/technical/api/dashboard/compliance-anomalies";

  const { data, isLoading, error } = useQuery<ComplianceAnomalies>({
    queryKey: ["/technical/api/dashboard/compliance-anomalies", vesselId],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch compliance anomalies");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: canViewPanel || isVessel,
  });

  if (!canViewPanel && !isVessel) return null;

  const hasNoData = !data || (
    data.cycleSkipRate.breakdown.length === 0 &&
    data.backdatingFrequency.recentBackdated.length === 0 &&
    data.bulkCompletions.events.length === 0 &&
    !data.scheduleDrift.worst
  );

  const allGreen = data &&
    data.cycleSkipRate.severity === "green" &&
    data.backdatingFrequency.severity === "green" &&
    data.bulkCompletions.severity === "green" &&
    data.scheduleDrift.severity === "green";

  return (
    <div style={{ padding: "16px 16px 0 16px" }} data-testid="panel-compliance-anomaly">
      <div style={{
        background: "#fff",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
        overflow: "hidden",
      }}>
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            background: "#fafafa",
            borderBottom: isCollapsed ? "none" : "1px solid #e0e0e0",
          }}
          data-testid="button-toggle-compliance-panel"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Search className="w-5 h-5" style={{ color: "#1565C0" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#212121", letterSpacing: "0.3px" }}>
                Compliance Anomaly Detection
              </div>
              <div style={{ fontSize: "11px", color: "#757575", marginTop: "2px" }}>
                Patterns indicating potential maintenance schedule manipulation
              </div>
            </div>
          </div>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" style={{ color: "#757575" }} />
          ) : (
            <ChevronUp className="w-4 h-4" style={{ color: "#757575" }} />
          )}
        </div>

        {!isCollapsed && (
          <div style={{ padding: "16px" }}>
            {isLoading && (
              <div style={{ textAlign: "center", padding: "32px", color: "#757575", fontSize: "13px" }} data-testid="loading-compliance">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
                <div>Analyzing compliance patterns...</div>
              </div>
            )}

            {error && (
              <div style={{ textAlign: "center", padding: "20px", color: "#d32f2f", fontSize: "13px" }} data-testid="error-compliance">
                Failed to load compliance data. Please try again later.
              </div>
            )}

            {data && !isLoading && (
              <>
                {allGreen && !hasNoData && (
                  <div
                    style={{
                      background: "#E8F5E9",
                      border: "1px solid #C8E6C9",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                    data-testid="banner-all-green"
                  >
                    <CheckCircle className="w-5 h-5" style={{ color: "#2e7d32" }} />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#1b5e20" }}>
                      No compliance anomalies detected. Maintenance schedule is on track.
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <MetricCard
                    icon={<AlertTriangle className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.cycleSkipRate.severity].text }} />}
                    title="Cycle Skip Rate"
                    value={hasNoData ? "—" : `${data.cycleSkipRate.highestRate}%`}
                    label={hasNoData ? "Insufficient data" : isRestricted ? "Highest skip rate across crew" : `${data.cycleSkipRate.highestRank} has highest skip rate`}
                    severity={hasNoData ? "grey" : data.cycleSkipRate.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("cycleSkip")}
                    testId="card-cycle-skip-rate"
                  />
                  <MetricCard
                    icon={<Calendar className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.backdatingFrequency.severity].text }} />}
                    title="Backdating Frequency"
                    value={hasNoData ? "—" : `${data.backdatingFrequency.percentage}%`}
                    label={hasNoData ? "Insufficient data" : "of WOs completed with backdated entries"}
                    severity={hasNoData ? "grey" : data.backdatingFrequency.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("backdating")}
                    testId="card-backdating-frequency"
                  />
                  <MetricCard
                    icon={<BarChart3 className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.bulkCompletions.severity].text }} />}
                    title="Bulk Completion Events"
                    value={hasNoData ? "—" : `${data.bulkCompletions.eventCount} events`}
                    label={hasNoData ? "Insufficient data" : "Last 90 days — clustering at month-end"}
                    severity={hasNoData ? "grey" : data.bulkCompletions.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("bulk")}
                    testId="card-bulk-completions"
                  />
                  <MetricCard
                    icon={<TrendingDown className="w-4 h-4" style={{ color: hasNoData ? "#bdbdbd" : severityColors[data.scheduleDrift.severity].text }} />}
                    title="Schedule Drift"
                    value={hasNoData ? "—" : `${data.scheduleDrift.averageDaysLate} days`}
                    label={hasNoData ? "Insufficient data" : "Average lateness across all jobs"}
                    severity={hasNoData ? "grey" : data.scheduleDrift.severity}
                    onClick={() => !hasNoData && !isRestricted && setActiveModal("drift")}
                    testId="card-schedule-drift"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {activeModal === "cycleSkip" && data && (
        <DetailModal title="Cycle Skip Rate — Breakdown by Crew Member" onClose={() => setActiveModal(null)}>
          <CycleSkipDetails data={data.cycleSkipRate} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "backdating" && data && (
        <DetailModal title="Backdating Frequency — Recent Backdated Entries" onClose={() => setActiveModal(null)}>
          <BackdatingDetails data={data.backdatingFrequency} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "bulk" && data && (
        <DetailModal title="Bulk Completion Events — Last 90 Days" onClose={() => setActiveModal(null)}>
          <BulkCompletionDetails data={data.bulkCompletions} isRestricted={isRestricted} />
        </DetailModal>
      )}
      {activeModal === "drift" && data && (
        <DetailModal title="Schedule Drift — Last 90 Days" onClose={() => setActiveModal(null)}>
          <ScheduleDriftDetails data={data.scheduleDrift} />
        </DetailModal>
      )}
    </div>
  );
}
