import { storage } from "../storage";
import type { Component, InsertComponent } from "@shared/schema";

/**
 * Component Service
 * Handles all business logic related to hierarchical component management
 * Components are organized in a tree structure using parentId (which stores component codes)
 */

export class ComponentService {
  /**
   * Get all components for a vessel
   */
  async getComponents(vesselId: string): Promise<Component[]> {
    return storage.getComponents(vesselId);
  }

  /**
   * Get a single component by ID
   */
  async getComponent(id: string): Promise<Component | undefined> {
    return storage.getComponent(id);
  }

  /**
   * Get component by component code
   */
  async getComponentByCode(vesselId: string, componentCode: string): Promise<Component | undefined> {
    const components = await this.getComponents(vesselId);
    return components.find(c => c.componentCode === componentCode);
  }

  /**
   * Create a new component
   */
  async createComponent(componentData: InsertComponent): Promise<Component> {
    // Validate that parent component exists if parentId is provided
    if (componentData.parentId && componentData.vesselId) {
      const parentComponent = await this.getComponentByCode(
        componentData.vesselId,
        componentData.parentId
      );
      
      if (!parentComponent) {
        throw new Error(`Parent component with code ${componentData.parentId} not found`);
      }
    }

    return storage.createComponent(componentData);
  }

  /**
   * Update an existing component
   */
  async updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component> {
    return storage.updateComponent(id, updates);
  }

  /**
   * Delete a component (and optionally cascade to children)
   */
  async deleteComponent(id: string): Promise<void> {
    return storage.deleteComponent(id);
  }

  /**
   * Get all child components for a parent component code
   */
  async getChildComponents(vesselId: string, parentCode: string): Promise<Component[]> {
    const allComponents = await this.getComponents(vesselId);
    return allComponents.filter(c => c.parentId === parentCode);
  }

  /**
   * Get all descendant components (children, grandchildren, etc.)
   */
  async getAllDescendants(vesselId: string, parentCode: string): Promise<Component[]> {
    const allComponents = await this.getComponents(vesselId);
    const descendants: Component[] = [];
    
    const findDescendants = (code: string) => {
      const children = allComponents.filter(c => c.parentId === code);
      for (const child of children) {
        descendants.push(child);
        if (child.componentCode) {
          findDescendants(child.componentCode);
        }
      }
    };
    
    findDescendants(parentCode);
    return descendants;
  }

  /**
   * Get component hierarchy (tree structure)
   */
  async getComponentHierarchy(vesselId: string): Promise<Component[]> {
    const components = await this.getComponents(vesselId);
    
    // Build a map for quick lookups
    const componentMap = new Map<string, Component>();
    for (const component of components) {
      if (component.componentCode) {
        componentMap.set(component.componentCode, component);
      }
    }
    
    // Attach children to their parents
    const rootComponents: Component[] = [];
    for (const component of components) {
      if (!component.parentId || component.parentId === '0') {
        rootComponents.push(component);
      }
    }
    
    return rootComponents;
  }

  /**
   * Get component path (breadcrumb from root to component)
   */
  async getComponentPath(vesselId: string, componentCode: string): Promise<Component[]> {
    const allComponents = await this.getComponents(vesselId);
    const componentMap = new Map<string, Component>();
    
    for (const component of allComponents) {
      if (component.componentCode) {
        componentMap.set(component.componentCode, component);
      }
    }
    
    const path: Component[] = [];
    let current = componentMap.get(componentCode);
    
    while (current) {
      path.unshift(current);
      if (!current.parentId || current.parentId === '0') {
        break;
      }
      if (current.parentId) {
        current = componentMap.get(current.parentId);
      } else {
        break;
      }
    }
    
    return path;
  }

  /**
   * Check if a component has children
   */
  async hasChildren(vesselId: string, componentCode: string): Promise<boolean> {
    const children = await this.getChildComponents(vesselId, componentCode);
    return children.length > 0;
  }

  /**
   * Bulk create components (used during upload/import)
   */
  async bulkCreateComponents(components: InsertComponent[]): Promise<Component[]> {
    return storage.bulkCreateComponents(components);
  }

  /**
   * Bulk update components
   */
  async bulkUpdateComponents(components: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]> {
    return storage.bulkUpdateComponents(components);
  }

  /**
   * Bulk upsert components
   */
  async bulkUpsertComponents(components: InsertComponent[]): Promise<{ created: number; updated: number }> {
    return storage.bulkUpsertComponents(components);
  }

  /**
   * Validate component data
   */
  validateComponentData(componentData: Partial<InsertComponent>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!componentData.componentCode) {
      errors.push('Component code is required');
    }

    if (!componentData.name) {
      errors.push('Component name is required');
    }

    if (!componentData.vesselId) {
      errors.push('Vessel ID is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const componentService = new ComponentService();
