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
import { Clock, Settings, Ship, Save, X, Calendar, Gauge, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import type { PmsVesselSettings } from "@shared/schema";
import { Marker } from "@/components/Marker";

interface Vessel {
  id: string;
  name: string;
  vesselCode?: string;
}

export default function PmsVesselSettingsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    calendarLeadDaysCritical: 7,
    calendarLeadDaysNonCritical: 14,
    calendarGraceMode: 'COMPANY_STANDARD',
    calendarGraceDays: 7,
    rhLeadHoursCritical: 50,
    rhLeadHoursNonCritical: 100,
    rhGraceHours: 168,
  });

  const { data: vessels = [], isLoading: isVesselsLoading } = useVessels();

  const { data: allSettings = [], isLoading: isSettingsLoading } = useQuery<PmsVesselSettings[]>({
    queryKey: ['/technical/api/pms-vessel-settings'],
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

  const handleSave = () => {
    if (!selectedVessel) return;
    saveMutation.mutate({ vesselId: selectedVessel.id, settings: formData });
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

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm mb-2 transition-colors"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          )}
          <div className="flex items-center gap-3 mb-1">
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
          </div>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Company Standard Grace Rule</h3>
                <p className="text-sm text-blue-700 mt-1">
                  When enabled, grace period is calculated as: If due date falls in last 7 days of month, grace = 7 days. 
                  Otherwise, grace extends to end of month.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vessels.map((vessel) => {
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
                  {formData.calendarGraceMode === 'COMPANY_STANDARD' && (
                    <p className="text-xs text-blue-600 mt-1">
                      Due in last 7 days = 7 days grace; otherwise = extends to month end
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
    </div>
  );
}
