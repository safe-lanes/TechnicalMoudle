import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Component, Job, Spare, MasterData } from "@shared/schema";

interface MappedFleetComponent {
  id: string | number;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  componentCode?: string | null;
  name?: string | null;
  maker?: string | null;
  makerCode?: string | null;
  model?: string | null;
  modelCode?: string | null;
  location?: string | null;
  rating?: string | null;
  notes?: string | null;
  category?: string | null;
  componentCategory?: string | null;
  department?: string | null;
  eqptSystemDept?: string | null;
  parentFleetEquipmentCode?: string | null;
  sfiCode?: string | null;
  vesselId?: string | null;
  vesselName?: string | null;
  vesselCode?: string | null;
  assignedSubCode?: string | null;
}

function mapMasterDataToFleetComponent(item: MasterData): MappedFleetComponent {
  const fleetCode = item.fleetEquipmentCode;
  const parentCode = item.assignedSubCode 
    ? fleetCode.replace(new RegExp(`\\.${item.assignedSubCode}$`), '') 
    : (fleetCode.includes('.') ? fleetCode.split('.').slice(0, -1).join('.') : null);
  
  return {
    id: item.id,
    fleetEquipmentCode: fleetCode,
    fleetEquipmentName: item.equipmentName,
    componentCode: fleetCode,
    name: item.equipmentName,
    maker: item.makerName,
    makerCode: item.makerCode,
    model: item.model,
    modelCode: item.modelCode,
    sfiCode: item.sfiCode,
    location: null,
    rating: null,
    notes: null,
    category: item.sfiCode?.substring(0, 1) || null,
    componentCategory: null,
    department: null,
    eqptSystemDept: null,
    parentFleetEquipmentCode: parentCode,
    vesselId: item.vesselCode || null,
    vesselName: item.vesselName || null,
    vesselCode: item.vesselCode || null,
    assignedSubCode: item.assignedSubCode || null,
  };
}

type FleetComponent = MappedFleetComponent;
type FleetJob = Job;
type FleetSpare = Spare;

interface TreeNode {
  code: string;
  name: string;
  children: TreeNode[];
  data?: FleetComponent;
  isExpanded?: boolean;
}

function buildTree(components: FleetComponent[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  const sfiCategories = [
    { code: "1", name: "Ship General" },
    { code: "2", name: "Hull" },
    { code: "3", name: "Equipment for Cargo" },
    { code: "4", name: "Ship's Equipment" },
    { code: "5", name: "Equipment for Crew & Passengers" },
    { code: "6", name: "Machinery Main Components" },
    { code: "7", name: "Systems for Machinery Main Components" },
    { code: "8", name: "Ship Common Systems" },
  ];

  sfiCategories.forEach((cat) => {
    const node: TreeNode = {
      code: cat.code,
      name: cat.name,
      children: [],
      isExpanded: false,
    };
    nodeMap.set(cat.code, node);
    rootNodes.push(node);
  });

  const groupedByPrefix = new Map<string, FleetComponent[]>();
  components.forEach((comp) => {
    const code = comp.fleetEquipmentCode || comp.componentCode || comp.id;
    if (!code) return;
    const prefix = code.charAt(0);
    if (!groupedByPrefix.has(prefix)) {
      groupedByPrefix.set(prefix, []);
    }
    groupedByPrefix.get(prefix)!.push(comp);
  });

  groupedByPrefix.forEach((items, prefix) => {
    const parentNode = nodeMap.get(prefix);
    if (parentNode) {
      const subGroups = new Map<string, FleetComponent[]>();
      items.forEach((item) => {
        const code = item.fleetEquipmentCode || item.componentCode || item.id;
        if (!code) return;
        const parts = code.split(".");
        const subPrefix = parts.length > 0 ? parts[0] : code;
        if (!subGroups.has(subPrefix)) {
          subGroups.set(subPrefix, []);
        }
        subGroups.get(subPrefix)!.push(item);
      });

      subGroups.forEach((subItems, subCode) => {
        if (subItems.length === 1 && subCode.length <= 2) {
          const item = subItems[0];
          const childNode: TreeNode = {
            code: item.fleetEquipmentCode || item.componentCode || item.id,
            name: item.fleetEquipmentName || item.name || "Unknown",
            children: [],
            data: item,
          };
          parentNode.children.push(childNode);
        } else {
          const firstItem = subItems[0];
          const subNode: TreeNode = {
            code: subCode,
            name: firstItem?.fleetEquipmentName || firstItem?.name || `Group ${subCode}`,
            children: [],
            isExpanded: false,
          };

          subItems.forEach((item) => {
            const leafNode: TreeNode = {
              code: item.fleetEquipmentCode || item.componentCode || item.id,
              name: item.fleetEquipmentName || item.name || "Unknown",
              children: [],
              data: item,
            };
            subNode.children.push(leafNode);
          });

          if (subNode.children.length === 1) {
            parentNode.children.push(subNode.children[0]);
          } else {
            parentNode.children.push(subNode);
          }
        }
      });
    }
  });

  return rootNodes;
}

function TreeItem({
  node,
  level = 0,
  selectedCode,
  onSelect,
  expandedNodes,
  onToggle,
}: {
  node: TreeNode;
  level?: number;
  selectedCode: string | null;
  onSelect: (node: TreeNode) => void;
  expandedNodes: Set<string>;
  onToggle: (code: string) => void;
}) {
  const isExpanded = expandedNodes.has(node.code);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedCode === node.code;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 ${
          isSelected ? "bg-blue-100 text-blue-800" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            onToggle(node.code);
          }
          onSelect(node);
        }}
        data-testid={`tree-node-${node.code}`}
      >
        {hasChildren ? (
          <span className="mr-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </span>
        ) : (
          <span className="mr-2 w-4" />
        )}
        <span className={`text-sm ${level === 0 ? "font-medium" : ""}`}>
          {node.code}. {node.name}
        </span>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.code}
            node={child}
            level={level + 1}
            selectedCode={selectedCode}
            onSelect={onSelect}
            expandedNodes={expandedNodes}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export default function FleetDataView() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: masterDataResponse, isLoading: isComponentsLoading } = useQuery<{
    items: MasterData[];
    total: number;
  }>({
    queryKey: ["/api/fleet-admin/master-data?limit=1000"],
  });

  const { data: fleetJobs } = useQuery<FleetJob[]>({
    queryKey: ["/api/fleet/jobs"],
  });

  const { data: fleetSpares } = useQuery<FleetSpare[]>({
    queryKey: ["/api/fleet/spares"],
  });

  const { data: vessels } = useQuery<{ id: string; code?: string; name: string }[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: componentVesselMappings } = useQuery<{ componentId: string; fleetEquipmentCode: string; vesselId: string; vesselCode: string; vesselName: string }[]>({
    queryKey: ["/api/fleet-admin/component-vessel-mappings"],
  });

  const mappedComponents = useMemo(() => {
    if (!masterDataResponse?.items) return [];
    return masterDataResponse.items.map(mapMasterDataToFleetComponent);
  }, [masterDataResponse?.items]);

  const treeData = useMemo(() => {
    if (!mappedComponents.length) return [];
    return buildTree(mappedComponents);
  }, [mappedComponents]);

  const handleToggle = (code: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const selectedComponent = selectedNode?.data;

  const relatedJobs = useMemo(() => {
    if (!selectedComponent || !fleetJobs) return [];
    return fleetJobs.filter(
      (job: FleetJob) =>
        job.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
        job.componentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetJobs]);

  const relatedSpares = useMemo(() => {
    if (!selectedComponent || !fleetSpares) return [];
    return fleetSpares.filter(
      (spare: FleetSpare) =>
        spare.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
        spare.componentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetSpares]);

  const relatedVessels = useMemo(() => {
    if (!selectedComponent) return [];
    
    // First check if we have component-vessel mappings
    if (componentVesselMappings && componentVesselMappings.length > 0) {
      const mappings = componentVesselMappings.filter(
        (m) => m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
               m.componentId === selectedComponent.id
      );
      if (mappings.length > 0) {
        return mappings.map(m => ({
          id: m.vesselCode,
          name: m.vesselName
        }));
      }
    }
    
    // Fallback: if component has vesselId, find that vessel
    if (selectedComponent.vesselId && vessels) {
      const vessel = vessels.find((v) => v.id === selectedComponent.vesselId);
      if (vessel) {
        return [{ id: vessel.code || vessel.id, name: vessel.name }];
      }
    }
    
    return [];
  }, [selectedComponent, vessels, componentVesselMappings]);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-gray-50">
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="bg-cyan-600 text-white px-4 py-3 font-semibold">
          Fleet Components
        </div>
        <ScrollArea className="flex-1">
          {isComponentsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-gray-100 animate-pulse rounded"
                />
              ))}
            </div>
          ) : (
            <div className="py-2">
              {treeData.map((node) => (
                <TreeItem
                  key={node.code}
                  node={node}
                  selectedCode={selectedNode?.code || null}
                  onSelect={setSelectedNode}
                  expandedNodes={expandedNodes}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {selectedComponent ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-600">
                {selectedComponent.fleetEquipmentCode}{" "}
                {selectedComponent.fleetEquipmentName}
              </h2>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                data-testid="button-add-edit-fleet-component"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add / Edit Fleet Component
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-cyan-600">
                  Fleet Component Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Maker</div>
                    <div className="font-medium">
                      {selectedComponent.maker || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Maker Code</div>
                    <div className="font-medium">
                      {selectedComponent.makerCode || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Model</div>
                    <div className="font-medium">
                      {selectedComponent.model || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Model Code</div>
                    <div className="font-medium">
                      {selectedComponent.modelCode || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 text-xs">
                      Fleet Equipment Code
                    </div>
                    <div className="font-medium">
                      {selectedComponent.fleetEquipmentCode || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Parent Code</div>
                    <div className="font-medium">
                      {selectedComponent.parentFleetEquipmentCode ||
                        selectedComponent.fleetEquipmentCode?.split(".")[0] ||
                        "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 text-xs">
                      Fleet Equipment Name
                    </div>
                    <div className="font-medium">
                      {selectedComponent.fleetEquipmentName || selectedComponent.name || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 text-xs">
                      Component Category
                    </div>
                    <div className="font-medium">
                      {selectedComponent.componentCategory || selectedComponent.category || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Location</div>
                    <div className="font-medium">
                      {selectedComponent.location || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Rating</div>
                    <div className="font-medium">
                      {selectedComponent.rating || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">
                      Eqpt / System Department
                    </div>
                    <div className="font-medium">
                      {selectedComponent.eqptSystemDept || selectedComponent.department || "—"}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <div className="text-gray-500 text-xs">Notes</div>
                    <div className="font-medium">
                      {selectedComponent.notes || "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-orange-500">
                  Fleet Job Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedJobs.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">Job No.</th>
                        <th className="text-left py-2 font-normal">
                          Job Title
                        </th>
                        <th className="text-left py-2 font-normal">
                          Task Type
                        </th>
                        <th className="text-left py-2 font-normal">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedJobs.map((job: FleetJob, index: number) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">{job.fleetJobCode || job.jobNo || job.id}</td>
                          <td className="py-2">
                            {job.jobTitle || "—"}
                          </td>
                          <td className="py-2">
                            {job.maintenanceType || "—"}
                          </td>
                          <td className="py-2">
                            {job.frequencyValue && job.frequencyUnit 
                              ? `${job.frequencyValue} ${job.frequencyUnit}` 
                              : job.intervalRunningHour 
                                ? `${job.intervalRunningHour} RH` 
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No jobs linked to this component
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-green-600">
                  Fleet Spares Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedSpares.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">
                          Part Code
                        </th>
                        <th className="text-left py-2 font-normal">
                          Part Name
                        </th>
                        <th className="text-left py-2 font-normal">
                          Part Number
                        </th>
                        <th className="text-left py-2 font-normal">Maker</th>
                        <th className="text-left py-2 font-normal">
                          Unit Of Measurement
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedSpares.map((spare: FleetSpare, index: number) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">
                            {spare.fleetPartCode || spare.partCode}
                          </td>
                          <td className="py-2">
                            {spare.partName || "—"}
                          </td>
                          <td className="py-2">{spare.partNumber || "—"}</td>
                          <td className="py-2">{spare.maker || "—"}</td>
                          <td className="py-2">{spare.uom || spare.unit || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No spares linked to this component
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-purple-600">
                  Vessel Mapping Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedVessels.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">
                          Vessel Code
                        </th>
                        <th className="text-left py-2 font-normal">
                          Vessel Name
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedVessels.map((vessel, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">{vessel.id}</td>
                          <td className="py-2">{vessel.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No vessels mapped to this component
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderTree className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a component from the tree</p>
              <p className="text-sm">
                to view its details, jobs, spares, and vessel mappings
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FolderTree(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z" />
      <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.88-.55H13a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1Z" />
      <path d="M3 5a2 2 0 0 0 2 2h3" />
      <path d="M3 3v13a2 2 0 0 0 2 2h3" />
    </svg>
  );
}
