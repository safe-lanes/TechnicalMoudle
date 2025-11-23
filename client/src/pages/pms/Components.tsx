import React, { useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Edit2, FileText, ArrowLeft, Plus, Check, Package, X, AlertCircle, CheckCircle, HelpCircle, File, FileImage, FileCheck, Upload, Download, Lock } from "lucide-react";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdminOnly } from "@/components/RoleGuard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ComponentRegisterForm from "@/components/ComponentRegisterForm";
import ComponentRegisterFormCR from "@/components/ComponentRegisterFormCR";
import { ReviewChangesDrawer } from "@/components/ReviewChangesDrawer";
import { useChangeRequest } from "@/contexts/ChangeRequestContext";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useLocation } from "wouter";
import { getComponentCategory } from "@/utils/componentUtils";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { FEATURES } from '@/config/features';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { VESSELS } from "@/lib/vessels";
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

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  children?: ComponentNode[];
  isExpanded?: boolean;
  critical?: boolean;
  [key: string]: any; // Allow additional properties from component data
}


const ComponentInformationSection: React.FC<{ isExpanded: boolean; selectedComponent: ComponentNode | null; isModifyMode?: boolean; onDataChange?: (data: any) => void; previewChanges?: any[]; isPreviewMode?: boolean }> = ({ isExpanded, selectedComponent, isModifyMode = false, onDataChange, previewChanges = [], isPreviewMode = false }) => {
  const { isChangeRequestMode } = useChangeRequest();
  const { collectDiff } = useChangeMode();
  const isChangeMode = isModifyMode;

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
        componentCategory: getComponentCategory(selectedComponent.id),
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
        eqptSystemDept: comp.eqptSystemDept || comp.deptCategory || "",
        notes: comp.notes || "",
        runningHours: comp.runningHours || "",
        isActive: toBoolString(comp.isActive),
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
  
  // Track which fields have been changed
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  
  const handleFieldChange = (fieldName: string, value: string) => {
    if (!isChangeMode && !isModifyMode) return;
    
    const originalValue = componentData[fieldName as keyof typeof componentData];
    setComponentData(prev => ({ ...prev, [fieldName]: value }));
    
    // Component change tracking is handled through onDataChange callback
    
    // Track the change
    if (value !== originalValue) {
      setChangedFields(prev => new Set(prev).add(fieldName));
      if (isModifyMode && collectDiff) {
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
      {/* Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Fleet Equipment Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.fleetEquipmentCode}
              onChange={(e) => handleFieldChange('fleetEquipmentCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-fleet-equipment-code"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-fleet-equipment-code">
              {componentData.fleetEquipmentCode}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Fleet Equipment Name</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.fleetEquipmentName}
              onChange={(e) => handleFieldChange('fleetEquipmentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-fleet-equipment-name"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-fleet-equipment-name">
              {componentData.fleetEquipmentName}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Parent Component Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.parentComponent}
              onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('parentComponent') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-parent-component-code"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-parent-component-code">
              {componentData.parentComponent}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Code</label>
          <div className="text-sm text-gray-900" data-testid="text-component-code">
            {componentData.componentCode}
          </div>
        </div>
      </div>
      {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Name</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.componentName}
              onChange={(e) => handleFieldChange('componentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('componentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-component-name"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-component-name">
              {componentData.componentName}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Category</label>
          <div className="text-sm text-gray-900" data-testid="text-component-category">
            {componentData.componentCategory}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Maker</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.maker}
              onChange={(e) => handleFieldChange('maker', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('maker') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-maker"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-maker">
              {componentData.maker}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Maker Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.makerCode}
              onChange={(e) => handleFieldChange('makerCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('makerCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-maker-code"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-maker-code">
              {componentData.makerCode}
            </div>
          )}
        </div>
      </div>
      {/* Row 3: Model, Model Code, Serial No, Drawing No */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Model</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('model') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-model"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-model">
              {componentData.model}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Model Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.modelCode}
              onChange={(e) => handleFieldChange('modelCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('modelCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-model-code"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-model-code">
              {componentData.modelCode}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Serial No</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.serialNo}
              onChange={(e) => handleFieldChange('serialNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('serialNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-serial-no"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-serial-no">
              {componentData.serialNo}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Drawing No</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.drawingNo}
              onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('drawingNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-drawing-no"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-drawing-no">
              {componentData.drawingNo}
            </div>
          )}
        </div>
      </div>
      
      {/* Row 4: Location, Critical (Yes/No), Condition Based (Yes/No), Installation Date */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Location</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('location') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-location"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-location">
              {componentData.location}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Critical</label>
          {isChangeMode ? (
            <select
              value={componentData.critical}
              onChange={(e) => handleFieldChange('critical', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('critical') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="select-critical"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-critical">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Condition Based</label>
          {isChangeMode ? (
            <select
              value={componentData.conditionBased}
              onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('conditionBased') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="select-condition-based"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-condition-based">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Installation Date</label>
          {isChangeMode ? (
            <input
              type="date"
              value={componentData.installationDate}
              onChange={(e) => handleFieldChange('installationDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('installationDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-installation-date"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-installation-date">
              {componentData.installationDate}
            </div>
          )}
        </div>
      </div>
      
      {/* Row 5: Commissioning Date, Rating, Equip/System Department, (spacer) */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Commissioning Date</label>
          {isChangeMode ? (
            <input
              type="date"
              value={componentData.commissionedDate}
              onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('commissionedDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-commissioned-date"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-commissioned-date">
              {componentData.commissionedDate}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Rating</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.rating}
              onChange={(e) => handleFieldChange('rating', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('rating') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-rating"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-rating">
              {componentData.rating}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Equip/System Department</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.eqptSystemDept}
              onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('eqptSystemDept') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-eqpt-system-dept"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-eqpt-system-dept">
              {componentData.eqptSystemDept}
            </div>
          )}
        </div>
        <div>
          {/* Empty spacer field */}
        </div>
      </div>

      {/* Row 6: Running Hours, IS Active, Vessel Code, IS Parent */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Running Hours</label>
          {isChangeMode ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={componentData.runningHours}
              onChange={(e) => handleFieldChange('runningHours', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('runningHours') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-running-hours"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-running-hours">
              {componentData.runningHours}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>IS Active</label>
          {isChangeMode ? (
            <select
              value={componentData.isActive}
              onChange={(e) => handleFieldChange('isActive', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('isActive') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="select-is-active"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-is-active">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.isActive === "Yes" 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.isActive}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Vessel Code</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.vesselCode}
              onChange={(e) => handleFieldChange('vesselCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('vesselCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-vessel-code"
            />
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-vessel-code">
              {componentData.vesselCode}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>IS Parent</label>
          {isChangeMode ? (
            <select
              value={componentData.isParent}
              onChange={(e) => handleFieldChange('isParent', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('isParent') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="select-is-parent"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900" data-testid="text-is-parent">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.isParent === "Yes" 
                  ? "bg-purple-100 text-purple-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.isParent}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 7: Notes (full width) */}
      <div>
        <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Notes</label>
        {isChangeMode ? (
          <textarea
            value={componentData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            className={`text-sm w-full px-2 py-1 border rounded ${
              changedFields.has('notes') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
            }`}
            rows={3}
            data-testid="input-notes"
          />
        ) : (
          <div className="text-sm text-gray-900" data-testid="text-notes">
            {componentData.notes}
          </div>
        )}
      </div>
    </div>
  );
};

const RunningHoursConditionSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { isChangeRequestMode } = useChangeRequest();
  const { isModifyMode } = useModifyMode();
  
  // Fetch running hours audit data for the selected component
  const { data: runningHoursAudit = [] } = useQuery<any[]>({
    queryKey: ['/api/running-hours-audit', selectedComponent?.id],
    enabled: !!selectedComponent?.id,
  });
  
  // Get the latest running hours update
  const latestUpdate = runningHoursAudit.length > 0 ? runningHoursAudit[0] : null;
  
  // State for running hours data - initialized from selectedComponent
  const [runningHoursData, setRunningHoursData] = useState({
    currentHours: selectedComponent?.currentCumulativeRH || "0.00",
    updatedDate: selectedComponent?.lastUpdated || latestUpdate?.dateUpdatedLocal || "-"
  });
  
  // Update data when selectedComponent changes
  React.useEffect(() => {
    if (selectedComponent) {
      setRunningHoursData({
        currentHours: selectedComponent.currentCumulativeRH || "0.00",
        updatedDate: selectedComponent.lastUpdated || latestUpdate?.dateUpdatedLocal || "-"
      });
    }
  }, [selectedComponent, latestUpdate]);
  
  const [originalData] = useState(runningHoursData);
  
  const handleFieldChange = (field: string, value: any) => {
    setRunningHoursData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view running hours</div>;
  };
  
  return (
    <div className="space-y-6">
      {/* Running Hours */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm font-medium text-gray-700">Running Hours:</label>
          <Edit2 className="h-4 w-4 text-gray-500" />
        </div>
        <div className="flex gap-12 pl-2">
          <div>
            <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Current</label>
            {isModifyMode ? (
              <ModifyFieldWrapper
                originalValue={originalData.currentHours}
                currentValue={runningHoursData.currentHours}
                fieldName="currentHours"
                isModifyMode={isModifyMode}
                onFieldChange={(field, value) => handleFieldChange('currentHours', value)}
              >
                <input
                  type="text"
                  value={runningHoursData.currentHours}
                  onChange={(e) => handleFieldChange('currentHours', e.target.value)}
                  className="text-sm w-full px-2 py-1 border rounded"
                  data-testid="input-current-hours"
                />
              </ModifyFieldWrapper>
            ) : (
              <div className="text-sm font-semibold text-gray-900" data-testid="text-current-hours">
                {runningHoursData.currentHours}
              </div>
            )}
          </div>
          <div>
            <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Updated</label>
            {isModifyMode ? (
              <ModifyFieldWrapper
                originalValue={originalData.updatedDate}
                currentValue={runningHoursData.updatedDate}
                fieldName="updatedDate"
                isModifyMode={isModifyMode}
                onFieldChange={(field, value) => handleFieldChange('updatedDate', value)}
              >
                <input
                  type="text"
                  value={runningHoursData.updatedDate}
                  onChange={(e) => handleFieldChange('updatedDate', e.target.value)}
                  className="text-sm w-full px-2 py-1 border rounded"
                  data-testid="input-updated-date"
                />
              </ModifyFieldWrapper>
            ) : (
              <div className="text-sm font-semibold text-gray-900" data-testid="text-updated-date">
                {runningHoursData.updatedDate}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkOrdersSection: React.FC<{ componentCode: string; componentName: string }> = ({ componentCode, componentName }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: allJobs = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });
  
  // Get all components to find children
  const { data: allComponents = [] } = useQuery<any[]>({
    queryKey: ['/api/components'],
  });
  
  // Find all child component codes recursively
  const getAllChildCodes = (parentCode: string): string[] => {
    const children = allComponents.filter(c => c.parentId === parentCode);
    const childCodes = children.map(c => c.componentCode);
    const descendantCodes = children.flatMap(c => getAllChildCodes(c.componentCode));
    return [...childCodes, ...descendantCodes];
  };
  
  // Get component codes to include (parent + all children)
  const relevantComponentCodes = [componentCode, ...getAllChildCodes(componentCode)];
  
  // Filter jobs for this component AND all its children
  const jobs = allJobs.filter(job => relevantComponentCodes.includes(job.componentCode));
  
  // Check URL parameter to navigate to job page when returning from Maintenance Records
  React.useEffect(() => {
    // Only run when data has loaded (not loading)
    if (isLoading) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const openJobId = urlParams.get('openJobId');
    
    if (openJobId) {
      // Find the job and navigate to its full-screen page in template mode
      const jobToOpen = allJobs.find((job: any) => job.id === openJobId);
      if (jobToOpen) {
        setLocation(`/pms/work-order/${jobToOpen.id}?mode=template`);
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
    // Navigate to new work order page for this component
    setLocation(`/pms/work-order/new/${componentCode}`);
  };

  const handleRowClick = (workOrder: any) => {
    // Navigate to job template page (Part A only)
    setLocation(`/pms/work-order/${workOrder.id}?mode=template`);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex justify-end mb-3">
          <Button
            onClick={handleAddWorkOrder}
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Job
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Job No.</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Job Title</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Maintenance Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Frequency</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Last Done Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Next Due Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Loading jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No jobs found for this component
                </td>
              </tr>
            ) : (
              jobs.map((job, index) => (
                <tr 
                  key={index} 
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(job)}
                  data-testid={`job-row-${job.jobNo}`}
                >
                  <td className="py-3 px-3 text-gray-900" data-testid={`job-no-${job.jobNo}`}>{job.jobNo}</td>
                  <td className="py-3 px-3 text-gray-900" data-testid={`job-title-${job.jobNo}`}>{job.jobTitle}</td>
                  <td className="py-3 px-3 text-gray-900">{job.maintenanceType}</td>
                  <td className="py-3 px-3 text-gray-900">{job.frequencyValue} {job.frequencyUnit}</td>
                  <td className="py-3 px-3 text-gray-900">{formatProfessionalDate(job.lastDoneDate) || '-'}</td>
                  <td className="py-3 px-3 text-gray-900">{formatProfessionalDate(job.nextDueDate) || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const MaintenanceHistorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  // Fetch maintenance history for the selected component
  const { data: maintenanceHistory = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/component-maintenance-history', selectedComponent?.id],
    enabled: !!selectedComponent?.id,
  });

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
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{maintenanceHistory.length}</span> maintenance record(s) found
        </div>
        <div className="text-xs text-gray-500 italic">
          ⚠️ Records are immutable and cannot be edited or deleted
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-3 px-3 font-semibold text-gray-700">WO No</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Job Title</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Type</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Date Completed</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Running Hours</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Performed By</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Approved By</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {maintenanceHistory.map((record, index) => (
              <tr 
                key={index} 
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
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
      </div>
      
      {/* Expandable Details Section - Future Enhancement */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 Click on a record to view full details including work description, spares used, and remarks (feature coming soon)
      </div>
    </div>
  );
};

const SparesSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { isModifyMode } = useModifyMode();
  
  // Fetch existing spares data from current API
  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/api/spares'],
  });
  
  // Filter spares by component ID
  const spares = selectedComponent 
    ? allSpares.filter(s => s.componentId === selectedComponent.id)
    : [];
  
  const [originalSpares] = useState(JSON.parse(JSON.stringify(spares)));
  
  const handleFieldChange = (index: number, field: string, value: string) => {
    // ModifyFieldWrapper handles change tracking
  };
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view associated spares</div>;
  }
  
  if (spares.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          No spare parts linked to this component
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Navigate to the Spares module to manage spare parts inventory
        </p>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Part Code</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Part Name</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Critical</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">ROB</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Min</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Stock</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Location</th>
            {FEATURES.IHM && (
              <th className="text-center py-2 px-3 font-medium text-gray-600" title="IHM Status">IHM</th>
            )}
          </tr>
        </thead>
        <tbody>
          {spares.map((spare, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].partCode}
                    currentValue={spare.partCode}
                    fieldName={`partCode-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'partCode', value)}
                  >
                    <input
                      type="text"
                      value={spare.partCode}
                      onChange={(e) => handleFieldChange(index, 'partCode', e.target.value)}
                      className="text-sm w-full px-2 py-1 border rounded"
                    />
                  </ModifyFieldWrapper>
                ) : (
                  spare.partCode
                )}
              </td>
              <td className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].partName}
                    currentValue={spare.partName}
                    fieldName={`partName-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'partName', value)}
                  >
                    <input
                      type="text"
                      value={spare.partName}
                      onChange={(e) => handleFieldChange(index, 'partName', e.target.value)}
                      className="text-sm w-full px-2 py-1 border rounded"
                    />
                  </ModifyFieldWrapper>
                ) : (
                  spare.partName
                )}
              </td>
              <td className="py-3 px-3">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].critical}
                    currentValue={spare.critical}
                    fieldName={`critical-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'critical', value)}
                  >
                    <select
                      value={spare.critical}
                      onChange={(e) => handleFieldChange(index, 'critical', e.target.value)}
                      className="text-sm w-full px-2 py-1 border rounded"
                    >
                      <option value="">Non-Critical</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </ModifyFieldWrapper>
                ) : (
                  spare.critical && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                      {spare.critical}
                    </span>
                  )
                )}
              </td>
              <td className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].rob}
                    currentValue={spare.rob}
                    fieldName={`rob-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'rob', value)}
                  >
                    <input
                      type="text"
                      value={spare.rob}
                      onChange={(e) => handleFieldChange(index, 'rob', e.target.value)}
                      className="text-sm w-[60px] px-2 py-1 border rounded"
                    />
                  </ModifyFieldWrapper>
                ) : (
                  spare.rob
                )}
              </td>
              <td className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].min}
                    currentValue={spare.min}
                    fieldName={`min-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'min', value)}
                  >
                    <input
                      type="text"
                      value={spare.min}
                      onChange={(e) => handleFieldChange(index, 'min', e.target.value)}
                      className="text-sm w-[60px] px-2 py-1 border rounded"
                    />
                  </ModifyFieldWrapper>
                ) : (
                  spare.min
                )}
              </td>
              <td className="py-3 px-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {spare.stock}
                </span>
              </td>
              <td className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares[index].location}
                    currentValue={spare.location}
                    fieldName={`location-${index}`}
                    isModifyMode={isModifyMode}
                    onFieldChange={(field, value) => handleFieldChange(index, 'location', value)}
                  >
                    <input
                      type="text"
                      value={spare.location}
                      onChange={(e) => handleFieldChange(index, 'location', e.target.value)}
                      className="text-sm w-full px-2 py-1 border rounded"
                    />
                  </ModifyFieldWrapper>
                ) : (
                  spare.location
                )}
              </td>
              {FEATURES.IHM && (
                <td className="py-3 px-3 text-center">
                  {/* Mock IHM status - in real implementation, fetch from API */}
                  {spare.partCode === 'SP-ME-001' ? (
                    <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                  ) : spare.partCode === 'SP-ME-002' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <HelpCircle className="h-4 w-4 text-gray-400 mx-auto" />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DrawingsAndManualsSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { canViewDocument, canDownloadDocument } = useAuth();
  
  // Fetch documents for the selected component
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/component-documents', selectedComponent?.id],
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
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view documents</div>;
  }
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading documents...</div>;
  }
  
  // Filter documents based on role permissions
  const viewableDocuments = documents.filter(doc => canViewDocument(doc));
  
  if (viewableDocuments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-sm">
          No drawings or manuals available for this component
        </div>
        <AdminOnly>
          <p className="text-xs text-gray-500 mt-2">
            Upload technical documents using object storage integration
          </p>
        </AdminOnly>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{viewableDocuments.length}</span> document(s) available
        </div>
        <AdminOnly>
          <Button size="sm" variant="outline" className="text-xs" data-testid="button-upload-document">
            <Upload className="h-3 w-3 mr-1" />
            Upload Document
          </Button>
        </AdminOnly>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {viewableDocuments.map((doc, index) => {
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
              data-testid={`document-${doc.fileName || index}`}
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
                <Download className="h-4 w-4 text-gray-400" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 Document access is controlled by role-based permissions
      </div>
    </div>
  );
};

const ClassificationRegulatorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  // Fetch class regulatory data for the selected component
  const { data: classRegData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/component-class-regulatory', selectedComponent?.id],
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
          No classification & regulatory data found for this component
        </div>
        <AdminOnly>
          <p className="text-xs text-gray-500 mt-2">
            Add survey records to track classification society requirements
          </p>
        </AdminOnly>
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
                <td className="py-3 px-3 text-gray-900">{item.certificateNo}</td>
                <td className="py-3 px-3 text-gray-900">{item.lastSurveyDate}</td>
                <td className="py-3 px-3 text-gray-900">{item.nextDueDate}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'Valid' ? 'bg-green-100 text-green-800' :
                    item.status === 'Due Soon' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status || 'Valid'}
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
  // Future enhancement - component-related requisitions
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view requisitions</div>;
  }
  
  return (
    <div className="text-center py-8">
      <div className="text-gray-400 text-sm">
        Requisitions section - future enhancement
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Will display component-related purchase and service requisitions
      </p>
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
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [showModifySubmitFooter, setShowModifySubmitFooter] = useState(false);
  const [modifiedComponentData, setModifiedComponentData] = useState<any>(null);
  const [originalComponentData, setOriginalComponentData] = useState<any>(null);
  
  // Preview changes mode state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [changeRequestData, setChangeRequestData] = useState<any>(null);
  const [previewChanges, setPreviewChanges] = useState<any[]>([]);
  
  const { isChangeRequestMode, exitChangeRequestMode } = useChangeRequest();
  const { isChangeMode, changeRequestTitle, changeRequestCategory, setOriginalSnapshot, collectDiff, getDiffs, reset } = useChangeMode();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  
  // Fetch components from API and build tree
  const { data: fetchedComponents = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: [`/api/components/${vesselId}`],
  });
  
  // Build component tree from fetched data
  const componentTreeData = React.useMemo(() => {
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
        id: code,
        code: code,
        name: comp.name,
        ...comp,  // Include all component data
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
      
      if (comp.parentId) {
        // Has explicit parent ID - use it
        const parent = componentMap.get(comp.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      } else {
        // No parent ID - determine category from code prefix (first digit)
        const categoryCode = code.split('.')[0];
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
      fetch(`/api/change-requests/${changeRequestId}`)
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
  
  // Handle change mode - capture original snapshot when component is selected
  useEffect(() => {
    if (isChangeMode && selectedComponent) {
      // Set the original snapshot for change tracking
      const snapshot = {
        id: selectedComponent.id,
        displayKey: selectedComponent.code,
        displayName: selectedComponent.name,
        displayPath: `${selectedComponent.code} ${selectedComponent.name}`,
        componentCode: selectedComponent.code,
        name: selectedComponent.name,
        maker: "MAN B&W", // These would come from actual data
        model: "6S60MC-C",
        serialNo: "MB2020001",
        category: getComponentCategory(selectedComponent.code),
        deptCategory: "Engineering",
        location: "Engine Room",
        critical: "Yes",
        classItem: "Yes",
        commissionedDate: "01-Jan-2020"
      };
      setOriginalSnapshot(snapshot);
    }
  }, [isChangeMode, selectedComponent]);
  
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
  
  // Check if we should open the Add/Edit Component form OR select a specific component
  useEffect(() => {
    const shouldOpenForm = sessionStorage.getItem('openComponentForm');
    const targetComponentCode = sessionStorage.getItem('targetComponentCode');
    
    if (shouldOpenForm === 'true') {
      setIsComponentFormOpen(true);
      sessionStorage.removeItem('openComponentForm');
    }
    
    // If we have a target component code from ModifyPMS, find and select it
    if (targetComponentCode) {
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
      if (targetComponent) {
        setSelectedComponent(targetComponent);
        // Expand parent nodes to show the selected component
        const expandParents = (code: string) => {
          const parts = code.split('.');
          const parentsToExpand: string[] = [];
          for (let i = 1; i <= parts.length; i++) {
            parentsToExpand.push(parts.slice(0, i).join('.'));
          }
          setExpandedNodes(new Set(parentsToExpand));
        };
        expandParents(targetComponentCode);
      }
      sessionStorage.removeItem('targetComponentCode');
    }
  }, []);

  const handleBackToModifyPMS = () => {
    exitChangeRequestMode();
    reset();
    setLocation("/pms/modify-pms");
  };
  
  const handleCancelChangeMode = () => {
    reset();
    setLocation("/pms/modify-pms");
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
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedComponent?.id === node.id;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-blue-50" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              setSelectedComponent(node);
              // Automatically open CR form when in change request mode
              if (isChangeRequestMode) {
                setIsComponentFormOpen(true);
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
    { id: "A", title: "Component Information" },
    { id: "B", title: "Running Hours & Condition Monitoring" },
    { id: "C", title: "Jobs" },
    { id: "D", title: "Maintenance History" },
    { id: "E", title: "Spares" },
    { id: "F", title: "Drawings & Manuals" },
    { id: "G", title: "Classification & Regulatory Data" },
    { id: "H", title: "Requisitions" }
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
    // Use actual database values (currently empty) - will be populated from Excel upload
    const changeRequest = {
      vesselId: 'V001',  // Required field
      category: 'components',  // Required field
      title: `Modify Component: ${selectedComponent.code} ${selectedComponent.name}`,  // Required field
      reason: 'Component modification request',  // Required field
      requestedByUserId: 'current_user',  // Required field
      targetType: 'component',
      targetId: selectedComponent.id,
      snapshotBeforeJson: {
        displayKey: selectedComponent.code,
        displayName: selectedComponent.name,
        displayPath: `${selectedComponent.code} ${selectedComponent.name}`,
        fields: {
          id: selectedComponent.id,
          code: selectedComponent.code,
          name: selectedComponent.name,
          maker: "",
          model: "",
          serialNo: "",
          department: "",
          location: "",
          critical: "",
          classItem: "",
          commissionedDate: "",
          installationDate: "",
          rating: "",
          conditionBased: "",
          noOfUnits: "",
          eqptSystemDept: "",
          parentComponent: "",
          dimensionsSize: "",
          notes: ""
        }
      },
      proposedChangesJson: proposedChanges,  // Now populated with actual changes
      status: 'submitted'  // Submit directly as submitted for review
    };

    try {
      const response = await fetch('/api/change-requests', {
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

  return (
    <div className={`h-full p-6 ${isModifyMode ? '' : isChangeMode ? 'bg-orange-50' : isChangeRequestMode ? 'bg-[#52baf3]' : 'bg-[#fafafa]'}`}>
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
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
            <h1 className={`text-2xl font-semibold ${isChangeRequestMode ? 'text-white' : 'text-gray-800'}`}>
              Components {isChangeMode ? '- Edit Mode' : isChangeRequestMode ? '- Change Request Mode' : ''}
            </h1>
          </div>
          {!isChangeRequestMode && !isChangeMode && (
            <Button 
              className="bg-[#52baf3] hover:bg-[#40a8e0] text-white"
              onClick={() => setIsComponentFormOpen(true)}
            >
              + Add / Edit Component
            </Button>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Vessel:</span>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger className={`w-[200px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {VESSELS.map(vessel => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.id} – MV {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
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
          
          <div className="flex items-center gap-2 flex-1">
            <Input
              placeholder="Search by Name, SFI Code, Fleet Equipment Code, Maker, or Serial Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`max-w-md ${isChangeRequestMode ? 'border-white bg-white/10 text-white placeholder:text-white/70' : ''}`}
            />
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left Panel - Component Tree (30%) */}
        <div className="w-[30%]">
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex-1 overflow-auto">
              <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm">
                COMPONENTS
              </div>
              <div>
                {renderComponentTree(filteredComponentTree)}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Component Details Form (70%) */}
        <div className="w-[70%]">
          {selectedComponent ? (
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="p-4 border-b-2 border-[#52baf3] flex-shrink-0">
                <h3 className="text-lg font-semibold text-[#15569e]">
                  {selectedComponent.code} {selectedComponent.name}
                </h3>
                
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
                      <Card key={section.id} className="rounded-sm border border-gray-200">
                        <CardHeader 
                          className="py-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSection(section.id)}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-[#16569e]">
                              {section.id}. {section.title}
                            </CardTitle>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
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

      {/* Component Register Form */}
      {/* Use CR form when in change request mode, regular form otherwise */}
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
        <ComponentRegisterForm 
          isOpen={isComponentFormOpen}
          onClose={() => {
            setIsComponentFormOpen(false);
            // If in change mode and closing without submitting, go back to ModifyPMS
            if (isChangeMode) {
              exitChangeRequestMode();
              reset();
              setLocation("/pms/modify-pms");
            }
          }}
          parentComponent={selectedComponent ? { 
            code: selectedComponent.code, 
            id: selectedComponent.id, 
            name: selectedComponent.name 
          } : undefined}
          onSubmit={async (componentData) => {
          console.log('Component data submitted:', componentData);
          
          // If in change mode, create a change request
          if (isChangeMode) {
            try {
              // Create the change request with proper structure
              const changeRequest = {
                category: 'components',
                title: changeRequestTitle || `New Component: ${componentData.componentName}`,
                reason: `Adding new component ${componentData.componentName} with code ${componentData.componentCode}`,
                targetType: 'component',
                targetId: componentData.componentCode,
                snapshotBeforeJson: {
                  displayKey: componentData.componentCode,
                  displayName: componentData.componentName,
                  displayPath: `${componentData.componentCode} ${componentData.componentName}`,
                  fields: {
                    componentCode: componentData.componentCode,
                    componentName: componentData.componentName,
                    maker: componentData.maker || '',
                    model: componentData.model || '',
                    serialNo: componentData.serialNo || '',
                    category: componentData.equipmentCategory || '',
                    location: componentData.location || '',
                    critical: componentData.critical || 'No',
                    classItem: componentData.classItem || 'No'
                  }
                },
                proposedChangesJson: [{
                  field: 'New Component',
                  oldValue: null,
                  newValue: componentData.componentName,
                  description: `Create new component ${componentData.componentCode} - ${componentData.componentName}`
                }],
                status: 'submitted',
                vesselId: 'MV Test Vessel',
                requestedByUserId: 'current_user'
              };

              // Submit to API
              const response = await fetch('/api/change-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changeRequest)
              });

              if (response.ok) {
                const result = await response.json();
                toast({
                  title: "Success",
                  description: `Change request CR${String(result.id).padStart(4, '0')} created and submitted successfully`
                });
                
                // Exit change mode and navigate back to ModifyPMS
                exitChangeRequestMode();
                reset();
                setLocation("/pms/modify-pms");
              } else {
                throw new Error('Failed to create change request');
              }
            } catch (error) {
              console.error('Error creating change request:', error);
              toast({
                title: "Error",
                description: "Failed to create change request",
                variant: "destructive"
              });
            }
          } else {
            // Normal mode - submit component data to API
            try {
              // Helper function to convert "Yes"/"No" strings to boolean
              const toBool = (val: any) => {
                if (typeof val === 'boolean') return val;
                if (typeof val === 'string') return val.toLowerCase() === 'yes';
                return false;
              };

              // Prepare component data with proper boolean conversion and field name mapping
              const componentPayload = {
                ...componentData,
                // Map frontend field names to backend schema names
                eqptSystemDept: (componentData as any).equipmentDepartment || componentData.eqptSystemDept || null,
                critical: toBool(componentData.critical),
                classItem: toBool(componentData.classItem),
                conditionBased: toBool(componentData.conditionBased),
                isActive: toBool(componentData.isActive),
              };
              
              // Remove the frontend-only field
              delete (componentPayload as any).equipmentDepartment;

              // Determine if this is create or update
              const isEditing = selectedComponent && !isComponentFormOpen;
              const url = isEditing 
                ? `/api/components/${selectedComponent.id}` 
                : '/api/components';
              const method = isEditing ? 'PATCH' : 'POST';

              const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(componentPayload)
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save component');
              }

              const result = await response.json();

              toast({
                title: "Success",
                description: isEditing 
                  ? "Component updated successfully" 
                  : "Component created successfully"
              });
              
              // Invalidate components cache to refresh the tree
              queryClient.invalidateQueries({ queryKey: ['/api/components'] });
              
              setIsComponentFormOpen(false);
            } catch (error: any) {
              console.error('Error saving component:', error);
              toast({
                title: "Error",
                description: error.message || "Failed to save component",
                variant: "destructive"
              });
            }
          }
        }}
      />
      )}
      
      {/* Review Changes Drawer */}
      {(isChangeMode || isModifyMode) && selectedComponent && (
        <ReviewChangesDrawer
          isOpen={showReviewDrawer}
          onClose={() => setShowReviewDrawer(false)}
          targetType="component"
          targetId={selectedComponent.id}
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