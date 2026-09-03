import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Bell, Mail, AlertCircle, Clock, Package, Shield, HardDrive } from 'lucide-react';
import AlertPolicyDrawer from '@/components/alerts/AlertPolicyDrawer';
import AlertHistory from '@/components/alerts/AlertHistory';
import { useVessel } from '@/contexts/VesselContext';

interface AlertPolicy {
  id: number;
  apuuid?: string;
  alertType: string;
  enabled: boolean;
  priority: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  thresholds: string;
  scopeFilters: string;
  recipients: string;
}

interface AlertConfig {
  vesselId: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  escalationEnabled: boolean;
  escalationHours: number;
  escalationRecipients: string;
}

const alertTypeInfo: Record<string, { label: string; description: string; icon: any; color: string }> = {
  critical_job_overdue: {
    label: 'Critical Job Overdue',
    description: 'Alerts when critical/high priority jobs become overdue',
    icon: Clock,
    color: 'text-red-600'
  },
  low_critical_spares: {
    label: 'Low Critical Spares',
    description: 'Alerts when critical spare stock falls below minimum',
    icon: Package,
    color: 'text-orange-600'
  },
  critical_job_cycle_skipped: {
    label: 'Cycle Skipped',
    description: 'Alerts for critical jobs with skipped maintenance cycles (co-ack required)',
    icon: AlertCircle,
    color: 'text-red-600'
  },
  maintenance_due: {
    label: 'Maintenance Due',
    description: 'Alerts for upcoming maintenance tasks',
    icon: Clock,
    color: 'text-blue-600'
  },
  critical_inventory: {
    label: 'Critical Inventory',
    description: 'Alerts for low stock on critical items',
    icon: Package,
    color: 'text-red-600'
  },
  running_hours: {
    label: 'Running Hours Threshold',
    description: 'Alerts when components reach RH thresholds',
    icon: AlertCircle,
    color: 'text-orange-600'
  },
  certificate_expiration: {
    label: 'Certificate Expiring',
    description: 'Alerts when certificates approach their expiry date (90/30 days)',
    icon: Shield,
    color: 'text-purple-600'
  },
  certificate_expired: {
    label: 'Certificate Expired',
    description: 'Alerts when a certificate has passed its expiry date',
    icon: Shield,
    color: 'text-red-600'
  },
  survey_due_soon: {
    label: 'Survey Due Soon',
    description: 'Alerts when a survey approaches its due date',
    icon: Shield,
    color: 'text-blue-600'
  },
  survey_window_closing: {
    label: 'Survey Window Closing',
    description: 'Alerts when a survey window end date approaches',
    icon: Shield,
    color: 'text-orange-600'
  },
  survey_overdue: {
    label: 'Survey Overdue',
    description: 'Alerts when a survey has passed its due/window date',
    icon: Shield,
    color: 'text-red-600'
  },
  defect_overdue: {
    label: 'Defect Overdue',
    description: 'Alerts when an active defect passes its target close date',
    icon: AlertCircle,
    color: 'text-red-600'
  },
  defect_coc: {
    label: 'COC / Class Defect',
    description: 'Alerts when a Condition-of-Class / Class defect is raised',
    icon: AlertCircle,
    color: 'text-red-600'
  },
  system_backup: {
    label: 'System Backup',
    description: 'Alerts for backup status and failures',
    icon: HardDrive,
    color: 'text-gray-600'
  }
};

const priorityBadgeColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

// MODULE-LEVEL draft cache (bug fix 04-Sep-2026, part 2): the Admin tabs UNMOUNT this
// screen on every tab switch, so component state alone cannot protect an unsaved draft —
// exactly the wipe the bug report described. Unsaved edits are mirrored here and restored
// on remount; cleared on successful save or explicit discard. Session-scoped by design.
const policyDraft: { policies: AlertPolicy[] | null; dirty: boolean } = { policies: null, dirty: false };
const configDraft: { config: AlertConfig | null; vesselId: string | null; dirty: boolean } = { config: null, vesselId: null, dirty: false };

export default function Alerts() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canEditAlerts = canEdit('admin-alerts');
  // No 'V001' phantom default (bug fix 04-Sep-2026): '' = no vessel selected. The
  // context can also hold 'all'/'my' for admins — the per-vessel config section only
  // operates on a SPECIFIC vessel (alert_config is keyed by vessel_id).
  const { vesselId: selectedVesselId = '', vessels } = useVessel();
  const vesselSpecific = !!selectedVesselId && selectedVesselId !== 'all' && selectedVesselId !== 'my';
  const selectedVesselName = vessels.find((v: any) => v.id === selectedVesselId)?.name ?? selectedVesselId;
  const [selectedPolicy, setSelectedPolicy] = useState<AlertPolicy | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // DIRTY DRAFTS (bug fix 04-Sep-2026): localPolicies/localConfig are the user's unsaved
  // DRAFT. The old code re-seeded them from the server inside every queryFn — any refetch
  // OR a tab switch (which unmounts this screen) silently WIPED unsaved toggles, so Save
  // then wrote the original values back: green toast, nothing changed. Drafts now survive
  // both: refetches via the dirty flag, unmounts via the module-level draft cache.
  const [localPolicies, setLocalPoliciesState] = useState<AlertPolicy[]>(() => policyDraft.dirty && policyDraft.policies ? policyDraft.policies : []);
  const [policiesDirty, setPoliciesDirtyState] = useState(() => policyDraft.dirty);
  const [localConfig, setLocalConfigState] = useState<AlertConfig | null>(() =>
    configDraft.dirty && configDraft.config ? configDraft.config : null);
  const [configDirty, setConfigDirtyState] = useState(() => configDraft.dirty);
  const setLocalPolicies: typeof setLocalPoliciesState = (v) => {
    setLocalPoliciesState((prev) => {
      const next = typeof v === 'function' ? (v as (p: AlertPolicy[]) => AlertPolicy[])(prev) : v;
      policyDraft.policies = next;
      return next;
    });
  };
  const setPoliciesDirty = (d: boolean) => { policyDraft.dirty = d; if (!d) policyDraft.policies = null; setPoliciesDirtyState(d); };
  const setLocalConfig: typeof setLocalConfigState = (v) => {
    setLocalConfigState((prev) => {
      const next = typeof v === 'function' ? (v as (p: AlertConfig | null) => AlertConfig | null)(prev) : v;
      configDraft.config = next;
      return next;
    });
  };
  const setConfigDirty = (d: boolean) => {
    configDraft.dirty = d;
    if (d) configDraft.vesselId = selectedVesselId; // remember WHICH vessel the draft belongs to
    else { configDraft.config = null; configDraft.vesselId = null; }
    setConfigDirtyState(d);
  };

  // Fetch alert policies (no draft-wiping side effect in the queryFn)
  const { data: policies, isLoading: policiesLoading } = useQuery<AlertPolicy[]>({
    queryKey: ['/technical/api/alerts/policies'],
    queryFn: async () => {
      const response = await fetch('/technical/api/alerts/policies');
      if (!response.ok) throw new Error('Failed to fetch policies');
      return response.json();
    }
  });
  React.useEffect(() => {
    if (policies && !policiesDirty) setLocalPolicies(policies);
  }, [policies, policiesDirty]);

  // Fetch alert configuration — only for a SPECIFIC vessel. An empty id used to build
  // GET /alerts/config/ (trailing slash) → 404 noise in the console; 'all'/'my' have no
  // per-vessel config row to edit.
  const { data: config, isLoading: configLoading } = useQuery<AlertConfig>({
    queryKey: ['/technical/api/alerts/config', selectedVesselId],
    enabled: vesselSpecific,
    queryFn: async () => {
      const response = await fetch(`/technical/api/alerts/config/${selectedVesselId}`);
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    }
  });
  React.useEffect(() => {
    if (config && !configDirty) setLocalConfig(config);
  }, [config, configDirty]);
  React.useEffect(() => {
    // Vessel switched: a draft belongs to the vessel it was loaded for — discard it so a
    // save can never land under a different vessel than the screen shows. (Guarded so a
    // REMOUNT with an intact same-vessel draft does not wipe it — that was the tab-switch
    // bug all over again.)
    if (configDraft.dirty && configDraft.vesselId !== selectedVesselId) {
      setLocalConfig(null); setConfigDirty(false);
    } else if (!configDraft.dirty) {
      setLocalConfigState(null); // clean slate while the new vessel's config loads
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVesselId]);

  // The fields a user can edit on this screen (toggles + drawer) — the change diff and
  // the post-save verification both key on exactly these.
  const EDITABLE_POLICY_FIELDS: (keyof AlertPolicy)[] = ['enabled', 'emailEnabled', 'inAppEnabled', 'priority', 'thresholds', 'scopeFilters', 'recipients'];
  const policyDiffers = (a: AlertPolicy, b: AlertPolicy) =>
    EDITABLE_POLICY_FIELDS.some((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));

  // Batch update policies mutation — sends ONLY changed policies; verifies the server's
  // echo actually contains the requested values (item 4: a mismatch is said plainly).
  const updatePoliciesMutation = useMutation({
    mutationFn: async (changed: AlertPolicy[]) => {
      const response = await fetch('/technical/api/alerts/policies/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: changed })
      });
      if (!response.ok) throw new Error(`Failed to update policies (HTTP ${response.status})`);
      return response.json() as Promise<{ success: boolean; policies: AlertPolicy[] }>;
    },
    onSuccess: (data, submitted) => {
      const echoed = new Map((data.policies ?? []).map((p) => [p.apuuid, p]));
      const mismatched = submitted.filter((s) => {
        const e = s.apuuid ? echoed.get(s.apuuid) : undefined;
        return !e || policyDiffers(s, e);
      });
      if (mismatched.length > 0) {
        toast({
          title: 'Save verification failed',
          description: `The server did not confirm the requested values for: ${mismatched.map((m) => m.alertType).join(', ')}. Please reload and check the switches.`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Alert switches saved',
          description: `${submitted.length} alert ${submitted.length === 1 ? 'switch' : 'switches'} updated and confirmed by the server.`
        });
      }
      setPoliciesDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/alerts/policies'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update alert policies. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: AlertConfig) => {
      const response = await fetch('/technical/api/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error('Failed to update config');
      return response.json();
    },
    onSuccess: () => {
      setConfigDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/alerts/config', selectedVesselId] });
      toast({
        title: 'Configuration Saved',
        description: `Alert configuration updated for ${selectedVesselName}.`
      });
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update alert configuration. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handlePolicyToggle = (policyId: number, field: 'enabled' | 'emailEnabled' | 'inAppEnabled', value: boolean) => {
    setLocalPolicies(prev => prev.map(p =>
      p.id === policyId ? { ...p, [field]: value } : p
    ));
    setPoliciesDirty(true);
  };

  const handlePriorityChange = (policyId: number, priority: string) => {
    setLocalPolicies(prev => prev.map(p =>
      p.id === policyId ? { ...p, priority } : p
    ));
    setPoliciesDirty(true);
  };

  const handleSaveConfiguration = () => {
    // Diff against the SERVER copy — only real changes are sent. A save that would
    // write nothing is a distinct, visible state, never a green success (item 2).
    const serverByUuid = new Map((policies ?? []).map((p) => [p.apuuid, p]));
    const changed = localPolicies.filter((lp) => {
      const sp = lp.apuuid ? serverByUuid.get(lp.apuuid) : undefined;
      return !sp || policyDiffers(lp, sp);
    });
    if (changed.length === 0) {
      toast({
        title: 'No changes to save',
        description: 'The alert switches already match what is saved. Flip a switch first, then save.'
      });
      return;
    }
    updatePoliciesMutation.mutate(changed);
  };

  const handlePolicyClick = (policy: AlertPolicy) => {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  };

  const handlePolicyUpdate = (updatedPolicy: AlertPolicy) => {
    setLocalPolicies(prev => prev.map(p =>
      p.id === updatedPolicy.id ? updatedPolicy : p
    ));
    setPoliciesDirty(true);
    setDrawerOpen(false);
  };

  const handleConfigUpdate = () => {
    if (!vesselSpecific) {
      toast({ title: 'Select a specific vessel', description: 'Alert configuration is saved per vessel — pick one vessel first.', variant: 'destructive' });
      return;
    }
    if (!localConfig) {
      toast({ title: 'Configuration not loaded', description: 'The vessel configuration has not loaded yet — try again in a moment.', variant: 'destructive' });
      return;
    }
    // Pin the save to the vessel the draft was LOADED for — a context change between
    // load and save must refuse, never save under a different vessel.
    if (localConfig.vesselId && localConfig.vesselId !== selectedVesselId) {
      toast({ title: 'Vessel changed since loading', description: 'The selected vessel changed while editing — the draft was discarded. Re-check the values and save again.', variant: 'destructive' });
      setLocalConfig(null); setConfigDirty(false);
      return;
    }
    updateConfigMutation.mutate({ ...localConfig, vesselId: selectedVesselId });
  };

  if (policiesLoading || (vesselSpecific && configLoading)) {
    return <div className="p-6">Loading alert configuration...</div>;
  }


  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b">
          <h1 className="text-2xl font-semibold">Alert Configuration</h1>
          <p className="text-sm text-gray-600 mt-1">Configure alert policies and notification preferences</p>
        </div>

        <Tabs defaultValue="policies" className="w-full">
          <TabsList className="w-full justify-start px-6 py-0 h-12 bg-transparent border-b">
            <TabsTrigger value="policies" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Policies
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="p-6 space-y-6">
            {/* Policies Table */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Policies</CardTitle>
                <CardDescription>Configure which alerts are enabled and how they are delivered</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Alert Type</th>
                        <th className="text-left py-3 px-4">Description</th>
                        <th className="text-center py-3 px-4">Enabled</th>
                        <th className="text-center py-3 px-4">Email</th>
                        <th className="text-center py-3 px-4">In-App</th>
                        <th className="text-center py-3 px-4">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localPolicies.map(policy => {
                        const info = alertTypeInfo[policy.alertType as keyof typeof alertTypeInfo];
                        const Icon = info?.icon || Bell;
                        
                        return (
                          <tr key={policy.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handlePolicyClick(policy)}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Icon className={`h-4 w-4 ${info?.color}`} />
                                {info?.label || policy.alertType}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {info?.description}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Switch
                                checked={policy.enabled}
                                onCheckedChange={(checked) => handlePolicyToggle(policy.id, 'enabled', checked)}
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Switch
                                checked={policy.emailEnabled}
                                onCheckedChange={(checked) => handlePolicyToggle(policy.id, 'emailEnabled', checked)}
                                disabled={!policy.enabled}
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Switch
                                checked={policy.inAppEnabled}
                                onCheckedChange={(checked) => handlePolicyToggle(policy.id, 'inAppEnabled', checked)}
                                disabled={!policy.enabled}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityBadgeColors[policy.priority] || priorityBadgeColors.medium}`}>
                                  {(policy.priority || 'medium').charAt(0).toUpperCase() + (policy.priority || 'medium').slice(1)}
                                </span>
                                <Select
                                  value={policy.priority || 'medium'}
                                  onValueChange={(value) => handlePriorityChange(policy.id, value)}
                                  disabled={!policy.enabled}
                                >
                                  <SelectTrigger className="w-24 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex justify-end">
                  {canEditAlerts && (
                    <Button 
                      onClick={handleSaveConfiguration}
                      disabled={updatePoliciesMutation.isPending}
                    >
                      {updatePoliciesMutation.isPending ? 'Saving...' : 'Save Alert Configuration'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quiet Hours & Escalation — saved PER VESSEL. The vessel is stated
                explicitly (bug fix 04-Sep-2026): this section used to follow the hidden
                global vessel selection silently, so a save could land under a different
                vessel than the user later read back. */}
            {vesselSpecific ? (
              <p className="text-sm text-gray-600" data-testid="alert-config-vessel-label">
                Vessel configuration for: <span className="font-semibold text-gray-900">{selectedVesselName}</span>
              </p>
            ) : (
              <p className="text-sm text-amber-600" data-testid="alert-config-no-vessel">
                Quiet Hours and Escalation are saved per vessel — select a specific vessel (not "All"/"My") to view and edit them.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quiet Hours</CardTitle>
                  <CardDescription>Configure when non-critical alerts should be held</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                    <Switch
                      id="quiet-hours"
                      checked={localConfig?.quietHoursEnabled || false}
                      onCheckedChange={(checked) => {
                        setLocalConfig(prev => prev ? { ...prev, quietHoursEnabled: checked } : null); setConfigDirty(true);
                      }}
                    />
                  </div>
                  
                  {localConfig?.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quiet-start">Start Time</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={localConfig?.quietHoursStart || '22:00'}
                          onChange={(e) => {
                            setLocalConfig(prev => prev ? { ...prev, quietHoursStart: e.target.value } : null); setConfigDirty(true);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quiet-end">End Time</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={localConfig?.quietHoursEnd || '06:00'}
                          onChange={(e) => {
                            setLocalConfig(prev => prev ? { ...prev, quietHoursEnd: e.target.value } : null); setConfigDirty(true);
                          }}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    During quiet hours, only High priority alerts bypass. Others are queued for daily digest.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Escalation</CardTitle>
                  <CardDescription>Configure alert escalation for unacknowledged high priority alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="escalation">Enable Escalation</Label>
                    <Switch
                      id="escalation"
                      checked={localConfig?.escalationEnabled || false}
                      onCheckedChange={(checked) => {
                        setLocalConfig(prev => prev ? { ...prev, escalationEnabled: checked } : null); setConfigDirty(true);
                      }}
                    />
                  </div>
                  
                  {localConfig?.escalationEnabled && (
                    <div>
                      <Label htmlFor="escalation-hours">Escalate after (hours)</Label>
                      <Input
                        id="escalation-hours"
                        type="number"
                        min={1}
                        max={24}
                        value={localConfig?.escalationHours || 4}
                        onChange={(e) => {
                          setLocalConfig(prev => prev ? { ...prev, escalationHours: parseInt(e.target.value) } : null); setConfigDirty(true);
                        }}
                        className="mt-1 w-24"
                      />
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    If High alerts are not acknowledged within specified hours, escalate to Tech Superintendent & Office via email.
                  </p>
                  
                  <Button
                    onClick={handleConfigUpdate}
                    disabled={updateConfigMutation.isPending || !vesselSpecific || !localConfig}
                    title={!vesselSpecific ? 'Select a specific vessel first — this configuration is saved per vessel.' : undefined}
                    className="w-full"
                  >
                    {updateConfigMutation.isPending ? 'Saving...' : vesselSpecific ? `Save Vessel Configuration (${selectedVesselName})` : 'Select a vessel to save'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="p-6">
            <AlertHistory />
          </TabsContent>
        </Tabs>
      </div>

      {/* Policy Drawer */}
      {selectedPolicy && (
        <AlertPolicyDrawer
          policy={selectedPolicy}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={handlePolicyUpdate}
        />
      )}
    </div>
  );
}