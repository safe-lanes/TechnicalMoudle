import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { officeReviewerRolesEqual } from "@shared/officeReviewer";

interface FieldChange {
  fieldName: string;
  originalValue: any;
  currentValue: any;
  timestamp: Date;
}

interface ModifyModeState {
  isModifyMode: boolean;
  targetType: string | null;
  targetId: string | null;
  fieldChanges: Record<string, FieldChange>;
  originalSnapshot: Record<string, any>;
}

export function useModifyMode() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  
  const [state, setState] = useState<ModifyModeState>({
    isModifyMode: searchParams.get("modify") === "1",
    targetType: searchParams.get("targetType"),
    targetId: searchParams.get("targetId"),
    fieldChanges: {},
    originalSnapshot: {}
  });

  // Update state when URL changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(search);
    setState(prev => ({
      ...prev,
      isModifyMode: newSearchParams.get("modify") === "1",
      targetType: newSearchParams.get("targetType"),
      targetId: newSearchParams.get("targetId")
    }));
  }, [search]);

  // Enable modify mode for a specific target
  const enableModifyMode = useCallback((targetType: string, targetId?: string) => {
    const newParams = new URLSearchParams(search);
    newParams.set("modify", "1");
    newParams.set("targetType", targetType);
    if (targetId) {
      newParams.set("targetId", targetId);
    }
    setLocation(`${location.split('?')[0]}?${newParams.toString()}`);
  }, [location, search, setLocation]);

  // Disable modify mode
  const disableModifyMode = useCallback(() => {
    const newParams = new URLSearchParams(search);
    newParams.delete("modify");
    newParams.delete("targetType");
    newParams.delete("targetId");
    
    const newSearch = newParams.toString();
    setLocation(`${location.split('?')[0]}${newSearch ? `?${newSearch}` : ''}`);
    
    // Clear field changes
    setState(prev => ({
      ...prev,
      fieldChanges: {},
      originalSnapshot: {}
    }));
  }, [location, search, setLocation]);

  // Set original snapshot for comparison
  const setOriginalSnapshot = useCallback((snapshot: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      originalSnapshot: snapshot
    }));
  }, []);

  // Track field changes
  const trackFieldChange = useCallback((fieldName: string, newValue: any, oldValue?: any) => {
    setState(prev => {
      const originalValue = fieldName === 'officeReviewerRoleRuids'
        ? (prev.fieldChanges[fieldName]?.originalValue ?? prev.originalSnapshot[fieldName] ?? oldValue ?? [])
        : (oldValue !== undefined ? oldValue : prev.originalSnapshot[fieldName]);
      
      // If the new value equals the original value, remove the change
      if (fieldName === 'officeReviewerRoleRuids'
        ? officeReviewerRolesEqual(newValue, originalValue)
        : newValue === originalValue) {
        const { [fieldName]: removed, ...remainingChanges } = prev.fieldChanges;
        return {
          ...prev,
          fieldChanges: remainingChanges
        };
      }

      // Add or update the field change
      return {
        ...prev,
        fieldChanges: {
          ...prev.fieldChanges,
          [fieldName]: {
            fieldName,
            originalValue,
            currentValue: newValue,
            timestamp: new Date()
          }
        }
      };
    });
  }, []);

  // Get change summary
  const getChangeSummary = useCallback(() => {
    const changes = Object.values(state.fieldChanges);
    return {
      hasChanges: changes.length > 0,
      changedFieldsCount: changes.length,
      changes: changes
    };
  }, [state.fieldChanges]);

  // Generate change request payload
  const generateChangeRequestPayload = useCallback(() => {
    const changes = Object.values(state.fieldChanges);
    if (changes.length === 0) return null;

    return {
      category: state.targetType,
      targetType: state.targetType,
      targetId: state.targetId,
      snapshotBefore: state.originalSnapshot,
      proposedChanges: changes.map(change => ({
        field: change.fieldName,
        from: change.originalValue,
        to: change.currentValue,
        timestamp: change.timestamp.toISOString()
      }))
    };
  }, [state]);

  return {
    isModifyMode: state.isModifyMode,
    targetType: state.targetType,
    targetId: state.targetId,
    enableModifyMode,
    disableModifyMode,
    setOriginalSnapshot,
    trackFieldChange,
    getChangeSummary,
    generateChangeRequestPayload,
    fieldChanges: state.fieldChanges
  };
}