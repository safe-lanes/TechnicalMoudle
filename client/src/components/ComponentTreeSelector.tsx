import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  maker?: string;
  model?: string;
  serialNo?: string;
  deptCategory?: string;
  componentCategory?: string;
  location?: string;
  commissionedDate?: string;
  critical?: boolean;
  classItem?: boolean;
  children?: ComponentNode[];
}

interface ComponentTreeSelectorProps {
  components: ComponentNode[];
  selectedItem: ComponentNode | null;
  onSelect: (item: ComponentNode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ComponentTreeSelector({
  components,
  selectedItem,
  onSelect,
  searchQuery,
  onSearchChange
}: ComponentTreeSelectorProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const filterComponents = (nodes: ComponentNode[], query: string): ComponentNode[] => {
    if (!query) return nodes;
    
    const lowerQuery = query.toLowerCase();
    return nodes.reduce((acc: ComponentNode[], node) => {
      const matches = 
        node.name.toLowerCase().includes(lowerQuery) ||
        node.code.toLowerCase().includes(lowerQuery);
      
      const filteredChildren = node.children ? filterComponents(node.children, query) : [];
      
      if (matches || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren
        });
      }
      
      return acc;
    }, []);
  };

  const renderComponentTree = (nodes: ComponentNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedItem?.id === node.id;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-blue-50" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              onSelect(node);
              if (hasChildren) {
                toggleNode(node.id);
              }
            }}
          >
            <button
              className="mr-2 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleNode(node.id);
                }
              }}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )
              ) : (
                <span className="w-4 h-4 inline-block" />
              )}
            </button>
            <span className="text-sm text-gray-700">
              {node.code} {node.name}
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderComponentTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const filteredComponents = filterComponents(components, searchQuery);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="pb-4">
          {filteredComponents.length > 0 ? (
            renderComponentTree(filteredComponents)
          ) : (
            <div className="text-center text-gray-500 py-8">
              No components found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}