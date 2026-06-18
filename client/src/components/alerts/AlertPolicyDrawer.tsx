import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, Eye } from 'lucide-react';

interface AlertPolicy {
  id: number;
  alertType: string;
  enabled: boolean;
  priority: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  thresholds: string;
  scopeFilters: string;
  recipients: string;
}

interface AlertPolicyDrawerProps {
  policy: AlertPolicy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (policy: AlertPolicy) => void;
}

const alertTypeLabels: Record<string, string> = {
  maintenance_due: 'Maintenance Due',
  critical_inventory: 'Critical Inventory',
  running_hours: 'Running Hours Threshold',
  certificate_expiration: 'Certificate Expiring',
  certificate_expired: 'Certificate Expired',
  survey_due_soon: 'Survey Due Soon',
  survey_window_closing: 'Survey Window Closing',
  survey_overdue: 'Survey Overdue',
  defect_overdue: 'Defect Overdue',
  defect_coc: 'COC / Class Defect',
  system_backup: 'System Backup'
};

const roleOptions = [
  'Chief Engineer',
  '2nd Engineer',
  '3rd Engineer',
  'Tech Superintendent',
  'Office',
  'Captain',
  'Chief Officer'
];

const certificateTypes = [
  'Class Certificates',
  'Flag',
  'Insurance',
  'Survey',
  'ISM',
  'ISPS',
  'MLC'
];

const componentCategories = [
  'Ship General',
  'Hull',
  'Equipment for Cargo',
  'Ship\'s Equipment',
  'Equipment for Crew & Passengers',
  'Machinery Main Components',
  'Systems for Machinery Main Components',
  'Ship Common Systems'
];

export default function AlertPolicyDrawer({
  policy,
  open,
  onOpenChange,
  onSave
}: AlertPolicyDrawerProps) {
  const { toast } = useToast();
  const [localPolicy, setLocalPolicy] = useState<AlertPolicy>(policy);
  const [thresholds, setThresholds] = useState<any>({});
  const [scopeFilters, setScopeFilters] = useState<any>({});
  const [recipients, setRecipients] = useState<any>({ roles: [], users: [] });

  useEffect(() => {
    setLocalPolicy(policy);
    try {
      setThresholds(JSON.parse(policy.thresholds || '{}'));
      setScopeFilters(JSON.parse(policy.scopeFilters || '{}'));
      setRecipients(JSON.parse(policy.recipients || '{"roles":[],"users":[]}'));
    } catch (e) {
      console.error('Error parsing policy data:', e);
    }
  }, [policy]);

  const handleSave = () => {
    const updatedPolicy = {
      ...localPolicy,
      thresholds: JSON.stringify(thresholds),
      scopeFilters: JSON.stringify(scopeFilters),
      recipients: JSON.stringify(recipients)
    };
    onSave(updatedPolicy);
  };

  const handleSendTest = async () => {
    try {
      const response = await fetch('/technical/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: policy.id,
          userId: 'user1'
        })
      });
      
      if (!response.ok) throw new Error('Failed to send test alert');
      
      toast({
        title: 'Test Alert Sent',
        description: 'A test alert has been sent to your configured channels.'
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Failed to send test alert. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const renderThresholdFields = () => {
    switch (policy.alertType) {
      case 'maintenance_due':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="days-before">Days Before Due</Label>
              <Input
                id="days-before"
                type="number"
                value={thresholds.daysBeforeDue || 7}
                onChange={(e) => setThresholds({ ...thresholds, daysBeforeDue: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pending-approval"
                checked={thresholds.includePendingApproval || false}
                onCheckedChange={(checked) => 
                  setThresholds({ ...thresholds, includePendingApproval: checked })
                }
              />
              <Label htmlFor="pending-approval">Include Pending Approval</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="only-critical"
                checked={thresholds.onlyCritical || false}
                onCheckedChange={(checked) => 
                  setThresholds({ ...thresholds, onlyCritical: checked })
                }
              />
              <Label htmlFor="only-critical">Only Critical Items</Label>
            </div>
          </>
        );
      
      case 'running_hours':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="hours-before">Hours Before Service</Label>
              <Input
                id="hours-before"
                type="number"
                value={thresholds.hoursBeforeService || 100}
                onChange={(e) => setThresholds({ ...thresholds, hoursBeforeService: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utilization-spike">Utilization Spike % (Optional)</Label>
              <Input
                id="utilization-spike"
                type="number"
                value={thresholds.utilizationSpikePercent || ''}
                onChange={(e) => setThresholds({ ...thresholds, utilizationSpikePercent: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Leave empty to disable"
              />
            </div>
          </>
        );
      
      case 'critical_inventory':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="buffer-qty">Buffer Quantity</Label>
              <Input
                id="buffer-qty"
                type="number"
                value={thresholds.bufferQty || 0}
                onChange={(e) => setThresholds({ ...thresholds, bufferQty: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-non-critical"
                checked={thresholds.includeNonCritical || false}
                onCheckedChange={(checked) => 
                  setThresholds({ ...thresholds, includeNonCritical: checked })
                }
              />
              <Label htmlFor="include-non-critical">Include Non-Critical Items</Label>
            </div>
          </>
        );
      
      case 'certificate_expiration':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="days-expiry">Days Before Expiry</Label>
              <Input
                id="days-expiry"
                type="number"
                value={thresholds.daysBeforeExpiry || 30}
                onChange={(e) => setThresholds({ ...thresholds, daysBeforeExpiry: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Certificate Types</Label>
              <div className="space-y-2">
                {certificateTypes.map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cert-${type}`}
                      checked={(thresholds.types || []).includes(type)}
                      onCheckedChange={(checked) => {
                        const types = thresholds.types || [];
                        if (checked) {
                          setThresholds({ ...thresholds, types: [...types, type] });
                        } else {
                          setThresholds({ ...thresholds, types: types.filter((t: string) => t !== type) });
                        }
                      }}
                    />
                    <Label htmlFor={`cert-${type}`}>{type}</Label>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'survey_due_soon':
      case 'survey_window_closing':
        return (
          <div className="space-y-2">
            <Label htmlFor="lead-days">Lead Days (alert before due/window close)</Label>
            <Input
              id="lead-days"
              type="number"
              value={thresholds.leadDays || 30}
              onChange={(e) => setThresholds({ ...thresholds, leadDays: parseInt(e.target.value) })}
            />
          </div>
        );

      case 'certificate_expired':
      case 'survey_overdue':
      case 'defect_overdue':
      case 'defect_coc':
        return (
          <p className="text-sm text-muted-foreground">
            This alert has no configurable thresholds. It fires once per item as soon as the
            condition is met.
          </p>
        );

      case 'system_backup':
        return (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="daily-success"
                checked={thresholds.requireDailySuccess || true}
                onCheckedChange={(checked) => 
                  setThresholds({ ...thresholds, requireDailySuccess: checked })
                }
              />
              <Label htmlFor="daily-success">Require Daily Success</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-age">Max Age (Hours)</Label>
              <Input
                id="max-age"
                type="number"
                value={thresholds.maxAgeHours || 26}
                onChange={(e) => setThresholds({ ...thresholds, maxAgeHours: parseInt(e.target.value) })}
              />
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{alertTypeLabels[policy.alertType] || policy.alertType}</SheetTitle>
          <SheetDescription>
            Configure alert settings, thresholds, and recipients
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={localPolicy.enabled}
                onCheckedChange={(checked) => 
                  setLocalPolicy({ ...localPolicy, enabled: checked })
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={localPolicy.priority || 'medium'}
                onValueChange={(value) => setLocalPolicy({ ...localPolicy, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              <Label>Channels</Label>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-channel">Email</Label>
                <Switch
                  id="email-channel"
                  checked={localPolicy.emailEnabled}
                  onCheckedChange={(checked) => 
                    setLocalPolicy({ ...localPolicy, emailEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="app-channel">In-App</Label>
                <Switch
                  id="app-channel"
                  checked={localPolicy.inAppEnabled}
                  onCheckedChange={(checked) => 
                    setLocalPolicy({ ...localPolicy, inAppEnabled: checked })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="thresholds" className="space-y-4">
            {renderThresholdFields()}
          </TabsContent>

          <TabsContent value="scope" className="space-y-4">
            {(policy.alertType === 'maintenance_due' || policy.alertType === 'running_hours') && (
              <div className="space-y-2">
                <Label>Component Categories</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {componentCategories.map(category => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={(scopeFilters.categories || []).includes(category)}
                        onCheckedChange={(checked) => {
                          const categories = scopeFilters.categories || [];
                          if (checked) {
                            setScopeFilters({ ...scopeFilters, categories: [...categories, category] });
                          } else {
                            setScopeFilters({ ...scopeFilters, categories: categories.filter((c: string) => c !== category) });
                          }
                        }}
                      />
                      <Label htmlFor={`cat-${category}`}>{category}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600">Leave unchecked to include all categories</p>
              </div>
            )}
            
            {policy.alertType === 'critical_inventory' && (
              <div className="space-y-2">
                <Label htmlFor="location">Location Filter (Optional)</Label>
                <Input
                  id="location"
                  value={scopeFilters.location || ''}
                  onChange={(e) => setScopeFilters({ ...scopeFilters, location: e.target.value })}
                  placeholder="e.g., Engine Room"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="recipients" className="space-y-4">
            <div className="space-y-2">
              <Label>Roles/Ranks</Label>
              <div className="space-y-2">
                {roleOptions.map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={(recipients.roles || []).includes(role)}
                      onCheckedChange={(checked) => {
                        const roles = recipients.roles || [];
                        if (checked) {
                          setRecipients({ ...recipients, roles: [...roles, role] });
                        } else {
                          setRecipients({ ...recipients, roles: roles.filter((r: string) => r !== role) });
                        }
                      }}
                    />
                    <Label htmlFor={`role-${role}`}>{role}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="specific-users">Specific Users (comma-separated)</Label>
              <Input
                id="specific-users"
                value={(recipients.users || []).join(', ')}
                onChange={(e) => {
                  const users = e.target.value.split(',').map(u => u.trim()).filter(u => u);
                  setRecipients({ ...recipients, users });
                }}
                placeholder="e.g., john.doe, jane.smith"
              />
            </div>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Preview & Test</CardTitle>
            <CardDescription>Preview the alert message and send a test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium mb-2">Sample Alert Message:</p>
              <p className="text-sm text-gray-600">
                {policy.alertType === 'maintenance_due' && 
                  `Maintenance is due in ${thresholds.daysBeforeDue || 7} days for Main Engine. Please schedule the maintenance task.`}
                {policy.alertType === 'critical_inventory' && 
                  `Critical inventory alert: Spare part "Filter Element" is below minimum stock level. Current: 2, Minimum: 5.`}
                {policy.alertType === 'running_hours' && 
                  `Component "Main Engine" is approaching service threshold. Current hours: 12,480, Service due at: 12,500.`}
                {policy.alertType === 'certificate_expiration' && 
                  `Certificate "Class Certificate" is expiring in ${thresholds.daysBeforeExpiry || 30} days. Please arrange renewal.`}
                {policy.alertType === 'system_backup' && 
                  `System backup completed successfully. Last backup: 2 hours ago.`}
              </p>
            </div>
            
            <Button 
              onClick={handleSendTest} 
              variant="outline" 
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              Send Test Alert to Me
            </Button>
          </CardContent>
        </Card>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}