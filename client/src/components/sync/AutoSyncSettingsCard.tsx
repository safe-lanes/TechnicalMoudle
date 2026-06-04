import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * AutoSyncSettingsCard — ship-side controls for the auto-sync scheduler.
 *
 * The auto-sync scheduler runs ONLY on the ship instance (gated by
 * isShipInstance in routes.ts), so these controls belong on the ship's
 * SyncDashboard — not the shore-only Fleet Overview page. Saving here writes
 * the ship's own sync_settings and the save endpoint live-restarts the
 * scheduler (restartWithNewInterval) on this ship instance.
 *
 * Manages exactly two keys: auto_sync_enabled, sync_interval_minutes.
 */

interface SettingRow {
  settingKey: string;
  settingValue: string | null;
}

export default function AutoSyncSettingsCard() {
  const { toast } = useToast();

  const { data, refetch } = useQuery<{ settings: SettingRow[] }>({
    queryKey: ["/technical/api/sync/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/technical/api/sync/settings");
      return res.json();
    },
  });

  const settings = data?.settings ?? [];
  const dbEnabled =
    settings.find((s) => s.settingKey === "auto_sync_enabled")?.settingValue === "true";
  const dbInterval =
    settings.find((s) => s.settingKey === "sync_interval_minutes")?.settingValue ?? "";

  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState("");
  const [touched, setTouched] = useState(false);

  // Hydrate local state from DB once loaded (and on refetch), unless the user
  // has unsaved edits in progress.
  useEffect(() => {
    if (!touched) {
      setEnabled(dbEnabled);
      setIntervalMinutes(dbInterval);
    }
  }, [dbEnabled, dbInterval, touched]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await apiRequest("PUT", "/technical/api/sync/settings", {
        settings: payload,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auto-sync settings updated" });
      setTouched(false);
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    },
  });

  const intervalNum = Number(intervalMinutes);
  const intervalValid = Number.isInteger(intervalNum) && intervalNum > 0;
  const dirty = enabled !== dbEnabled || intervalMinutes !== dbInterval;

  const handleSave = () => {
    if (!intervalValid) {
      toast({
        title: "Invalid interval",
        description: "Enter a positive whole number of minutes.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      auto_sync_enabled: enabled ? "true" : "false",
      sync_interval_minutes: String(intervalNum),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border rounded-md p-3">
        <div>
          <Label>Auto-Sync</Label>
          <p className="text-xs text-gray-400">Enable automatic scheduled sync</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            setTouched(true);
          }}
          data-testid="switch-auto-sync"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Sync Interval (minutes)</Label>
        <Input
          type="number"
          min={1}
          step={1}
          value={intervalMinutes}
          onChange={(e) => {
            setIntervalMinutes(e.target.value);
            setTouched(true);
          }}
          className="h-8 max-w-[160px]"
          data-testid="input-sync-interval"
        />
        <p className="text-[11px] leading-tight text-gray-400">
          How often auto-sync runs. Lower values use more VSAT bandwidth.
          Changes take effect immediately.
        </p>
        {!intervalValid && intervalMinutes !== "" && (
          <p className="text-[11px] text-red-500">Enter a positive whole number.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || !intervalValid || mutation.isPending}
          data-testid="btn-save-auto-sync"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
