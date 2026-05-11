import React, { useState, useRef, useEffect } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface AlertEvent {
  id: number;
  aeuuid: string;
  alertType: string;
  priority: string;
  objectType: string | null;
  objectId: string | null;
  vesselId: string | null;
  state: string | null;
  payload: string;
  ackBy: string | null;
  createdAt: string;
}

const priorityColors: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  high: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  medium: { dot: 'bg-orange-400', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  low: { dot: 'bg-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
};

const alertTypeLabels: Record<string, string> = {
  critical_job_overdue: 'Job Overdue',
  low_critical_spares: 'Low Spares',
  critical_job_cycle_skipped: 'Cycle Skipped',
  sync_conflict_detected: 'Sync Conflict',
};

function getHighestPriority(events: AlertEvent[]): string {
  if (events.some(e => e.priority === 'high')) return 'high';
  if (events.some(e => e.priority === 'medium')) return 'medium';
  return 'low';
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const NotificationBell: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const role = currentUser?.role || 'Office';
  const vesselId = currentUser?.vesselId || '';

  const { data: events = [] } = useQuery<AlertEvent[]>({
    queryKey: ['/technical/api/alerts/events/for-current-user', role, vesselId],
    queryFn: async () => {
      const params = new URLSearchParams({ role });
      if (vesselId) params.set('vesselId', vesselId);
      const response = await fetch(`/technical/api/alerts/events/for-current-user?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 60000, // Poll every minute
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ eventId, comments }: { eventId: string; comments?: string }) => {
      const response = await fetch(`/technical/api/alerts/events/${eventId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.userUuid || 'user1',
          userRole: role,
          comments: comments || 'Acknowledged from notification bell',
        }),
      });
      if (!response.ok) throw new Error('Failed to acknowledge');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/alerts/events/for-current-user'] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unackCount = events.length;
  const highestPriority = unackCount > 0 ? getHighestPriority(events) : 'low';
  const badgeColor = highestPriority === 'high' ? 'bg-red-500' : highestPriority === 'medium' ? 'bg-orange-400' : 'bg-gray-400';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-gray-200 transition-colors"
        aria-label={`Notifications (${unackCount} unread)`}
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unackCount > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold px-1',
            badgeColor
          )}>
            {unackCount > 99 ? '99+' : unackCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] max-h-[480px] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-800">Notifications</h3>
            {unackCount > 0 && (
              <span className="text-xs text-gray-500">{unackCount} unread</span>
            )}
          </div>

          {/* Event List */}
          <div className="overflow-y-auto max-h-[400px]">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No new notifications
              </div>
            ) : (
              events.slice(0, 50).map(event => {
                const colors = priorityColors[event.priority] || priorityColors.low;
                let payload: Record<string, any> = {};
                try { payload = JSON.parse(event.payload || '{}'); } catch {}
                const message = payload.alertMessage || `${alertTypeLabels[event.alertType] || event.alertType} alert`;
                const requiresCoAck = payload.requiresCoAck === true;
                const deepLink = payload.link || null;

                return (
                  <div
                    key={event.aeuuid}
                    className={cn(
                      'px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                      deepLink && 'cursor-pointer',
                      colors.bg
                    )}
                    onClick={() => {
                      if (deepLink) {
                        // Acknowledge + navigate
                        acknowledgeMutation.mutate({ eventId: event.aeuuid });
                        setIsOpen(false);
                        setLocation(deepLink);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority dot */}
                      <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', colors.dot)} />

                      <div className="flex-1 min-w-0">
                        {/* Type + Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-xs font-semibold uppercase tracking-wide', colors.text)}>
                            {alertTypeLabels[event.alertType] || event.alertType}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTimeAgo(event.createdAt)}
                          </span>
                        </div>

                        {/* Message */}
                        <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{message}</p>

                        {/* Deep link indicator */}
                        {deepLink && (
                          <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            <ExternalLink className="h-2.5 w-2.5" /> View details
                          </span>
                        )}

                        {/* Co-ack badge */}
                        {requiresCoAck && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            Co-Ack Required
                          </span>
                        )}

                        {/* Acknowledge button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            acknowledgeMutation.mutate({ eventId: event.aeuuid });
                          }}
                          disabled={acknowledgeMutation.isPending}
                          className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
