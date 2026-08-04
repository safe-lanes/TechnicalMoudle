/**
 * Replace Rotational Item dialog (rotation swap).
 *
 * Lists the vessel's available rotational items (not Installed, not Retired) with
 * their stored Running Hours and RH-last-updated date, or lets the user create a
 * brand-new Stamp inline (starting RH, default 0). On confirm the server performs
 * the swap atomically: outgoing stamp keeps the component's current RH, incoming
 * stamp's stored RH becomes the component's new baseline.
 */
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { invalidateByUrlPrefix } from "@/lib/queryClient";

interface RotationalItemRow {
  riuuid: string;
  stamp: string;
  stampName: string | null;
  status: string;
  currentRh: string | null;
  rhLastUpdated: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentCuuid: string;
  componentName: string;
  currentStamp: string;
  vesselId: string;
  onSwapped?: () => void;
}

export const ReplaceRotationalItemDialog: React.FC<Props> = ({
  open, onOpenChange, componentCuuid, componentName, currentStamp, vesselId, onSwapped,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedRiuuid, setSelectedRiuuid] = useState("");
  const [newStamp, setNewStamp] = useState("");
  const [newStampName, setNewStampName] = useState("");
  const [newRh, setNewRh] = useState("0");
  const [stampFilter, setStampFilter] = useState("");

  const { data: items = [], isLoading } = useQuery<RotationalItemRow[]>({
    queryKey: [`/technical/api/rotational-items?vesselId=${vesselId}`],
    enabled: open && !!vesselId,
  });

  const available = useMemo(
    () => items.filter((i) => i.status !== "Installed" && i.status !== "Retired"),
    [items],
  );

  const filteredAvailable = useMemo(() => {
    const q = stampFilter.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (i) =>
        i.stamp.toLowerCase().includes(q) ||
        (i.stampName || "").toLowerCase().includes(q),
    );
  }, [available, stampFilter]);

  // If the filter hides the selected item, clear the selection so the user
  // cannot confirm a replacement with a candidate they can no longer see.
  React.useEffect(() => {
    if (selectedRiuuid && !filteredAvailable.some((i) => i.riuuid === selectedRiuuid)) {
      setSelectedRiuuid("");
    }
  }, [filteredAvailable, selectedRiuuid]);

  const swapMutation = useMutation({
    mutationFn: async () => {
      const body: any = { componentCuuid };
      if (mode === "existing") {
        body.incomingRiuuid = selectedRiuuid;
      } else {
        body.newStamp = newStamp.trim();
        body.newStampName = newStampName.trim() || null;
        body.newStampInitialRh = newRh.trim() === "" ? 0 : Number(newRh);
      }
      const res = await fetch("/technical/api/rotational-items/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Replacement failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Rotational item replaced",
        description: `Stamp ${result?.incoming?.stamp ?? ""} is now installed. Running hours continue from ${result?.incoming?.currentRh ?? ""}.`,
      });
      invalidateByUrlPrefix([
        "/technical/api/rotational-items",
        "/technical/api/components",
        "/technical/api/running-hours",
      ]);
      queryClient.invalidateQueries();
      onOpenChange(false);
      setSelectedRiuuid("");
      setNewStamp("");
      setNewStampName("");
      setNewRh("0");
      onSwapped?.();
    },
    onError: (err: any) => {
      toast({ title: "Replacement failed", description: err.message, variant: "destructive" });
    },
  });

  const canConfirm = mode === "existing"
    ? !!selectedRiuuid
    : newStamp.trim().length > 0 && !isNaN(Number(newRh)) && Number(newRh) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[92vw] sm:w-[50vw] sm:max-w-[50vw]" data-testid="dialog-replace-rotational-item">
        <DialogHeader>
          <DialogTitle>Replace Rotational Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-gray-600">
            {componentName} — currently installed stamp:{" "}
            <span className="font-medium text-gray-900">{currentStamp || "-"}</span>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")}
                data-testid="radio-existing-item" />
              Existing item
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "new"} onChange={() => setMode("new")}
                data-testid="radio-new-stamp" />
              New stamp
            </label>
          </div>

          {mode === "existing" ? (
            <>
            <input
              type="text"
              value={stampFilter}
              onChange={(e) => setStampFilter(e.target.value)}
              className="text-sm w-full px-2 py-1.5 border rounded"
              placeholder="Filter by stamp or stamp name…"
              data-testid="input-stamp-filter"
            />
            <div className="border rounded max-h-72 overflow-y-auto" data-testid="list-available-items">
              {isLoading ? (
                <div className="p-3 text-gray-500">Loading…</div>
              ) : available.length === 0 ? (
                <div className="p-3 text-gray-500">
                  No available rotational items on this vessel. Create a new stamp instead.
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="p-3 text-gray-500" data-testid="text-no-matching-stamps">
                  No stamps match "{stampFilter.trim()}". Clear the filter to see all available items.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left"></th>
                      <th className="p-2 text-left">Stamp</th>
                      <th className="p-2 text-left">Stamp Name</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-right">Running Hours</th>
                      <th className="p-2 text-left">RH Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvailable.map((item) => (
                      <tr
                        key={item.riuuid}
                        className={`border-t cursor-pointer hover:bg-blue-50 ${selectedRiuuid === item.riuuid ? "bg-blue-50" : ""}`}
                        onClick={() => setSelectedRiuuid(item.riuuid)}
                        data-testid={`row-item-${item.stamp}`}
                      >
                        <td className="p-2">
                          <input type="radio" readOnly checked={selectedRiuuid === item.riuuid} />
                        </td>
                        <td className="p-2 font-medium">{item.stamp}</td>
                        <td className="p-2">{item.stampName || "-"}</td>
                        <td className="p-2">{item.status}</td>
                        <td className="p-2 text-right">{item.currentRh ?? "0"}</td>
                        <td className="p-2">
                          {item.rhLastUpdated ? String(item.rhLastUpdated).split("T")[0] : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">New Stamp *</label>
                <input
                  type="text" value={newStamp} onChange={(e) => setNewStamp(e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded"
                  placeholder="e.g. 555223"
                  data-testid="input-new-stamp"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Stamp Name</label>
                <input
                  type="text" value={newStampName} onChange={(e) => setNewStampName(e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded"
                  placeholder="e.g. ME Cylinder Liner"
                  data-testid="input-new-stamp-name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Starting Running Hours</label>
                <input
                  type="number" min="0" step="0.01" value={newRh} onChange={(e) => setNewRh(e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded"
                  data-testid="input-new-stamp-rh"
                />
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            The current stamp keeps the component's running hours and becomes a spare. The
            incoming item's stored hours become the component's new starting point.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-swap">
            Cancel
          </Button>
          <Button
            onClick={() => swapMutation.mutate()}
            disabled={!canConfirm || swapMutation.isPending}
            data-testid="button-confirm-swap"
          >
            {swapMutation.isPending ? "Replacing…" : "Replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
