import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ship, Box, Wrench, Package, Search, Link2, ArrowLeft, RefreshCw, Zap, CheckCircle2, Anchor, ChevronRight, ChevronDown, FolderTree, Trash2, Download, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Component, FleetComponents, FleetJobs, FleetSpares, FleetSpareVesselMapping } from "@shared/schema";

type MappingTab = "components" | "jobs" | "spares";

interface FleetComponentMapping {
  id: number;
  fleetEquipmentCode: string;
  vesselCode: string;
  componentCode: string;
  componentId?: string;
  componentName?: string;
  mappedBy: string;
  mappedAt: string;
  isActive: boolean;
}

interface AutoMatchEntry {
  vesselComponentCode: string;
  vesselComponentName: string;
  vesselComponentId: string;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  matched: boolean;
}

interface JobAutoMatchEntry {
  fleetEquipmentCode: string;
  componentCode: string;
  componentName: string;
  jobCode: string;
  jobTitle: string;
  vesselJobId: string;
  matched: boolean;
}

interface FleetTreeNode {
  code: string;
  name: string;
  parentCode: string | null;
  children: FleetTreeNode[];
  isLeaf: boolean;
  data?: FleetComponents;
}

interface VesselTreeNode {
  code: string;
  name: string;
  parentId: string | null;
  children: VesselTreeNode[];
  isParent: boolean;
  data?: Component;
}

interface SpareAutoMatchEntry {
  fleetEquipmentCode: string;
  partCode: string;
  partName: string;
  vesselPartCode: string;
  vesselPartName: string;
  vesselSpareId: string;
  matched: boolean;
}

interface FleetJobMapping {
  id: number;
  fleetEquipmentCode: string;
  jobCode: string;
  jobId?: string;
  vesselCode: string;
  vesselName?: string;
  mappedBy: string;
  mappedAt: string;
  isActive: boolean;
}

export default function FleetVesselMapping({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<MappingTab>("components");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedFleetItem, setSelectedFleetItem] = useState<string | null>(null);
  const [selectedVesselItems, setSelectedVesselItems] = useState<Set<string>>(new Set());
  const [autoMatchDialogOpen, setAutoMatchDialogOpen] = useState(false);
  const [autoMatchProgress, setAutoMatchProgress] = useState<{ current: number; total: number; linked: number; failed: number } | null>(null);
  const [jobAutoMatchDialogOpen, setJobAutoMatchDialogOpen] = useState(false);
  const [jobAutoMatchProgress, setJobAutoMatchProgress] = useState<{ current: number; total: number; linked: number; failed: number } | null>(null);
  const [spareAutoMatchDialogOpen, setSpareAutoMatchDialogOpen] = useState(false);
  const [spareAutoMatchProgress, setSpareAutoMatchProgress] = useState<{ current: number; total: number; linked: number; failed: number } | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<{ linked: number; notLinked: number }>({ linked: 0, notLinked: 0 });
  const [expandedFleetNodes, setExpandedFleetNodes] = useState<Set<string>>(new Set());
  const [expandedVesselNodes, setExpandedVesselNodes] = useState<Set<string>>(new Set());
  const [selectedFleetJob, setSelectedFleetJob] = useState<string | null>(null); // composite key: jobCode|fleetEquipmentCode
  const [selectedVesselJobs, setSelectedVesselJobs] = useState<Set<string>>(new Set());
  const [selectedFleetSpare, setSelectedFleetSpare] = useState<string | null>(null); // composite key: fleetEquipmentCode|partCode
  const [selectedVesselSpares, setSelectedVesselSpares] = useState<Set<string>>(new Set());

  const { data: vessels = [] } = useVessels();

  const { data: fleetComponentsData = [], isLoading: isLoadingFleet } = useQuery<FleetComponents[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-components"],
    enabled: activeTab === "components",
  });

  const { data: vesselComponentsData = [], isLoading: isLoadingVessel } = useQuery<Component[]>({
    queryKey: ["/technical/api/components", { vesselId: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/components?vesselId=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vessel components");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "components",
  });

  const { data: mappingsData = [], isLoading: isLoadingMappings } = useQuery<FleetComponentMapping[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/fleet-admin/fleet-component-mappings?vesselCode=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch mappings");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "components",
  });

  const vesselComponentsNonParent = useMemo(
    () => vesselComponentsData.filter((c) => c.isParent !== true),
    [vesselComponentsData]
  );

  const { data: fleetJobsData = [], isLoading: isLoadingFleetJobs } = useQuery<FleetJobs[]>({
    queryKey: ["/technical/api/fleet/jobs"],
    enabled: activeTab === "jobs",
  });

  const { data: vesselJobsData = [], isLoading: isLoadingVesselJobs } = useQuery<any[]>({
    queryKey: ["/technical/api/jobs", { vesselId: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/jobs?vesselId=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vessel jobs");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "jobs",
  });

  const { data: jobMappingsData = [], isLoading: isLoadingJobMappings } = useQuery<FleetJobMapping[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/fleet-admin/fleet-job-mappings?vesselCode=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job mappings");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "jobs",
  });

  const { data: fleetSparesData = [], isLoading: isLoadingFleetSpares } = useQuery<FleetSpares[]>({
    queryKey: ["/technical/api/fleet/spares"],
    enabled: activeTab === "spares",
  });

  const { data: vesselSparesData = [], isLoading: isLoadingVesselSpares } = useQuery<any[]>({
    queryKey: ["/technical/api/spares", selectedVessel],
    queryFn: async () => {
      const res = await fetch(`/technical/api/spares/${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vessel spares");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "spares",
  });

  const { data: spareMappingsData = [], isLoading: isLoadingSpareMappings } = useQuery<FleetSpareVesselMapping[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/fleet-admin/fleet-spare-mappings?vesselCode=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch spare mappings");
      return res.json();
    },
    enabled: !!selectedVessel && activeTab === "spares",
  });

  const selectedFleetSpareData = useMemo(() => {
    if (!selectedFleetSpare) return null;
    return fleetSparesData.find((s) => `${s.fleetEquipmentCode}|${s.partCode}` === selectedFleetSpare) || null;
  }, [selectedFleetSpare, fleetSparesData]);

  const selectedFleetSpareMappings = useMemo(() => {
    if (!selectedFleetSpare) return [];
    const [eqCode, pCode] = selectedFleetSpare.split("|");
    return spareMappingsData.filter((m) => m.fleetEquipmentCode === eqCode && m.partCode === pCode);
  }, [selectedFleetSpare, spareMappingsData]);

  const selectedFleetSpareLinkedDetails = useMemo(() => {
    if (!selectedFleetSpare) return [];
    return selectedFleetSpareMappings.map((m) => {
      const vesselSpare = m.spareId ? vesselSparesData.find((vs: any) => String(vs.id) === String(m.spareId)) : null;
      return {
        ...m,
        vesselPartCode: vesselSpare?.partCode || m.spareId || "-",
        vesselPartName: vesselSpare?.partName || "-",
      };
    });
  }, [selectedFleetSpareMappings, vesselSparesData]);

  const spareMappedCount = useMemo(() => {
    const mappedKeys = new Set(spareMappingsData.map((m) => `${m.fleetEquipmentCode}|${m.partCode}`));
    return mappedKeys.size;
  }, [spareMappingsData]);

  const spareUnmappedCount = useMemo(() => {
    const mappedKeys = new Set(spareMappingsData.map((m) => `${m.fleetEquipmentCode}|${m.partCode}`));
    return fleetSparesData.filter((s) => !mappedKeys.has(`${s.fleetEquipmentCode}|${s.partCode}`)).length;
  }, [fleetSparesData, spareMappingsData]);

  const spareLinkedVesselSpareIds = useMemo(() => {
    const ids = new Set<string>();
    spareMappingsData.forEach((m) => {
      if (m.spareId) ids.add(String(m.spareId));
    });
    return ids;
  }, [spareMappingsData]);

  const selectedFleetJobParts = useMemo(() => {
    if (!selectedFleetJob) return { jobCode: "", fleetEquipmentCode: "" };
    const [jobCode, fleetEquipmentCode] = selectedFleetJob.split("|");
    return { jobCode, fleetEquipmentCode };
  }, [selectedFleetJob]);

  const selectedFleetJobData = useMemo(() => {
    if (!selectedFleetJob) return null;
    const { jobCode, fleetEquipmentCode } = selectedFleetJobParts;
    return fleetJobsData.find((j) => j.jobCode === jobCode && j.fleetEquipmentCode === fleetEquipmentCode) || null;
  }, [selectedFleetJob, fleetJobsData, selectedFleetJobParts]);

  const selectedFleetJobMappings = useMemo(() => {
    if (!selectedFleetJob) return [];
    const { jobCode, fleetEquipmentCode } = selectedFleetJobParts;
    return jobMappingsData.filter((m) => m.jobCode === jobCode && m.fleetEquipmentCode === fleetEquipmentCode);
  }, [selectedFleetJob, jobMappingsData, selectedFleetJobParts]);

  const jobMappedCount = useMemo(() => {
    const mappedKeys = new Set(jobMappingsData.map((m) => `${m.jobCode}|${m.fleetEquipmentCode}`));
    return mappedKeys.size;
  }, [jobMappingsData]);

  const jobUnmappedCount = useMemo(() => {
    const mappedKeys = new Set(jobMappingsData.map((m) => `${m.jobCode}|${m.fleetEquipmentCode}`));
    return fleetJobsData.filter((j) => !mappedKeys.has(`${j.jobCode}|${j.fleetEquipmentCode}`)).length;
  }, [fleetJobsData, jobMappingsData]);

  const jobLinkedVesselJobIds = useMemo(() => {
    const ids = new Set<string>();
    jobMappingsData.forEach((m) => {
      if (m.jobId) ids.add(m.jobId);
    });
    return ids;
  }, [jobMappingsData]);

  const selectedFleetJobLinkedDetails = useMemo(() => {
    if (!selectedFleetJob) return [];
    return selectedFleetJobMappings.map((m) => {
      const vesselJob = m.jobId ? vesselJobsData.find((vj: any) => vj.id === m.jobId) : null;
      return {
        ...m,
        vesselJobNo: vesselJob?.jobNo || m.jobId || "-",
        vesselJobTitle: vesselJob?.jobTitle || "-",
      };
    });
  }, [selectedFleetJobMappings, vesselJobsData]);

  const fleetComponents = useMemo(() => fleetComponentsData, [fleetComponentsData]);

  const fleetTree = useMemo((): FleetTreeNode[] => {
    if (!fleetComponents.length) return [];

    const nodeMap = new Map<string, FleetTreeNode>();

    fleetComponents.forEach((fc) => {
      nodeMap.set(fc.fleetEquipmentCode, {
        code: fc.fleetEquipmentCode,
        name: fc.fleetEquipmentName,
        parentCode: fc.parentFleetEquipmentCode || null,
        children: [],
        isLeaf: true,
        data: fc,
      });
    });

    const roots: FleetTreeNode[] = [];

    nodeMap.forEach((node) => {
      if (node.parentCode && nodeMap.has(node.parentCode)) {
        const parent = nodeMap.get(node.parentCode)!;
        parent.children.push(node);
        parent.isLeaf = false;
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: FleetTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
  }, [fleetComponents]);

  const vesselTree = useMemo((): VesselTreeNode[] => {
    if (!vesselComponentsData.length) return [];

    const nodeMap = new Map<string, VesselTreeNode>();

    vesselComponentsData.forEach((vc) => {
      const code = vc.componentCode || vc.id;
      nodeMap.set(code, {
        code,
        name: vc.name || "",
        parentId: vc.parentId || null,
        children: [],
        isParent: vc.isParent === true,
        data: vc,
      });
    });

    const roots: VesselTreeNode[] = [];

    nodeMap.forEach((node) => {
      if (node.parentId) {
        let parent = nodeMap.get(node.parentId);
        if (!parent) {
          const parentComp = vesselComponentsData.find((c: any) => c.id === node.parentId || c.componentCode === node.parentId);
          if (parentComp) {
            parent = nodeMap.get(parentComp.componentCode || parentComp.id);
          }
        }
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: VesselTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
  }, [vesselComponentsData]);

  const { filtered: filteredFleetTree, expandCodes: fleetExpandCodes } = useMemo(() => {
    if (!searchTerm) return { filtered: fleetTree, expandCodes: new Set<string>() };
    const term = searchTerm.toLowerCase();
    const expandCodes = new Set<string>();

    const filterTree = (nodes: FleetTreeNode[], ancestors: string[]): FleetTreeNode[] => {
      return nodes.reduce<FleetTreeNode[]>((acc, node) => {
        const selfMatch =
          node.code.toLowerCase().includes(term) ||
          node.name.toLowerCase().includes(term);
        const filteredChildren = filterTree(node.children, [...ancestors, node.code]);
        if (selfMatch || filteredChildren.length > 0) {
          ancestors.forEach((a) => expandCodes.add(a));
          if (filteredChildren.length > 0) expandCodes.add(node.code);
          acc.push({
            ...node,
            children: selfMatch ? node.children : filteredChildren,
          });
        }
        return acc;
      }, []);
    };
    return { filtered: filterTree(fleetTree, []), expandCodes };
  }, [fleetTree, searchTerm]);

  useEffect(() => {
    if (fleetExpandCodes.size > 0) {
      setExpandedFleetNodes((prev) => {
        const next = new Set(prev);
        let changed = false;
        fleetExpandCodes.forEach((c) => { if (!next.has(c)) { next.add(c); changed = true; } });
        return changed ? next : prev;
      });
    }
  }, [fleetExpandCodes]);

  const { filtered: filteredVesselTree, expandCodes: vesselExpandCodes } = useMemo(() => {
    if (!searchTerm) return { filtered: vesselTree, expandCodes: new Set<string>() };
    const term = searchTerm.toLowerCase();
    const expandCodes = new Set<string>();

    const filterTree = (nodes: VesselTreeNode[], ancestors: string[]): VesselTreeNode[] => {
      return nodes.reduce<VesselTreeNode[]>((acc, node) => {
        const selfMatch =
          node.code.toLowerCase().includes(term) ||
          node.name.toLowerCase().includes(term);
        const filteredChildren = filterTree(node.children, [...ancestors, node.code]);
        if (selfMatch || filteredChildren.length > 0) {
          ancestors.forEach((a) => expandCodes.add(a));
          if (filteredChildren.length > 0) expandCodes.add(node.code);
          acc.push({
            ...node,
            children: selfMatch ? node.children : filteredChildren,
          });
        }
        return acc;
      }, []);
    };
    return { filtered: filterTree(vesselTree, []), expandCodes };
  }, [vesselTree, searchTerm]);

  useEffect(() => {
    if (vesselExpandCodes.size > 0) {
      setExpandedVesselNodes((prev) => {
        const next = new Set(prev);
        let changed = false;
        vesselExpandCodes.forEach((c) => { if (!next.has(c)) { next.add(c); changed = true; } });
        return changed ? next : prev;
      });
    }
  }, [vesselExpandCodes]);

  const mappingsByFleetCode = useMemo(() => {
    const map = new Map<string, FleetComponentMapping[]>();
    for (const m of mappingsData) {
      const arr = map.get(m.fleetEquipmentCode) || [];
      arr.push(m);
      map.set(m.fleetEquipmentCode, arr);
    }
    return map;
  }, [mappingsData]);

  const mappingsByComponentCode = useMemo(() => {
    const map = new Map<string, FleetComponentMapping[]>();
    for (const m of mappingsData) {
      const arr = map.get(m.componentCode) || [];
      arr.push(m);
      map.set(m.componentCode, arr);
    }
    return map;
  }, [mappingsData]);

  const mappedFleetCodes = useMemo(() => new Set(mappingsData.map((m) => m.fleetEquipmentCode)), [mappingsData]);
  const mappedComponentCodes = useMemo(() => new Set(mappingsData.map((m) => m.componentCode)), [mappingsData]);

  const linkedComponentCodes = useMemo(() => {
    if (!selectedFleetItem) return new Set<string>();
    const mappings = mappingsByFleetCode.get(selectedFleetItem) || [];
    return new Set(mappings.map((m) => m.componentCode));
  }, [selectedFleetItem, mappingsByFleetCode]);

  const linkedFleetCodes = useMemo(() => {
    if (selectedVesselItems.size === 0) return new Set<string>();
    const codes = new Set<string>();
    selectedVesselItems.forEach((itemCode) => {
      const mappings = mappingsByComponentCode.get(itemCode) || [];
      mappings.forEach((m) => codes.add(m.fleetEquipmentCode));
    });
    return codes;
  }, [selectedVesselItems, mappingsByComponentCode]);

  const vesselComponentConflictMap = useMemo(() => {
    const map = new Map<string, string>();
    mappingsData.forEach((m) => {
      map.set(m.componentCode, m.fleetEquipmentCode);
    });
    return map;
  }, [mappingsData]);

  const leafFleetCount = useMemo(() => {
    let count = 0;
    const countLeaves = (nodes: FleetTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.isLeaf) count++;
        countLeaves(n.children);
      });
    };
    countLeaves(fleetTree);
    return count;
  }, [fleetTree]);

  const mappedCount = useMemo(() => mappedFleetCodes.size, [mappedFleetCodes]);
  const unmappedCount = useMemo(() => Math.max(0, leafFleetCount - mappedCount), [leafFleetCount, mappedCount]);

  const selectedFleetData = useMemo(() => {
    if (!selectedFleetItem) return null;
    return fleetComponents.find((fc) => fc.fleetEquipmentCode === selectedFleetItem) || null;
  }, [selectedFleetItem, fleetComponents]);

  const selectedFleetMappings = useMemo(() => {
    if (!selectedFleetItem) return [];
    return mappingsByFleetCode.get(selectedFleetItem) || [];
  }, [selectedFleetItem, mappingsByFleetCode]);

  const autoMatchEntries = useMemo((): AutoMatchEntry[] => {
    const fleetCodeSet = new Set(fleetComponents.map((fc) => fc.fleetEquipmentCode));
    const fleetCodeToName = new Map(fleetComponents.map((fc) => [fc.fleetEquipmentCode, fc.fleetEquipmentName]));

    return vesselComponentsNonParent.map((vc) => {
      const vcFleetCode = vc.fleetEquipmentCode || "";
      const matched = !!vcFleetCode && fleetCodeSet.has(vcFleetCode);
      return {
        vesselComponentCode: vc.componentCode || "",
        vesselComponentName: vc.name || "",
        vesselComponentId: vc.id,
        fleetEquipmentCode: vcFleetCode,
        fleetEquipmentName: matched ? (fleetCodeToName.get(vcFleetCode) || "") : "",
        matched,
      };
    });
  }, [vesselComponentsNonParent, fleetComponents]);

  const jobAutoMatchEntries = useMemo((): JobAutoMatchEntry[] => {
    const fleetJobCompositeKeys = new Set(
      fleetJobsData.map((fj) => `${fj.jobCode}|${fj.fleetEquipmentCode}`)
    );
    const fleetJobLookup = new Map(
      fleetJobsData.map((fj) => [`${fj.jobCode}|${fj.fleetEquipmentCode}`, fj])
    );

    return vesselJobsData.map((vj: any) => {
      const vjJobCode = vj.jobNo || "";
      const vjFleetEquipCode = vj.fleetEquipmentCode || "";
      const compositeKey = `${vjJobCode}|${vjFleetEquipCode}`;
      const matched = !!vjJobCode && !!vjFleetEquipCode && fleetJobCompositeKeys.has(compositeKey);
      const fleetJob = matched ? fleetJobLookup.get(compositeKey) : null;

      return {
        fleetEquipmentCode: vjFleetEquipCode,
        componentCode: vj.componentCode || "",
        componentName: vj.componentName || "",
        jobCode: vjJobCode,
        jobTitle: fleetJob?.woTitle || vj.jobTitle || vj.title || "",
        vesselJobId: vj.id || "",
        matched,
      };
    });
  }, [vesselJobsData, fleetJobsData]);

  const jobMappedCompositeKeys = useMemo(() => {
    return new Set(jobMappingsData.map((m) => `${m.jobCode}|${m.fleetEquipmentCode}`));
  }, [jobMappingsData]);

  const spareAutoMatchEntries = useMemo((): SpareAutoMatchEntry[] => {
    const fleetSpareCompositeKeys = new Set(
      fleetSparesData.map((fs) => `${fs.fleetEquipmentCode}|${fs.partCode}`)
    );
    const fleetSpareLookup = new Map(
      fleetSparesData.map((fs) => [`${fs.fleetEquipmentCode}|${fs.partCode}`, fs])
    );

    return vesselSparesData.map((vs: any) => {
      const vsFleetEquipCode = vs.fleetEquipmentCode || "";
      const vsPartCode = vs.partCode || "";
      const compositeKey = `${vsFleetEquipCode}|${vsPartCode}`;
      const matched = !!vsFleetEquipCode && !!vsPartCode && fleetSpareCompositeKeys.has(compositeKey);
      const fleetSpare = matched ? fleetSpareLookup.get(compositeKey) : null;

      return {
        fleetEquipmentCode: vsFleetEquipCode,
        partCode: fleetSpare?.partCode || vsPartCode,
        partName: fleetSpare?.partName || "",
        vesselPartCode: vsPartCode,
        vesselPartName: vs.partName || "",
        vesselSpareId: String(vs.id),
        matched,
      };
    });
  }, [vesselSparesData, fleetSparesData]);

  const spareMappedCompositeKeys = useMemo(() => {
    return new Set(spareMappingsData.map((m) => `${m.fleetEquipmentCode}|${m.partCode}`));
  }, [spareMappingsData]);

  const createMappingMutation = useMutation({
    mutationFn: async (data: {
      fleetEquipmentCode: string;
      vesselCode: string;
      componentCode: string;
      componentName: string;
      componentId: string;
      mappedBy: string;
      isActive: boolean;
    }) => {
      const response = await apiRequest("POST", "/technical/api/fleet-admin/fleet-component-mappings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (params: { fleetEquipmentCode: string; vesselCode: string; componentCode: string }) => {
      await apiRequest(
        "DELETE",
        `/technical/api/fleet-admin/fleet-component-mappings?fleetEquipmentCode=${encodeURIComponent(params.fleetEquipmentCode)}&vesselCode=${encodeURIComponent(params.vesselCode)}&componentCode=${encodeURIComponent(params.componentCode)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
      toast({ title: "Success", description: "Mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove mapping", variant: "destructive" });
    },
  });

  const deleteJobMappingMutation = useMutation({
    mutationFn: async (params: { jobCode: string; vesselCode: string }) => {
      await apiRequest(
        "DELETE",
        `/technical/api/fleet-admin/fleet-job-mappings?jobCode=${encodeURIComponent(params.jobCode)}&vesselCode=${encodeURIComponent(params.vesselCode)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }] });
      toast({ title: "Success", description: "Job mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove job mapping", variant: "destructive" });
    },
  });

  const handleRemoveJobMapping = (m: any) => {
    deleteJobMappingMutation.mutate({
      jobCode: m.jobCode,
      vesselCode: m.vesselCode || selectedVessel || "",
    });
  };

  const handleRemoveAllJobMappings = async () => {
    for (const m of selectedFleetJobMappings) {
      try {
        await apiRequest(
          "DELETE",
          `/technical/api/fleet-admin/fleet-job-mappings?jobCode=${encodeURIComponent(m.jobCode)}&vesselCode=${encodeURIComponent(m.vesselCode || selectedVessel || "")}`
        );
      } catch {}
    }
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Success", description: "All job mappings removed" });
  };

  const handleManualJobMap = async () => {
    if (!selectedFleetJob || selectedVesselJobs.size === 0 || !selectedVessel) {
      toast({ title: "Error", description: "Select a fleet job and one or more vessel jobs", variant: "destructive" });
      return;
    }

    const selectedFleetJobObj = fleetJobsData.find(
      (fj) => `${fj.jobCode}|${fj.fleetEquipmentCode}` === selectedFleetJob
    );
    if (!selectedFleetJobObj) {
      toast({ title: "Error", description: "Fleet job not found", variant: "destructive" });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const vesselJobKey of Array.from(selectedVesselJobs)) {
      const [jobNo, componentCode] = vesselJobKey.split("|");
      const vesselJob = vesselJobsData.find((vj: any) =>
        (vj.jobNo || vj.id) === jobNo && (vj.componentCode || "") === (componentCode || "")
      );
      if (!vesselJob) { failCount++; continue; }

      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-job-mappings", {
          fleetEquipmentCode: selectedFleetJobObj.fleetEquipmentCode,
          jobCode: selectedFleetJobObj.jobCode,
          jobId: vesselJob.id,
          vesselCode: selectedVessel,
          mappedBy: "admin",
          isActive: true,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }] });
    setSelectedVesselJobs(new Set());

    if (successCount > 0) {
      toast({ title: "Success", description: `${successCount} job mapping(s) created successfully${failCount > 0 ? `, ${failCount} failed` : ""}` });
    } else {
      toast({ title: "Error", description: "Failed to create job mappings", variant: "destructive" });
    }
  };

  const handleManualMap = async () => {
    if (!selectedFleetItem || selectedVesselItems.size === 0 || !selectedVessel) {
      toast({ title: "Error", description: "Select a fleet item and one or more vessel components", variant: "destructive" });
      return;
    }

    const itemsToMap = Array.from(selectedVesselItems);
    let successCount = 0;
    let failCount = 0;

    for (const itemCode of itemsToMap) {
      const vc = vesselComponentsNonParent.find((c) => (c.componentCode || c.id) === itemCode);
      if (!vc) { failCount++; continue; }

      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-component-mappings", {
          fleetEquipmentCode: selectedFleetItem,
          vesselCode: selectedVessel,
          componentCode: vc.componentCode || "",
          componentName: vc.name || "",
          componentId: vc.id,
          mappedBy: "admin",
          isActive: true,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    setSelectedVesselItems(new Set());

    if (successCount > 0) {
      toast({ title: "Success", description: `${successCount} mapping(s) created successfully${failCount > 0 ? `, ${failCount} failed` : ""}` });
    } else {
      toast({ title: "Error", description: "Failed to create mappings", variant: "destructive" });
    }
  };

  const deleteSpareMappingMutation = useMutation({
    mutationFn: async (params: { partCode: string; vesselCode: string }) => {
      await apiRequest(
        "DELETE",
        `/technical/api/fleet-admin/fleet-spare-mappings?partCode=${encodeURIComponent(params.partCode)}&vesselCode=${encodeURIComponent(params.vesselCode)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }] });
      toast({ title: "Success", description: "Spare mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove spare mapping", variant: "destructive" });
    },
  });

  const handleRemoveSpareMapping = (m: any) => {
    deleteSpareMappingMutation.mutate({
      partCode: m.partCode,
      vesselCode: m.vesselCode || selectedVessel || "",
    });
  };

  const handleRemoveAllSpareMappings = async () => {
    for (const m of selectedFleetSpareLinkedDetails) {
      try {
        await apiRequest(
          "DELETE",
          `/technical/api/fleet-admin/fleet-spare-mappings?partCode=${encodeURIComponent(m.partCode)}&vesselCode=${encodeURIComponent(m.vesselCode || selectedVessel || "")}`
        );
      } catch {}
    }
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Success", description: "All spare mappings removed" });
  };

  const handleManualSpareMap = async () => {
    if (!selectedFleetSpare || selectedVesselSpares.size === 0 || !selectedVessel) {
      toast({ title: "Error", description: "Select a fleet spare and one or more vessel spares", variant: "destructive" });
      return;
    }

    const selectedFleetSpareObj = fleetSparesData.find((s) => `${s.fleetEquipmentCode}|${s.partCode}` === selectedFleetSpare);
    if (!selectedFleetSpareObj) {
      toast({ title: "Error", description: "Fleet spare not found", variant: "destructive" });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const vesselSpareId of Array.from(selectedVesselSpares)) {
      const vesselSpare = vesselSparesData.find((vs: any) => String(vs.id) === vesselSpareId);
      if (!vesselSpare) { failCount++; continue; }

      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-spare-mappings", {
          fleetEquipmentCode: selectedFleetSpareObj.fleetEquipmentCode,
          partCode: selectedFleetSpareObj.partCode,
          spareId: String(vesselSpare.id),
          vesselCode: selectedVessel,
          mappedBy: "admin",
          isActive: true,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }] });
    setSelectedVesselSpares(new Set());

    if (successCount > 0) {
      toast({ title: "Success", description: `${successCount} spare mapping(s) created successfully${failCount > 0 ? `, ${failCount} failed` : ""}` });
    } else {
      toast({ title: "Error", description: "Failed to create spare mappings", variant: "destructive" });
    }
  };

  const handleSpareAutoMatch = () => {
    if (!selectedVessel) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }
    setSpareAutoMatchDialogOpen(true);
  };

  const handleCreateSpareAutoMappings = async () => {
    const matchedEntries = spareAutoMatchEntries.filter(
      (e) => e.matched && !spareMappedCompositeKeys.has(`${e.fleetEquipmentCode}|${e.partCode}`)
    );

    if (matchedEntries.length === 0) {
      toast({ title: "Info", description: "No new spare mappings to create" });
      return;
    }

    let linked = 0;
    let failed = 0;
    setSpareAutoMatchProgress({ current: 0, total: matchedEntries.length, linked: 0, failed: 0 });

    for (let i = 0; i < matchedEntries.length; i++) {
      const entry = matchedEntries[i];
      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-spare-mappings", {
          fleetEquipmentCode: entry.fleetEquipmentCode,
          partCode: entry.partCode,
          spareId: entry.vesselSpareId,
          vesselCode: selectedVessel,
          mappedBy: "auto-match",
          isActive: true,
        });
        linked++;
      } catch {
        failed++;
      }
      setSpareAutoMatchProgress({ current: i + 1, total: matchedEntries.length, linked, failed });
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }] });
    setSpareAutoMatchDialogOpen(false);
    setSpareAutoMatchProgress(null);
    setSummaryData({ linked, notLinked: failed });
    setSummaryDialogOpen(true);
  };

  const handleRemoveMapping = (m: FleetComponentMapping) => {
    deleteMappingMutation.mutate({
      fleetEquipmentCode: m.fleetEquipmentCode,
      vesselCode: m.vesselCode,
      componentCode: m.componentCode,
    });
  };

  const handleAutoMatch = () => {
    if (!selectedVessel) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }
    setAutoMatchDialogOpen(true);
  };

  const handleCreateAutoMappings = async () => {
    const matchedEntries = autoMatchEntries.filter((e) => e.matched && !mappedComponentCodes.has(e.vesselComponentCode));
    let linked = 0;
    let notLinked = 0;

    for (const entry of matchedEntries) {
      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-component-mappings", {
          fleetEquipmentCode: entry.fleetEquipmentCode,
          vesselCode: selectedVessel,
          componentCode: entry.vesselComponentCode,
          componentName: entry.vesselComponentName,
          componentId: entry.vesselComponentId,
          mappedBy: "auto-match",
          isActive: true,
        });
        linked++;
      } catch {
        notLinked++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    setAutoMatchDialogOpen(false);
    setSummaryData({ linked, notLinked });
    setSummaryDialogOpen(true);
  };

  const handleJobAutoMatch = () => {
    if (!selectedVessel) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }
    setJobAutoMatchDialogOpen(true);
  };

  const handleCreateJobAutoMappings = async () => {
    const matchedEntries = jobAutoMatchEntries.filter(
      (e) => e.matched && !jobMappedCompositeKeys.has(`${e.jobCode}|${e.fleetEquipmentCode}`)
    );

    if (matchedEntries.length === 0) {
      toast({ title: "Info", description: "No new job mappings to create" });
      return;
    }

    let linked = 0;
    let failed = 0;
    setJobAutoMatchProgress({ current: 0, total: matchedEntries.length, linked: 0, failed: 0 });

    for (let i = 0; i < matchedEntries.length; i++) {
      const entry = matchedEntries[i];
      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-job-mappings", {
          fleetEquipmentCode: entry.fleetEquipmentCode,
          jobCode: entry.jobCode,
          jobId: entry.vesselJobId,
          vesselCode: selectedVessel,
          mappedBy: "auto-match",
          isActive: true,
        });
        linked++;
      } catch {
        failed++;
      }
      setJobAutoMatchProgress({ current: i + 1, total: matchedEntries.length, linked, failed });
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }] });
    setJobAutoMatchDialogOpen(false);
    setJobAutoMatchProgress(null);
    setSummaryData({ linked, notLinked: failed });
    setSummaryDialogOpen(true);
  };

  const handleResync = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/components", { vesselId: selectedVessel }] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Re-syncing", description: "Refreshing component mapping data..." });
  };

  const handleJobsResync = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/jobs", { vesselId: selectedVessel }] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-job-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Re-syncing", description: "Refreshing job mapping data..." });
  };

  const handleSparesResync = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet/spares"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/spares", selectedVessel] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-spare-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Re-syncing", description: "Refreshing spare mapping data..." });
  };

  const toggleFleetNode = useCallback((code: string) => {
    setExpandedFleetNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const toggleVesselNode = useCallback((code: string) => {
    setExpandedVesselNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const isLoading = isLoadingFleet || isLoadingVessel || isLoadingMappings;

  const renderFleetTree = (nodes: FleetTreeNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedFleetNodes.has(node.code);
      const isSelected = node.isLeaf && selectedFleetItem === node.code;
      const isLinkedFromRight = node.isLeaf && linkedFleetCodes.has(node.code);
      const isMapped = mappedFleetCodes.has(node.code);

      return (
        <div key={node.code}>
          <div
            className={`flex items-center border-b border-gray-100 transition-colors text-xs ${
              node.isLeaf ? "cursor-pointer" : "cursor-default"
            } ${
              isSelected
                ? "bg-blue-100"
                : isLinkedFromRight
                ? "bg-green-50"
                : node.isLeaf
                ? "hover:bg-blue-50/50"
                : ""
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleFleetNode(node.code);
              }
              if (node.isLeaf) {
                setSelectedFleetItem(node.code);
              }
            }}
            data-testid={`row-fleet-${node.code}`}
          >
            <button
              className="mr-1 flex-shrink-0 p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleFleetNode(node.code);
                }
              }}
              data-testid={`toggle-fleet-${node.code}`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                )
              ) : (
                <span className="inline-block w-3.5" />
              )}
            </button>
            {hasChildren ? (
              <FolderTree className="h-3 w-3 text-cyan-500 mr-1.5 flex-shrink-0" />
            ) : (
              <Box className="h-3 w-3 text-gray-400 mr-1.5 flex-shrink-0" />
            )}
            <span className="font-mono text-[11px] text-gray-500 mr-2 flex-shrink-0">{node.code}</span>
            <span className="truncate py-1.5" title={node.name}>{node.name}</span>
            {!hasChildren && isMapped && (
              <div className="w-2 h-2 rounded-full bg-green-500 ml-auto mr-2 flex-shrink-0" />
            )}
          </div>
          {hasChildren && isExpanded && (
            <div>{renderFleetTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const renderVesselTree = (nodes: VesselTreeNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedVesselNodes.has(node.code);
      const isSelected = selectedVesselItems.has(node.code);
      const isLinkedFromLeft = linkedComponentCodes.has(node.code);
      const isMapped = mappedComponentCodes.has(node.code);
      const isParentNode = node.isParent;
      const canSelect = !isParentNode;
      const conflictFleetCode = vesselComponentConflictMap.get(node.code);
      const hasConflict = canSelect && isMapped && selectedFleetItem && conflictFleetCode && conflictFleetCode !== selectedFleetItem;

      return (
        <div key={node.code}>
          <div
            className={`flex items-center border-b border-gray-100 transition-colors text-xs ${
              canSelect ? "cursor-pointer" : "cursor-default"
            } ${
              isSelected && canSelect
                ? "bg-blue-100"
                : isLinkedFromLeft && canSelect
                ? "bg-green-50"
                : canSelect
                ? "hover:bg-blue-50/50"
                : "bg-gray-50/50"
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleVesselNode(node.code);
              }
              if (canSelect) {
                setSelectedVesselItems((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.code)) {
                    next.delete(node.code);
                  } else {
                    next.add(node.code);
                  }
                  return next;
                });
              }
            }}
            data-testid={`row-vessel-${node.code}`}
          >
            <button
              className="mr-1 flex-shrink-0 p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleVesselNode(node.code);
                }
              }}
              data-testid={`toggle-vessel-${node.code}`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                )
              ) : (
                <span className="inline-block w-3.5" />
              )}
            </button>
            {canSelect && (
              <Checkbox
                checked={isSelected}
                className="h-3.5 w-3.5 mr-1.5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => {
                  setSelectedVesselItems((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.code)) {
                      next.delete(node.code);
                    } else {
                      next.add(node.code);
                    }
                    return next;
                  });
                }}
                data-testid={`checkbox-vessel-${node.code}`}
              />
            )}
            {isParentNode ? (
              <FolderTree className="h-3 w-3 text-cyan-500 mr-1.5 flex-shrink-0" />
            ) : !canSelect ? (
              <Box className="h-3 w-3 text-gray-400 mr-1.5 flex-shrink-0" />
            ) : null}
            <span className="font-mono text-[11px] text-gray-500 mr-2 flex-shrink-0">{node.code}</span>
            <span className={`truncate py-1.5 ${isParentNode ? "font-medium text-gray-700" : ""}`} title={node.name}>{node.name}</span>
            {canSelect && (
              <div className="ml-auto mr-2 flex-shrink-0 flex items-center gap-1">
                {hasConflict && (
                  <span title={`Already linked to ${conflictFleetCode}`}>
                    <AlertTriangle className="h-3 w-3 text-amber-500" data-testid={`conflict-${node.code}`} />
                  </span>
                )}
                {isMapped ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" data-testid={`status-mapped-${node.code}`} />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border border-gray-300" data-testid={`status-unmapped-${node.code}`} />
                )}
              </div>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div>{renderVesselTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 rounded-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Ship className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="text-page-title">Fleet Vessel Mapping</h1>
              <p className="text-cyan-100 text-sm mt-0.5">Map fleet components to vessels</p>
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

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-mappings"
          />
        </div>
        <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setSelectedFleetItem(null); setSelectedVesselItems(new Set()); setSelectedFleetJob(null); setSelectedVesselJobs(new Set()); setSelectedFleetSpare(null); setSelectedVesselSpares(new Set()); }}>
          <SelectTrigger className="w-64" data-testid="select-vessel-filter">
            <SelectValue placeholder="Select a vessel..." />
          </SelectTrigger>
          <SelectContent>
            {vessels.map((vessel) => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.id} - {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MappingTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="components" className="flex items-center gap-2" data-testid="tab-components">
            <Box className="h-4 w-4" />
            Components Mapping
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-jobs">
            <Wrench className="h-4 w-4" />
            Jobs Mapping
          </TabsTrigger>
          <TabsTrigger value="spares" className="flex items-center gap-2" data-testid="tab-spares">
            <Package className="h-4 w-4" />
            Spares Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="components">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span data-testid="text-mapped-count">Mapped: {mappedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span data-testid="text-unmapped-count">Not Mapped: {unmappedCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoMatch}
                disabled={!selectedVessel || isLoading}
                className="border-cyan-500 text-cyan-600"
                data-testid="button-component-auto-match"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Auto-Match
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResync}
                disabled={isLoading}
                data-testid="button-component-resync"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Re-sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedVessel}
                className="border-green-500 text-green-600"
                data-testid="button-component-export"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>

          {!selectedVessel ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Ship className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a Vessel</h3>
                  <p className="text-sm">Choose a vessel from the dropdown above to view and manage mappings</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <FolderTree className="h-4 w-4 text-cyan-600" />
                    Fleet Equipment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingFleet ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : filteredFleetTree.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No fleet components found</div>
                    ) : (
                      renderFleetTree(filteredFleetTree)
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Link2 className="h-4 w-4 text-gray-500" />
                    Mapping Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedFleetItem ? (
                    <div className="text-center py-8 text-gray-400">
                      <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Select a fleet item to view or create mappings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Selected Fleet Item</div>
                        <div className="font-medium text-sm">{selectedFleetData?.fleetEquipmentCode}</div>
                        <div className="text-xs text-gray-600 truncate">{selectedFleetData?.fleetEquipmentName}</div>
                      </div>

                      {selectedFleetMappings.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-gray-500">Linked Components ({selectedFleetMappings.length})</div>
                            {selectedFleetMappings.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-red-500"
                                data-testid="button-remove-all-mappings"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove All
                              </Button>
                            )}
                          </div>
                          {selectedFleetMappings.map((m) => (
                            <div key={`${m.fleetEquipmentCode}-${m.componentCode}`} className="p-2 border rounded-md flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{m.componentCode}</div>
                                <div className="text-xs text-gray-500 truncate">{m.componentName}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMapping(m)}
                                className="text-red-500 shrink-0"
                                data-testid={`button-remove-mapping-${m.componentCode}`}
                              >
                                <span className="text-xs">x</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Badge variant="secondary" className="text-xs">Not Mapped</Badge>
                          <p className="text-xs text-gray-500 mt-2">Select a vessel component on the right to create a mapping</p>
                        </div>
                      )}

                      {selectedVesselItems.size > 0 && selectedFleetItem && (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 text-center">
                            {selectedVesselItems.size} vessel component{selectedVesselItems.size > 1 ? "s" : ""} selected
                          </div>
                          <Button
                            onClick={handleManualMap}
                            disabled={createMappingMutation.isPending}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                            data-testid="button-create-mapping"
                          >
                            {createMappingMutation.isPending ? "Creating..." : `Link ${selectedVesselItems.size} Selected`}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Anchor className="h-4 w-4 text-cyan-600" />
                    Vessel Components
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingVessel ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : filteredVesselTree.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No vessel components found</div>
                    ) : (
                      renderVesselTree(filteredVesselTree)
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span data-testid="text-job-mapped-count">Mapped: {jobMappedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span data-testid="text-job-unmapped-count">Not Mapped: {jobUnmappedCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedVessel || isLoading}
                className="border-cyan-500 text-cyan-600"
                onClick={handleJobAutoMatch}
                data-testid="button-job-auto-match"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Auto-Match
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleJobsResync}
                disabled={isLoading}
                data-testid="button-job-resync"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Re-sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedVessel}
                className="border-green-500 text-green-600"
                data-testid="button-job-export"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>

          {!selectedVessel ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Ship className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a Vessel</h3>
                  <p className="text-sm">Choose a vessel from the dropdown above to view and manage job mappings</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Wrench className="h-4 w-4 text-cyan-600" />
                    Fleet Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingFleetJobs ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : fleetJobsData.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No fleet jobs found</div>
                    ) : (
                      <table className="w-full" data-testid="table-fleet-jobs">
                        <thead>
                          <tr className="border-b">
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Title</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...fleetJobsData].sort((a, b) => (a.fleetEquipmentCode || "").localeCompare(b.fleetEquipmentCode || "")).map((job) => {
                            const compositeKey = `${job.jobCode}|${job.fleetEquipmentCode}`;
                            const isSelected = selectedFleetJob === compositeKey;
                            const isMapped = jobMappingsData.some((m) => m.jobCode === job.jobCode && m.fleetEquipmentCode === job.fleetEquipmentCode);
                            return (
                              <tr
                                key={compositeKey}
                                className={`border-b text-xs cursor-pointer ${isSelected ? "bg-cyan-50 border-l-2 border-l-cyan-500" : isMapped ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-blue-50/50"}`}
                                onClick={() => setSelectedFleetJob(compositeKey)}
                                data-testid={`row-fleet-job-${job.id}`}
                              >
                                <td className="px-3 py-2 font-mono text-gray-600">{job.fleetEquipmentCode}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">{job.jobCode}</td>
                                <td className="px-3 py-2 text-gray-600">{job.woTitle}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Link2 className="h-4 w-4 text-gray-500" />
                    Mapping Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedFleetJob ? (
                    <div className="text-center py-8 text-gray-400">
                      <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Select a fleet job to view or create mappings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Selected Fleet Job</div>
                        <div className="font-medium text-sm">{selectedFleetJobData?.jobCode}</div>
                        <div className="text-xs text-gray-600 truncate">{selectedFleetJobData?.woTitle}</div>
                        <div className="text-xs text-gray-400 mt-1 font-mono">{selectedFleetJobData?.fleetEquipmentCode}</div>
                      </div>

                      {selectedFleetJobLinkedDetails.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-gray-500">Linked Vessel Jobs ({selectedFleetJobLinkedDetails.length})</div>
                            {selectedFleetJobLinkedDetails.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-red-500"
                                onClick={handleRemoveAllJobMappings}
                                data-testid="button-remove-all-job-mappings"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove All
                              </Button>
                            )}
                          </div>
                          {selectedFleetJobLinkedDetails.map((m) => (
                            <div key={`${m.jobCode}-${m.vesselCode}`} className="p-2 border rounded-md flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{m.vesselJobNo}</div>
                                <div className="text-xs text-gray-500 truncate">{m.vesselJobTitle}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveJobMapping(m)}
                                className="text-red-500 shrink-0"
                                data-testid={`button-remove-job-mapping-${m.jobCode}`}
                              >
                                <span className="text-xs">x</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Badge variant="secondary" className="text-xs">Not Mapped</Badge>
                          <p className="text-xs text-gray-500 mt-2">Select a vessel job on the right to create a mapping</p>
                        </div>
                      )}

                      {selectedVesselJobs.size > 0 && selectedFleetJob && (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 text-center">
                            {selectedVesselJobs.size} vessel job{selectedVesselJobs.size > 1 ? "s" : ""} selected
                          </div>
                          <Button
                            onClick={handleManualJobMap}
                            className="w-full bg-cyan-600 text-white"
                            data-testid="button-create-job-mapping"
                          >
                            Link {selectedVesselJobs.size} Selected
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Anchor className="h-4 w-4 text-cyan-600" />
                    Vessel Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingVesselJobs ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : vesselJobsData.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No vessel jobs found</div>
                    ) : (
                      <table className="w-full" data-testid="table-vessel-jobs">
                        <thead>
                          <tr className="border-b">
                            <th className="sticky top-0 bg-gray-50 z-10 w-8 px-3 py-2">
                              <Checkbox
                                checked={vesselJobsData.length > 0 && selectedVesselJobs.size === vesselJobsData.length}
                                className="h-3.5 w-3.5"
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const allKeys = new Set(vesselJobsData.map((j: any) => `${j.jobNo || j.id}|${j.componentCode || ""}`));
                                    setSelectedVesselJobs(allKeys);
                                  } else {
                                    setSelectedVesselJobs(new Set());
                                  }
                                }}
                                data-testid="checkbox-vessel-jobs-select-all"
                              />
                            </th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Title</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...vesselJobsData].sort((a: any, b: any) => (a.componentCode || "").localeCompare(b.componentCode || "")).map((job: any) => {
                            const vesselJobKey = `${job.jobNo || job.id}|${job.componentCode || ""}`;
                            const isSelected = selectedVesselJobs.has(vesselJobKey);
                            const isLinked = jobLinkedVesselJobIds.has(job.id);
                            return (
                              <tr
                                key={vesselJobKey}
                                className={`border-b text-xs cursor-pointer ${isSelected ? "bg-cyan-50 border-l-2 border-l-cyan-500" : isLinked ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-blue-50/50"}`}
                                onClick={() => {
                                  setSelectedVesselJobs((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(vesselJobKey)) next.delete(vesselJobKey);
                                    else next.add(vesselJobKey);
                                    return next;
                                  });
                                }}
                                data-testid={`row-vessel-job-${job.id}`}
                              >
                                <td className="px-3 py-1.5 w-8">
                                  <Checkbox
                                    checked={isSelected}
                                    className="h-3.5 w-3.5"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => {
                                      setSelectedVesselJobs((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(vesselJobKey)) next.delete(vesselJobKey);
                                        else next.add(vesselJobKey);
                                        return next;
                                      });
                                    }}
                                    data-testid={`checkbox-vessel-job-${job.id}`}
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">{job.componentCode || "-"}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">{job.fleetJobCode || job.jobNo}</td>
                                <td className="px-3 py-2 text-gray-600">{job.jobTitle}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="spares">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span data-testid="text-spare-mapped-count">Mapped: {spareMappedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span data-testid="text-spare-unmapped-count">Not Mapped: {spareUnmappedCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedVessel || isLoading}
                className="border-cyan-500 text-cyan-600"
                onClick={handleSpareAutoMatch}
                data-testid="button-spare-auto-match"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Auto-Match
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSparesResync}
                disabled={isLoading}
                data-testid="button-spare-resync"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Re-sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedVessel}
                className="border-green-500 text-green-600"
                data-testid="button-spare-export"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>

          {!selectedVessel ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Ship className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a Vessel</h3>
                  <p className="text-sm">Choose a vessel from the dropdown above to view and manage spares mappings</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Package className="h-4 w-4 text-cyan-600" />
                    Fleet Spares
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingFleetSpares ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : fleetSparesData.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No fleet spares found</div>
                    ) : (
                      <table className="w-full" data-testid="table-fleet-spares">
                        <thead>
                          <tr className="border-b">
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...fleetSparesData].sort((a, b) => (a.fleetEquipmentCode || "").localeCompare(b.fleetEquipmentCode || "")).map((spare) => {
                            const compositeKey = `${spare.fleetEquipmentCode}|${spare.partCode}`;
                            const isSelected = selectedFleetSpare === compositeKey;
                            const isMapped = spareMappingsData.some((m) => m.fleetEquipmentCode === spare.fleetEquipmentCode && m.partCode === spare.partCode);
                            return (
                              <tr
                                key={spare.id}
                                className={`border-b text-xs cursor-pointer ${isSelected ? "bg-cyan-50 border-l-2 border-l-cyan-500" : isMapped ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-blue-50/50"}`}
                                onClick={() => setSelectedFleetSpare(compositeKey)}
                                data-testid={`row-fleet-spare-${spare.id}`}
                              >
                                <td className="px-3 py-2 font-mono text-gray-600">{spare.fleetEquipmentCode}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">{spare.partCode}</td>
                                <td className="px-3 py-2 text-gray-600">{spare.partName}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Link2 className="h-4 w-4 text-gray-500" />
                    Mapping Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedFleetSpare ? (
                    <div className="text-center py-8 text-gray-400">
                      <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Select a fleet spare to view or create mappings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Selected Fleet Spare</div>
                        <div className="font-medium text-sm">{selectedFleetSpareData?.partCode}</div>
                        <div className="text-xs text-gray-600 truncate">{selectedFleetSpareData?.partName}</div>
                        <div className="text-xs text-gray-400 mt-1 font-mono">{selectedFleetSpareData?.fleetEquipmentCode}</div>
                      </div>

                      {selectedFleetSpareLinkedDetails.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-gray-500">Linked Vessel Spares ({selectedFleetSpareLinkedDetails.length})</div>
                            {selectedFleetSpareLinkedDetails.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-red-500"
                                onClick={handleRemoveAllSpareMappings}
                                data-testid="button-remove-all-spare-mappings"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove All
                              </Button>
                            )}
                          </div>
                          {selectedFleetSpareLinkedDetails.map((m) => (
                            <div key={`${m.partCode}-${m.vesselCode}`} className="p-2 border rounded-md flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{m.vesselPartCode}</div>
                                <div className="text-xs text-gray-500 truncate">{m.vesselPartName}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveSpareMapping(m)}
                                className="text-red-500 shrink-0"
                                data-testid={`button-remove-spare-mapping-${m.partCode}`}
                              >
                                <span className="text-xs">x</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Badge variant="secondary" className="text-xs">Not Mapped</Badge>
                          <p className="text-xs text-gray-500 mt-2">Select a vessel spare on the right to create a mapping</p>
                        </div>
                      )}

                      {selectedVesselSpares.size > 0 && selectedFleetSpare && (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 text-center">
                            {selectedVesselSpares.size} vessel spare{selectedVesselSpares.size > 1 ? "s" : ""} selected
                          </div>
                          <Button
                            onClick={handleManualSpareMap}
                            className="w-full bg-cyan-600 text-white"
                            data-testid="button-create-spare-mapping"
                          >
                            Link {selectedVesselSpares.size} Selected
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Anchor className="h-4 w-4 text-cyan-600" />
                    Vessel Spares
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {isLoadingVesselSpares ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                      </div>
                    ) : vesselSparesData.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No vessel spares found</div>
                    ) : (
                      <table className="w-full" data-testid="table-vessel-spares">
                        <thead>
                          <tr className="border-b">
                            <th className="sticky top-0 bg-gray-50 z-10 w-8 px-2 py-2"></th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Code</th>
                            <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...vesselSparesData].sort((a: any, b: any) => (a.componentCode || "").localeCompare(b.componentCode || "")).map((spare: any) => {
                            const spareId = String(spare.id);
                            const isChecked = selectedVesselSpares.has(spareId);
                            const isLinked = spareLinkedVesselSpareIds.has(spareId);
                            return (
                              <tr
                                key={spare.id}
                                className={`border-b text-xs cursor-pointer ${isChecked ? "bg-cyan-50 border-l-2 border-l-cyan-500" : isLinked ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-blue-50/50"}`}
                                onClick={() => {
                                  setSelectedVesselSpares((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(spareId)) next.delete(spareId);
                                    else next.add(spareId);
                                    return next;
                                  });
                                }}
                                data-testid={`row-vessel-spare-${spare.id}`}
                              >
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="h-3.5 w-3.5 rounded border-gray-300"
                                    data-testid={`checkbox-vessel-spare-${spare.id}`}
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">{spare.componentCode || "-"}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">{spare.partCode}</td>
                                <td className="px-3 py-2 text-gray-600">{spare.partName}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={autoMatchDialogOpen} onOpenChange={setAutoMatchDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ width: "50vw", maxWidth: "50vw", maxHeight: "85vh" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 flex items-center justify-between gap-2 rounded-t-lg flex-wrap">
            <div className="flex items-center gap-2">
              <Ship className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Results (Is Parent = No only)</DialogTitle>
            </div>
            <Button
              onClick={handleCreateAutoMappings}
              className="h-6 px-2 text-[10px] bg-white text-blue-700 hover:bg-gray-100"
              data-testid="button-create-auto-mappings"
            >
              Create Mapping
            </Button>
          </div>
          {autoMatchProgress && (
            <div className="px-4 py-3 border-b bg-blue-50/50" data-testid="auto-match-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">
                  Processing {autoMatchProgress.current} of {autoMatchProgress.total}...
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round((autoMatchProgress.current / autoMatchProgress.total) * 100)}%
                </span>
              </div>
              <Progress value={(autoMatchProgress.current / autoMatchProgress.total) * 100} className="h-2" />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-500">Linked: {autoMatchProgress.linked}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-gray-500">Failed: {autoMatchProgress.failed}</span>
                </div>
              </div>
            </div>
          )}
          <ScrollArea className="max-h-[70vh]">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Name</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {autoMatchEntries.map((entry) => (
                  <tr key={entry.vesselComponentCode} className="border-b text-xs hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-mono">{entry.vesselComponentCode}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{entry.vesselComponentName}</td>
                    <td className="px-3 py-2 font-mono">{entry.fleetEquipmentCode || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {entry.matched ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Matched</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">No Match</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {autoMatchEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 text-xs">No vessel components to match</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={jobAutoMatchDialogOpen} onOpenChange={setJobAutoMatchDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ width: "60vw", maxWidth: "60vw", maxHeight: "85vh" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 flex items-center justify-between gap-2 rounded-t-lg flex-wrap">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Results — Jobs Mapping</DialogTitle>
            </div>
            <Button
              onClick={handleCreateJobAutoMappings}
              className="h-6 px-2 text-[10px] bg-white text-blue-700 hover:bg-gray-100"
              data-testid="button-create-job-auto-mappings"
            >
              Create Mapping
            </Button>
          </div>
          {jobAutoMatchProgress && (
            <div className="px-4 py-3 border-b bg-blue-50/50" data-testid="job-auto-match-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">
                  Processing {jobAutoMatchProgress.current} of {jobAutoMatchProgress.total}...
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round((jobAutoMatchProgress.current / jobAutoMatchProgress.total) * 100)}%
                </span>
              </div>
              <Progress value={(jobAutoMatchProgress.current / jobAutoMatchProgress.total) * 100} className="h-2" />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-500">Linked: {jobAutoMatchProgress.linked}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-gray-500">Failed: {jobAutoMatchProgress.failed}</span>
                </div>
              </div>
            </div>
          )}
          <ScrollArea className="max-h-[70vh]">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Name</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Job Title</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobAutoMatchEntries.map((entry, idx) => (
                  <tr key={`${entry.jobCode}-${entry.fleetEquipmentCode}-${idx}`} className="border-b text-xs hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-mono">{entry.fleetEquipmentCode || "-"}</td>
                    <td className="px-3 py-2 font-mono">{entry.componentCode || "-"}</td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{entry.componentName || "-"}</td>
                    <td className="px-3 py-2 font-mono">{entry.jobCode}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{entry.jobTitle}</td>
                    <td className="px-3 py-2 text-center">
                      {entry.matched ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Matched</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">No Match</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {jobAutoMatchEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">No vessel jobs to match</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={spareAutoMatchDialogOpen} onOpenChange={setSpareAutoMatchDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ width: "60vw", maxWidth: "60vw", maxHeight: "85vh" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 flex items-center justify-between gap-2 rounded-t-lg flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Results — Spares Mapping</DialogTitle>
            </div>
            <Button
              onClick={handleCreateSpareAutoMappings}
              className="h-6 px-2 text-[10px] bg-white text-blue-700"
              data-testid="button-create-spare-auto-mappings"
            >
              Create Mapping
            </Button>
          </div>
          {spareAutoMatchProgress && (
            <div className="px-4 py-3 border-b bg-blue-50/50" data-testid="spare-auto-match-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">
                  Processing {spareAutoMatchProgress.current} of {spareAutoMatchProgress.total}...
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round((spareAutoMatchProgress.current / spareAutoMatchProgress.total) * 100)}%
                </span>
              </div>
              <Progress value={(spareAutoMatchProgress.current / spareAutoMatchProgress.total) * 100} className="h-2" />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-500">Linked: {spareAutoMatchProgress.linked}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-gray-500">Failed: {spareAutoMatchProgress.failed}</span>
                </div>
              </div>
            </div>
          )}
          <ScrollArea className="max-h-[70vh]">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Part Name</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Vessel Part Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Vessel Part Name</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {spareAutoMatchEntries.map((entry, idx) => (
                  <tr key={`${entry.partCode}-${entry.fleetEquipmentCode}-${idx}`} className="border-b text-xs hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-mono">{entry.fleetEquipmentCode || "-"}</td>
                    <td className="px-3 py-2 font-mono">{entry.partCode || "-"}</td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{entry.partName || "-"}</td>
                    <td className="px-3 py-2 font-mono">{entry.vesselPartCode || "-"}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{entry.vesselPartName || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {entry.matched ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Matched</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">No Match</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {spareAutoMatchEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">No vessel spares to match</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ maxWidth: "400px" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Summary</DialogTitle>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm" data-testid="text-summary-linked">Successfully Linked: {summaryData.linked}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm" data-testid="text-summary-not-linked">Not Linked: {summaryData.notLinked}</span>
            </div>
            <Button onClick={() => setSummaryDialogOpen(false)} className="w-full" data-testid="button-close-summary">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
