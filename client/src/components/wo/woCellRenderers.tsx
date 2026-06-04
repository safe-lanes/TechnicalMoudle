import { Eye, Pen } from "lucide-react";

export const getWoStatusBadgeColor = (status: string): string => {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "approved":
      return "bg-green-100 text-green-800";
    case "due":
      return "bg-yellow-100 text-yellow-800";
    case "due soon":
      return "bg-amber-100 text-amber-800";
    case "due (grace p)":
    case "grace p":
      return "bg-orange-100 text-orange-800";
    case "overdue":
      return "bg-red-100 text-red-800";
    case "active":
    case "planned":
      return "bg-sky-100 text-sky-800";
    case "postponed":
      return "bg-blue-100 text-blue-800";
    case "awaiting office approval":
      return "bg-amber-100 text-amber-800";
    case "postponement approved":
      return "bg-green-100 text-green-800";
    case "postponement rejected":
      return "bg-red-200 text-red-900";
    case "pending approval":
      return "bg-purple-100 text-purple-800";
    case "pending office review":
    case "awaiting level 2 review":
      return "bg-teal-100 text-teal-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "reopened":
      return "bg-amber-100 text-amber-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getWoCriticalityBadgeColor = (criticality: string): string => {
  const c = (criticality || "").toLowerCase();
  if (c === "critical" || c === "yes") return "bg-red-100 text-red-800";
  if (c === "high") return "bg-orange-100 text-orange-800";
  if (c === "medium") return "bg-yellow-100 text-yellow-800";
  if (c === "low") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-800";
};

interface WoStatusBadgeCellProps {
  status: string;
}

export const WoStatusBadgeCell: React.FC<WoStatusBadgeCellProps> = ({ status }) => {
  const display = status === "Due (Grace P)" ? "Grace P" : status;
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getWoStatusBadgeColor(status)}`}
    >
      {display}
    </span>
  );
};

interface WoCriticalityBadgeCellProps {
  value: string | null | undefined;
}

export const WoCriticalityBadgeCell: React.FC<WoCriticalityBadgeCellProps> = ({ value }) => {
  if (!value) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getWoCriticalityBadgeColor(value)}`}
    >
      {value}
    </span>
  );
};

interface WoActionButtonProps {
  icon: "view" | "edit";
  title: string;
  onClick: (e: React.MouseEvent) => void;
  testId?: string;
}

export const WoActionButton: React.FC<WoActionButtonProps> = ({ icon, title, onClick, testId }) => {
  const Icon = icon === "view" ? Eye : Pen;
  return (
    <button
      className="p-1 hover:bg-gray-200 rounded"
      onClick={onClick}
      title={title}
      data-testid={testId}
    >
      <Icon className="h-4 w-4 text-gray-600" />
    </button>
  );
};
