import React, { useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Edit2, FileText, ArrowLeft, Plus, Check, Package, X, AlertCircle, CheckCircle, HelpCircle, File, FileImage, FileCheck, Upload, Download, Lock, Wrench, User, ClipboardList, MessageSquare, MapPin, Pencil, Expand, Minimize2 } from "lucide-react";
import { Marker } from "@/components/Marker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { AdminOnly } from "@/components/RoleGuard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ComponentRegisterForm from "@/components/ComponentRegisterForm";
import ComponentRegisterFormCR from "@/components/ComponentRegisterFormCR";
import AddEditComponentForm from "@/components/AddEditComponentForm";
import ComponentRegisterAddEdit from "@/components/ComponentRegisterAddEdit";
import { ReviewChangesDrawer } from "@/components/ReviewChangesDrawer";
import { useChangeRequest } from "@/contexts/ChangeRequestContext";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useLocation } from "wouter";
import { getComponentCategory } from "@/utils/componentUtils";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { FEATURES } from '@/config/features';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { useVessels } from "@/hooks/useVessels";
import { formatProfessionalDate } from "@/lib/dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WorkOrderViewerSheet } from "@/components/WorkOrderViewerSheet";

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  actualId?: string; // The actual database UUID for API calls
  children?: ComponentNode[];
  isExpanded?: boolean;
  critical?: boolean;
  [key: string]: any; // Allow additional properties from component data
}


const ComponentInformationSection: React.FC<{ isExpanded: boolean; selectedComponent: ComponentNode | null; isModifyMode?: boolean; onDataChange?: (data: any) => void; previewChanges?: any[]; isPreviewMode?: boolean }> = ({ isExpanded, selectedComponent, isModifyMode = false, onDataChange, previewChanges = [], isPreviewMode = false }) => {
  const { isChangeRequestMode } = useChangeRequest();
  const { isChangeMode: contextChangeMode, collectDiff } = useChangeMode();
  const { isSailAdmin } = useUIRole();
  // isModifyMode prop controls inline editing behavior
  // contextChangeMode (from useChangeMode) is the secure way to enable non-admin visibility
  // For visibility gates, use contextChangeMode; for edit behavior, use isModifyMode
  const isChangeMode = isModifyMode; // For editing behavior (inline inputs)
  const isChangeModeForVisibility = contextChangeMode; // For role-bypass visibility (secure)

  // Helper function to check if a field has changes in preview mode
  const hasPreviewChange = (fieldName: string) => {
    if (!isPreviewMode || !previewChanges) return false;
    return previewChanges.some(change => 
      change.field === fieldName || change.fieldName === fieldName ||
      change.field === `componentInfo.${fieldName}` || change.fieldName === `componentInfo.${fieldName}`
    );
  };

  // Helper function to get the new value from preview changes
  const getPreviewValue = (fieldName: string) => {
    if (!isPreviewMode || !previewChanges) return null;
    const change = previewChanges.find(change => 
      change.field === fieldName || change.fieldName === fieldName ||
      change.field === `componentInfo.${fieldName}` || change.fieldName === `componentInfo.${fieldName}`
    );
    return change ? (change.newValue || change.currentValue) : null;
  };

  // Derive Component Category from the component's tree position
  const componentCategory = selectedComponent ? getComponentCategory(selectedComponent.id) : '';

  // Component data - uses selected component code or defaults (empty until populated from Excel)
  const [componentData, setComponentData] = useState({
    fleetEquipmentCode: "",
    fleetEquipmentName: "",
    parentComponent: "",
    componentCode: "",
    componentName: "",
    componentCategory: "",
    maker: "",
    makerCode: "",
    model: "",
    modelCode: "",
    serialNo: "",
    drawingNo: "",
    location: "",
    critical: "",
    conditionBased: "",
    installationDate: "",
    commissionedDate: "",
    rating: "",
    eqptSystemDept: "",
    notes: "",
    runningHours: "",
    isActive: "",
    vesselCode: "",
    isParent: "",
    // Legacy fields kept for compatibility
    classItem: "",
    modelNumber: "",
    department: "",
    noOfUnits: "",
    dimensionsSize: ""
  });
  
  // Track original component data for modify mode
  const [originalComponentData, setOriginalComponentData] = useState<typeof componentData | null>(null);
  
  // Update component data when selected component changes
  useEffect(() => {
    if (selectedComponent) {
      // Populate from selectedComponent data (now includes all fields from spread operator)
      const comp = selectedComponent as any;
      
      // Helper to normalize boolean/string to "Yes"/"No"/""
      const toBoolString = (val: any) => {
        if (val === true || (typeof val === 'string' && val.toLowerCase() === 'yes')) return "Yes";
        if (val === false || (typeof val === 'string' && val.toLowerCase() === 'no')) return "No";
        return "";
      };
      
      const newData = {
        fleetEquipmentCode: comp.fleetEquipmentCode || "",
        fleetEquipmentName: comp.fleetEquipmentName || "",
        parentComponent: comp.parentId || "",
        componentCode: selectedComponent.code,
        componentName: comp.name || selectedComponent.name || "",
        // Use stored componentCategory from Excel first, fall back to derived category only if not present
        componentCategory: comp.componentCategory || comp.category || getComponentCategory(selectedComponent.id),
        maker: comp.maker || "",
        makerCode: comp.makerCode || "",
        model: comp.model || "",
        modelCode: comp.modelCode || "",
        serialNo: comp.serialNo || "",
        drawingNo: comp.drawingNo || "",
        location: comp.location || "",
        critical: toBoolString(comp.critical),
        conditionBased: toBoolString(comp.conditionBased),
        installationDate: comp.installationDate || "",
        commissionedDate: comp.commissionedDate || "",
        rating: comp.rating || "",
        eqptSystemDept: comp.eqptSystemDept || comp.deptCategory || comp.department || "",
        notes: comp.notes || "",
        runningHours: comp.runningHours || comp.currentCumulativeRH || "",
        isActive: toBoolString(comp.isActive !== undefined ? comp.isActive : true),
        vesselCode: comp.vesselCode || "",
        isParent: toBoolString(comp.isParent),
        // Legacy fields
        classItem: toBoolString(comp.classItem),
        modelNumber: comp.modelNumber || "",
        department: comp.department || comp.deptCategory || "",
        noOfUnits: comp.noOfUnits || "",
        dimensionsSize: comp.dimensionsSize || ""
      };
      setComponentData(newData);
      
      // Store original data for modify mode
      if (isModifyMode || isChangeMode) {
        setOriginalComponentData(newData);
      }
      
      // Reset changed fields when switching components
      setChangedFields(new Set());
    }
  }, [selectedComponent, isModifyMode, isChangeMode]);

  // Capture original component data when change mode is activated on an already-loaded component
  useEffect(() => {
    if ((isChangeMode || isModifyMode) && componentData.componentCode && !originalComponentData) {
      // Change mode was activated while a component was already selected - capture current data as original
      setOriginalComponentData({ ...componentData });
    }
  }, [isChangeMode, isModifyMode, componentData, originalComponentData]);

  // Auto-update componentCategory when componentCode changes (for new components)
  useEffect(() => {
    if (componentData.componentCode) {
      const derivedCategory = getComponentCategory(componentData.componentCode);
      if (derivedCategory && derivedCategory !== componentData.componentCategory) {
        setComponentData(prev => ({ ...prev, componentCategory: derivedCategory }));
      }
    }
  }, [componentData.componentCode]);
  
  // Track which fields have been changed
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  
  const handleFieldChange = (fieldName: string, value: string) => {
    if (!isChangeMode && !isModifyMode) return;
    
    // Get the original value from originalComponentData (the snapshot before any edits)
    // This ensures oldValue reflects the persisted value, not the currently edited value
    const originalValue = originalComponentData 
      ? originalComponentData[fieldName as keyof typeof originalComponentData] 
      : null;
    
    setComponentData(prev => ({ ...prev, [fieldName]: value }));
    
    // Component change tracking is handled through onDataChange callback
    
    // Track the change - compare new value against original persisted value
    if (value !== originalValue) {
      setChangedFields(prev => new Set(prev).add(fieldName));
      if (isModifyMode && collectDiff) {
        // Pass the original persisted value (from snapshotBeforeJson equivalent), not the current form value
        collectDiff(`componentInfo.${fieldName}`, originalValue, value);
      }
    } else {
      setChangedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
    
    // Notify parent component of changes
    if (onDataChange) {
      onDataChange({ ...componentData, [fieldName]: value });
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto-flowing grid for component fields - visible fields fill gaps automatically */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.1"><Marker id="B7.A.1" /> Fleet Equipment Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.fleetEquipmentCode}
              onChange={(e) => handleFieldChange('fleetEquipmentCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.2"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.2">
              <Marker id="B7.A.2" /> {componentData.fleetEquipmentCode}
            </div>
          )}
        </div>
        )}
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.3"><Marker id="B7.A.3" /> Fleet Equipment Name</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.fleetEquipmentName}
              onChange={(e) => handleFieldChange('fleetEquipmentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.4"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.4">
              <Marker id="B7.A.4" /> {componentData.fleetEquipmentName}
            </div>
          )}
        </div>
        )}
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.5"><Marker id="B7.A.5" /> Parent Component Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.parentComponent}
              onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('parentComponent') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.6"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.6">
              <Marker id="B7.A.6" /> {componentData.parentComponent}
            </div>
          )}
        </div>
        )}
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.7"><Marker id="B7.A.7" /> Component Code</label>
          <div className="text-sm text-gray-900" data-testid="B7.A.8">
            <Marker id="B7.A.8" /> {componentData.componentCode}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.9"><Marker id="B7.A.9" /> Component Name</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.componentName}
              onChange={(e) => handleFieldChange('componentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('componentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.10"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.10">
              <Marker id="B7.A.10" /> {componentData.componentName}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.11"><Marker id="B7.A.11" /> Component Category</label>
          <div className="text-sm text-gray-900" data-testid="B7.A.12">
            <Marker id="B7.A.12" /> {componentData.componentCategory}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.13"><Marker id="B7.A.13" /> Maker</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.maker}
              onChange={(e) => handleFieldChange('maker', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('maker') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.14"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.14">
              <Marker id="B7.A.14" /> {componentData.maker}
            </div>
          )}
        </div>
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.15"><Marker id="B7.A.15" /> Maker Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.makerCode}
              onChange={(e) => handleFieldChange('makerCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('makerCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.16"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.16">
              <Marker id="B7.A.16" /> {componentData.makerCode}
            </div>
          )}
        </div>
        )}
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.17"><Marker id="B7.A.17" /> Model</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('model') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.18"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.18">
              <Marker id="B7.A.18" /> {componentData.model}
            </div>
          )}
        </div>
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.19"><Marker id="B7.A.19" /> Model Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.modelCode}
              onChange={(e) => handleFieldChange('modelCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('modelCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.20"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.20">
              <Marker id="B7.A.20" /> {componentData.modelCode}
            </div>
          )}
        </div>
        )}
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.21"><Marker id="B7.A.21" /> Serial No</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.serialNo}
              onChange={(e) => handleFieldChange('serialNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('serialNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.22"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.22">
              <Marker id="B7.A.22" /> {componentData.serialNo}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.23"><Marker id="B7.A.23" /> Drawing No</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.drawingNo}
              onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('drawingNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.24"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.24">
              <Marker id="B7.A.24" /> {componentData.drawingNo}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.25"><Marker id="B7.A.25" /> Location</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('location') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.26"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.26">
              <Marker id="B7.A.26" /> {componentData.location}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.27"><Marker id="B7.A.27" /> Criticality</label>
          {isChangeMode ? (
            <select
              value={componentData.critical}
              onChange={(e) => handleFieldChange('critical', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('critical') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.28"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.28">
              <Marker id="B7.A.28" /> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.critical === "Yes" 
                  ? "bg-red-100 text-red-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.critical}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.29"><Marker id="B7.A.29" /> Condition Based</label>
          {isChangeMode ? (
            <select
              value={componentData.conditionBased}
              onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('conditionBased') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.30"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.30">
              <Marker id="B7.A.30" /> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.conditionBased === "Yes" 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.conditionBased}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.31"><Marker id="B7.A.31" /> Installation Date</label>
          {isChangeMode ? (
            <input
              type="date"
              value={componentData.installationDate}
              onChange={(e) => handleFieldChange('installationDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('installationDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.32"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.32">
              <Marker id="B7.A.32" /> {componentData.installationDate}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.33"><Marker id="B7.A.33" /> Commissioned Date</label>
          {isChangeMode ? (
            <input
              type="date"
              value={componentData.commissionedDate}
              onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('commissionedDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.34"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.34">
              <Marker id="B7.A.34" /> {componentData.commissionedDate}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.35"><Marker id="B7.A.35" /> Rating</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.rating}
              onChange={(e) => handleFieldChange('rating', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('rating') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.36"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.36">
              <Marker id="B7.A.36" /> {componentData.rating}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.37"><Marker id="B7.A.37" /> Equipment / System Department</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.eqptSystemDept}
              onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('eqptSystemDept') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.38"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.38">
              <Marker id="B7.A.38" /> {componentData.eqptSystemDept}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.39"><Marker id="B7.A.39" /> Class Item</label>
          {isChangeMode ? (
            <select
              value={componentData.classItem}
              onChange={(e) => handleFieldChange('classItem', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('classItem') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.40"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.40">
              <Marker id="B7.A.40" /> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.classItem === "Yes" 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.classItem}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.41"><Marker id="B7.A.41" /> IS Active</label>
          {isChangeMode ? (
            <select
              value={componentData.isActive}
              onChange={(e) => handleFieldChange('isActive', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('isActive') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.42"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.42">
              <Marker id="B7.A.42" /> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.isActive === "Yes" 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.isActive}
              </span>
            </div>
          )}
        </div>
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.43"><Marker id="B7.A.43" /> Vessel Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.vesselCode}
              onChange={(e) => handleFieldChange('vesselCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('vesselCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.44"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.44">
              <Marker id="B7.A.44" /> {componentData.vesselCode}
            </div>
          )}
        </div>
        )}
        {(isSailAdmin || isChangeModeForVisibility || isChangeRequestMode) && (
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.45"><Marker id="B7.A.45" /> IS Parent</label>
          {isChangeMode ? (
            <select
              value={componentData.isParent}
              onChange={(e) => handleFieldChange('isParent', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('isParent') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="B7.A.46"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="B7.A.46">
              <Marker id="B7.A.46" /> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.isParent === "Yes" 
                  ? "bg-purple-100 text-purple-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.isParent}
              </span>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Notes (full width) */}
      <div>
        <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`} data-testid="B7.A.47"><Marker id="B7.A.47" /> Notes</label>
        {isChangeMode ? (
          <textarea
            value={componentData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            className={`text-sm w-full px-2 py-1 border rounded ${
              changedFields.has('notes') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
            }`}
            rows={3}
            data-testid="B7.A.48"
          />
        ) : (
          <div className="text-sm text-gray-900" data-testid="B7.A.48">
            <Marker id="B7.A.48" /> {componentData.notes}
          </div>
        )}
      </div>
    </div>
  );
};

const RunningHoursConditionSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { isChangeRequestMode } = useChangeRequest();
  const { isModifyMode } = useModifyMode();
  
  // Fetch running hours data for the selected component
  const { data: runningHoursData } = useQuery<any>({
    queryKey: [`/technical/api/running-hours/${selectedComponent?.id}`],
    enabled: !!selectedComponent?.id,
  });
  
  // Get the latest running hours update
  const latestUpdate = Array.isArray(runningHoursData) && runningHoursData.length > 0 
    ? runningHoursData[0] 
    : (runningHoursData && typeof runningHoursData === 'object' ? runningHoursData : null);
  
  // Components show their OWN RH value (maintained independently)
  // For INHERITED components, use rhCurrentInheritedCached which is vessel-isolated
  const getDisplayRH = (comp: any) => {
    const isInherited = comp?.rhCounterType === 'INHERITED';
    if (isInherited) {
      return comp?.rhCurrentInheritedCached || comp?.currentCumulativeRH || comp?.runningHours || "0";
    }
    return comp?.currentCumulativeRH || comp?.runningHours || "0";
  };
  
  // Get RH counter type display
  const getRHCounterType = (comp: any) => {
    return comp?.rhCounterType || 'NONE';
  };
  
  // Get RH counter source
  const getRHCounterSource = (comp: any) => {
    const type = getRHCounterType(comp);
    if (type === 'MASTER') return 'Self';
    if (type === 'INHERITED') return comp?.rhCounterSource || 'Parent Component';
    return '—';
  };
  
  // Get last updated date
  const getLastUpdated = (comp: any) => {
    return comp?.lastUpdated || latestUpdate?.dateUpdatedLocal || latestUpdate?.updatedAt || '—';
  };
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view running hours</div>;
  };
  
  const rhCounterType = getRHCounterType(selectedComponent);
  
  return (
    <div className="space-y-4">
      {/* Running Hours Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-running-hours">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.B.1"><Marker id="B7.B.1" /> RH Counter Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.B.2"><Marker id="B7.B.2" /> RH Counter Source</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.B.3"><Marker id="B7.B.3" /> Running Hours</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.B.4"><Marker id="B7.B.4" /> Last Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3" data-testid="B7.B.5">
                <Marker id="B7.B.5" /> {rhCounterType === 'MASTER' ? 'Master' :
                 rhCounterType === 'INHERITED' ? 'Inherited' :
                 'Not RH Driven'}
              </td>
              <td className="py-2 px-3" data-testid="B7.B.6">
                <Marker id="B7.B.6" /> {getRHCounterSource(selectedComponent)}
              </td>
              <td className="py-2 px-3 font-semibold" data-testid="B7.B.7">
                <Marker id="B7.B.7" /> {getDisplayRH(selectedComponent)}
              </td>
              <td className="py-2 px-3" data-testid="B7.B.8">
                <Marker id="B7.B.8" /> {getLastUpdated(selectedComponent)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const JobRow: React.FC<{
  job: any;
  onRowClick: (job: any) => void;
  toast: any;
  activeComponentCode: string; // The component context from which this job is being viewed
}> = ({ job, onRowClick, toast, activeComponentCode }) => {
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  // Get component-specific tracking data for THIS component (prevents data mixing between components)
  const componentTracking = job.componentTracking?.[activeComponentCode] || {};
  const effectiveLastDoneDate = componentTracking.lastDoneDate || job.lastDoneDate;
  const effectiveNextDueDate = componentTracking.nextDueDate || job.nextDueDate;
  const effectiveLastDoneRH = componentTracking.lastDoneRH || job.lastDoneRH;
  const effectiveNextDueRH = componentTracking.nextDueRH || job.nextDueRH;

  const generateWOMutation = useMutation({
    mutationFn: async (reason: 'Planning' | 'Breakdown' | 'Other') => {
      const response = await fetch(`/technical/api/jobs/${job.id}/generate-wo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass activeComponentCode to ensure work order is created with correct component context
        body: JSON.stringify({ reason, activeComponentCode })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate work order');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Work Order Created",
        description: `Work order ${data.workOrderNo} has been created successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
      // Invalidate all jobs queries (matching any vesselId parameter)
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
      });
      setShowReasonDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate work order",
        variant: "destructive"
      });
      setShowReasonDialog(false);
    }
  });

  const handleGenerateWO = (reason: 'Planning' | 'Breakdown' | 'Other') => {
    generateWOMutation.mutate(reason);
  };

  return (
    <>
      <tr 
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => onRowClick(job)}
        data-testid={`job-row-${job.jobNo}`}
      >
        <td className="py-3 px-3 text-gray-900" data-testid={`job-no-${job.jobNo}`}>{job.jobNo}</td>
        <td className="py-3 px-3 text-gray-900" data-testid={`job-title-${job.jobNo}`}>{job.jobTitle}</td>
        <td className="py-3 px-3 text-gray-900">{job.maintenanceType}</td>
        <td className="py-3 px-3 text-gray-900">
          {job.maintenanceBasis === 'Running Hours' 
            ? `${job.intervalRunningHour || 0} RH` 
            : `${job.frequencyValue} ${job.frequencyUnit}`}
        </td>
        <td className="py-3 px-3 text-gray-900">{formatProfessionalDate(effectiveLastDoneDate) || '-'}</td>
        <td className="py-3 px-3 text-gray-900">
          {job.maintenanceBasis === 'Running Hours' 
            ? (() => {
                // Calculate remaining RH: Frequency - (Current RH - Last Done RH)
                const frequency = parseFloat(job.intervalRunningHour || '0');
                const currentRH = parseFloat(job.componentCurrentRH || '0');
                const lastDoneRH = parseFloat(effectiveLastDoneRH || '0');
                const remainingRH = frequency - (currentRH - lastDoneRH);
                return remainingRH > 0 ? `${remainingRH.toFixed(0)} RH` : 'Due';
              })()
            : formatProfessionalDate(effectiveNextDueDate) || '-'}
        </td>
        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReasonDialog(true)}
            disabled={generateWOMutation.isPending}
            className="text-xs"
            data-testid={`btn-generate-wo-${job.jobNo}`}
          >
            {generateWOMutation.isPending ? 'Generating...' : 'Generate WO'}
          </Button>
        </td>
      </tr>
      
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Work Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Select the reason for generating this work order on-demand:
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => handleGenerateWO('Planning')} 
                disabled={generateWOMutation.isPending}
                variant="outline"
                className="justify-start"
              >
                Planning - Scheduled ahead of time
              </Button>
              <Button 
                onClick={() => handleGenerateWO('Breakdown')} 
                disabled={generateWOMutation.isPending}
                variant="outline"
                className="justify-start"
              >
                Breakdown - Emergency repair needed
              </Button>
              <Button 
                onClick={() => handleGenerateWO('Other')} 
                disabled={generateWOMutation.isPending}
                variant="outline"
                className="justify-start"
              >
                Other - Custom reason
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const WorkOrdersSection: React.FC<{ componentCode: string; componentName: string; componentId?: string }> = ({ componentCode, componentName, componentId }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId } = useVessel();
  const { isSailAdmin } = useUIRole();
  const { isChangeRequestMode } = useChangeRequest();
  const { isChangeMode } = useChangeMode();
  
  // Pagination state
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const COLLAPSED_ROWS = 2;
  const ROWS_PER_PAGE = 10;
  
  // Fetch jobs filtered by vesselId at the database level
  const { data: allJobs = [], isLoading } = useQuery<any[]>({
    queryKey: [`/technical/api/jobs?vesselId=${vesselId}`],
    enabled: !!vesselId,
  });
  
  // Filter jobs ONLY for this exact component (no child inheritance)
  // MANY-TO-MANY: Use linkedComponentCodes array (from junction table) plus deprecated componentCode for backwards compatibility
  const jobs = allJobs.filter(job => {
    const linkedCodes: string[] = job.linkedComponentCodes || [];
    // Always include the deprecated componentCode as fallback for backwards compatibility
    const allJobCodes = job.componentCode ? [...linkedCodes, job.componentCode] : linkedCodes;
    // Check if any of the job's linked component codes match EXACTLY this component code
    return allJobCodes.includes(componentCode);
  });
  
  // Calculate visible jobs based on expand state and pagination
  const totalJobs = jobs.length;
  const totalPages = Math.ceil(totalJobs / ROWS_PER_PAGE);
  const visibleJobs = isTableExpanded 
    ? jobs.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
    : jobs.slice(0, COLLAPSED_ROWS);
  
  // Check URL parameter to navigate to job page when returning from Maintenance Records
  React.useEffect(() => {
    // Only run when data has loaded (not loading)
    if (isLoading) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const openJobId = urlParams.get('openJobId');
    
    if (openJobId) {
      // Find the job and navigate to the Jobs Form page
      const jobToOpen = allJobs.find((job: any) => job.id === openJobId);
      if (jobToOpen) {
        setLocation(`/pms/job/${jobToOpen.id}`);
      }
      
      // Always clean up the openJobId parameter after data has loaded
      urlParams.delete('openJobId');
      const newSearch = urlParams.toString();
      const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [allJobs, isLoading, setLocation]);
  
  // Generate template code for existing data
  const generateTemplateCode = (componentCode: string, taskType: string, basis: string, frequency: number, unit?: string) => {
    const taskCodes: Record<string, string> = {
      "Inspection": "INS",
      "Overhaul": "OH",
      "Service": "SRV",
      "Testing": "TST"
    };
    
    let freqTag = "";
    if (basis === "Calendar" && frequency && unit) {
      const unitCode = unit[0].toUpperCase();
      freqTag = `${unitCode}${frequency}`;
    } else if (basis === "Running Hours" && frequency) {
      freqTag = `RH${frequency}`;
    }
    
    const taskCode = taskCodes[taskType] || "";
    return `WO-${componentCode}-${taskCode}${freqTag}`.toUpperCase();
  };

  const handleAddWorkOrder = () => {
    // Navigate to new job template page for this component (template mode shows only Part A)
    setLocation(`/pms/work-order/new/${componentCode}?mode=template`);
  };

  const handleRowClick = (job: any) => {
    // Navigate to Jobs Form page with activeComponentCode context
    // This ensures when a job is viewed from a specific component, that component context is preserved
    setLocation(`/pms/job/${job.id}?activeComponentCode=${encodeURIComponent(componentCode)}`);
  };

  return (
    <>
      <div className="overflow-x-auto">
        {(isSailAdmin || isChangeMode || isChangeRequestMode) && (
        <div className="flex justify-end mb-3">
          <Button
            onClick={handleAddWorkOrder}
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
            data-testid="B7.C.2"
          >
            <Marker id="B7.C.2" /> <Plus className="h-4 w-4 mr-1" />
            Add Job
          </Button>
        </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.3"><Marker id="B7.C.3" /> Job Code</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.4"><Marker id="B7.C.4" /> Job Title</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.5"><Marker id="B7.C.5" /> Task Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.6"><Marker id="B7.C.6" /> Frequency</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.7"><Marker id="B7.C.7" /> Last Done Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.C.8"><Marker id="B7.C.8" /> Next Due Date</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600" data-testid="B7.C.9"><Marker id="B7.C.9" /> Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Loading jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No jobs found for this component
                </td>
              </tr>
            ) : (
              visibleJobs.map((job, index) => (
                <JobRow 
                  key={index}
                  job={job}
                  onRowClick={handleRowClick}
                  toast={toast}
                  activeComponentCode={componentCode}
                />
              ))
            )}
          </tbody>
        </table>
        
        {/* Expand/Collapse and Pagination Controls */}
        {totalJobs > COLLAPSED_ROWS && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsTableExpanded(!isTableExpanded);
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
              data-testid="btn-expand-jobs"
            >
              {isTableExpanded ? (
                <>
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Collapse ({totalJobs} total)
                </>
              ) : (
                <>
                  <Expand className="h-3 w-3 mr-1" />
                  Show All ({totalJobs} jobs)
                </>
              )}
            </Button>
            
            {isTableExpanded && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="btn-prev-page-jobs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="btn-next-page-jobs"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

const MaintenanceHistorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  
  // Pagination state
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const COLLAPSED_ROWS = 2;
  const ROWS_PER_PAGE = 10;
  
  // Fetch maintenance history for the selected component
  // NOTE: Must use actualId (database UUID) not id (tree node code) for API calls
  // Only enable query when actualId exists (real component nodes, not category nodes)
  const componentDbId = selectedComponent?.actualId;
  const { data: maintenanceHistory = [], isLoading } = useQuery<any[]>({
    queryKey: [`/technical/api/component-maintenance-history/${componentDbId}`],
    enabled: !!componentDbId,
  });
  
  // Calculate visible records based on expand state and pagination
  const totalRecords = maintenanceHistory.length;
  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
  const visibleRecords = isTableExpanded 
    ? maintenanceHistory.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
    : maintenanceHistory.slice(0, COLLAPSED_ROWS);

  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view maintenance history</div>;
  }
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading maintenance history...</div>;
  }

  if (maintenanceHistory.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          No maintenance history records found for this component
        </div>
        <p className="text-xs text-gray-500 mt-2">
          History records are automatically created when work orders are approved and completed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600" data-testid="B7.D.2">
          <Marker id="B7.D.2" /> <span className="font-semibold">{maintenanceHistory.length}</span> maintenance record(s) found
        </div>
        <div className="text-xs text-gray-500 italic" data-testid="B7.D.3">
          <Marker id="B7.D.3" /> Records are immutable and cannot be edited or deleted
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.4"><Marker id="B7.D.4" /> WO No</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.5"><Marker id="B7.D.5" /> Job Title</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.6"><Marker id="B7.D.6" /> Type</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.7"><Marker id="B7.D.7" /> Date Completed</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.8"><Marker id="B7.D.8" /> Running Hours</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.9"><Marker id="B7.D.9" /> Performed By</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.10"><Marker id="B7.D.10" /> Approved By</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700" data-testid="B7.D.11"><Marker id="B7.D.11" /> Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record, index) => (
              <tr 
                key={index} 
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                onClick={() => setSelectedRecord(record)}
                data-testid={`maintenance-record-${record.workOrderNo}`}
              >
                <td className="py-3 px-3 text-gray-900 font-medium" data-testid={`wo-no-${record.workOrderNo}`}>
                  {record.workOrderNo}
                </td>
                <td className="py-3 px-3 text-gray-900" data-testid={`job-title-${record.workOrderNo}`}>
                  {record.jobTitle}
                </td>
                <td className="py-3 px-3 text-gray-900">{record.maintenanceType}</td>
                <td className="py-3 px-3 text-gray-900">{record.dateCompleted}</td>
                <td className="py-3 px-3 text-gray-900">
                  {record.runningHoursAtCompletion || '-'}
                </td>
                <td className="py-3 px-3 text-gray-900">{record.performedBy}</td>
                <td className="py-3 px-3 text-gray-900">{record.approvedBy || '-'}</td>
                <td className="py-3 px-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Expand/Collapse and Pagination Controls */}
        {totalRecords > COLLAPSED_ROWS && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsTableExpanded(!isTableExpanded);
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
              data-testid="btn-expand-history"
            >
              {isTableExpanded ? (
                <>
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Collapse ({totalRecords} total)
                </>
              ) : (
                <>
                  <Expand className="h-3 w-3 mr-1" />
                  Show All ({totalRecords} records)
                </>
              )}
            </Button>
            
            {isTableExpanded && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="btn-prev-page-history"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="btn-next-page-history"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Instruction hint */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700" data-testid="B7.D.20">
        <Marker id="B7.D.20" /> Click on a record to view full details including work description, spares used, and remarks
      </div>

      {/* Work Order Viewer Sheet - shows full completed work order form */}
      <WorkOrderViewerSheet
        workOrderId={selectedRecord?.workOrderId || null}
        open={!!selectedRecord}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      />
    </div>
  );
};

interface SpareWithInventoryData {
  spare: any;
  robTotal: number;
  stockStatus: "OK" | "At Min";
  locations: Array<{
    locationId: number;
    locationName: string;
    qty: number;
  }>;
  linkedComponents: Array<{
    componentId: string;
    componentCode: string;
    componentName: string;
  }>;
}

const SparesSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { isModifyMode } = useModifyMode();
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [editingLocationA, setEditingLocationA] = useState('');
  const [editingLocationB, setEditingLocationB] = useState('');
  const [spareDetailsOpen, setSpareDetailsOpen] = useState(false);
  const [selectedSpareDetails, setSelectedSpareDetails] = useState<SpareWithInventoryData | null>(null);
  
  // Pagination state
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const COLLAPSED_ROWS = 2;
  const ROWS_PER_PAGE = 10;
  
  const vesselId = selectedComponent?.vesselId || selectedComponent?.vesselCode || 'V001';
  
  const { data: vesselComponents = [] } = useQuery<any[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
    enabled: !!vesselId,
  });
  
  const getActualComponentId = (code: string): string | undefined => {
    const comp = vesselComponents.find((c: any) => (c.componentCode || c.code) === code);
    return comp?.id;
  };
  
  const selectedActualId = selectedComponent ? getActualComponentId(selectedComponent.code) : undefined;
  const selectedComponentCode = selectedComponent?.code;
  
  const { data: sparesWithInventory = [], isLoading: sparesLoading } = useQuery<SpareWithInventoryData[]>({
    queryKey: ['/technical/api/inventory/spares-by-component-code', vesselId, selectedComponentCode],
    queryFn: async () => {
      if (!vesselId || !selectedComponentCode) return [];
      const res = await fetch(`/technical/api/inventory/spares-by-component-code/${vesselId}/${encodeURIComponent(selectedComponentCode)}`);
      if (!res.ok) throw new Error('Failed to fetch spares');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!vesselId && !!selectedComponentCode,
  });
  
  const { data: locationNames = { locationAName: 'Location A', locationBName: 'Location B' } } = useQuery<{
    vesselId: string;
    locationAName: string;
    locationBName: string;
  }>({
    queryKey: [`/technical/api/vessel-location-names/${vesselId}`],
    enabled: !!vesselId,
  });
  
  const updateLocationNamesMutation = useMutation({
    mutationFn: async (data: { locationAName: string; locationBName: string }) => {
      const response = await fetch(`/technical/api/vessel-location-names/${vesselId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, updatedBy: 'User' }),
      });
      if (!response.ok) throw new Error('Failed to update location names');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/technical/api/vessel-location-names/${vesselId}`] });
      setEditLocationDialogOpen(false);
    },
  });
  
  const handleEditLocations = () => {
    setEditingLocationA(locationNames.locationAName);
    setEditingLocationB(locationNames.locationBName);
    setEditLocationDialogOpen(true);
  };
  
  const handleSaveLocations = () => {
    updateLocationNamesMutation.mutate({
      locationAName: editingLocationA,
      locationBName: editingLocationB,
    });
  };
  
  const handleViewSpareDetails = (spareData: SpareWithInventoryData) => {
    setSelectedSpareDetails(spareData);
    setSpareDetailsOpen(true);
  };
  
  const getStockStatusBadge = (status: string) => {
    if (status === "At Min") {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">At Min</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">OK</span>;
  };
  
  const getLocationQty = (locations: SpareWithInventoryData['locations'], locationName: string): number => {
    const loc = locations.find(l => l.locationName.toLowerCase().includes(locationName.toLowerCase()) || 
      l.locationName === locationNames.locationAName || l.locationName === locationNames.locationBName);
    return loc?.qty || 0;
  };
  
  const getLocationAQty = (locations: SpareWithInventoryData['locations']): number => {
    return locations[0]?.qty || 0;
  };
  
  const getLocationBQty = (locations: SpareWithInventoryData['locations']): number => {
    return locations[1]?.qty || 0;
  };
  
  const getComponentDisplay = (linkedComponents: SpareWithInventoryData['linkedComponents']): string => {
    if (linkedComponents.length === 0) return '-';
    if (linkedComponents.length === 1) return linkedComponents[0].componentName || linkedComponents[0].componentCode;
    return 'Multi-linked';
  };
  
  const [originalSpares] = useState<any[]>([]);
  
  const handleFieldChange = (index: number, field: string, value: string) => {
  };
  
  // Calculate visible spares based on expand state and pagination
  const totalSpares = sparesWithInventory.length;
  const totalPages = Math.ceil(totalSpares / ROWS_PER_PAGE);
  const visibleSpares = isTableExpanded 
    ? sparesWithInventory.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
    : sparesWithInventory.slice(0, COLLAPSED_ROWS);
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view associated spares</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      {sparesLoading ? (
        <div className="py-8 text-center text-gray-500">Loading spares...</div>
      ) : (
      <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.2"><Marker id="B7.E.2" /> Part Code</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.3"><Marker id="B7.E.3" /> Part Name</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Component</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Part Number</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.4"><Marker id="B7.E.4" /> Critical</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.5"><Marker id="B7.E.5" /> ROB</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.6"><Marker id="B7.E.6" /> Min</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.7"><Marker id="B7.E.7" /> Stock</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600" data-testid="B7.E.8"><Marker id="B7.E.8" /> Location</th>
            {FEATURES.IHM && (
              <th className="text-center py-2 px-3 font-medium text-gray-600" data-testid="B7.E.9" title="IHM Status"><Marker id="B7.E.9" /> IHM</th>
            )}
            <th className="text-left py-2 px-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sparesWithInventory.length === 0 ? (
            <tr>
              <td colSpan={FEATURES.IHM ? 11 : 10} className="text-center py-8">
                <div className="text-gray-400 text-sm">No spare parts linked to this component</div>
                <p className="text-xs text-gray-500 mt-2">Navigate to the Spares module to manage spare parts inventory</p>
              </td>
            </tr>
          ) : visibleSpares.map((spareData, index) => {
            const spare = spareData.spare;
            const isCritical = spare.critical === 'Critical' || spare.critical === 'Yes' || spare.criticality === 'Yes';
            return (
            <tr key={spare.id || index} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => handleViewSpareDetails(spareData)}>
              <td className="py-3 px-3 text-gray-900 text-blue-600 hover:underline" data-testid={index === 0 ? "B7.E.10" : undefined}>
                {index === 0 && <Marker id="B7.E.10" />}
                {spare.partCode}
              </td>
              <td className="py-3 px-3 text-gray-900" data-testid={index === 0 ? "B7.E.11" : undefined}>
                {index === 0 && <Marker id="B7.E.11" />}
                {spare.partName}
              </td>
              <td className="py-3 px-3 text-gray-700">
                {spareData.linkedComponents.length > 1 ? (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">Multi-linked</span>
                ) : (
                  getComponentDisplay(spareData.linkedComponents)
                )}
              </td>
              <td className="py-3 px-3 text-gray-700">{spare.partNumber || '-'}</td>
              <td className="py-3 px-3" data-testid={index === 0 ? "B7.E.12" : undefined}>
                {index === 0 && <Marker id="B7.E.12" />}
                {isCritical && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                    Critical
                  </span>
                )}
              </td>
              <td className="py-3 px-3 text-gray-900 font-medium" data-testid={index === 0 ? "B7.E.13" : undefined}>
                {index === 0 && <Marker id="B7.E.13" />}
                {spareData.robTotal}
              </td>
              <td className="py-3 px-3 text-gray-900" data-testid={index === 0 ? "B7.E.14" : undefined}>
                {index === 0 && <Marker id="B7.E.14" />}
                {spare.min || 0}
              </td>
              <td className="py-3 px-3" data-testid={index === 0 ? "B7.E.15" : undefined}>
                {index === 0 && <Marker id="B7.E.15" />}
                {getStockStatusBadge(spareData.stockStatus)}
              </td>
              <td className="py-3 px-3 text-gray-900" data-testid={index === 0 ? "B7.E.16" : undefined} onClick={(e) => e.stopPropagation()}>
                {index === 0 && <Marker id="B7.E.16" />}
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      data-testid={`location-popup-trigger-${index}`}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>View ({spareData.locations.length})</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div className="p-3 border-b bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-gray-800">Storage Locations</h4>
                        <button 
                          onClick={handleEditLocations}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          data-testid="edit-location-names-btn"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit Names
                        </button>
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      {spareData.locations.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-2">No locations assigned</div>
                      ) : spareData.locations.map((loc, locIdx) => (
                        <div key={loc.locationId} className={`flex items-center justify-between p-2 rounded-lg border ${locIdx === 0 ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${locIdx === 0 ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                            <span className="text-sm font-medium text-gray-700">{loc.locationName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-900">{loc.qty}</span>
                            <span className="text-xs text-gray-500 ml-1">units</span>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t text-xs text-gray-500">
                        Total ROB: <span className="font-semibold text-gray-700">{spareData.robTotal}</span> units
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </td>
              {FEATURES.IHM && (
                <td className="py-3 px-3 text-center" data-testid={index === 0 ? "B7.E.17" : undefined}>
                  {index === 0 && <Marker id="B7.E.17" />}
                  {spare.ihmPresence === 'YES' ? (
                    <span title="IHM Present"><AlertCircle className="h-4 w-4 text-red-500 mx-auto" /></span>
                  ) : spare.ihmPresence === 'NO' ? (
                    <span title="No IHM"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></span>
                  ) : (
                    <span title="IHM Unknown"><HelpCircle className="h-4 w-4 text-gray-400 mx-auto" /></span>
                  )}
                </td>
              )}
              <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => handleViewSpareDetails(spareData)} data-testid={`view-spare-details-${spare.id}`}>
                  <FileText className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
      
      {/* Expand/Collapse and Pagination Controls */}
      {totalSpares > COLLAPSED_ROWS && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsTableExpanded(!isTableExpanded);
              setCurrentPage(1);
            }}
            className="text-xs text-blue-600 hover:text-blue-800"
            data-testid="btn-expand-spares"
          >
            {isTableExpanded ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse ({totalSpares} total)
              </>
            ) : (
              <>
                <Expand className="h-3 w-3 mr-1" />
                Show All ({totalSpares} spares)
              </>
            )}
          </Button>
          
          {isTableExpanded && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="btn-prev-page-spares"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="btn-next-page-spares"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      </>
      )}
      
      {/* Edit Location Names Dialog */}
      <Dialog open={editLocationDialogOpen} onOpenChange={setEditLocationDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Storage Location Names</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="locationAName" className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Location A Name
              </Label>
              <Input
                id="locationAName"
                value={editingLocationA}
                onChange={(e) => setEditingLocationA(e.target.value)}
                placeholder="e.g., Engine Room Store"
                data-testid="input-location-a-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationBName" className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Location B Name
              </Label>
              <Input
                id="locationBName"
                value={editingLocationB}
                onChange={(e) => setEditingLocationB(e.target.value)}
                placeholder="e.g., Deck Store"
                data-testid="input-location-b-name"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditLocationDialogOpen(false)}
                data-testid="btn-cancel-location-edit"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLocations}
                disabled={updateLocationNamesMutation.isPending}
                data-testid="btn-save-location-names"
              >
                {updateLocationNamesMutation.isPending ? 'Saving...' : 'Save Names'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Spare Details Dialog (E1) */}
      <Dialog open={spareDetailsOpen} onOpenChange={setSpareDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Spare Part Details
              {selectedSpareDetails && selectedSpareDetails.linkedComponents.length > 1 && (
                <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">Multi-linked</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedSpareDetails && (
            <div className="space-y-6 pt-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Part Code</Label>
                    <p className="text-sm font-medium" data-testid="spare-details-part-code">{selectedSpareDetails.spare.partCode}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Part Name</Label>
                    <p className="text-sm font-medium" data-testid="spare-details-part-name">{selectedSpareDetails.spare.partName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Part Number</Label>
                    <p className="text-sm font-medium" data-testid="spare-details-part-number">{selectedSpareDetails.spare.partNumber || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Unit</Label>
                    <p className="text-sm font-medium">{selectedSpareDetails.spare.unit || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Maker</Label>
                    <p className="text-sm font-medium">{selectedSpareDetails.spare.maker || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Maker Reference</Label>
                    <p className="text-sm font-medium">{selectedSpareDetails.spare.makerReference || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Drawing Number</Label>
                    <p className="text-sm font-medium">{selectedSpareDetails.spare.drawingNo || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Critical</Label>
                    <p className="text-sm font-medium">
                      {(selectedSpareDetails.spare.critical === 'Critical' || selectedSpareDetails.spare.critical === 'Yes' || selectedSpareDetails.spare.criticality === 'Yes') ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">Critical</span>
                      ) : (
                        'No'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Linked Components */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Linked Components ({selectedSpareDetails.linkedComponents.length})</h4>
                {selectedSpareDetails.linkedComponents.length === 0 ? (
                  <p className="text-sm text-gray-500">No components linked</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSpareDetails.linkedComponents.map((comp, idx) => (
                      <div key={comp.componentId} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <div>
                          <span className="text-sm font-medium">{comp.componentName || comp.componentCode}</span>
                          <span className="ml-2 text-xs text-gray-500">{comp.componentCode}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock & Inventory */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Stock & Inventory</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-800">{selectedSpareDetails.robTotal}</p>
                    <p className="text-xs text-blue-600">Total ROB</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-800">{selectedSpareDetails.spare.min || 0}</p>
                    <p className="text-xs text-gray-600">Minimum Level</p>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: selectedSpareDetails.stockStatus === 'OK' ? '#dcfce7' : '#fef9c3' }}>
                    <p className="text-lg font-bold" style={{ color: selectedSpareDetails.stockStatus === 'OK' ? '#166534' : '#854d0e' }}>{selectedSpareDetails.stockStatus}</p>
                    <p className="text-xs" style={{ color: selectedSpareDetails.stockStatus === 'OK' ? '#15803d' : '#a16207' }}>Stock Status</p>
                  </div>
                </div>

                {/* Location Breakdown */}
                <div className="mt-4">
                  <h5 className="text-xs font-medium text-gray-600 mb-2">Stock by Location</h5>
                  {selectedSpareDetails.locations.length === 0 ? (
                    <p className="text-sm text-gray-500">No location stock data available</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedSpareDetails.locations.map((loc, idx) => (
                        <div key={loc.locationId} className={`flex items-center justify-between p-2 rounded border ${idx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">{loc.locationName}</span>
                          </div>
                          <span className="text-sm font-bold">{loc.qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {FEATURES.IHM && selectedSpareDetails.spare.ihmPresence && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">IHM Information</h4>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
                    {selectedSpareDetails.spare.ihmPresence === 'YES' ? (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-700">This spare contains hazardous materials (IHM)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-700">No hazardous materials (IHM compliant)</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedSpareDetails.spare.remarks && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Remarks</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{selectedSpareDetails.spare.remarks}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setSpareDetailsOpen(false)} data-testid="close-spare-details">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DrawingsAndManualsSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { canViewDocument, canDownloadDocument } = useAuth();
  
  // Pagination state
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const COLLAPSED_ROWS = 2;
  const ROWS_PER_PAGE = 10;
  
  // Fetch documents for the selected component
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: [`/technical/api/component-documents/${selectedComponent?.id}`],
    enabled: !!selectedComponent?.id,
  });
  
  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'Manual': return FileText;
      case 'Drawing': return FileImage;
      case 'Certificate': return FileCheck;
      default: return File;
    }
  };
  
  // Filter documents based on role permissions
  const viewableDocuments = documents.filter(doc => canViewDocument(doc));
  
  // Calculate visible documents based on expand state and pagination
  const totalDocs = viewableDocuments.length;
  const totalPages = Math.ceil(totalDocs / ROWS_PER_PAGE);
  const visibleDocs = isTableExpanded 
    ? viewableDocuments.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
    : viewableDocuments.slice(0, COLLAPSED_ROWS);
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view documents</div>;
  }
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading documents...</div>;
  }
  
  if (viewableDocuments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          Feature coming soon
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600" data-testid="B7.F.2">
          <Marker id="B7.F.2" /> <span className="font-semibold">{viewableDocuments.length}</span> document(s) available
        </div>
        <AdminOnly>
          <Button size="sm" variant="outline" className="text-xs" data-testid="B7.F.3">
            <Marker id="B7.F.3" /> <Upload className="h-3 w-3 mr-1" />
            Upload Document
          </Button>
        </AdminOnly>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {visibleDocs.map((doc, index) => {
          const IconComponent = getFileTypeIcon(doc.fileType);
          const hasDownloadAccess = canDownloadDocument(doc);
          
          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-md border ${
                hasDownloadAccess 
                  ? 'hover:bg-blue-50 cursor-pointer border-gray-200' 
                  : 'bg-gray-50 border-gray-100 cursor-not-allowed'
              }`}
              data-testid="B7.F.4"
              onClick={() => {
                if (hasDownloadAccess) {
                  console.log('Download document:', doc.fileName);
                }
              }}
            >
              <IconComponent className={`h-5 w-5 ${hasDownloadAccess ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${hasDownloadAccess ? 'text-gray-900' : 'text-gray-500'}`}>
                  {doc.fileName}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{doc.fileType}</span>
                  {doc.version && (
                    <>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">v{doc.version}</span>
                    </>
                  )}
                  {!hasDownloadAccess && (
                    <>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> View Only
                      </span>
                    </>
                  )}
                </div>
              </div>
              {hasDownloadAccess && (
                <span data-testid="B7.F.5"><Marker id="B7.F.5" /> <Download className="h-4 w-4 text-gray-400" /></span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Expand/Collapse and Pagination Controls */}
      {totalDocs > COLLAPSED_ROWS && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsTableExpanded(!isTableExpanded);
              setCurrentPage(1);
            }}
            className="text-xs text-blue-600 hover:text-blue-800"
            data-testid="btn-expand-documents"
          >
            {isTableExpanded ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse ({totalDocs} total)
              </>
            ) : (
              <>
                <Expand className="h-3 w-3 mr-1" />
                Show All ({totalDocs} documents)
              </>
            )}
          </Button>
          
          {isTableExpanded && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="btn-prev-page-documents"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="btn-next-page-documents"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700" data-testid="B7.F.6">
        <Marker id="B7.F.6" /> Document access is controlled by role-based permissions
      </div>
    </div>
  );
};

const ClassificationRegulatorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  // Fetch class regulatory data for the selected component
  const { data: classRegData = [], isLoading } = useQuery<any[]>({
    queryKey: [`/technical/api/component-class-regulatory/${selectedComponent?.id}`],
    enabled: !!selectedComponent?.id,
  });
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view classification & regulatory data</div>;
  }
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading classification & regulatory data...</div>;
  }
  
  if (classRegData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          Feature coming soon
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{classRegData.length}</span> survey record(s)
        </div>
        <AdminOnly>
          <Button size="sm" variant="outline" className="text-xs" data-testid="button-add-survey">
            <Plus className="h-3 w-3 mr-1" />
            Add Survey
          </Button>
        </AdminOnly>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Classification Society</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Survey Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Certificate No.</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Last Survey</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Next Due</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {classRegData.map((item, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-3 px-3 text-gray-900">{item.classificationSociety}</td>
                <td className="py-3 px-3 text-gray-900">{item.surveyType}</td>
                <td className="py-3 px-3 text-gray-900">{item.certificateNumber}</td>
                <td className="py-3 px-3 text-gray-900">{item.lastClassSurvey}</td>
                <td className="py-3 px-3 text-gray-900">{item.nextSurveyDue}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.surveyStatus === 'Active' ? 'bg-green-100 text-green-800' :
                    item.surveyStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    item.surveyStatus === 'Expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.surveyStatus || 'Active'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RequisitionsSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  // Fetch requisitions for the selected component
  const { data: requisitions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/technical/api/component-requisitions/${selectedComponent?.id}`],
    enabled: !!selectedComponent?.id,
  });
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view requisitions</div>;
  }
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading requisitions...</div>;
  }
  
  if (requisitions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          Feature coming soon
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{requisitions.length}</span> requisition(s)
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Req. No</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Item/Service</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Qty</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Raised On</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Priority</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.map((req, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-3 px-3 text-gray-900 font-medium">{req.requisitionNo}</td>
                <td className="py-3 px-3 text-gray-900">{req.itemOrService}</td>
                <td className="py-3 px-3 text-gray-900">{req.quantity} {req.uom}</td>
                <td className="py-3 px-3 text-gray-900">{req.raisedOn}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.priority === 'Urgent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {req.priority}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.status === 'Delivered On Board' ? 'bg-green-100 text-green-800' :
                    req.status === 'PO Raised' ? 'bg-blue-100 text-blue-800' :
                    req.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {req.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Components: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalFilter, setCriticalFilter] = useState("all");
  const [selectedComponent, setSelectedComponent] = useState<ComponentNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["A", "B", "C", "D", "E", "F", "G", "H"]));
  const [isComponentFormOpen, setIsComponentFormOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingComponentCode, setEditingComponentCode] = useState<string | null>(null);
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [showModifySubmitFooter, setShowModifySubmitFooter] = useState(false);
  const [modifiedComponentData, setModifiedComponentData] = useState<any>(null);
  const [originalComponentData, setOriginalComponentData] = useState<any>(null);
  const [showAddEditFullPage, setShowAddEditFullPage] = useState(false);
  
  // Preview changes mode state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [changeRequestData, setChangeRequestData] = useState<any>(null);
  const [previewChanges, setPreviewChanges] = useState<any[]>([]);
  
  const { isChangeRequestMode, exitChangeRequestMode } = useChangeRequest();
  const { isChangeMode, changeRequestTitle, changeRequestCategory, setOriginalSnapshot, collectDiff, getDiffs, reset } = useChangeMode();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();
  const { isSailAdmin, isClientAdmin } = useUIRole();
  
  const prevVesselIdRef = React.useRef(vesselId);
  React.useEffect(() => {
    if (prevVesselIdRef.current !== vesselId) {
      setSelectedComponent(null);
      setEditingComponentId(null);
      setEditingComponentCode(null);
      setShowAddEditFullPage(false);
      setShowReviewDrawer(false);
      prevVesselIdRef.current = vesselId;
    }
  }, [vesselId]);
  
  // Fetch components from API and build tree
  const { data: fetchedComponents = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
  });
  
  // Build component tree from fetched data
  const componentTreeData = React.useMemo(() => {
    console.log('[TREE] Building tree from', fetchedComponents.length, 'components');
    
    // Create a fresh clone of fetched components to avoid mutating React Query cache
    const clonedComponents = fetchedComponents.map(comp => ({ ...comp }));
    
    // Start with the 8 hardcoded main categories (specification-compliant names)
    const mainCategories: ComponentNode[] = [
      { id: "1", code: "1", name: "1 Ship General", children: [] },
      { id: "2", code: "2", name: "2 Hull", children: [] },
      { id: "3", code: "3", name: "3 Equipment for Cargo", children: [] },
      { id: "4", code: "4", name: "4 Ship's Equipment", children: [] },
      { id: "5", code: "5", name: "5 Equipment for Crew & Passengers", children: [] },
      { id: "6", code: "6", name: "6 Machinery Main Components", children: [] },
      { id: "7", code: "7", name: "7 Systems for Machinery Main Components", children: [] },
      { id: "8", code: "8", name: "8 Ship Common Systems", children: [] }
    ];
    
    if (!clonedComponents || clonedComponents.length === 0) {
      return mainCategories;
    }
    
    // Build a map for quick lookup
    const componentMap = new Map<string, ComponentNode>();
    
    // First, add all main categories to the map
    mainCategories.forEach(cat => {
      componentMap.set(cat.code, cat);
    });
    
    // Convert fetched components to ComponentNode format and add to map
    // Skip main categories (1-8) as they're already in the map from hardcoded mainCategories
    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      // Skip if this is a main category (single digit 1-8) - already in map
      if (code.match(/^[1-8]$/)) {
        return;
      }
      const node: ComponentNode = {
        ...comp,  // Include all component data FIRST
        id: code,  // Override with componentCode for tree display
        code: code,  // Override with componentCode
        actualId: comp.id,  // Preserve the actual database UUID for API calls
        name: comp.name,
        critical: comp.critical === "Yes" || comp.critical === true,  // Normalize to boolean
        children: []
      };
      componentMap.set(node.code, node);
    });
    
    // Build parent-child relationships
    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      const node = componentMap.get(code);
      
      if (!node) return;
      
      let placed = false;
      
      if (comp.parentId) {
        // Has explicit parent ID - use it
        // First try parentId as componentCode
        let parent = componentMap.get(comp.parentId);
        
        // If not found, parentId might be a storage ID - search by matching componentCode
        if (!parent) {
          // Search for component whose code matches parentId OR whose original id matches parentId
          const parentComp = clonedComponents.find((c: any) => 
            c.id === comp.parentId || c.componentCode === comp.parentId
          );
          if (parentComp) {
            parent = componentMap.get(parentComp.componentCode || parentComp.id);
          }
          if (!parent) {
            console.log(`⚠️ Parent not found for component ${code}, parentId: ${comp.parentId}`);
          }
        }
        
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
          placed = true;
        }
        // If parent not found, fall through to category-based placement
      }
      
      if (!placed) {
        // No parent ID - determine category from code prefix
        let categoryCode = code.split('.')[0];
        
        // If the code prefix isn't a valid category (1-8), try the first character
        if (!componentMap.get(categoryCode) || !categoryCode.match(/^[1-8]$/)) {
          const firstChar = code.charAt(0);
          if (firstChar.match(/^[1-8]$/)) {
            categoryCode = firstChar;
          } else {
            // Fallback to "8 Ship Common Systems" for codes that don't match any category
            categoryCode = "8";
          }
        }
        
        const category = componentMap.get(categoryCode);
        if (category && categoryCode !== code) {
          // Only add if it's not the category itself
          if (!category.children) {
            category.children = [];
          }
          category.children.push(node);
        }
      }
    });
    
    // Sort children in ascending order by component code
    const sortChildrenAscending = (nodes: ComponentNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          // Sort children by code in ascending order (handles numeric and alphanumeric codes)
          node.children.sort((a, b) => {
            const aCode = a.code || '';
            const bCode = b.code || '';
            // Try numeric comparison first
            const aNum = parseFloat(aCode);
            const bNum = parseFloat(bCode);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            // Fall back to string comparison
            return aCode.localeCompare(bCode);
          });
          // Recursively sort descendants
          sortChildrenAscending(node.children);
        }
      });
    };
    
    sortChildrenAscending(mainCategories);
    
    return mainCategories;
  }, [fetchedComponents]);

  // Filter component tree based on search term and critical filter
  const filteredComponentTree = React.useMemo(() => {
    const filterTree = (nodes: ComponentNode[]): ComponentNode[] => {
      const filtered: ComponentNode[] = [];
      
      for (const node of nodes) {
        // First, recursively filter children
        const filteredChildren = node.children ? filterTree(node.children) : [];
        
        // Check if this node matches the filters - smart search across multiple fields
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          node.name.toLowerCase().includes(searchLower) ||
          node.code.toLowerCase().includes(searchLower) ||
          ((node as any).fleetEquipmentCode ?? "").toLowerCase().includes(searchLower) ||
          ((node as any).maker ?? "").toLowerCase().includes(searchLower) ||
          ((node as any).serialNo ?? "").toLowerCase().includes(searchLower);
        
        const matchesCritical = 
          criticalFilter === 'all' ||
          (criticalFilter === 'critical' && node.critical === true) ||
          (criticalFilter === 'non-critical' && node.critical !== true);
        
        // Include node if:
        // 1. It matches both filters, OR
        // 2. Any of its children were included (parent visibility)
        const nodeMatches = matchesSearch && matchesCritical;
        const hasMatchingChildren = filteredChildren.length > 0;
        
        if (nodeMatches || hasMatchingChildren) {
          filtered.push({
            ...node,
            children: filteredChildren
          });
        }
      }
      
      return filtered;
    };
    
    return filterTree(componentTreeData);
  }, [componentTreeData, searchTerm, criticalFilter]);

  // Helper function to find component by ID
  const findComponentById = (id: string): ComponentNode | null => {
    const searchInTree = (nodes: ComponentNode[]): ComponentNode | null => {
      for (const node of nodes) {
        if (node.id === id || node.code === id) {
          return node;
        }
        if (node.children) {
          const found = searchInTree(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return searchInTree(componentTreeData);
  };
  
  // Check for modify mode from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const isModifyMode = urlParams.get('modify') === '1';

  // Check for preview changes mode and load change request data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewMode = params.get('previewChanges') === '1';
    const changeRequestId = params.get('changeRequestId');
    const targetId = params.get('targetId');
    
    if (previewMode && changeRequestId) {
      setIsPreviewMode(true);
      
      // Fetch the change request data
      fetch(`/technical/api/change-requests/${changeRequestId}`)
        .then(res => res.json())
        .then(data => {
          setChangeRequestData(data);
          if (data.proposedChangesJson) {
            setPreviewChanges(Array.isArray(data.proposedChangesJson) ? data.proposedChangesJson : []);
          }
          
          // Auto-select the target component if provided
          if (targetId && data.targetType === 'component') {
            const component = findComponentById(targetId);
            if (component) {
              setSelectedComponent(component);
              // Expand the path to show the component
              const expandPath = (componentCode: string) => {
                const parts = componentCode.split('.');
                const newExpanded = new Set(expandedNodes);
                for (let i = 0; i < parts.length - 1; i++) {
                  newExpanded.add(parts.slice(0, i + 1).join('.'));
                }
                setExpandedNodes(newExpanded);
              };
              expandPath(component.code);
            }
          }
        })
        .catch(err => {
          console.error('Failed to load change request data:', err);
          toast({
            title: "Error",
            description: "Failed to load change request data",
            variant: "destructive"
          });
        });
    } else {
      setIsPreviewMode(false);
      setChangeRequestData(null);
      setPreviewChanges([]);
    }
  }, [location]);
  
  // Handle change mode - capture original snapshot when component data is fully loaded
  useEffect(() => {
    if (isChangeMode && selectedComponent && originalComponentData) {
      // Set the original snapshot for change tracking using the fully-loaded component data
      const snapshot = {
        id: selectedComponent.id,
        displayKey: selectedComponent.code,
        displayName: selectedComponent.name,
        displayPath: `${selectedComponent.code} ${selectedComponent.name}`,
        componentCode: originalComponentData.componentCode,
        name: originalComponentData.componentName,
        maker: originalComponentData.maker,
        makerCode: originalComponentData.makerCode,
        model: originalComponentData.model,
        modelCode: originalComponentData.modelCode,
        serialNo: originalComponentData.serialNo,
        drawingNo: originalComponentData.drawingNo,
        category: originalComponentData.componentCategory,
        deptCategory: originalComponentData.eqptSystemDept,
        location: originalComponentData.location,
        critical: originalComponentData.critical,
        classItem: originalComponentData.classItem,
        conditionBased: originalComponentData.conditionBased,
        commissionedDate: originalComponentData.commissionedDate,
        installationDate: originalComponentData.installationDate,
        rating: originalComponentData.rating,
        fleetEquipmentCode: originalComponentData.fleetEquipmentCode,
        fleetEquipmentName: originalComponentData.fleetEquipmentName,
        parentComponent: originalComponentData.parentComponent,
        vesselCode: originalComponentData.vesselCode,
        isParent: originalComponentData.isParent,
        isActive: originalComponentData.isActive,
        runningHours: originalComponentData.runningHours,
        notes: originalComponentData.notes
      };
      setOriginalSnapshot(snapshot);
    }
  }, [isChangeMode, selectedComponent, originalComponentData]);
  
  // Initialize modify mode from URL parameter
  useEffect(() => {
    if (isModifyMode) {
      setShowModifySubmitFooter(true);
      // Apply modify mode styles to the body
      document.body.classList.add('modify-mode');
    }
    return () => {
      document.body.classList.remove('modify-mode');
    };
  }, [isModifyMode]);
  
  // Check if we should open the Add/Edit Component form
  useEffect(() => {
    const shouldOpenForm = sessionStorage.getItem('openComponentForm');
    
    if (shouldOpenForm === 'true') {
      setIsComponentFormOpen(true);
      sessionStorage.removeItem('openComponentForm');
    }
  }, []);
  
  // Handle target component navigation - find and select a specific component, expanding its parent chain
  useEffect(() => {
    const targetComponentCode = sessionStorage.getItem('targetComponentCode');
    
    // Only proceed if we have a target and data is loaded
    if (!targetComponentCode || fetchedComponents.length === 0 || componentTreeData.length === 0) {
      return;
    }
    
    // Find the target component in the tree
    const findComponent = (nodes: ComponentNode[]): ComponentNode | null => {
      for (const node of nodes) {
        if (node.code === targetComponentCode) {
          return node;
        }
        if (node.children) {
          const found = findComponent(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const targetComponent = findComponent(componentTreeData);
    
    // Clear the session storage flag immediately to prevent repeated attempts
    sessionStorage.removeItem('targetComponentCode');
    
    if (targetComponent) {
      setSelectedComponent(targetComponent);
      
      // Build the parent chain by traversing parentId relationships
      const buildParentChain = (targetCode: string): string[] => {
        const nodesToExpand: string[] = [];
        
        // Find the target component in fetched data to get its parentId
        const targetData = fetchedComponents.find((c: any) => 
          c.componentCode === targetCode || c.id === targetCode
        );
        
        if (!targetData) {
          // Fallback: extract root category from first character of code
          const rootCategory = targetCode.charAt(0);
          if (rootCategory && rootCategory.match(/^[1-8]$/)) {
            nodesToExpand.push(rootCategory);
          }
          return nodesToExpand;
        }
        
        // Walk up the parent chain
        let currentData = targetData;
        while (currentData) {
          const currentCode = currentData.componentCode || currentData.id;
          nodesToExpand.push(currentCode);
          
          if (currentData.parentId) {
            // Find parent by parentId (which stores parent's componentCode)
            const parentData = fetchedComponents.find((c: any) => 
              c.componentCode === currentData.parentId || c.id === currentData.parentId
            );
            currentData = parentData;
          } else {
            // No more parents - add the root category (first digit 1-8)
            const rootCategory = currentCode.charAt(0);
            if (rootCategory && rootCategory.match(/^[1-8]$/) && !nodesToExpand.includes(rootCategory)) {
              nodesToExpand.push(rootCategory);
            }
            break;
          }
        }
        
        return nodesToExpand;
      };
      
      const parentChain = buildParentChain(targetComponentCode);
      setExpandedNodes(new Set(parentChain));
    }
  }, [fetchedComponents, componentTreeData]);

  const handleBackToModifyPMS = () => {
    exitChangeRequestMode();
    reset();
    window.history.back();
  };
  
  const handleCancelChangeMode = () => {
    reset();
    window.history.back();
  };

  const collectAllNodeIds = (nodes: ComponentNode[]): string[] => {
    const ids: string[] = [];
    const traverse = (nodeList: ComponentNode[]) => {
      for (const node of nodeList) {
        if (node.children && node.children.length > 0) {
          ids.push(node.id);
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return ids;
  };

  const expandAllNodes = () => {
    const allIds = collectAllNodeIds(filteredComponentTree);
    setExpandedNodes(new Set(allIds));
  };

  const collapseAllNodes = () => {
    setExpandedNodes(new Set());
  };

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const renderComponentTree = (nodes: ComponentNode[], level: number = 0) => {
    const getTreeNodeMarker = (nodeLevel: number) => {
      if (nodeLevel === 0) return "B6.1";
      if (nodeLevel === 1) return "B6.2";
      if (nodeLevel === 2) return "B6.3";
      return "B6.4";
    };

    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedComponent?.id === node.id;
      const markerLevel = getTreeNodeMarker(level);

      return (
        <div key={node.id} data-testid={markerLevel}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-blue-50" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              setSelectedComponent(node);
              if (hasChildren) {
                toggleNode(node.id);
              }
              if (isChangeRequestMode) {
                setIsComponentFormOpen(true);
              }
            }}
          >
            <Marker id={markerLevel} />
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
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            <span className="text-sm text-gray-700">
              {node.name.startsWith(node.code + " ") ? node.name : `${node.code} ${node.name}`}
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderComponentTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const formSections = [
    { id: "A", title: "Component Information", marker: "B7.A" },
    { id: "B", title: "Running Hours & Condition Monitoring", marker: "B7.B" },
    { id: "C", title: "Jobs", marker: "B7.C" },
    { id: "D", title: "Maintenance History", marker: "B7.D" },
    { id: "E", title: "Spares", marker: "B7.E.1" },
    { id: "F", title: "Drawings & Manuals", marker: "B7.F" },
    { id: "G", title: "Classification & Regulatory Data", marker: "B7.G" },
    { id: "H", title: "Requisitions", marker: "B7.H" }
  ];

  // Build proposed changes from tracked modifications
  const buildProposedChanges = () => {
    const changes: any[] = [];
    
    // Use Change Mode Context diffs which properly track all field changes
    const diffs = getDiffs();
    
    if (diffs.length > 0) {
      diffs.forEach(diff => {
        changes.push({
          field: diff.path,
          oldValue: diff.oldVal || '',
          newValue: diff.newVal || ''
        });
      });
    }
    
    return changes;
  };

  // Handle Submit for modify mode
  const handleModifySubmit = async () => {
    if (!selectedComponent) {
      toast({
        title: "Please select a component",
        description: "You must select a component to modify before submitting",
        variant: "destructive"
      });
      return;
    }

    // Prevent change requests for hardcoded main categories (1-8)
    // These are organizational placeholders, not actual stored components
    const mainCategoryIds = ["1", "2", "3", "4", "5", "6", "7", "8"];
    if (mainCategoryIds.includes(selectedComponent.id)) {
      toast({
        title: "Cannot modify main category",
        description: "Main categories are organizational placeholders. Please create sub-components to add editable items.",
        variant: "destructive"
      });
      return;
    }

    // Build the proposed changes from actual modifications
    const proposedChanges = buildProposedChanges();
    
    if (proposedChanges.length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some modifications before submitting",
        variant: "destructive"
      });
      return;
    }

    // Create proper change request structure matching the schema
    // Use actual component data from selectedComponent (which has all fields via spread operator)
    const comp = selectedComponent as any;
    const changeRequest = {
      vesselId: vesselId,  // Required field - use global vessel context
      category: 'components',  // Required field
      title: `Modify Component: ${selectedComponent.code} ${selectedComponent.name}`,  // Required field
      reason: 'Component modification request',  // Required field
      requestedByUserId: 'current_user',  // Required field
      targetType: 'component',
      targetId: selectedComponent.actualId || selectedComponent.id,  // Use actual database ID
      snapshotBeforeJson: {
        displayKey: selectedComponent.code,
        displayName: selectedComponent.name,
        displayPath: `${selectedComponent.code} ${selectedComponent.name}`,
        fields: {
          id: selectedComponent.actualId || selectedComponent.id,  // Use actual database ID
          code: comp.componentCode || selectedComponent.code,
          name: comp.name || selectedComponent.name,
          fleetEquipmentCode: comp.fleetEquipmentCode || "",
          fleetEquipmentName: comp.fleetEquipmentName || "",
          parentComponent: comp.parentId || "",
          componentCode: comp.componentCode || "",
          componentName: comp.name || "",
          componentCategory: comp.componentCategory || comp.category || "",
          maker: comp.maker || "",
          makerCode: comp.makerCode || "",
          model: comp.model || "",
          modelCode: comp.modelCode || "",
          serialNo: comp.serialNo || "",
          drawingNo: comp.drawingNo || "",
          location: comp.location || "",
          critical: comp.critical === true || comp.critical === "Yes" ? "Yes" : (comp.critical === false || comp.critical === "No" ? "No" : ""),
          conditionBased: comp.conditionBased === true || comp.conditionBased === "Yes" ? "Yes" : (comp.conditionBased === false || comp.conditionBased === "No" ? "No" : ""),
          installationDate: comp.installationDate || "",
          commissionedDate: comp.commissionedDate || "",
          rating: comp.rating || "",
          eqptSystemDept: comp.eqptSystemDept || comp.deptCategory || comp.department || "",
          notes: comp.notes || "",
          runningHours: comp.runningHours || comp.currentCumulativeRH || "",
          isActive: comp.isActive !== undefined ? (comp.isActive ? "Yes" : "No") : "",
          vesselCode: comp.vesselCode || "",
          isParent: comp.isParent !== undefined ? (comp.isParent ? "Yes" : "No") : "",
          classItem: comp.classItem === true || comp.classItem === "Yes" ? "Yes" : (comp.classItem === false || comp.classItem === "No" ? "No" : ""),
          noOfUnits: comp.noOfUnits || "",
          dimensionsSize: comp.dimensionsSize || ""
        }
      },
      proposedChangesJson: proposedChanges,  // Now populated with actual changes
      status: 'submitted'  // Submit directly as submitted for review
    };

    try {
      const response = await fetch('/technical/api/change-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changeRequest),
      });

      if (response.ok) {
        toast({
          title: "Change request created",
          description: "Your change request has been created as a draft. Navigate to Modify PMS to complete it.",
        });
        // Navigate back to Modify PMS
        setLocation('/pms/modify-pms');
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to submit change request');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission failed",
        description: (error as Error).message || "Failed to submit change request. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (showAddEditFullPage) {
    return (
      <ComponentRegisterAddEdit
        onBack={() => {
          setShowAddEditFullPage(false);
          setEditingComponentId(null);
          setEditingComponentCode(null);
        }}
        componentId={editingComponentId}
        componentCode={editingComponentCode}
        parentComponent={!editingComponentId && selectedComponent ? {
          code: selectedComponent.code,
          id: selectedComponent.actualId || selectedComponent.id,
          name: selectedComponent.name
        } : undefined}
      />
    );
  }

  return (
    <div className={`flex flex-col ${isModifyMode ? '' : isChangeMode ? 'bg-orange-50' : isChangeRequestMode ? 'bg-[#52baf3]' : ''}`} style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0">
        {/* Change Mode Banner */}
        {isChangeMode && (
          <div className="mb-4 p-4 bg-amber-50 border-b-2 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-semibold text-amber-900">
                    You are proposing changes to this record
                  </h3>
                  <p className="text-sm text-amber-700">
                    {changeRequestTitle ? `Change Request: ${changeRequestTitle}` : 'Edited fields will be tracked and submitted for approval'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelChangeMode}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowReviewDrawer(true)}
                  disabled={getDiffs().length === 0}
                >
                  Review & Submit
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header with SubModule Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {isChangeRequestMode && (
              <Button
                variant="ghost"
                onClick={handleBackToModifyPMS}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Modify PMS
              </Button>
            )}
            <h1 className={`text-2xl font-bold ${isChangeRequestMode ? 'text-white' : 'text-gray-800'}`} data-testid="B1">
              <Marker id="B1" /> Components {isChangeMode ? '- Edit Mode' : isChangeRequestMode ? '- Change Request Mode' : ''}
            </h1>
          </div>
          {(isSailAdmin || isClientAdmin) && !isChangeRequestMode && !isChangeMode && (
            <Button 
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
              onClick={() => {
                setEditingComponentId(null);
                setEditingComponentCode(null);
                setShowAddEditFullPage(true);
              }}
              data-testid="B5"
            >
              <Marker id="B5" /> + Add / Edit Component
            </Button>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="flex gap-4 mb-4">
          {(isSailAdmin || isClientAdmin || isChangeMode || isChangeRequestMode) && (
          <div className="flex items-center gap-2" data-testid="B2">
            <Marker id="B2" />
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Vessel:</span>
            <Select value={vesselId === 'all' ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className={`w-[200px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
                <SelectValue placeholder="Choose vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map(vessel => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          
          <div className="flex items-center gap-2" data-testid="B3">
            <Marker id="B3" />
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Critical Item:</span>
            <Select value={criticalFilter} onValueChange={setCriticalFilter}>
              <SelectTrigger className={`w-[140px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
                <SelectValue placeholder="All Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="non-critical">Non-Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 flex-1" data-testid="B4">
            <Marker id="B4" />
            <Input
              placeholder="Search by Name, SFI Code, Fleet Equipment Code, Maker, or Serial Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`max-w-md ${isChangeRequestMode ? 'border-white bg-white/10 text-white placeholder:text-white/70' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex gap-6 h-full min-h-0">
        {/* Left Panel - Component Tree (30%) */}
        <div className="w-[30%]" data-testid="B6">
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex-shrink-0 bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm flex items-center justify-between gap-2 rounded-t-lg">
              <div className="flex items-center gap-2">
                <Marker id="B6" /> COMPONENTS
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAllNodes}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                  data-testid="button-expand-all-components"
                >
                  <Expand className="h-3 w-3" />
                  Expand
                </button>
                <button
                  onClick={collapseAllNodes}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                  data-testid="button-collapse-all-components"
                >
                  <Minimize2 className="h-3 w-3" />
                  Collapse
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <div>
                {renderComponentTree(filteredComponentTree)}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Component Details Form (70%) */}
        <div className="w-[70%]" data-testid="B7">
          {selectedComponent ? (
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="p-4 border-b-2 border-[#52baf3] flex-shrink-0">
                <Marker id="B7" />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#15569e]" data-testid="B7.1">
                    <Marker id="B7.1" /> {selectedComponent.code} {selectedComponent.name}
                  </h3>
                  {(isSailAdmin || isClientAdmin) && !isChangeRequestMode && !isChangeMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#52baf3] border-[#52baf3] hover:bg-[#52baf3] hover:text-white"
                      onClick={() => {
                        // Use actualId (database UUID) for API calls, and code for tree selection
                        setEditingComponentId(selectedComponent.actualId || selectedComponent.id);
                        setEditingComponentCode(selectedComponent.code);
                        setShowAddEditFullPage(true);
                      }}
                      data-testid="B7.2"
                    >
                      <Marker id="B7.2" /> <Edit2 className="h-4 w-4 mr-1" />
                      Edit Component
                    </Button>
                  )}
                </div>
                
                {/* Preview Mode Banner */}
                {isPreviewMode && changeRequestData && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 text-sm">Viewing Change Request Preview</h4>
                        <p className="text-xs text-blue-700">
                          {changeRequestData.title} - Changed fields are highlighted in <span className="text-red-600 font-medium">red</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation('/pms/modify-pms')}
                        className="text-blue-700 border-blue-300 text-xs px-2 py-1 h-7"
                      >
                        <ArrowLeft className="w-3 h-3 mr-1" />
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-2">
                  {formSections.map((section) => {
                    const isExpanded = expandedSections.has(section.id);
                    
                    return (
                      <Card key={section.id} className="rounded-sm border border-gray-200" data-testid={section.marker}>
                        <CardHeader 
                          className="py-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSection(section.id)}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-[#16569e] flex items-center gap-2">
                              <Marker id={section.marker} /> {section.id}. {section.title}
                            </CardTitle>
                            <span data-testid="B7.3">
                              <Marker id="B7.3" />
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="pt-4 border-t border-gray-100">
                            {section.id === "A" ? (
                            <ComponentInformationSection 
                              isExpanded={isExpanded} 
                              selectedComponent={selectedComponent}
                              isModifyMode={isModifyMode || isPreviewMode}
                              isPreviewMode={isPreviewMode}
                              previewChanges={previewChanges}
                              onDataChange={(data) => {
                                // Update modified component data for change tracking
                                if (isModifyMode) {
                                  setModifiedComponentData(data);
                                }
                                if (!originalComponentData && data) {
                                  setOriginalComponentData(JSON.parse(JSON.stringify(data)));
                                }
                              }}
                            />
                          ) : section.id === "B" ? (
                            <RunningHoursConditionSection selectedComponent={selectedComponent} />
                          ) : section.id === "C" ? (
                            <WorkOrdersSection 
                              componentCode={selectedComponent?.code || ""} 
                              componentName={selectedComponent?.name || ""} 
                            />
                          ) : section.id === "D" ? (
                            <MaintenanceHistorySection selectedComponent={selectedComponent} />
                          ) : section.id === "E" ? (
                            <SparesSection selectedComponent={selectedComponent} />
                          ) : section.id === "F" ? (
                            <DrawingsAndManualsSection selectedComponent={selectedComponent} />
                          ) : section.id === "G" ? (
                            <ClassificationRegulatorySection selectedComponent={selectedComponent} />
                          ) : section.id === "H" ? (
                            <RequisitionsSection selectedComponent={selectedComponent} />
                          ) : (
                            <p className="text-sm text-gray-500">
                              {section.title} content will be added here
                            </p>
                          )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
                
                {/* Submit Changes Button - Only shown in modify mode */}
                {isModifyMode && modifiedComponentData && (
                  <div className="mt-6 pb-4">
                    <button
                      onClick={() => {
                        // Create change request with modified data
                        const changedFields: any = {};
                        if (originalComponentData && modifiedComponentData) {
                          Object.keys(modifiedComponentData).forEach(key => {
                            if (modifiedComponentData[key] !== originalComponentData[key]) {
                              changedFields[key] = {
                                old: originalComponentData[key],
                                new: modifiedComponentData[key]
                              };
                            }
                          });
                        }
                        
                        if (Object.keys(changedFields).length > 0) {
                          // Show review drawer with changes
                          setShowReviewDrawer(true);
                        } else {
                          toast({
                            title: "No Changes",
                            description: "No fields have been modified",
                          });
                        }
                      }}
                      className="w-full bg-[#15569e] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#0d3d6e] transition-colors"
                      disabled={!modifiedComponentData}
                    >
                      Submit Changes
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm h-full flex items-center justify-center">
              <p className="text-gray-500">Select a component to view details</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Component Register Form */}
      {/* Use CR form when in change request mode, AddEditComponentForm otherwise */}
      {isChangeRequestMode ? (
        <ComponentRegisterFormCR
          isOpen={isComponentFormOpen}
          onClose={() => {
            setIsComponentFormOpen(false);
            if (isChangeRequestMode) {
              exitChangeRequestMode();
              reset();
              setLocation("/pms/modify-pms");
            }
          }}
          selectedComponent={selectedComponent}
        />
      ) : (
        <AddEditComponentForm 
          isOpen={isComponentFormOpen}
          onClose={() => {
            setIsComponentFormOpen(false);
            setEditingComponentId(null);
            setEditingComponentCode(null);
            // If in change mode and closing without submitting, go back to ModifyPMS
            if (isChangeMode) {
              exitChangeRequestMode();
              reset();
              setLocation("/pms/modify-pms");
            }
          }}
          componentId={editingComponentId}
          parentComponent={!editingComponentId && selectedComponent ? { 
            code: selectedComponent.code, 
            id: selectedComponent.actualId || selectedComponent.id, 
            name: selectedComponent.name 
          } : undefined}
        />
      )}

      {/* Review Changes Drawer */}
      {(isChangeMode || isModifyMode) && selectedComponent && (
        <ReviewChangesDrawer
          isOpen={showReviewDrawer}
          onClose={() => setShowReviewDrawer(false)}
          targetType="component"
          targetId={selectedComponent.actualId || selectedComponent.id}
        />
      )}
      
      {/* Sticky Footer for Modify Mode */}
      {isModifyMode && showModifySubmitFooter && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {selectedComponent 
                    ? `Selected: ${selectedComponent.code} ${selectedComponent.name}`
                    : 'Select a component to modify'}
                </span>
                {selectedComponent && (
                  <span className="text-xs text-gray-500">
                    • Make your changes then click Submit
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModifySubmitFooter(false);
                    setLocation('/pms/modify-pms');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#52BAF3] hover:bg-[#40a8e0] text-white"
                  onClick={handleModifySubmit}
                  disabled={!selectedComponent}
                >
                  Submit Change Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Components;