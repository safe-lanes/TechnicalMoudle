import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useContext } from "react";
import { VesselContext } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  Navigation,
  Cloud,
  Fuel,
  BarChart3,
  Package,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  reportId?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function numOpt(msg: string) {
  return z.string().optional().refine(
    (v) => !v || !isNaN(parseFloat(v)),
    { message: msg }
  );
}
function numMin(min: number, msg: string) {
  return z.string().optional().refine(
    (v) => !v || parseFloat(v) >= min,
    { message: msg }
  );
}
function numRange(min: number, max: number, msg: string) {
  return z.string().optional().refine(
    (v) => !v || (parseFloat(v) >= min && parseFloat(v) <= max),
    { message: msg }
  );
}

const formSchema = z.object({
  reportDate: z.string().min(1, "Date is required"),
  reportTime: z.string().optional(),
  voyageNo: z.string().optional(),
  portFrom: z.string().optional(),
  portTo: z.string().optional(),

  // Tab 1: Navigation
  latDegrees: z.string().optional(),
  latMinutes: z.string().optional(),
  latDirection: z.string().optional(),
  lonDegrees: z.string().optional(),
  lonMinutes: z.string().optional(),
  lonDirection: z.string().optional(),
  course: z.string().optional(),
  speed: z.string().optional(), // warning only if > 30, not a hard error
  distanceSailed: numMin(0, "Distance cannot be negative"),
  nextPort: z.string().optional(),
  etaNextPort: z.string().optional(),
  distanceToGo: numMin(0, "Distance cannot be negative"),

  // Tab 2: Weather
  windDirection: z.string().optional(),
  windForce: numRange(0, 12, "Beaufort scale is 0–12"),
  seaState: numRange(0, 9, "Douglas scale is 0–9"),
  swellHeight: z.string().optional(),
  swellDirection: z.string().optional(),
  visibility: z.string().optional(),
  currentDirection: z.string().optional(),
  currentSpeed: z.string().optional(),
  airTemperature: numRange(-30, 60, "Enter a valid air temperature"),
  seaTemperature: numRange(-5, 45, "Enter a valid sea temperature"),

  // Tab 3: Fuel
  meLoad: z.string().optional(),
  meRpm: z.string().optional(),
  meHours: z.string().optional(),
  aeRunningHours: z.string().optional(),
  boilerHours: z.string().optional(),
  hfoConsumption: numMin(0, "Consumption cannot be negative"),
  lsmgoConsumption: numMin(0, "Consumption cannot be negative"),
  mgoConsumption: numMin(0, "Consumption cannot be negative"),
  vlsfoConsumption: numMin(0, "Consumption cannot be negative"),
  lpgConsumption: numMin(0, "Consumption cannot be negative"),
  hfoRob: numMin(0, "ROB cannot be negative"),
  lsmgoRob: numMin(0, "ROB cannot be negative"),
  mgoRob: numMin(0, "ROB cannot be negative"),
  vlsfoRob: numMin(0, "ROB cannot be negative"),
  lpgRob: numMin(0, "ROB cannot be negative"),
  lubeOilConsumption: numMin(0, "Cannot be negative"),
  freshWaterConsumption: numMin(0, "Cannot be negative"),
  freshWaterProduced: numMin(0, "Cannot be negative"),

  // Tab 4: Emissions (overridable)
  co2Hfo: z.string().optional(),
  co2Lsmgo: z.string().optional(),
  co2Mgo: z.string().optional(),
  co2Vlsfo: z.string().optional(),
  co2Lpg: z.string().optional(),
  co2Total: z.string().optional(),
  emissionOverrideNotes: z.string().optional(),

  // Tab 5: Cargo & Remarks
  draftForward: z.string().optional(),
  draftAft: z.string().optional(),
  condition: z.string().optional(),
  cargoQuantity: z.string().optional(),
  cargoDescription: z.string().optional(),
  generalRemarks: z.string().optional(),
  machineryRemarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const TABS = [
  { id: 0, label: "Navigation", icon: Navigation, shortLabel: "Nav" },
  { id: 1, label: "Weather", icon: Cloud, shortLabel: "Weather" },
  { id: 2, label: "Fuel & Machinery", icon: Fuel, shortLabel: "Fuel" },
  { id: 3, label: "Emissions", icon: BarChart3, shortLabel: "Emissions" },
  { id: 4, label: "Cargo & Remarks", icon: Package, shortLabel: "Cargo" },
];

const WIND_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const VISIBILITY_OPTIONS = ["Good", "Moderate", "Poor", "Fog"];

// CO₂ conversion factors (IMO)
const CO2_FACTORS = {
  hfo: 3.114,
  lsmgo: 3.206,
  mgo: 3.206,
  vlsfo: 3.151,
  lpg: 3.030,
};

function calcCo2(consumption: string | undefined, factor: number): number {
  const v = parseFloat(consumption || "0");
  return isNaN(v) ? 0 : v * factor;
}

// Typed map from override field name → form key (avoids dynamic string construction)
const CO2_FIELD_MAP: Readonly<Record<string, keyof FormValues>> = {
  hfo: "co2Hfo",
  lsmgo: "co2Lsmgo",
  mgo: "co2Mgo",
  vlsfo: "co2Vlsfo",
  lpg: "co2Lpg",
};

// ── NumericInput ──────────────────────────────────────────────────────────────
function NumericInput({
  label,
  name,
  unit,
  placeholder,
  register,
  disabled,
  hint,
  error,
  min,
  max,
  step,
}: {
  label: string;
  name: keyof FormValues;
  unit?: string;
  placeholder?: string;
  register: any;
  disabled?: boolean;
  hint?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number | string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-gray-600">
        {label} {unit && <span className="text-gray-400 font-normal">({unit})</span>}
      </Label>
      <Input
        {...register(name)}
        type="number"
        step={step ?? "any"}
        min={min}
        max={max}
        placeholder={placeholder || "0.0"}
        disabled={disabled}
        className={`h-9 text-sm ${error ? "border-red-400" : ""}`}
        data-testid={`input-${name}`}
      />
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ── InfoCard (read-only display) ──────────────────────────────────────────────
function InfoCard({ label, value, unit }: { label: string; value: any; unit: string }) {
  return (
    <div className="flex flex-col gap-1 bg-gray-50 rounded p-3 border border-gray-100">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-lg font-semibold text-gray-800">
        {value != null ? Number(value).toFixed(2) : "—"}
        {unit && <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NoonEntryForm({ reportId }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const vesselCtx = useContext(VesselContext);
  const authCtx = useAuth();
  const vesselId = vesselCtx?.vesselId || "";
  const today = new Date().toISOString().split("T")[0];

  // Draft save timestamp state
  const [draftStatusMsg, setDraftStatusMsg] = useState<string | null>(null);

  // Override state for Tab 4 per-fuel CO₂ fields
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportDate: today,
      reportTime: "12:00",
      latDirection: "N",
      lonDirection: "E",
      condition: "laden",
    },
  });

  const { register, watch, setValue, getValues, formState: { errors } } = form;

  // Watch draft/aft to auto-calc trim
  const draftForward = watch("draftForward");
  const draftAft = watch("draftAft");
  const trim = draftForward && draftAft
    ? (parseFloat(draftAft) - parseFloat(draftForward)).toFixed(2)
    : "—";

  // Watch speed for warning
  const speedVal = watch("speed");
  const showSpeedWarning = speedVal ? parseFloat(speedVal) > 30 : false;

  // Watch fuel consumptions for live CO₂ calc
  const hfoC = watch("hfoConsumption");
  const lsmgoC = watch("lsmgoConsumption");
  const mgoC = watch("mgoConsumption");
  const vlsfoC = watch("vlsfoConsumption");
  const lpgC = watch("lpgConsumption");

  const autoCo2 = {
    hfo: calcCo2(hfoC, CO2_FACTORS.hfo),
    lsmgo: calcCo2(lsmgoC, CO2_FACTORS.lsmgo),
    mgo: calcCo2(mgoC, CO2_FACTORS.mgo),
    vlsfo: calcCo2(vlsfoC, CO2_FACTORS.vlsfo),
    lpg: calcCo2(lpgC, CO2_FACTORS.lpg),
  };

  // Override values for each CO₂ field (string in form)
  const co2HfoVal = watch("co2Hfo");
  const co2LsmgoVal = watch("co2Lsmgo");
  const co2MgoVal = watch("co2Mgo");
  const co2VlsfoVal = watch("co2Vlsfo");
  const co2LpgVal = watch("co2Lpg");

  // Effective CO₂ values (override or auto)
  const effectiveCo2 = {
    hfo: overrides.hfo ? parseFloat(co2HfoVal || "0") : autoCo2.hfo,
    lsmgo: overrides.lsmgo ? parseFloat(co2LsmgoVal || "0") : autoCo2.lsmgo,
    mgo: overrides.mgo ? parseFloat(co2MgoVal || "0") : autoCo2.mgo,
    vlsfo: overrides.vlsfo ? parseFloat(co2VlsfoVal || "0") : autoCo2.vlsfo,
    lpg: overrides.lpg ? parseFloat(co2LpgVal || "0") : autoCo2.lpg,
  };
  const totalCo2 = Object.values(effectiveCo2).reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);

  // Sync auto CO₂ values into form when not overridden
  useEffect(() => {
    if (!overrides.hfo) setValue("co2Hfo", autoCo2.hfo.toFixed(3));
    if (!overrides.lsmgo) setValue("co2Lsmgo", autoCo2.lsmgo.toFixed(3));
    if (!overrides.mgo) setValue("co2Mgo", autoCo2.mgo.toFixed(3));
    if (!overrides.vlsfo) setValue("co2Vlsfo", autoCo2.vlsfo.toFixed(3));
    if (!overrides.lpg) setValue("co2Lpg", autoCo2.lpg.toFixed(3));
    setValue("co2Total", totalCo2.toFixed(3));
  }, [hfoC, lsmgoC, mgoC, vlsfoC, lpgC, overrides]);

  // Fetch existing report if editing
  const { data: existingReport, isLoading: reportLoading } = useQuery<any>({
    queryKey: ["/technical/api/nr-reports", reportId],
    enabled: !!reportId,
  });

  // Populate form when existing report loads
  useEffect(() => {
    if (existingReport) {
      Object.keys(existingReport).forEach((key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (camelKey in form.getValues()) {
          const val = existingReport[key];
          setValue(camelKey as keyof FormValues, val != null ? String(val) : "");
        }
      });
      // Show draft restored message
      if (existingReport.status === "draft" && existingReport.draft_saved_at) {
        const t = new Date(existingReport.draft_saved_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        setDraftStatusMsg(`Draft restored from ${t}`);
      }
      // Restore override notes if any
      if (existingReport.emission_override_notes) {
        try {
          const parsed = JSON.parse(existingReport.emission_override_notes);
          const newOverrides: Record<string, boolean> = {};
          const newReasons: Record<string, string> = {};
          Object.keys(parsed).forEach((k) => {
            newOverrides[k] = true;
            newReasons[k] = parsed[k];
          });
          setOverrides(newOverrides);
          setOverrideReasons(newReasons);
        } catch {}
      }
    }
  }, [existingReport]);

  const isSubmitted = existingReport?.status === "submitted";

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/technical/api/nr-reports", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/nr-reports"] });
      const t = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setDraftStatusMsg(`Draft saved at ${t}`);
      toast({ title: "Draft saved", description: "Report created as draft." });
      setLocation(`/noon-report/entry/${data.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/technical/api/nr-reports/${reportId}/draft`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/nr-reports", reportId] });
      const t = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setDraftStatusMsg(`Draft saved at ${t}`);
      toast({ title: "Draft saved", description: "Changes auto-saved." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/technical/api/nr-reports/${reportId}/submit`, {
        submittedBy: authCtx?.currentUser?.fullName || "Unknown",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/nr-reports"] });
      toast({ title: "Report submitted", description: "Noon report locked and submitted.", variant: "default" });
      setLocation("/noon-report/history");
    },
    onError: () => toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" }),
  });

  function buildPayload(values: FormValues) {
    const trimVal = values.draftForward && values.draftAft
      ? String(parseFloat(values.draftAft) - parseFloat(values.draftForward))
      : undefined;

    // Build override notes JSON
    const overrideNotes: Record<string, string> = {};
    Object.keys(overrides).forEach((k) => {
      if (overrides[k] && overrideReasons[k]) overrideNotes[k] = overrideReasons[k];
    });

    return {
      vesselId,
      reportDate: values.reportDate,
      reportTime: values.reportTime,
      voyageNo: values.voyageNo,
      portFrom: values.portFrom,
      portTo: values.portTo,
      // Tab 1
      latDegrees: values.latDegrees,
      latMinutes: values.latMinutes,
      latDirection: values.latDirection,
      lonDegrees: values.lonDegrees,
      lonMinutes: values.lonMinutes,
      lonDirection: values.lonDirection,
      course: values.course,
      speed: values.speed,
      distanceSailed: values.distanceSailed,
      nextPort: values.nextPort,
      etaNextPort: values.etaNextPort || undefined,
      distanceToGo: values.distanceToGo,
      // Tab 2
      windDirection: values.windDirection,
      windForce: values.windForce,
      seaState: values.seaState,
      swellHeight: values.swellHeight,
      swellDirection: values.swellDirection,
      visibility: values.visibility,
      currentDirection: values.currentDirection,
      currentSpeed: values.currentSpeed,
      airTemperature: values.airTemperature,
      seaTemperature: values.seaTemperature,
      // Tab 3
      meLoad: values.meLoad,
      meRpm: values.meRpm,
      meHours: values.meHours,
      aeRunningHours: values.aeRunningHours,
      boilerHours: values.boilerHours,
      hfoConsumption: values.hfoConsumption,
      lsmgoConsumption: values.lsmgoConsumption,
      mgoConsumption: values.mgoConsumption,
      vlsfoConsumption: values.vlsfoConsumption,
      lpgConsumption: values.lpgConsumption,
      hfoRob: values.hfoRob,
      lsmgoRob: values.lsmgoRob,
      mgoRob: values.mgoRob,
      vlsfoRob: values.vlsfoRob,
      lpgRob: values.lpgRob,
      lubeOilConsumption: values.lubeOilConsumption,
      freshWaterConsumption: values.freshWaterConsumption,
      freshWaterProduced: values.freshWaterProduced,
      // Tab 4 — computed CO₂
      co2Hfo: effectiveCo2.hfo.toFixed(3),
      co2Lsmgo: effectiveCo2.lsmgo.toFixed(3),
      co2Mgo: effectiveCo2.mgo.toFixed(3),
      co2Vlsfo: effectiveCo2.vlsfo.toFixed(3),
      co2Lpg: effectiveCo2.lpg.toFixed(3),
      co2Total: totalCo2.toFixed(3),
      emissionOverrideNotes: Object.keys(overrideNotes).length ? JSON.stringify(overrideNotes) : undefined,
      // Tab 5
      draftForward: values.draftForward,
      draftAft: values.draftAft,
      trim: trimVal,
      condition: values.condition,
      cargoQuantity: values.cargoQuantity,
      cargoDescription: values.cargoDescription,
      generalRemarks: values.generalRemarks,
      machineryRemarks: values.machineryRemarks,
    };
  }

  function getMissingOverrideReasonFields(): string[] {
    return Object.keys(overrides).filter((k) => overrides[k] && !overrideReasons[k]?.trim());
  }

  function handleSaveDraft() {
    const values = getValues();
    if (!vesselId) return toast({ title: "No vessel selected", variant: "destructive" });
    const missing = getMissingOverrideReasonFields();
    if (missing.length > 0) {
      setActiveTab(3);
      toast({
        title: "Override reason required",
        description: `Please provide a reason for each CO₂ override before saving (${missing.map((f) => f.toUpperCase()).join(", ")}).`,
        variant: "destructive",
      });
      return;
    }
    const payload = buildPayload(values);
    if (!reportId) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  }

  function handleSubmit() {
    if (!reportId) {
      toast({ title: "Save draft first", description: "Please save a draft before submitting.", variant: "destructive" });
      return;
    }
    const missing = getMissingOverrideReasonFields();
    if (missing.length > 0) {
      setActiveTab(3);
      toast({
        title: "Override reason required",
        description: `All CO₂ overrides must have a reason before submitting (${missing.map((f) => f.toUpperCase()).join(", ")}).`,
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  }

  function handleNewReport() {
    setLocation("/noon-report/entry");
    setDraftStatusMsg(null);
    form.reset({
      reportDate: today,
      reportTime: "12:00",
      latDirection: "N",
      lonDirection: "E",
      condition: "laden",
    });
  }

  function toggleOverride(field: string) {
    setOverrides((prev) => ({ ...prev, [field]: !prev[field] }));
    if (overrides[field]) {
      setOverrideReasons((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  function resetOverride(field: string, autoValue: number) {
    setOverrides((prev) => { const n = { ...prev }; delete n[field]; return n; });
    setOverrideReasons((prev) => { const n = { ...prev }; delete n[field]; return n; });
    const formKey = CO2_FIELD_MAP[field];
    if (formKey) setValue(formKey, autoValue.toFixed(3));
  }

  // Format submitted_at for display
  function formatSubmittedDate(submittedAt: string | null) {
    if (!submittedAt) return "";
    const d = new Date(submittedAt);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function formatSubmittedTime(submittedAt: string | null) {
    if (!submittedAt) return "";
    const d = new Date(submittedAt);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report…
      </div>
    );
  }

  // ── CO₂ field component ───────────────────────────────────────────────────
  function Co2Field({ field, label, autoValue }: { field: string; label: string; autoValue: number }) {
    const formKey = `co2${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof FormValues;
    const isOverridden = overrides[field];
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-0.5">
          <Label className="text-xs font-medium text-gray-600">{label}</Label>
          <div className="flex items-center gap-1">
            {isOverridden && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" /> Manual
              </span>
            )}
            {!isSubmitted && (
              isOverridden ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-5 text-xs px-1.5 py-0 border-gray-300"
                  onClick={() => resetOverride(field, autoValue)}
                >
                  Reset
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-5 text-xs px-1.5 py-0 border-gray-300"
                  onClick={() => toggleOverride(field)}
                >
                  Override
                </Button>
              )
            )}
          </div>
        </div>
        <Input
          {...register(formKey)}
          type="number"
          step="0.001"
          disabled={!isOverridden || isSubmitted}
          className={`h-9 text-sm ${isOverridden ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
          data-testid={`input-co2-${field}`}
        />
        <span className="text-xs text-gray-400 italic">auto-calculated</span>
        {isOverridden && !isSubmitted && (
          <Input
            type="text"
            placeholder="Reason for override (required)"
            value={overrideReasons[field] || ""}
            onChange={(e) => setOverrideReasons((prev) => ({ ...prev, [field]: e.target.value }))}
            className="h-7 text-xs border-amber-300 mt-0.5"
            data-testid={`input-co2-override-reason-${field}`}
          />
        )}
        {isOverridden && overrideReasons[field] && (
          <span className="text-xs text-amber-600 italic">{overrideReasons[field]}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800">
            {reportId ? `Noon Report — ${existingReport?.report_date || ""}` : "New Noon Report"}
          </h1>
          {isSubmitted && (
            <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Submitted
            </Badge>
          )}
          {reportId && !isSubmitted && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 gap-1">
              <Clock className="h-3.5 w-3.5" /> Draft
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reportId && (
            <Button variant="outline" size="sm" onClick={handleNewReport} data-testid="button-new-report">
              + New Report
            </Button>
          )}
          {!isSubmitted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-draft"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!reportId || submitMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-submit-report"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Submit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Report Header Info */}
      <Card className="border border-gray-200">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Report Date</Label>
              <Input
                {...register("reportDate")}
                type="date"
                className="h-9 text-sm mt-1"
                disabled={isSubmitted}
                data-testid="input-reportDate"
              />
              {errors.reportDate && <p className="text-xs text-red-500 mt-0.5">{errors.reportDate.message}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-500">Time (UTC)</Label>
              <Input
                {...register("reportTime")}
                type="time"
                className="h-9 text-sm mt-1"
                disabled={isSubmitted}
                data-testid="input-reportTime"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Voyage No.</Label>
              <Input
                {...register("voyageNo")}
                placeholder="V-2026-001"
                className="h-9 text-sm mt-1"
                disabled={isSubmitted}
                data-testid="input-voyageNo"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Port From</Label>
              <Input
                {...register("portFrom")}
                placeholder="SGSIN"
                className="h-9 text-sm mt-1"
                disabled={isSubmitted}
                data-testid="input-portFrom"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Port To</Label>
              <Input
                {...register("portTo")}
                placeholder="JPYOK"
                className="h-9 text-sm mt-1"
                disabled={isSubmitted}
                data-testid="input-portTo"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Post-Submission Green Banner (Fix 8) */}
      {isSubmitted && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded px-4 py-2.5 text-sm" data-testid="banner-submitted">
          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>
            This report was submitted on{" "}
            <strong>{formatSubmittedDate(existingReport?.submitted_at)}</strong>
            {" "}at{" "}
            <strong>{formatSubmittedTime(existingReport?.submitted_at)}</strong>
            {existingReport?.submitted_by ? ` by ${existingReport.submitted_by}` : ""}.
            {" "}It is now locked and cannot be edited.
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Draft save timestamp (Fix 7) */}
      {draftStatusMsg && (
        <p className="text-xs text-gray-400 italic animate-fade-in" data-testid="text-draft-status">
          {draftStatusMsg}
        </p>
      )}

      {/* Tab Content */}
      <Card className="border border-gray-200">
        <CardContent className="pt-5">

          {/* ── Tab 0: Navigation ─────────────────────────────────────────── */}
          {activeTab === 0 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Position at Noon</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumericInput label="Latitude Degrees" name="latDegrees" unit="°" placeholder="0" register={register} disabled={isSubmitted} />
                  <NumericInput label="Latitude Minutes" name="latMinutes" unit="′" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <div>
                    <Label className="text-xs font-medium text-gray-600">N / S</Label>
                    <Select value={watch("latDirection")} onValueChange={(v) => setValue("latDirection", v)} disabled={isSubmitted}>
                      <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-latDirection">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N">N</SelectItem>
                        <SelectItem value="S">S</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <NumericInput label="Longitude Degrees" name="lonDegrees" unit="°" placeholder="0" register={register} disabled={isSubmitted} />
                  <NumericInput label="Longitude Minutes" name="lonMinutes" unit="′" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <div>
                    <Label className="text-xs font-medium text-gray-600">E / W</Label>
                    <Select value={watch("lonDirection")} onValueChange={(v) => setValue("lonDirection", v)} disabled={isSubmitted}>
                      <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-lonDirection">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="E">E</SelectItem>
                        <SelectItem value="W">W</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Speed & Distance</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <NumericInput label="Course" name="course" unit="°T" placeholder="000" register={register} disabled={isSubmitted} />
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-gray-600">
                      Speed (SOG) <span className="text-gray-400 font-normal">(kts)</span>
                    </Label>
                    <Input
                      {...register("speed")}
                      type="number"
                      step="any"
                      placeholder="0.0"
                      disabled={isSubmitted}
                      className={`h-9 text-sm ${errors.speed ? "border-red-400" : ""}`}
                      data-testid="input-speed"
                    />
                    {errors.speed && <span className="text-xs text-red-500">{errors.speed.message}</span>}
                    {showSpeedWarning && !errors.speed && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-1 text-xs mt-0.5" data-testid="warning-speed">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        Speed above 30 knots — please verify
                      </div>
                    )}
                  </div>
                  <NumericInput
                    label="Distance Sailed"
                    name="distanceSailed"
                    unit="NM"
                    placeholder="0"
                    register={register}
                    disabled={isSubmitted}
                    error={errors.distanceSailed?.message}
                  />
                </div>
              </div>

              {/* Fix 1: Next Port, ETA, Distance to Go */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Voyage Progress</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-gray-600">Next Port</Label>
                    <Input
                      {...register("nextPort")}
                      placeholder="e.g. JPYOK"
                      disabled={isSubmitted}
                      className="h-9 text-sm"
                      data-testid="input-nextPort"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-gray-600">ETA to Next Port (UTC)</Label>
                    <Input
                      {...register("etaNextPort")}
                      type="datetime-local"
                      disabled={isSubmitted}
                      className="h-9 text-sm"
                      data-testid="input-etaNextPort"
                    />
                  </div>
                  <NumericInput
                    label="Distance to Go"
                    name="distanceToGo"
                    unit="NM"
                    placeholder="0.0"
                    min={0}
                    step={0.1}
                    register={register}
                    disabled={isSubmitted}
                    error={errors.distanceToGo?.message}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 1: Weather ─────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Wind Direction</Label>
                  <Select value={watch("windDirection")} onValueChange={(v) => setValue("windDirection", v)} disabled={isSubmitted}>
                    <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-windDirection">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIND_DIRS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <NumericInput
                  label="Wind Force (Beaufort)"
                  name="windForce"
                  unit="Bft"
                  placeholder="0"
                  register={register}
                  disabled={isSubmitted}
                  error={errors.windForce?.message}
                />
                <NumericInput
                  label="Sea State (Douglas)"
                  name="seaState"
                  unit="0–9"
                  placeholder="0"
                  register={register}
                  disabled={isSubmitted}
                  error={errors.seaState?.message}
                />
                <NumericInput label="Swell Height" name="swellHeight" unit="m" placeholder="0.0" register={register} disabled={isSubmitted} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Swell Direction</Label>
                  <Select value={watch("swellDirection")} onValueChange={(v) => setValue("swellDirection", v)} disabled={isSubmitted}>
                    <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-swellDirection">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIND_DIRS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Visibility</Label>
                  <Select value={watch("visibility")} onValueChange={(v) => setValue("visibility", v)} disabled={isSubmitted}>
                    <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-visibility">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Current Direction</Label>
                  <Select value={watch("currentDirection")} onValueChange={(v) => setValue("currentDirection", v)} disabled={isSubmitted}>
                    <SelectTrigger className="h-9 text-sm mt-1" data-testid="select-currentDirection">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIND_DIRS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <NumericInput label="Current Speed" name="currentSpeed" unit="kts" placeholder="0.0" register={register} disabled={isSubmitted} />
              </div>
              {/* Fix 2: Temperature fields */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Temperature</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumericInput
                    label="Air Temperature"
                    name="airTemperature"
                    unit="°C"
                    placeholder="0.0"
                    min={-30}
                    max={60}
                    step={0.1}
                    register={register}
                    disabled={isSubmitted}
                    error={errors.airTemperature?.message}
                  />
                  <NumericInput
                    label="Sea Temperature"
                    name="seaTemperature"
                    unit="°C"
                    placeholder="0.0"
                    min={-5}
                    max={45}
                    step={0.1}
                    register={register}
                    disabled={isSubmitted}
                    error={errors.seaTemperature?.message}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 2: Fuel & Machinery ─────────────────────────────────────── */}
          {activeTab === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Machinery</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumericInput label="ME Load" name="meLoad" unit="% MCR" placeholder="0" register={register} disabled={isSubmitted} />
                  <NumericInput label="ME RPM" name="meRpm" unit="rpm" placeholder="0" register={register} disabled={isSubmitted} />
                  <NumericInput label="ME Running Hours" name="meHours" unit="hrs" placeholder="24" register={register} disabled={isSubmitted} />
                  <NumericInput label="AE Running Hours" name="aeRunningHours" unit="hrs" placeholder="0" register={register} disabled={isSubmitted} />
                  <NumericInput label="Boiler Hours" name="boilerHours" unit="hrs" placeholder="0" register={register} disabled={isSubmitted} />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Fuel Consumption (MT)</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumericInput label="HFO" name="hfoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.hfoConsumption?.message} />
                  <NumericInput label="LSMGO" name="lsmgoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.lsmgoConsumption?.message} />
                  <NumericInput label="MGO" name="mgoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.mgoConsumption?.message} />
                  <NumericInput label="VLSFO" name="vlsfoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.vlsfoConsumption?.message} />
                  <NumericInput label="LPG" name="lpgConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.lpgConsumption?.message} />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">ROB at Noon (MT)</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumericInput label="HFO ROB" name="hfoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.hfoRob?.message} />
                  <NumericInput label="LSMGO ROB" name="lsmgoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.lsmgoRob?.message} />
                  <NumericInput label="MGO ROB" name="mgoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.mgoRob?.message} />
                  <NumericInput label="VLSFO ROB" name="vlsfoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.vlsfoRob?.message} />
                  <NumericInput label="LPG ROB" name="lpgRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} error={errors.lpgRob?.message} />
                </div>
              </div>
              {/* Fix 3: Consumables */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Consumables</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <NumericInput
                    label="Lube Oil Consumption"
                    name="lubeOilConsumption"
                    unit="L"
                    placeholder="0.0"
                    register={register}
                    disabled={isSubmitted}
                    error={errors.lubeOilConsumption?.message}
                  />
                  <NumericInput
                    label="Fresh Water Consumption"
                    name="freshWaterConsumption"
                    unit="tons"
                    placeholder="0.0"
                    register={register}
                    disabled={isSubmitted}
                    error={errors.freshWaterConsumption?.message}
                  />
                  <NumericInput
                    label="Fresh Water Produced"
                    name="freshWaterProduced"
                    unit="tons"
                    placeholder="0.0"
                    register={register}
                    disabled={isSubmitted}
                    error={errors.freshWaterProduced?.message}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 3: Emissions ────────────────────────────────────────────── */}
          {activeTab === 3 && (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 rounded px-3 py-2.5 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <span>
                  Emission figures are auto-calculated from Tab 3 fuel data.
                  Values update live as you enter fuel consumption.
                </span>
              </div>

              {/* Per-fuel CO₂ breakdown */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Per Fuel Type CO₂ Breakdown</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Co2Field field="hfo" label="CO₂ — HFO" autoValue={autoCo2.hfo} />
                  <Co2Field field="lsmgo" label="CO₂ — LSMGO" autoValue={autoCo2.lsmgo} />
                  <Co2Field field="mgo" label="CO₂ — MGO" autoValue={autoCo2.mgo} />
                  <Co2Field field="vlsfo" label="CO₂ — VLSFO" autoValue={autoCo2.vlsfo} />
                  <Co2Field field="lpg" label="CO₂ — LPG" autoValue={autoCo2.lpg} />
                </div>
              </div>

              {/* Total CO₂ */}
              <div className="border-t border-gray-100 pt-4">
                <Card className="border border-gray-200 bg-gray-50">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-0.5">Total CO₂ Emitted Today</p>
                        <p className="text-xl font-bold text-gray-900" data-testid="text-co2-total">
                          {totalCo2.toFixed(3)} MT
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-gray-300" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── Tab 4: Cargo & Remarks ──────────────────────────────────────── */}
          {activeTab === 4 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Draft & Condition</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumericInput label="Draft Forward" name="draftForward" unit="m" placeholder="0.00" register={register} disabled={isSubmitted} />
                  <NumericInput label="Draft Aft" name="draftAft" unit="m" placeholder="0.00" register={register} disabled={isSubmitted} />
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-gray-600">Trim <span className="text-gray-400 font-normal">(m, auto)</span></Label>
                    <Input value={trim} readOnly className="h-9 text-sm bg-gray-50" data-testid="input-trim" />
                    <span className="text-xs text-gray-400">Aft − Forward</span>
                  </div>
                  <div />
                </div>
                <div className="mt-4">
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">Vessel Condition</Label>
                  <RadioGroup
                    value={watch("condition")}
                    onValueChange={(v) => setValue("condition", v)}
                    className="flex gap-6"
                    disabled={isSubmitted}
                    data-testid="radio-condition"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ballast" id="c-ballast" data-testid="radio-ballast" />
                      <Label htmlFor="c-ballast" className="text-sm cursor-pointer">Ballast</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="laden" id="c-laden" data-testid="radio-laden" />
                      <Label htmlFor="c-laden" className="text-sm cursor-pointer">Laden</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="in_port" id="c-port" data-testid="radio-in-port" />
                      <Label htmlFor="c-port" className="text-sm cursor-pointer">In Port</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Cargo</p>
                <div className="grid grid-cols-2 gap-3">
                  <NumericInput label="Cargo Quantity" name="cargoQuantity" unit="MT" placeholder="0" register={register} disabled={isSubmitted} />
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Cargo Description</Label>
                    <Input
                      {...register("cargoDescription")}
                      placeholder="e.g. Iron ore"
                      className="h-9 text-sm mt-1"
                      disabled={isSubmitted}
                      data-testid="input-cargoDescription"
                    />
                  </div>
                </div>
              </div>
              {/* Fix 5: Split remarks */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">General Remarks</Label>
                  <Textarea
                    {...register("generalRemarks")}
                    placeholder="Any remarks, delays, port calls, weather events..."
                    rows={4}
                    disabled={isSubmitted}
                    data-testid="input-generalRemarks"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">Machinery Defects / Abnormalities</Label>
                  <Textarea
                    {...register("machineryRemarks")}
                    placeholder="Any machinery issues, defects, abnormal observations, or running hour deviations..."
                    rows={4}
                    disabled={isSubmitted}
                    data-testid="input-machineryRemarks"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation Footer */}
      <div className="flex items-center justify-between pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
          disabled={activeTab === 0}
          data-testid="button-prev-tab"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="text-xs text-gray-400">{activeTab + 1} / {TABS.length}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveTab(Math.min(TABS.length - 1, activeTab + 1))}
          disabled={activeTab === TABS.length - 1}
          data-testid="button-next-tab"
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
