import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Filter, CheckCircle, AlertCircle, Clock, Mail, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AlertEvent {
  id: number;
  policyId: number;
  alertType: string;
  priority: string;
  objectType: string;
  objectId: string;
  vesselId: string;
  dedupeKey: string;
  state: string;
  payload: string;
  ackBy?: string;
  ackAt?: Date;
  createdAt: Date;
}

interface AlertDelivery {
  id: number;
  eventId: number;
  channel: string;
  recipient: string;
  status: string;
  errorMessage?: string;
  sentAt?: Date;
  acknowledgedAt?: Date;
}

const alertTypeLabels: Record<string, string> = {
  maintenance_due: 'Maintenance Due',
  critical_inventory: 'Critical Inventory',
  running_hours: 'Running Hours',
  certificate_expiration: 'Certificate Expiry',
  system_backup: 'System Backup'
};

export default function AlertHistory() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    alertType: 'all',
    priority: 'all',
    status: ''
  });
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  // Fetch alert events
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['/technical/api/alerts/events', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.alertType && filters.alertType !== 'all') params.append('alertType', filters.alertType);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      
      const response = await fetch(`/technical/api/alerts/events?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  const handleAcknowledge = async (eventId: number) => {
    try {
      const response = await fetch(`/technical/api/alerts/events/${eventId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user1' })
      });
      
      if (!response.ok) throw new Error('Failed to acknowledge event');
      
      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged successfully.'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Acknowledgment Failed',
        description: 'Failed to acknowledge the alert. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive'
    };
    
    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (event: AlertEvent) => {
    if (event.ackAt) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (event.priority === 'high') {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter alert history by date, type, and priority</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alert-type">Alert Type</Label>
              <Select
                value={filters.alertType}
                onValueChange={(value) => handleFilterChange('alertType', value)}
              >
                <SelectTrigger id="alert-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="maintenance_due">Maintenance Due</SelectItem>
                  <SelectItem value="critical_inventory">Critical Inventory</SelectItem>
                  <SelectItem value="running_hours">Running Hours</SelectItem>
                  <SelectItem value="certificate_expiration">Certificate Expiry</SelectItem>
                  <SelectItem value="system_backup">System Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={filters.priority}
                onValueChange={(value) => handleFilterChange('priority', value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => refetch()} 
                className="w-full"
              >
                <Filter className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unacknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {events?.filter((e: AlertEvent) => !e.ackAt).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {events?.filter((e: AlertEvent) => e.priority === 'high').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {events?.filter((e: AlertEvent) => e.ackAt).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>View and manage historical alerts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading alert history...</div>
          ) : events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event: AlertEvent) => {
                    const payload = JSON.parse(event.payload || '{}');
                    const isExpanded = expandedEvent === event.id;
                    
                    return (
                      <React.Fragment key={event.id}>
                        <TableRow 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        >
                          <TableCell>{getStatusIcon(event)}</TableCell>
                          <TableCell>
                            {format(new Date(event.createdAt), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            {alertTypeLabels[event.alertType] || event.alertType}
                          </TableCell>
                          <TableCell>{getPriorityBadge(event.priority)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {payload.message || 'Alert triggered'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {payload.channels?.includes('email') && 
                                <Mail className="h-4 w-4 text-gray-600" />}
                              {payload.channels?.includes('in_app') && 
                                <Bell className="h-4 w-4 text-gray-600" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            {event.ackAt ? (
                              <span className="text-sm text-green-600">
                                Ack by {event.ackBy}
                              </span>
                            ) : (
                              <span className="text-sm text-orange-600">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!event.ackAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledge(event.id);
                                }}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-gray-50">
                              <div className="p-4 space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Object Type:</span> {event.objectType}
                                  </div>
                                  <div>
                                    <span className="font-medium">Object ID:</span> {event.objectId}
                                  </div>
                                  <div>
                                    <span className="font-medium">Vessel:</span> {event.vesselId}
                                  </div>
                                  <div>
                                    <span className="font-medium">State:</span> {event.state}
                                  </div>
                                </div>
                                {payload.details && (
                                  <div className="mt-2">
                                    <span className="font-medium text-sm">Additional Details:</span>
                                    <pre className="mt-1 p-2 bg-white rounded text-xs">
                                      {JSON.stringify(payload.details, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No alerts found for the selected filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}