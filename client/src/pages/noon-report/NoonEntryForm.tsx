import { useState, useEffect, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  reportId?: string;
}

const formSchema = z.object({
  reportDate: z.string().min(1, "Date is required"),
  reportTime: z.string().optional(),
  voyageNo: z.string().optional(),
  portFrom: z.string().optional(),
  portTo: z.string().optional(),
  // Navigation
  latDegrees: z.string().optional(),
  latMinutes: z.string().optional(),
  latDirection: z.string().optional(),
  lonDegrees: z.string().optional(),
  lonMinutes: z.string().optional(),
  lonDirection: z.string().optional(),
  course: z.string().optional(),
  speed: z.string().optional(),
  distanceSailed: z.string().optional(),
  // Weather
  windDirection: z.string().optional(),
  windForce: z.string().optional(),
  seaState: z.string().optional(),
  swellHeight: z.string().optional(),
  swellDirection: z.string().optional(),
  visibility: z.string().optional(),
  currentDirection: z.string().optional(),
  currentSpeed: z.string().optional(),
  // Machinery
  meLoad: z.string().optional(),
  meRpm: z.string().optional(),
  meHours: z.string().optional(),
  aeRunningHours: z.string().optional(),
  boilerHours: z.string().optional(),
  hfoConsumption: z.string().optional(),
  lsmgoConsumption: z.string().optional(),
  mgoConsumption: z.string().optional(),
  vlsfoConsumption: z.string().optional(),
  lpgConsumption: z.string().optional(),
  hfoRob: z.string().optional(),
  lsmgoRob: z.string().optional(),
  mgoRob: z.string().optional(),
  vlsfoRob: z.string().optional(),
  lpgRob: z.string().optional(),
  // Cargo / Remarks
  draftForward: z.string().optional(),
  draftAft: z.string().optional(),
  condition: z.string().optional(),
  cargoQuantity: z.string().optional(),
  cargoDescription: z.string().optional(),
  remarks: z.string().optional(),
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

function NumericInput({
  label,
  name,
  unit,
  placeholder,
  register,
  disabled,
  hint,
}: {
  label: string;
  name: keyof FormValues;
  unit?: string;
  placeholder?: string;
  register: any;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-gray-600">
        {label} {unit && <span className="text-gray-400 font-normal">({unit})</span>}
      </Label>
      <Input
        {...register(name)}
        type="number"
        step="any"
        placeholder={placeholder || "0.0"}
        disabled={disabled}
        className="h-9 text-sm"
        data-testid={`input-${name}`}
      />
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

export default function NoonEntryForm({ reportId }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const vesselCtx = useContext(VesselContext);
  const authCtx = useAuth();
  const vesselId = vesselCtx?.vesselId || "";
  const today = new Date().toISOString().split("T")[0];

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
          (setValue as any)(camelKey as keyof FormValues, val != null ? String(val) : "");
        }
      });
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
    return {
      vesselId,
      reportDate: values.reportDate,
      reportTime: values.reportTime,
      voyageNo: values.voyageNo,
      portFrom: values.portFrom,
      portTo: values.portTo,
      latDegrees: values.latDegrees,
      latMinutes: values.latMinutes,
      latDirection: values.latDirection,
      lonDegrees: values.lonDegrees,
      lonMinutes: values.lonMinutes,
      lonDirection: values.lonDirection,
      course: values.course,
      speed: values.speed,
      distanceSailed: values.distanceSailed,
      windDirection: values.windDirection,
      windForce: values.windForce,
      seaState: values.seaState,
      swellHeight: values.swellHeight,
      swellDirection: values.swellDirection,
      visibility: values.visibility,
      currentDirection: values.currentDirection,
      currentSpeed: values.currentSpeed,
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
      draftForward: values.draftForward,
      draftAft: values.draftAft,
      trim: trimVal,
      condition: values.condition,
      cargoQuantity: values.cargoQuantity,
      cargoDescription: values.cargoDescription,
      remarks: values.remarks,
    };
  }

  function handleSaveDraft() {
    const values = getValues();
    if (!vesselId) return toast({ title: "No vessel selected", variant: "destructive" });
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
    submitMutation.mutate();
  }

  function handleNewReport() {
    setLocation("/noon-report/entry");
    form.reset({
      reportDate: today,
      reportTime: "12:00",
      latDirection: "N",
      lonDirection: "E",
      condition: "laden",
    });
  }

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report…
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

      {/* Tab Content */}
      <Card className="border border-gray-200">
        <CardContent className="pt-5">
          {/* Tab 0: Navigation */}
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
                  <NumericInput label="Speed (SOG)" name="speed" unit="kts" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="Distance Sailed" name="distanceSailed" unit="NM" placeholder="0" register={register} disabled={isSubmitted} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Weather */}
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
                <NumericInput label="Wind Force (Beaufort)" name="windForce" unit="Bft" placeholder="0" register={register} disabled={isSubmitted} />
                <NumericInput label="Sea State (Douglas)" name="seaState" unit="0–9" placeholder="0" register={register} disabled={isSubmitted} />
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
            </div>
          )}

          {/* Tab 2: Fuel & Machinery */}
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
                  <NumericInput label="HFO" name="hfoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="LSMGO" name="lsmgoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="MGO" name="mgoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="VLSFO" name="vlsfoConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="LPG" name="lpgConsumption" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">ROB at Noon (MT)</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumericInput label="HFO ROB" name="hfoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="LSMGO ROB" name="lsmgoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="MGO ROB" name="mgoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="VLSFO ROB" name="vlsfoRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                  <NumericInput label="LPG ROB" name="lpgRob" unit="MT" placeholder="0.0" register={register} disabled={isSubmitted} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Emissions (read-only calculated) */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
                Emission figures are auto-calculated from fuel consumption data upon submission.
              </p>
              {existingReport?.co2_emissions ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoCard label="CO₂ Emissions" value={existingReport.co2_emissions} unit="t" />
                  <InfoCard label="SOx Emissions" value={existingReport.sox_emissions} unit="t" />
                  <InfoCard label="NOx Emissions" value={existingReport.nox_emissions} unit="t" />
                  <InfoCard label="EEOI" value={existingReport.eeoi} unit="g CO₂/t·NM" />
                  <InfoCard label="AER" value={existingReport.aer} unit="" />
                  <div className="flex flex-col gap-1 bg-gray-50 rounded p-3 border border-gray-100">
                    <span className="text-xs text-gray-500">CII Rating</span>
                    <span className={`text-2xl font-bold ${
                      existingReport.cii_rating === "A" ? "text-green-600" :
                      existingReport.cii_rating === "B" ? "text-green-500" :
                      existingReport.cii_rating === "C" ? "text-yellow-600" :
                      existingReport.cii_rating === "D" ? "text-orange-500" :
                      "text-red-600"
                    }`}>{existingReport.cii_rating || "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-12">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Emission data will appear after the report is submitted.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Cargo & Remarks */}
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
              <div className="border-t border-gray-100 pt-4">
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Remarks</Label>
                <Textarea
                  {...register("remarks")}
                  placeholder="Any remarks, delays, engine issues, port calls…"
                  rows={4}
                  disabled={isSubmitted}
                  data-testid="input-remarks"
                />
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
