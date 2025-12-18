// Component Category mapping based on top-level group
export const getComponentCategory = (componentIdOrCode: string): string => {
  if (!componentIdOrCode) return '';
  
  // Map top-level ID to category name
  const categoryMap: Record<string, string> = {
    '1': 'Ship General',
    '2': 'Hull',
    '3': 'Equipment for Cargo',
    '4': "Ship's Equipment",
    '5': 'Equipment for Crew & Passengers',
    '6': 'Machinery Main Components',
    '7': 'Systems for Machinery Main Components',
    '8': 'Ship Common Systems'
  };
  
  // Handle dotted IDs like "40.001" - extract first character of first segment
  if (componentIdOrCode.includes('.')) {
    const firstSegment = componentIdOrCode.split('.')[0];
    const firstChar = firstSegment.charAt(0);
    return categoryMap[firstChar] || '';
  }
  
  // Handle plain codes like "301" - extract first character
  const firstChar = componentIdOrCode.charAt(0);
  return categoryMap[firstChar] || '';
};

// Find a component node by ID in the tree
export const findComponentNode = (
  nodes: any[], 
  targetId: string
): any | null => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }
    if (node.children) {
      const found = findComponentNode(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

// Build component tree from flat list
export const buildComponentTree = (components: any[]): any[] => {
  if (!components || components.length === 0) return [];
  
  // Create a map for quick lookup
  const componentMap = new Map();
  components.forEach(comp => {
    componentMap.set(comp.id || comp.componentId, { ...comp, children: [] });
  });
  
  const tree: any[] = [];
  
  // Build the tree structure
  components.forEach(comp => {
    const node = componentMap.get(comp.id || comp.componentId);
    if (comp.parentId) {
      const parent = componentMap.get(comp.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // If parent not found, add to root
        tree.push(node);
      }
    } else {
      // No parent means it's a root node
      tree.push(node);
    }
  });
  
  // Sort nodes at each level by code
  const sortTree = (nodes: any[]) => {
    nodes.sort((a, b) => {
      const aCode = a.code || a.componentCode || '';
      const bCode = b.code || b.componentCode || '';
      return aCode.localeCompare(bCode, undefined, { numeric: true });
    });
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortTree(node.children);
      }
    });
  };
  
  sortTree(tree);
  return tree;
};