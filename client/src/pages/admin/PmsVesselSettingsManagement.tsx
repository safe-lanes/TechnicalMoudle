import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Settings, Ship, Save, X, Calendar, Gauge, CheckCircle2, ArrowLeft, Search, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { PmsVesselSettings } from "@shared/schema";
import { Marker } from "@/components/Marker";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";

interface Vessel {
  id: string;
  name: string;
  vesselCode?: string;
}

interface CompanyGraceSettings {
  graceMethod: string;
  graceValue: number | null;
  scope: string;
  fallbackGraceDays: number | null;
  fallbackMethod: string | null;
  calendarLeadDaysCritical: number;
  calendarLeadDaysNonCritical: number;
  rhLeadHoursCritical: number;
  rhLeadHoursNonCritical: number;
  rhGraceHours: number;
  rhGraceMethod: string;
  rhGraceValue: number;
  rhGraceScope: string;
  rhFallbackMethod: string | null;
  rhFallbackGraceHours: number | null;
  configured: boolean;
}

function formatCalendarGraceLabel(settings: CompanyGraceSettings): string {
  const methodLabel =
    settings.graceMethod === 'FIXED_DAYS' ? `Fixed ${settings.graceValue}d` :
    settings.graceMethod === 'MONTH_END' ? 'Month End' :
    settings.graceMethod === 'SPECIFIC_DATE_NEXT_MONTH' ? `${settings.graceValue}${getOrdinalSuffix(settings.graceValue || 1)} next mo` :
    'Unknown';

  if (settings.scope === 'ALL_WORK_ORDERS') {
    return methodLabel;
  }

  const fb = settings.fallbackMethod || 'MONTH_END';
  const fbLabel = fb === 'MONTH_END' ? 'Month End' : fb === 'FIXED_DAYS' ? `${settings.fallbackGraceDays ?? 0}d` : '—';
  return `${methodLabel} (last wk); ${fbLabel} (others)`;
}

function formatRhGraceLabel(settings: CompanyGraceSettings): string {
  const method = settings.rhGraceMethod || 'FIXED_HOURS';
  const methodLabel =
    method === 'FIXED_HOURS' ? `Fixed ${settings.rhGraceValue ?? 168}h` :
    method === 'MONTH_END' ? 'Month End' :
    method === 'SPECIFIC_DATE_NEXT_MONTH' ? `${settings.rhGraceValue}${getOrdinalSuffix(settings.rhGraceValue || 1)} next mo` :
    'Unknown';

  const scope = settings.rhGraceScope || 'ALL_WORK_ORDERS';
  if (scope === 'ALL_WORK_ORDERS') {
    return methodLabel;
  }

  const fb = settings.rhFallbackMethod || 'MONTH_END';
  const fbLabel = fb === 'MONTH_END' ? 'Month End' : fb === 'FIXED_HOURS' ? `${settings.rhFallbackGraceHours ?? 0}h` : '—';
  return `${methodLabel} (last wk); ${fbLabel} (others)`;
}

function formatCompanyStandardSummary(settings: CompanyGraceSettings): string {
  const calLead = `${settings.calendarLeadDaysCritical ?? 7}d / ${settings.calendarLeadDaysNonCritical ?? 14}d`;
  const calGrace = formatCalendarGraceLabel(settings);
  const rhLead = `${settings.rhLeadHoursCritical ?? 720}h / ${settings.rhLeadHoursNonCritical ?? 720}h`;
  const rhGrace = formatRhGraceLabel(settings);
  return `Cal Lead: ${calLead} · Cal Grace: ${calGrace} · RH Lead: ${rhLead} · RH Grace: ${rhGrace}`;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export default function PmsVesselSettingsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCompanyGraceDialogOpen, setIsCompanyGraceDialogOpen] = useState(false);
  const [vesselSearch, setVesselSearch] = useState("");

  const [vesselTab, setVesselTab] = useState<'calendar' | 'rh'>('calendar');

  const [formData, setFormData] = useState({
    settingsMode: 'COMPANY_STANDARD' as 'COMPANY_STANDARD' | 'CUSTOM',
    calendarLeadDaysCritical: 7,
    calendarLeadDaysNonCritical: 14,
    calendarGraceMode: 'COMPANY_STANDARD',
    calendarGraceDays: 7,
    calendarGraceMethod: 'FIXED_DAYS',
    calendarGraceValue: 7,
    calendarGraceScope: 'ALL_WORK_ORDERS',
    calendarFallbackMethod: 'MONTH_END' as string | null,
    calendarFallbackGraceDays: 0 as number | null,
    rhLeadHoursCritical: 50,
    rhLeadHoursNonCritical: 100,
    rhGraceHours: 168,
    rhGraceMethod: 'FIXED_HOURS',
    rhGraceValue: 168,
    rhGraceScope: 'ALL_WORK_ORDERS',
    rhFallbackMethod: 'MONTH_END' as string | null,
    rhFallbackGraceHours: 0 as number | null,
  });

  const [companyStandardTab, setCompanyStandardTab] = useState<'calendar' | 'rh'>('calendar');

  const [companyGraceForm, setCompanyGraceForm] = useState({
    graceMethod: 'FIXED_DAYS',
    graceValue: 7,
    scope: 'LAST_WEEK_OF_MONTH',
    fallbackGraceDays: 0 as number | null,
    fallbackMethod: 'MONTH_END' as string | null,
    calendarLeadDaysCritical: 7,
    calendarLeadDaysNonCritical: 14,
    rhLeadHoursCritical: 720,
    rhLeadHoursNonCritical: 720,
    rhGraceHours: 168,
    rhGraceMethod: 'FIXED_HOURS',
    rhGraceValue: 168,
    rhGraceScope: 'ALL_WORK_ORDERS',
    rhFallbackMethod: 'MONTH_END' as string | null,
    rhFallbackGraceHours: 0 as number | null,
  });

  const { data: vessels = [], isLoading: isVesselsLoading } = useVessels();

  const { data: allSettings = [], isLoading: isSettingsLoading } = useQuery<PmsVesselSettings[]>({
    queryKey: ['/technical/api/pms-vessel-settings'],
  });

  const { data: companyGraceSettings } = useQuery<CompanyGraceSettings>({
    queryKey: ['/technical/api/company-standard-grace-settings'],
  });

  const settingsMap = new Map(allSettings.map(s => [s.vesselId, s]));

  // Office WO generation kill switch (migration 161): shore Sail Admin / Super Admin only.
  const { hasRole } = useAuth();
  const { isShore } = useSyncInstanceInfo();
  const canToggleOfficeWoGeneration = isShore && hasRole(["Sail Admin", "Super Admin"] as any);

  const officeWoSwitchMutation = useMutation({
    mutationFn: async (data: { vesselId: string; enabled: boolean }) => {
      const res = await apiRequest('PUT', `/technical/api/pms-vessel-settings/${data.vesselId}/office-wo-generation`, { enabled: data.enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/pms-vessel-settings'] });
      toast({
        title: data.officeWoGenerationEnabled ? "Office generation ENABLED" : "Office generation DISABLED",
        description: data.officeWoGenerationEnabled
          ? "The office will now generate work orders for this vessel in the daily sweep and manual generation."
          : "The office will not generate work orders for this vessel. The ship's own generation is unaffected.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not change office generation", description: error?.message, variant: "destructive" });
    },
  });

  // Office RH entry kill switch (migration 162, Task #394): shore Sail Admin / Super Admin only.
  const officeRhSwitchMutation = useMutation({
    mutationFn: async (data: { vesselId: string; enabled: boolean }) => {
      const res = await apiRequest('PUT', `/technical/api/pms-vessel-settings/${data.vesselId}/office-rh-entry`, { enabled: data.enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/pms-vessel-settings'] });
      toast({
        title: data.officeRhEntryEnabled ? "Office RH entry ENABLED" : "Office RH entry DISABLED",
        description: data.officeRhEntryEnabled
          ? "The office may now record running hours when completing work orders for this vessel. The latest reading date always wins; ship readings win same-day ties."
          : "The office cannot record running hours for this vessel. Ship-side RH entry is unaffected.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not change office RH entry", description: error?.message, variant: "destructive" });
    },
  });

  // Vessel-specific RH validation policy (migration 163): shore Sail Admin /
  // Super Admin only. The setting syncs with the existing PMS settings row.
  const rhValidationSwitchMutation = useMutation({
    mutationFn: async (data: { vesselId: string; enabled: boolean }) => {
      const res = await apiRequest('PUT', `/technical/api/pms-vessel-settings/${data.vesselId}/rh-validation`, { enabled: data.enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/pms-vessel-settings'] });
      toast({
        title: data.rhValidationEnabled ? "RH validation ENABLED" : "RH validation DISABLED",
        description: data.rhValidationEnabled
          ? "Normal Running Hours validation is enforced for this vessel."
          : "Authorized Running Hours corrections for this vessel may bypass normal validation after sync.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not change RH validation", description: error?.message, variant: "destructive" });
    },
  });

  const superintendentLockSwitchMutation = useMutation({
    mutationFn: async (data: { vesselId: string; enabled: boolean }) => {
      const res = await apiRequest('PUT', `/technical/api/pms-vessel-settings/${data.vesselId}/superintendent-lock`, { enabled: data.enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/pms-vessel-settings'] });
      toast({
        title: data.superintendentLockEnabled ? "Superintendent lock ENABLED" : "Superintendent lock DISABLED",
        description: data.superintendentLockEnabled
          ? "High-severity work orders for this vessel require Superintendent acknowledgment."
          : "High-severity work orders for this vessel are notify-only; detailed remarks remain mandatory.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not change Superintendent lock", description: error?.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { vesselId: string; settings: typeof formData }) => {
      return apiRequest('PUT', `/technical/api/pms-vessel-settings/${data.vesselId}`, data.settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/pms-vessel-settings'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Settings Saved",
        description: `Lead time and grace period settings updated for ${selectedVessel?.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const companyGraceSaveMutation = useMutation({
    mutationFn: async (data: typeof companyGraceForm) => {
      return apiRequest('PUT', '/technical/api/company-standard-grace-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/company-standard-grace-settings'] });
      setIsCompanyGraceDialogOpen(false);
      toast({
        title: "Company Standard Saved",
        description: "Company standard grace rule has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save company standard settings",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (vessel: Vessel) => {
    setSelectedVessel(vessel);
    const s = settingsMap.get(vessel.id);
    if (s) {
      setFormData({
        settingsMode: (s.settingsMode === 'CUSTOM' ? 'CUSTOM' : 'COMPANY_STANDARD'),
        calendarLeadDaysCritical: s.calendarLeadDaysCritical ?? 7,
        calendarLeadDaysNonCritical: s.calendarLeadDaysNonCritical ?? 14,
        calendarGraceMode: s.calendarGraceMode ?? 'COMPANY_STANDARD',
        calendarGraceDays: s.calendarGraceDays ?? 7,
        calendarGraceMethod: s.calendarGraceMethod || 'FIXED_DAYS',
        calendarGraceValue: s.calendarGraceValue ?? 7,
        calendarGraceScope: s.calendarGraceScope || 'ALL_WORK_ORDERS',
        calendarFallbackMethod: s.calendarFallbackMethod || 'MONTH_END',
        calendarFallbackGraceDays: s.calendarFallbackGraceDays ?? 0,
        rhLeadHoursCritical: s.rhLeadHoursCritical ?? 50,
        rhLeadHoursNonCritical: s.rhLeadHoursNonCritical ?? 100,
        rhGraceHours: s.rhGraceHours ?? 168,
        rhGraceMethod: s.rhGraceMethod || 'FIXED_HOURS',
        rhGraceValue: s.rhGraceValue ?? 168,
        rhGraceScope: s.rhGraceScope || 'ALL_WORK_ORDERS',
        rhFallbackMethod: s.rhFallbackMethod || 'MONTH_END',
        rhFallbackGraceHours: s.rhFallbackGraceHours ?? 0,
      });
    } else {
      setFormData({
        settingsMode: 'COMPANY_STANDARD',
        calendarLeadDaysCritical: 7,
        calendarLeadDaysNonCritical: 14,
        calendarGraceMode: 'COMPANY_STANDARD',
        calendarGraceDays: 7,
        calendarGraceMethod: 'FIXED_DAYS',
        calendarGraceValue: 7,
        calendarGraceScope: 'ALL_WORK_ORDERS',
        calendarFallbackMethod: 'MONTH_END',
        calendarFallbackGraceDays: 0,
        rhLeadHoursCritical: 50,
        rhLeadHoursNonCritical: 100,
        rhGraceHours: 168,
        rhGraceMethod: 'FIXED_HOURS',
        rhGraceValue: 168,
        rhGraceScope: 'ALL_WORK_ORDERS',
        rhFallbackMethod: 'MONTH_END',
        rhFallbackGraceHours: 0,
      });
    }
    setVesselTab('calendar');
    setIsEditDialogOpen(true);
  };

  const openCompanyGraceDialog = () => {
    if (companyGraceSettings) {
      setCompanyGraceForm({
        graceMethod: companyGraceSettings.graceMethod || 'FIXED_DAYS',
        graceValue: companyGraceSettings.graceValue ?? 7,
        scope: companyGraceSettings.scope || 'LAST_WEEK_OF_MONTH',
        fallbackGraceDays: companyGraceSettings.fallbackGraceDays ?? 0,
        fallbackMethod: companyGraceSettings.fallbackMethod || 'MONTH_END',
        calendarLeadDaysCritical: companyGraceSettings.calendarLeadDaysCritical ?? 7,
        calendarLeadDaysNonCritical: companyGraceSettings.calendarLeadDaysNonCritical ?? 14,
        rhLeadHoursCritical: companyGraceSettings.rhLeadHoursCritical ?? 720,
        rhLeadHoursNonCritical: companyGraceSettings.rhLeadHoursNonCritical ?? 720,
        rhGraceHours: companyGraceSettings.rhGraceHours ?? 168,
        rhGraceMethod: companyGraceSettings.rhGraceMethod || 'FIXED_HOURS',
        rhGraceValue: companyGraceSettings.rhGraceValue ?? 168,
        rhGraceScope: companyGraceSettings.rhGraceScope || 'ALL_WORK_ORDERS',
        rhFallbackMethod: companyGraceSettings.rhFallbackMethod || 'MONTH_END',
        rhFallbackGraceHours: companyGraceSettings.rhFallbackGraceHours ?? 0,
      });
    }
    setCompanyStandardTab('calendar');
    setIsCompanyGraceDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedVessel) return;
    saveMutation.mutate({ vesselId: selectedVessel.id, settings: formData });
  };

  const handleCompanyGraceSave = () => {
    companyGraceSaveMutation.mutate(companyGraceForm);
  };

  const formatSettingsSummary = (vesselId: string): string => {
    const settings = settingsMap.get(vesselId);
    if (!settings) return "Not Configured";
    const mode = settings.settingsMode === 'CUSTOM' ? 'Custom' : 'Company Std';
    return `${mode} · Lead: ${settings.calendarLeadDaysCritical}d / ${settings.rhLeadHoursCritical}hrs`;
  };

  const isConfigured = (vesselId: string): boolean => {
    return settingsMap.has(vesselId);
  };

  if (isVesselsLoading || isSettingsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const configuredCount = vessels.filter(v => isConfigured(v.id)).length;
  const notSetCount = vessels.length - configuredCount;

  const filteredVessels = vessels.filter((v) => {
    if (!vesselSearch.trim()) return true;
    const query = vesselSearch.toLowerCase().trim();
    return v.name.toLowerCase().includes(query) || v.id.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="I4.QL7.1"><Marker id="I4.QL7.1" />Lead Time & Grace Period Settings</h1>
        <div className="flex gap-2 items-center">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
              onClick={onBack}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by vessel name or ID..."
            className="pl-10"
            value={vesselSearch}
            onChange={(e) => setVesselSearch(e.target.value)}
            data-testid="input-search-vessels"
          />
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-configured-count">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {configuredCount} Configured
        </Badge>
        <Badge variant="secondary" className="bg-gray-100 text-gray-600 no-default-hover-elevate no-default-active-elevate" data-testid="badge-not-set-count">
          {notSetCount} Not Set
        </Badge>
      </div>

      <div>
          <div className="flex items-center gap-4 mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <Button
              variant="outline"
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={openCompanyGraceDialog}
              data-testid="button-company-standard"
            >
              <Building2 className="h-4 w-4" />
              Company Standard
            </Button>
            {companyGraceSettings && (
              <p className="text-sm text-gray-600" data-testid="text-company-grace-summary">
                {formatCompanyStandardSummary(companyGraceSettings)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVessels.map((vessel) => {
          const configured = isConfigured(vessel.id);
          const summary = formatSettingsSummary(vessel.id);
          
          return (
            <Card 
              key={vessel.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${configured ? 'border-green-200' : 'border-gray-200'}`}
              onClick={() => openEditDialog(vessel)}
              data-testid={`card-vessel-settings-${vessel.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-gray-500" />
                    <CardTitle className="text-sm font-medium">
                      {vessel.name}
                    </CardTitle>
                  </div>
                  {configured ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                      Not Set
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className={configured ? "text-gray-700" : "text-gray-400 italic"}>
                    {summary}
                  </span>
                </div>
                {canToggleOfficeWoGeneration && (
                  <div
                    className="mt-3 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`row-office-wo-generation-${vessel.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">Office WO Generation</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {settingsMap.get(vessel.id)?.officeWoGenerationEnabled
                          ? "Office generates work orders for this vessel"
                          : "Off — ship-only generation (default)"}
                      </p>
                    </div>
                    <Switch
                      checked={settingsMap.get(vessel.id)?.officeWoGenerationEnabled === true}
                      disabled={officeWoSwitchMutation.isPending}
                      onCheckedChange={(checked) => officeWoSwitchMutation.mutate({ vesselId: vessel.id, enabled: checked })}
                      data-testid={`switch-office-wo-generation-${vessel.id}`}
                    />
                  </div>
                )}
                {canToggleOfficeWoGeneration && (
                  <div
                    className="mt-2 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`row-superintendent-lock-${vessel.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">Superintendent Approval Lock</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {(settingsMap.get(vessel.id) as any)?.superintendentLockEnabled === true
                            ? "Per-vessel: On — Superintendent acknowledgment required"
                            : "Per-vessel: Off — notify-only approval path (default)"}
                      </p>
                    </div>
                    <Switch
                      checked={(settingsMap.get(vessel.id) as any)?.superintendentLockEnabled === true}
                      disabled={superintendentLockSwitchMutation.isPending}
                      onCheckedChange={(checked) => superintendentLockSwitchMutation.mutate({ vesselId: vessel.id, enabled: checked })}
                      data-testid={`switch-superintendent-lock-${vessel.id}`}
                    />
                  </div>
                )}
                {canToggleOfficeWoGeneration && (
                  <div
                    className="mt-2 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`row-office-rh-entry-${vessel.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">Office RH Entry</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {(settingsMap.get(vessel.id) as any)?.officeRhEntryEnabled
                          ? "Office records running hours via WO completion"
                          : "Off — ship-only RH entry (default)"}
                      </p>
                    </div>
                    <Switch
                      checked={(settingsMap.get(vessel.id) as any)?.officeRhEntryEnabled === true}
                      disabled={officeRhSwitchMutation.isPending}
                      onCheckedChange={(checked) => officeRhSwitchMutation.mutate({ vesselId: vessel.id, enabled: checked })}
                      data-testid={`switch-office-rh-entry-${vessel.id}`}
                    />
                  </div>
                )}
                {canToggleOfficeWoGeneration && (
                  <div
                    className="mt-2 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`row-rh-validation-${vessel.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">RH Validation</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {(settingsMap.get(vessel.id) as any)?.rhValidationEnabled !== false
                          ? "On — standard Running Hours validation"
                          : "Off — applies to this vessel after sync"}
                      </p>
                    </div>
                    <Switch
                      checked={(settingsMap.get(vessel.id) as any)?.rhValidationEnabled !== false}
                      disabled={rhValidationSwitchMutation.isPending}
                      onCheckedChange={(checked) => rhValidationSwitchMutation.mutate({ vesselId: vessel.id, enabled: checked })}
                      data-testid={`switch-rh-validation-${vessel.id}`}
                    />
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(vessel);
                  }}
                  data-testid={`button-configure-vessel-${vessel.id}`}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Configure
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

          {vessels.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Vessels Found</h3>
              <p className="text-gray-600 mt-1">Add vessels to configure their PMS settings.</p>
            </div>
          )}
        </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Lead Time & Grace Period Settings
              {selectedVessel && (
                <Badge variant="outline" className="ml-2">{selectedVessel.name}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-semibold text-gray-700" data-testid="label-settings-mode">Settings Mode</Label>
              <div className="flex gap-3 mt-2">
                {[
                  { value: 'COMPANY_STANDARD' as const, label: 'Company Standard', desc: 'Uses company-wide grace rules' },
                  { value: 'CUSTOM' as const, label: 'Custom', desc: 'Override grace rules for this vessel' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex-1 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.settingsMode === option.value
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`radio-settings-mode-${option.value.toLowerCase()}`}
                  >
                    <input
                      type="radio"
                      name="settingsMode"
                      value={option.value}
                      checked={formData.settingsMode === option.value}
                      onChange={() => setFormData({...formData, settingsMode: option.value})}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{option.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {formData.settingsMode === 'COMPANY_STANDARD' && (
              <div className="space-y-4">
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">This vessel inherits all lead time and grace period settings from the Company Standard configuration. Switch to Custom mode to override.</p>
                </div>
                <div className="flex border-b">
                  <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      vesselTab === 'calendar'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setVesselTab('calendar')}
                    data-testid="tab-vessel-std-calendar"
                  >
                    <Calendar className="h-4 w-4" />
                    Calendar-Based Jobs
                  </button>
                  <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      vesselTab === 'rh'
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setVesselTab('rh')}
                    data-testid="tab-vessel-std-rh"
                  >
                    <Gauge className="h-4 w-4" />
                    Running Hours Based Jobs
                  </button>
                </div>

                {vesselTab === 'calendar' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label className="text-xs text-blue-700">Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input value={`${companyGraceSettings?.calendarLeadDaysCritical ?? 7}`} disabled className="w-24 bg-blue-100/50 text-blue-900" data-testid="display-std-cal-lead-critical" />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-blue-700">Non-Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input value={`${companyGraceSettings?.calendarLeadDaysNonCritical ?? 14}`} disabled className="w-24 bg-blue-100/50 text-blue-900" data-testid="display-std-cal-lead-noncritical" />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>

                      {companyGraceSettings ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-blue-700">Method</Label>
                              <Input value={companyGraceSettings.graceMethod === 'FIXED_DAYS' ? `Fixed Days (${companyGraceSettings.graceValue ?? 7}d)` : companyGraceSettings.graceMethod === 'MONTH_END' ? 'Month End' : `${companyGraceSettings.graceValue}${getOrdinalSuffix(companyGraceSettings.graceValue || 1)} of Next Month`} disabled className="mt-1 bg-blue-100/50 text-blue-900" data-testid="display-std-cal-grace-method" />
                            </div>
                            <div>
                              <Label className="text-xs text-blue-700">Scope</Label>
                              <Input value={companyGraceSettings.scope === 'ALL_WORK_ORDERS' ? 'All Calendar-Based WOs' : 'Last Week of Month Only'} disabled className="mt-1 bg-blue-100/50 text-blue-900" data-testid="display-std-cal-grace-scope" />
                            </div>
                          </div>
                          {companyGraceSettings.scope === 'LAST_WEEK_OF_MONTH' && (
                            <div>
                              <Label className="text-xs text-blue-700">Fallback (Other WOs)</Label>
                              <Input value={companyGraceSettings.fallbackMethod === 'FIXED_DAYS' ? `Fixed Days (${companyGraceSettings.fallbackGraceDays ?? 0}d)` : companyGraceSettings.fallbackMethod === 'MONTH_END' ? 'Month End' : '—'} disabled className="mt-1 bg-blue-100/50 text-blue-900" data-testid="display-std-cal-grace-fallback" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Company Standard not configured yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {vesselTab === 'rh' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>

                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label className="text-xs text-orange-700">Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input value={`${companyGraceSettings?.rhLeadHoursCritical ?? 720}`} disabled className="w-24 bg-orange-100/50 text-orange-900" data-testid="display-std-rh-lead-critical" />
                            <span className="text-sm text-gray-500">hours</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-orange-700">Non-Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input value={`${companyGraceSettings?.rhLeadHoursNonCritical ?? 720}`} disabled className="w-24 bg-orange-100/50 text-orange-900" data-testid="display-std-rh-lead-noncritical" />
                            <span className="text-sm text-gray-500">hours</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>

                      {companyGraceSettings ? (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-orange-700">Method</Label>
                              <Input value={(companyGraceSettings.rhGraceMethod || 'FIXED_HOURS') === 'FIXED_HOURS' ? `Fixed Hours (${companyGraceSettings.rhGraceValue ?? 168}h)` : (companyGraceSettings.rhGraceMethod || 'FIXED_HOURS') === 'MONTH_END' ? 'Month End' : `${companyGraceSettings.rhGraceValue}${getOrdinalSuffix(companyGraceSettings.rhGraceValue || 1)} of Next Month`} disabled className="mt-1 bg-orange-100/50 text-orange-900" data-testid="display-std-rh-grace-method" />
                            </div>
                            <div>
                              <Label className="text-xs text-orange-700">Scope</Label>
                              <Input value={(companyGraceSettings.rhGraceScope || 'ALL_WORK_ORDERS') === 'ALL_WORK_ORDERS' ? 'All RH-Based WOs' : 'Last Week of Month Only'} disabled className="mt-1 bg-orange-100/50 text-orange-900" data-testid="display-std-rh-grace-scope" />
                            </div>
                          </div>
                          {(companyGraceSettings.rhGraceScope || 'ALL_WORK_ORDERS') === 'LAST_WEEK_OF_MONTH' && (
                            <div>
                              <Label className="text-xs text-orange-700">Fallback (Other WOs)</Label>
                              <Input value={companyGraceSettings.rhFallbackMethod === 'FIXED_HOURS' ? `Fixed Hours (${companyGraceSettings.rhFallbackGraceHours ?? 0}h)` : companyGraceSettings.rhFallbackMethod === 'MONTH_END' ? 'Month End' : '—'} disabled className="mt-1 bg-orange-100/50 text-orange-900" data-testid="display-std-rh-grace-fallback" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Company Standard not configured yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.settingsMode === 'CUSTOM' && (
              <div className="space-y-4">
                <div className="flex border-b">
                  <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      vesselTab === 'calendar'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setVesselTab('calendar')}
                    data-testid="tab-vessel-calendar"
                  >
                    <Calendar className="h-4 w-4" />
                    Calendar-Based Jobs
                  </button>
                  <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      vesselTab === 'rh'
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setVesselTab('rh')}
                    data-testid="tab-vessel-rh"
                  >
                    <Gauge className="h-4 w-4" />
                    Running Hours Based Jobs
                  </button>
                </div>

                {vesselTab === 'calendar' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label className="text-xs text-gray-500">Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} value={formData.calendarLeadDaysCritical} onChange={(e) => setFormData({...formData, calendarLeadDaysCritical: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-custom-cal-lead-critical" />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Non-Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} value={formData.calendarLeadDaysNonCritical} onChange={(e) => setFormData({...formData, calendarLeadDaysNonCritical: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-custom-cal-lead-noncritical" />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>
                      <p className="text-xs text-gray-500">Select how the grace period is calculated for calendar-based work orders on this vessel.</p>
                      <div className="space-y-2">
                        {[
                          { value: 'FIXED_DAYS', label: 'Fixed Days', desc: 'Grace period is a fixed number of days after due date' },
                          { value: 'MONTH_END', label: 'Month End', desc: 'Grace extends to the end of the month the WO is due' },
                          { value: 'SPECIFIC_DATE_NEXT_MONTH', label: 'Specific Date of Next Month', desc: 'Grace extends to a specific day of the following month' },
                        ].map(option => (
                          <label
                            key={option.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              formData.calendarGraceMethod === option.value
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            data-testid={`radio-vessel-cal-grace-method-${option.value.toLowerCase()}`}
                          >
                            <input type="radio" name="vesselCalGraceMethod" value={option.value} checked={formData.calendarGraceMethod === option.value} onChange={() => setFormData({...formData, calendarGraceMethod: option.value})} className="mt-0.5" />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{option.label}</span>
                              <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      {formData.calendarGraceMethod === 'FIXED_DAYS' && (
                        <div className="ml-7 mt-2">
                          <Label className="text-sm text-gray-700">Number of grace days</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} max={365} value={formData.calendarGraceValue} onChange={(e) => setFormData({...formData, calendarGraceValue: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-cal-grace-fixed-days" />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        </div>
                      )}

                      {formData.calendarGraceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (
                        <div className="ml-7 mt-2">
                          <Label className="text-sm text-gray-700">Day of the next month</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} max={28} value={formData.calendarGraceValue} onChange={(e) => { const val = parseInt(e.target.value) || 1; setFormData({...formData, calendarGraceValue: Math.min(28, Math.max(1, val))}); }} className="w-24" data-testid="input-vessel-cal-grace-day-of-month" />
                            <span className="text-sm text-gray-500">of next month (1-28)</span>
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-3 space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">Scope</Label>
                        <p className="text-xs text-gray-500">Select which calendar-based work orders this grace rule applies to.</p>
                        <div className="space-y-2">
                          {[
                            { value: 'ALL_WORK_ORDERS', label: 'Apply to all Calendar-Based Work Orders', desc: 'The selected grace method applies to all calendar-based work orders' },
                            { value: 'LAST_WEEK_OF_MONTH', label: 'Apply only to Calendar-Based WOs due in last week of month', desc: 'The grace method applies only to calendar-based work orders whose due date falls in the last 7 days of the month' },
                          ].map(option => (
                            <label
                              key={option.value}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                formData.calendarGraceScope === option.value
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              data-testid={`radio-vessel-cal-grace-scope-${option.value.toLowerCase()}`}
                            >
                              <input type="radio" name="vesselCalGraceScope" value={option.value} checked={formData.calendarGraceScope === option.value} onChange={() => setFormData({...formData, calendarGraceScope: option.value})} className="mt-0.5" />
                              <div>
                                <span className="text-sm font-medium text-gray-900">{option.label}</span>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>

                        {formData.calendarGraceScope === 'LAST_WEEK_OF_MONTH' && (
                          <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <Label className="text-sm font-medium text-amber-900">Fallback for Calendar-Based WOs not due in last week of month</Label>
                            <p className="text-xs text-amber-700 mt-0.5 mb-2">This covers all remaining calendar-based work orders whose due date falls outside the last 7 days of the month.</p>
                            <div className="space-y-2">
                              {[
                                { value: 'MONTH_END', label: 'Month End', desc: 'Grace until end of due month' },
                                { value: 'FIXED_DAYS', label: 'Fixed Days', desc: 'Set a specific number of grace days' },
                              ].map(option => (
                                <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                                  <input type="radio" name="vesselCalFallback" checked={formData.calendarFallbackMethod === option.value} onChange={() => setFormData({...formData, calendarFallbackMethod: option.value})} className="mt-1" data-testid={`radio-vessel-cal-fallback-${option.value.toLowerCase()}`} />
                                  <div>
                                    <span className="text-sm font-medium text-amber-900">{option.label}</span>
                                    <p className="text-xs text-amber-700">{option.desc}</p>
                                  </div>
                                </label>
                              ))}
                              {formData.calendarFallbackMethod === 'FIXED_DAYS' && (
                                <div className="flex items-center gap-2 ml-6">
                                  <Input type="number" min={0} max={365} value={formData.calendarFallbackGraceDays ?? 0} onChange={(e) => setFormData({...formData, calendarFallbackGraceDays: parseInt(e.target.value) || 0})} className="w-24" data-testid="input-vessel-cal-fallback-days" />
                                  <span className="text-sm text-gray-500">days</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {vesselTab === 'rh' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label className="text-xs text-gray-500">Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} value={formData.rhLeadHoursCritical} onChange={(e) => setFormData({...formData, rhLeadHoursCritical: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-custom-rh-lead-critical" />
                            <span className="text-sm text-gray-500">hours</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Non-Critical Jobs</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} value={formData.rhLeadHoursNonCritical} onChange={(e) => setFormData({...formData, rhLeadHoursNonCritical: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-custom-rh-lead-noncritical" />
                            <span className="text-sm text-gray-500">hours</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>
                      <p className="text-xs text-gray-500">Select how the grace period is calculated for running hours based work orders on this vessel.</p>
                      <div className="space-y-2">
                        {[
                          { value: 'FIXED_HOURS', label: 'Fixed Hours', desc: 'Grace period is a fixed number of hours after due running hours' },
                          { value: 'MONTH_END', label: 'Month End', desc: 'Grace extends to the end of the month the WO is due' },
                          { value: 'SPECIFIC_DATE_NEXT_MONTH', label: 'Specific Date of Next Month', desc: 'Grace extends to a specific day of the following month' },
                        ].map(option => (
                          <label
                            key={option.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              formData.rhGraceMethod === option.value
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            data-testid={`radio-vessel-rh-grace-method-${option.value.toLowerCase()}`}
                          >
                            <input type="radio" name="vesselRhGraceMethod" value={option.value} checked={formData.rhGraceMethod === option.value} onChange={() => setFormData({...formData, rhGraceMethod: option.value})} className="mt-0.5" />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{option.label}</span>
                              <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      {formData.rhGraceMethod === 'FIXED_HOURS' && (
                        <div className="ml-7 mt-2">
                          <Label className="text-sm text-gray-700">Number of grace hours</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} value={formData.rhGraceValue} onChange={(e) => setFormData({...formData, rhGraceValue: parseInt(e.target.value) || 1})} className="w-24" data-testid="input-vessel-rh-grace-fixed-hours" />
                            <span className="text-sm text-gray-500">hours</span>
                            <span className="text-xs text-gray-400">(≈ {Math.round((formData.rhGraceValue || 0) / 24)} days)</span>
                          </div>
                        </div>
                      )}

                      {formData.rhGraceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (
                        <div className="ml-7 mt-2">
                          <Label className="text-sm text-gray-700">Day of the next month</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Input type="number" min={1} max={28} value={formData.rhGraceValue} onChange={(e) => { const val = parseInt(e.target.value) || 1; setFormData({...formData, rhGraceValue: Math.min(28, Math.max(1, val))}); }} className="w-24" data-testid="input-vessel-rh-grace-day-of-month" />
                            <span className="text-sm text-gray-500">of next month (1-28)</span>
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-3 space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">Scope</Label>
                        <p className="text-xs text-gray-500">Select which running-hours-based work orders this grace rule applies to.</p>
                        <div className="space-y-2">
                          {[
                            { value: 'ALL_WORK_ORDERS', label: 'Apply to all RH-Based Work Orders', desc: 'The selected grace method applies to all running-hours-based work orders' },
                            { value: 'LAST_WEEK_OF_MONTH', label: 'Apply only to RH-Based WOs due in last week of month', desc: 'The grace method applies only to running-hours-based work orders whose due date falls in the last 7 days of the month' },
                          ].map(option => (
                            <label
                              key={option.value}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                formData.rhGraceScope === option.value
                                  ? 'border-orange-400 bg-orange-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              data-testid={`radio-vessel-rh-grace-scope-${option.value.toLowerCase()}`}
                            >
                              <input type="radio" name="vesselRhGraceScope" value={option.value} checked={formData.rhGraceScope === option.value} onChange={() => setFormData({...formData, rhGraceScope: option.value})} className="mt-0.5" />
                              <div>
                                <span className="text-sm font-medium text-gray-900">{option.label}</span>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>

                        {formData.rhGraceScope === 'LAST_WEEK_OF_MONTH' && (
                          <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <Label className="text-sm font-medium text-amber-900">Fallback for RH-Based WOs not due in last week of month</Label>
                            <p className="text-xs text-amber-700 mt-0.5 mb-2">This covers all remaining running-hours-based work orders whose due date falls outside the last 7 days of the month.</p>
                            <div className="space-y-2">
                              {[
                                { value: 'MONTH_END', label: 'Month End', desc: 'Grace until end of due month' },
                                { value: 'FIXED_HOURS', label: 'Fixed Hours', desc: 'Set a specific number of grace hours' },
                              ].map(option => (
                                <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                                  <input type="radio" name="vesselRhFallback" checked={formData.rhFallbackMethod === option.value} onChange={() => setFormData({...formData, rhFallbackMethod: option.value})} className="mt-1" data-testid={`radio-vessel-rh-fallback-${option.value.toLowerCase()}`} />
                                  <div>
                                    <span className="text-sm font-medium text-amber-900">{option.label}</span>
                                    <p className="text-xs text-amber-700">{option.desc}</p>
                                  </div>
                                </label>
                              ))}
                              {formData.rhFallbackMethod === 'FIXED_HOURS' && (
                                <div className="flex items-center gap-2 ml-6">
                                  <Input type="number" min={0} value={formData.rhFallbackGraceHours ?? 0} onChange={(e) => setFormData({...formData, rhFallbackGraceHours: parseInt(e.target.value) || 0})} className="w-24" data-testid="input-vessel-rh-fallback-hours" />
                                  <span className="text-sm text-gray-500">hours</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-settings"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompanyGraceDialogOpen} onOpenChange={setIsCompanyGraceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Company Standard Settings
            </DialogTitle>
          </DialogHeader>

          <div className="flex border-b mb-4">
            <button
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                companyStandardTab === 'calendar'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setCompanyStandardTab('calendar')}
              data-testid="tab-calendar-jobs"
            >
              <Calendar className="h-4 w-4" />
              Calendar-Based Jobs
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                companyStandardTab === 'rh'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setCompanyStandardTab('rh')}
              data-testid="tab-rh-jobs"
            >
              <Gauge className="h-4 w-4" />
              Running Hours Based Jobs
            </button>
          </div>

          <div className="py-2">
            {companyStandardTab === 'calendar' && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label className="text-xs text-gray-500">Critical Jobs</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={companyGraceForm.calendarLeadDaysCritical}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, calendarLeadDaysCritical: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-company-cal-lead-critical"
                        />
                        <span className="text-sm text-gray-500">days</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Non-Critical Jobs</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={companyGraceForm.calendarLeadDaysNonCritical}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, calendarLeadDaysNonCritical: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-company-cal-lead-noncritical"
                        />
                        <span className="text-sm text-gray-500">days</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>
                  <p className="text-xs text-gray-500">Select how the grace period is calculated for calendar-based work orders.</p>
                  <div className="space-y-2">
                    {[
                      { value: 'FIXED_DAYS', label: 'Fixed Days', desc: 'Grace period is a fixed number of days after due date' },
                      { value: 'MONTH_END', label: 'Month End', desc: 'Grace extends to the end of the month the WO is due' },
                      { value: 'SPECIFIC_DATE_NEXT_MONTH', label: 'Specific Date of Next Month', desc: 'Grace extends to a specific day of the following month' },
                    ].map(option => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          companyGraceForm.graceMethod === option.value
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`radio-grace-method-${option.value.toLowerCase()}`}
                      >
                        <input
                          type="radio"
                          name="graceMethod"
                          value={option.value}
                          checked={companyGraceForm.graceMethod === option.value}
                          onChange={() => setCompanyGraceForm({...companyGraceForm, graceMethod: option.value})}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{option.label}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {companyGraceForm.graceMethod === 'FIXED_DAYS' && (
                    <div className="ml-7 mt-2">
                      <Label className="text-sm text-gray-700">Number of grace days</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={companyGraceForm.graceValue}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, graceValue: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-grace-fixed-days"
                        />
                        <span className="text-sm text-gray-500">days</span>
                      </div>
                    </div>
                  )}

                  {companyGraceForm.graceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (
                    <div className="ml-7 mt-2">
                      <Label className="text-sm text-gray-700">Day of the next month</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          value={companyGraceForm.graceValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setCompanyGraceForm({...companyGraceForm, graceValue: Math.min(28, Math.max(1, val))});
                          }}
                          className="w-24"
                          data-testid="input-grace-day-of-month"
                        />
                        <span className="text-sm text-gray-500">of next month (1-28)</span>
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">Scope</Label>
                    <p className="text-xs text-gray-500">Select which calendar-based work orders this grace rule applies to.</p>
                    <div className="space-y-2">
                      {[
                        { value: 'ALL_WORK_ORDERS', label: 'Apply to all Calendar-Based Work Orders', desc: 'The selected grace method applies to all calendar-based work orders' },
                        { value: 'LAST_WEEK_OF_MONTH', label: 'Apply only to Calendar-Based WOs due in last week of month', desc: 'The grace method applies only to calendar-based work orders whose due date falls in the last 7 days of the month' },
                      ].map(option => (
                        <label
                          key={option.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            companyGraceForm.scope === option.value
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`radio-grace-scope-${option.value.toLowerCase()}`}
                        >
                          <input
                            type="radio"
                            name="graceScope"
                            value={option.value}
                            checked={companyGraceForm.scope === option.value}
                            onChange={() => setCompanyGraceForm({...companyGraceForm, scope: option.value})}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{option.label}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {companyGraceForm.scope === 'LAST_WEEK_OF_MONTH' && (
                      <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <Label className="text-sm font-medium text-amber-900">Fallback for Calendar-Based WOs not due in last week of month</Label>
                        <p className="text-xs text-amber-700 mt-0.5 mb-2">
                          This covers all remaining calendar-based work orders whose due date falls outside the last 7 days of the month.
                        </p>
                        <div className="space-y-2">
                          {[
                            { value: 'MONTH_END', label: 'Month End', desc: 'Grace until end of due month' },
                            { value: 'FIXED_DAYS', label: 'Fixed Days', desc: 'Set a specific number of grace days' },
                          ].map(option => (
                            <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="fallbackMethod"
                                checked={companyGraceForm.fallbackMethod === option.value}
                                onChange={() => setCompanyGraceForm({...companyGraceForm, fallbackMethod: option.value})}
                                className="mt-1"
                                data-testid={`radio-fallback-${option.value.toLowerCase()}`}
                              />
                              <div>
                                <span className="text-sm font-medium text-amber-900">{option.label}</span>
                                <p className="text-xs text-amber-700">{option.desc}</p>
                              </div>
                            </label>
                          ))}
                          {companyGraceForm.fallbackMethod === 'FIXED_DAYS' && (
                            <div className="flex items-center gap-2 ml-6">
                              <Input
                                type="number"
                                min={0}
                                max={365}
                                value={companyGraceForm.fallbackGraceDays ?? 0}
                                onChange={(e) => setCompanyGraceForm({...companyGraceForm, fallbackGraceDays: parseInt(e.target.value) || 0})}
                                className="w-24"
                                data-testid="input-grace-fallback-days"
                              />
                              <span className="text-sm text-gray-500">days</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {companyStandardTab === 'rh' && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Lead Time</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label className="text-xs text-gray-500">Critical Jobs</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={companyGraceForm.rhLeadHoursCritical}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, rhLeadHoursCritical: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-company-rh-lead-critical"
                        />
                        <span className="text-sm text-gray-500">hours</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Non-Critical Jobs</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={companyGraceForm.rhLeadHoursNonCritical}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, rhLeadHoursNonCritical: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-company-rh-lead-noncritical"
                        />
                        <span className="text-sm text-gray-500">hours</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>
                  <p className="text-xs text-gray-500">Select how the grace period is calculated for running hours based work orders.</p>
                  <div className="space-y-2">
                    {[
                      { value: 'FIXED_HOURS', label: 'Fixed Hours', desc: 'Grace period is a fixed number of hours after due running hours' },
                      { value: 'MONTH_END', label: 'Month End', desc: 'Grace extends to the end of the month the WO is due' },
                      { value: 'SPECIFIC_DATE_NEXT_MONTH', label: 'Specific Date of Next Month', desc: 'Grace extends to a specific day of the following month' },
                    ].map(option => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          companyGraceForm.rhGraceMethod === option.value
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`radio-rh-grace-method-${option.value.toLowerCase()}`}
                      >
                        <input
                          type="radio"
                          name="rhGraceMethod"
                          value={option.value}
                          checked={companyGraceForm.rhGraceMethod === option.value}
                          onChange={() => setCompanyGraceForm({...companyGraceForm, rhGraceMethod: option.value})}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{option.label}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {companyGraceForm.rhGraceMethod === 'FIXED_HOURS' && (
                    <div className="ml-7 mt-2">
                      <Label className="text-sm text-gray-700">Number of grace hours</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={companyGraceForm.rhGraceValue}
                          onChange={(e) => setCompanyGraceForm({...companyGraceForm, rhGraceValue: parseInt(e.target.value) || 1})}
                          className="w-24"
                          data-testid="input-rh-grace-fixed-hours"
                        />
                        <span className="text-sm text-gray-500">hours</span>
                        <span className="text-xs text-gray-400">(≈ {Math.round((companyGraceForm.rhGraceValue || 0) / 24)} days)</span>
                      </div>
                    </div>
                  )}

                  {companyGraceForm.rhGraceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (
                    <div className="ml-7 mt-2">
                      <Label className="text-sm text-gray-700">Day of the next month</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          value={companyGraceForm.rhGraceValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setCompanyGraceForm({...companyGraceForm, rhGraceValue: Math.min(28, Math.max(1, val))});
                          }}
                          className="w-24"
                          data-testid="input-rh-grace-day-of-month"
                        />
                        <span className="text-sm text-gray-500">of next month (1-28)</span>
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">Scope</Label>
                    <p className="text-xs text-gray-500">Select which running-hours-based work orders this grace rule applies to.</p>
                    <div className="space-y-2">
                      {[
                        { value: 'ALL_WORK_ORDERS', label: 'Apply to all RH-Based Work Orders', desc: 'The selected grace method applies to all running-hours-based work orders' },
                        { value: 'LAST_WEEK_OF_MONTH', label: 'Apply only to RH-Based WOs due in last week of month', desc: 'The grace method applies only to running-hours-based work orders whose due date falls in the last 7 days of the month' },
                      ].map(option => (
                        <label
                          key={option.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            companyGraceForm.rhGraceScope === option.value
                              ? 'border-orange-400 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`radio-rh-grace-scope-${option.value.toLowerCase()}`}
                        >
                          <input
                            type="radio"
                            name="rhGraceScope"
                            value={option.value}
                            checked={companyGraceForm.rhGraceScope === option.value}
                            onChange={() => setCompanyGraceForm({...companyGraceForm, rhGraceScope: option.value})}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{option.label}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {companyGraceForm.rhGraceScope === 'LAST_WEEK_OF_MONTH' && (
                      <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <Label className="text-sm font-medium text-amber-900">Fallback for RH-Based WOs not due in last week of month</Label>
                        <p className="text-xs text-amber-700 mt-0.5 mb-2">
                          This covers all remaining running-hours-based work orders whose due date falls outside the last 7 days of the month.
                        </p>
                        <div className="space-y-2">
                          {[
                            { value: 'MONTH_END', label: 'Month End', desc: 'Grace until end of due month' },
                            { value: 'FIXED_HOURS', label: 'Fixed Hours', desc: 'Set a specific number of grace hours' },
                          ].map(option => (
                            <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="rhFallbackMethod"
                                checked={companyGraceForm.rhFallbackMethod === option.value}
                                onChange={() => setCompanyGraceForm({...companyGraceForm, rhFallbackMethod: option.value})}
                                className="mt-1"
                                data-testid={`radio-rh-fallback-${option.value.toLowerCase()}`}
                              />
                              <div>
                                <span className="text-sm font-medium text-amber-900">{option.label}</span>
                                <p className="text-xs text-amber-700">{option.desc}</p>
                              </div>
                            </label>
                          ))}
                          {companyGraceForm.rhFallbackMethod === 'FIXED_HOURS' && (
                            <div className="flex items-center gap-2 ml-6">
                              <Input
                                type="number"
                                min={0}
                                value={companyGraceForm.rhFallbackGraceHours ?? 0}
                                onChange={(e) => setCompanyGraceForm({...companyGraceForm, rhFallbackGraceHours: parseInt(e.target.value) || 0})}
                                className="w-24"
                                data-testid="input-rh-grace-fallback-hours"
                              />
                              <span className="text-sm text-gray-500">hours</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCompanyGraceDialogOpen(false)}
              data-testid="button-cancel-company-grace"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleCompanyGraceSave}
              disabled={companyGraceSaveMutation.isPending}
              data-testid="button-save-company-grace"
            >
              <Save className="h-4 w-4 mr-1" />
              {companyGraceSaveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
