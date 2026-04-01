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
import type { PmsVesselSettings } from "@shared/schema";
import { Marker } from "@/components/Marker";

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

function formatCompanyStandardSummary(settings: CompanyGraceSettings): string {
  const calLead = `${settings.calendarLeadDaysCritical ?? 7}d / ${settings.calendarLeadDaysNonCritical ?? 14}d`;
  const calGrace = formatCalendarGraceLabel(settings);
  const rhLead = `${settings.rhLeadHoursCritical ?? 720}h / ${settings.rhLeadHoursNonCritical ?? 720}h`;
  const rhGrace = `${settings.rhGraceHours ?? 168}h`;
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

  const [formData, setFormData] = useState({
    calendarLeadDaysCritical: 7,
    calendarLeadDaysNonCritical: 14,
    calendarGraceMode: 'COMPANY_STANDARD',
    calendarGraceDays: 7,
    rhLeadHoursCritical: 50,
    rhLeadHoursNonCritical: 100,
    rhGraceHours: 168,
  });

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
  });

  const { data: vessels = [], isLoading: isVesselsLoading } = useVessels();

  const { data: allSettings = [], isLoading: isSettingsLoading } = useQuery<PmsVesselSettings[]>({
    queryKey: ['/technical/api/pms-vessel-settings'],
  });

  const { data: companyGraceSettings } = useQuery<CompanyGraceSettings>({
    queryKey: ['/technical/api/company-standard-grace-settings'],
  });

  const settingsMap = new Map(allSettings.map(s => [s.vesselId, s]));

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
    const existingSettings = settingsMap.get(vessel.id);
    if (existingSettings) {
      setFormData({
        calendarLeadDaysCritical: existingSettings.calendarLeadDaysCritical ?? 7,
        calendarLeadDaysNonCritical: existingSettings.calendarLeadDaysNonCritical ?? 14,
        calendarGraceMode: existingSettings.calendarGraceMode ?? 'COMPANY_STANDARD',
        calendarGraceDays: existingSettings.calendarGraceDays ?? 7,
        rhLeadHoursCritical: existingSettings.rhLeadHoursCritical ?? 50,
        rhLeadHoursNonCritical: existingSettings.rhLeadHoursNonCritical ?? 100,
        rhGraceHours: existingSettings.rhGraceHours ?? 168,
      });
    } else {
      setFormData({
        calendarLeadDaysCritical: 7,
        calendarLeadDaysNonCritical: 14,
        calendarGraceMode: 'COMPANY_STANDARD',
        calendarGraceDays: 7,
        rhLeadHoursCritical: 50,
        rhLeadHoursNonCritical: 100,
        rhGraceHours: 168,
      });
    }
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
      });
    }
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
    return `Lead: ${settings.calendarLeadDaysCritical}d / ${settings.rhLeadHoursCritical}hrs`;
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
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="I4.QL7.1"><Marker id="I4.QL7.1" />Lead Time & Grace Period Settings</h1>
                <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL7.2">
                  <Marker id="I4.QL7.2" />Configure vessel-specific lead times for work order generation and grace periods for status calculation
                </p>
              </div>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800">All Vessels</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-green-100 text-green-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-configured-count">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {configuredCount} Configured
                </Badge>
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 no-default-hover-elevate no-default-active-elevate" data-testid="badge-not-set-count">
                  {notSetCount} Not Set
                </Badge>
              </div>
            </div>
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by vessel name or ID..."
                className="pl-10 bg-white border-gray-300"
                value={vesselSearch}
                onChange={(e) => setVesselSearch(e.target.value)}
                data-testid="input-search-vessels"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
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
      </Card>

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

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2" data-testid="I4.QL7.3">
                <Marker id="I4.QL7.3" />
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Calendar-Based Jobs</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calendarLeadDaysCritical" className="text-sm font-medium" data-testid="I4.QL7.4">
                    <Marker id="I4.QL7.4" />Lead Time (Critical Jobs)
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="calendarLeadDaysCritical"
                      type="number"
                      min={1}
                      value={formData.calendarLeadDaysCritical}
                      onChange={(e) => setFormData({...formData, calendarLeadDaysCritical: parseInt(e.target.value) || 0})}
                      className="w-24"
                      data-testid="I4.QL7.5"
                    />
                    <span className="text-sm text-gray-500">days before due</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="calendarLeadDaysNonCritical" className="text-sm font-medium" data-testid="I4.QL7.6">
                    <Marker id="I4.QL7.6" />Lead Time (Non-Critical Jobs)
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="calendarLeadDaysNonCritical"
                      type="number"
                      min={1}
                      value={formData.calendarLeadDaysNonCritical}
                      onChange={(e) => setFormData({...formData, calendarLeadDaysNonCritical: parseInt(e.target.value) || 0})}
                      className="w-24"
                      data-testid="I4.QL7.7"
                    />
                    <span className="text-sm text-gray-500">days before due</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calendarGraceMode" className="text-sm font-medium" data-testid="I4.QL7.8">
                    <Marker id="I4.QL7.8" />Grace Period Mode
                  </Label>
                  <Select
                    value={formData.calendarGraceMode}
                    onValueChange={(value) => setFormData({...formData, calendarGraceMode: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="I4.QL7.9">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY_STANDARD">Company Standard</SelectItem>
                      <SelectItem value="CUSTOM_DAYS">Fixed Days</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.calendarGraceMode === 'COMPANY_STANDARD' && companyGraceSettings && (
                    <p className="text-xs text-blue-600 mt-1">
                      {formatCompanyStandardSummary(companyGraceSettings)}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="calendarGraceDays" className="text-sm font-medium" data-testid="I4.QL7.10">
                    <Marker id="I4.QL7.10" />{formData.calendarGraceMode === 'CUSTOM_DAYS' ? 'Fixed Grace Days' : 'Default Grace Days'}
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="calendarGraceDays"
                      type="number"
                      min={0}
                      value={formData.calendarGraceDays}
                      onChange={(e) => setFormData({...formData, calendarGraceDays: parseInt(e.target.value) || 0})}
                      className="w-24"
                      disabled={formData.calendarGraceMode === 'COMPANY_STANDARD'}
                      data-testid="I4.QL7.11"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                  {formData.calendarGraceMode === 'COMPANY_STANDARD' && (
                    <p className="text-xs text-gray-400 mt-1">
                      This field is ignored in Company Standard mode
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2" data-testid="I4.QL7.12">
                <Marker id="I4.QL7.12" />
                <Gauge className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Running Hours Jobs</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rhLeadHoursCritical" className="text-sm font-medium" data-testid="I4.QL7.13">
                    <Marker id="I4.QL7.13" />Lead Time (Critical Jobs)
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="rhLeadHoursCritical"
                      type="number"
                      min={1}
                      value={formData.rhLeadHoursCritical}
                      onChange={(e) => setFormData({...formData, rhLeadHoursCritical: parseInt(e.target.value) || 0})}
                      className="w-24"
                      data-testid="I4.QL7.14"
                    />
                    <span className="text-sm text-gray-500">hours before due</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="rhLeadHoursNonCritical" className="text-sm font-medium" data-testid="I4.QL7.15">
                    <Marker id="I4.QL7.15" />Lead Time (Non-Critical Jobs)
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="rhLeadHoursNonCritical"
                      type="number"
                      min={1}
                      value={formData.rhLeadHoursNonCritical}
                      onChange={(e) => setFormData({...formData, rhLeadHoursNonCritical: parseInt(e.target.value) || 0})}
                      className="w-24"
                      data-testid="I4.QL7.16"
                    />
                    <span className="text-sm text-gray-500">hours before due</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="rhGraceHours" className="text-sm font-medium" data-testid="I4.QL7.17">
                  <Marker id="I4.QL7.17" />Grace Period
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="rhGraceHours"
                    type="number"
                    min={0}
                    value={formData.rhGraceHours}
                    onChange={(e) => setFormData({...formData, rhGraceHours: parseInt(e.target.value) || 0})}
                    className="w-24"
                    data-testid="I4.QL7.18"
                  />
                  <span className="text-sm text-gray-500" data-testid="I4.QL7.19"><Marker id="I4.QL7.19" />hours after due</span>
                  <span className="text-xs text-gray-400">(≈ {Math.round(formData.rhGraceHours / 24)} days)</span>
                </div>
              </div>
            </div>
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

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Calendar-Based Jobs</h3>
              </div>

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
                  <p className="text-xs text-gray-500">Select which work orders this grace rule applies to.</p>
                  <div className="space-y-2">
                    {[
                      { value: 'ALL_WORK_ORDERS', label: 'Apply to all Work Orders', desc: 'The selected grace method applies to all calendar-based WOs' },
                      { value: 'LAST_WEEK_OF_MONTH', label: 'Apply only to WOs due in last week of month', desc: 'The grace method applies only to WOs due in the last 7 days of the month' },
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
                      <Label className="text-sm font-medium text-amber-900">Fallback for WOs not due in last week of month</Label>
                      <p className="text-xs text-amber-700 mt-0.5 mb-2">
                        This covers all remaining work orders that fall outside the last week.
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

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Gauge className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Running Hours Based Jobs</h3>
              </div>

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

              <div className="border-t pt-3">
                <Label className="text-sm font-semibold text-gray-700">Grace Period</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={companyGraceForm.rhGraceHours}
                    onChange={(e) => setCompanyGraceForm({...companyGraceForm, rhGraceHours: parseInt(e.target.value) || 0})}
                    className="w-24"
                    data-testid="input-company-rh-grace"
                  />
                  <span className="text-sm text-gray-500">hours after due</span>
                  <span className="text-xs text-gray-400">(≈ {Math.round(companyGraceForm.rhGraceHours / 24)} days)</span>
                </div>
              </div>
            </div>
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
