import React, { useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Edit2, FileText, ArrowLeft, Plus, Check, Package, X, AlertCircle, CheckCircle, HelpCircle, File, FileImage, FileCheck, Upload, Download, Lock, Wrench, User, ClipboardList, MessageSquare, MapPin, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
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
          <label data-marker="B7.A.1" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Fleet Equipment Code</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.2"
              value={componentData.fleetEquipmentCode}
              onChange={(e) => handleFieldChange('fleetEquipmentCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-fleet-equipment-code"
            />
          ) : (
            <div data-marker="B7.A.2" className="text-sm text-gray-900" data-testid="text-fleet-equipment-code">
              {componentData.fleetEquipmentCode}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.3" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Fleet Equipment Name</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.4"
              value={componentData.fleetEquipmentName}
              onChange={(e) => handleFieldChange('fleetEquipmentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('fleetEquipmentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-fleet-equipment-name"
            />
          ) : (
            <div data-marker="B7.A.4" className="text-sm text-gray-900" data-testid="text-fleet-equipment-name">
              {componentData.fleetEquipmentName}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.5" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Parent Component Code</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.6"
              value={componentData.parentComponent}
              onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('parentComponent') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-parent-component-code"
            />
          ) : (
            <div data-marker="B7.A.6" className="text-sm text-gray-900" data-testid="text-parent-component-code">
              {componentData.parentComponent}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.7" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Code</label>
          <div data-marker="B7.A.8" className="text-sm text-gray-900" data-testid="text-component-code">
            {componentData.componentCode}
          </div>
        </div>
      </div>
      {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label data-marker="B7.A.9" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Name</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.10"
              value={componentData.componentName}
              onChange={(e) => handleFieldChange('componentName', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('componentName') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-component-name"
            />
          ) : (
            <div data-marker="B7.A.10" className="text-sm text-gray-900" data-testid="text-component-name">
              {componentData.componentName}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.11" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Component Category</label>
          <div data-marker="B7.A.12" className="text-sm text-gray-900" data-testid="text-component-category">
            {componentData.componentCategory}
          </div>
        </div>
        <div>
          <label data-marker="B7.A.13" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Maker</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.14"
              value={componentData.maker}
              onChange={(e) => handleFieldChange('maker', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('maker') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-maker"
            />
          ) : (
            <div data-marker="B7.A.14" className="text-sm text-gray-900" data-testid="text-maker">
              {componentData.maker}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.15" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Maker Code</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.16"
              value={componentData.makerCode}
              onChange={(e) => handleFieldChange('makerCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('makerCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-maker-code"
            />
          ) : (
            <div data-marker="B7.A.16" className="text-sm text-gray-900" data-testid="text-maker-code">
              {componentData.makerCode}
            </div>
          )}
        </div>
      </div>
      {/* Row 3: Model, Model Code, Serial No, Drawing No */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label data-marker="B7.A.17" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Model</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.18"
              value={componentData.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('model') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-model"
            />
          ) : (
            <div data-marker="B7.A.18" className="text-sm text-gray-900" data-testid="text-model">
              {componentData.model}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.19" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Model Code</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.20"
              value={componentData.modelCode}
              onChange={(e) => handleFieldChange('modelCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('modelCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-model-code"
            />
          ) : (
            <div data-marker="B7.A.20" className="text-sm text-gray-900" data-testid="text-model-code">
              {componentData.modelCode}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.21" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Serial No</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.22"
              value={componentData.serialNo}
              onChange={(e) => handleFieldChange('serialNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('serialNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-serial-no"
            />
          ) : (
            <div data-marker="B7.A.22" className="text-sm text-gray-900" data-testid="text-serial-no">
              {componentData.serialNo}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.23" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Drawing No</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.24"
              value={componentData.drawingNo}
              onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('drawingNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-drawing-no"
            />
          ) : (
            <div data-marker="B7.A.24" className="text-sm text-gray-900" data-testid="text-drawing-no">
              {componentData.drawingNo}
            </div>
          )}
        </div>
      </div>
      
      {/* Row 4: Location, Critical (Yes/No), Condition Based (Yes/No), Installation Date */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label data-marker="B7.A.25" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Location</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.26"
              value={componentData.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('location') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-location"
            />
          ) : (
            <div data-marker="B7.A.26" className="text-sm text-gray-900" data-testid="text-location">
              {componentData.location}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.27" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Criticality</label>
          {isChangeMode ? (
            <select
              data-marker="B7.A.28"
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
            <div data-marker="B7.A.28" className="text-sm text-gray-900" data-testid="text-critical">
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
          <label data-marker="B7.A.29" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Condition Based</label>
          {isChangeMode ? (
            <select
              data-marker="B7.A.30"
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
            <div data-marker="B7.A.30" className="text-sm text-gray-900" data-testid="text-condition-based">
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
          <label data-marker="B7.A.31" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Installation Date</label>
          {isChangeMode ? (
            <input
              type="date"
              data-marker="B7.A.32"
              value={componentData.installationDate}
              onChange={(e) => handleFieldChange('installationDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('installationDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-installation-date"
            />
          ) : (
            <div data-marker="B7.A.32" className="text-sm text-gray-900" data-testid="text-installation-date">
              {componentData.installationDate}
            </div>
          )}
        </div>
      </div>
      
      {/* Row 5: Commissioning Date, Rating, Equip/System Department, (spacer) */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label data-marker="B7.A.33" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Commissioned Date</label>
          {isChangeMode ? (
            <input
              type="date"
              data-marker="B7.A.34"
              value={componentData.commissionedDate}
              onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('commissionedDate') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-commissioned-date"
            />
          ) : (
            <div data-marker="B7.A.34" className="text-sm text-gray-900" data-testid="text-commissioned-date">
              {componentData.commissionedDate}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.35" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Rating</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.36"
              value={componentData.rating}
              onChange={(e) => handleFieldChange('rating', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('rating') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-rating"
            />
          ) : (
            <div data-marker="B7.A.36" className="text-sm text-gray-900" data-testid="text-rating">
              {componentData.rating}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.37" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Equipment / System Department</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.38"
              value={componentData.eqptSystemDept}
              onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('eqptSystemDept') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-eqpt-system-dept"
            />
          ) : (
            <div data-marker="B7.A.38" className="text-sm text-gray-900" data-testid="text-eqpt-system-dept">
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
          <label data-marker="B7.A.39" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Running Hours</label>
          {isChangeMode ? (
            <input
              type="number"
              min="0"
              step="0.01"
              data-marker="B7.A.40"
              value={componentData.runningHours}
              onChange={(e) => handleFieldChange('runningHours', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('runningHours') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-running-hours"
            />
          ) : (
            <div data-marker="B7.A.40" className="text-sm text-gray-900" data-testid="text-running-hours">
              {componentData.runningHours}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.41" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>IS Active</label>
          {isChangeMode ? (
            <select
              data-marker="B7.A.42"
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
            <div data-marker="B7.A.42" className="text-sm text-gray-900" data-testid="text-is-active">
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
          <label data-marker="B7.A.43" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Vessel Code</label>
          {isChangeMode ? (
            <input
              type="text"
              data-marker="B7.A.44"
              value={componentData.vesselCode}
              onChange={(e) => handleFieldChange('vesselCode', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('vesselCode') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-testid="input-vessel-code"
            />
          ) : (
            <div data-marker="B7.A.44" className="text-sm text-gray-900" data-testid="text-vessel-code">
              {componentData.vesselCode}
            </div>
          )}
        </div>
        <div>
          <label data-marker="B7.A.45" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>IS Parent</label>
          {isChangeMode ? (
            <select
              data-marker="B7.A.46"
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
            <div data-marker="B7.A.46" className="text-sm text-gray-900" data-testid="text-is-parent">
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
        <label data-marker="B7.A.47" className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'} block mb-1`}>Notes</label>
        {isChangeMode ? (
          <textarea
            data-marker="B7.A.48"
            value={componentData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            className={`text-sm w-full px-2 py-1 border rounded ${
              changedFields.has('notes') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
            }`}
            rows={3}
            data-testid="input-notes"
          />
        ) : (
          <div data-marker="B7.A.48" className="text-sm text-gray-900" data-testid="text-notes">
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
  const { canModifyData } = useAuth();
  
  // Get explicit values from component
  const explicitRhType = (selectedComponent as any)?.rhCounterType;
  const rhMasterComponentId = (selectedComponent as any)?.rhMasterComponentId;
  const componentCode = selectedComponent?.code || (selectedComponent as any)?.componentCode;
  const parentId = (selectedComponent as any)?.parentId;
  
  // Only fetch jobs for auto-detection if no explicit type is set
  const { data: allJobs = [], isLoading: isJobsLoading } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    enabled: !explicitRhType, // Only fetch if no explicit type
  });
  
  // Memoize auto-detection to avoid recalculating on every render
  const autoDetectedType = React.useMemo(() => {
    if (explicitRhType) return null; // Don't auto-detect if explicit type exists
    if (!componentCode || isJobsLoading) return 'NONE'; // Default to NONE while loading
    
    const componentJobs = allJobs.filter((j: any) => j.componentCode === componentCode);
    const hasRHJobs = componentJobs.some((j: any) => 
      j.frequencyType === 'Running Hours' || 
      (j.rhInterval && Number(j.rhInterval) > 0)
    );
    return hasRHJobs ? 'MASTER' : 'NONE';
  }, [explicitRhType, componentCode, allJobs, isJobsLoading]);
  
  // Final RH counter type: explicit takes precedence, fallback to auto-detected
  const rhCounterType = explicitRhType || autoDetectedType || 'NONE';
  
  // Fetch master component data if type is INHERITED
  const { data: masterComponent, isLoading: isMasterLoading } = useQuery<any>({
    queryKey: ['/api/components/details', rhMasterComponentId],
    enabled: rhCounterType === 'INHERITED' && !!rhMasterComponentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Fetch parent component for INHERITED type (to display parent name as counter source)
  const { data: parentComponent } = useQuery<any>({
    queryKey: ['/api/components/details', parentId],
    enabled: rhCounterType === 'INHERITED' && !!parentId,
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch running hours audit data for accurate timestamps (for MASTER type)
  const { data: runningHoursAudit = [] } = useQuery<any[]>({
    queryKey: ['/api/running-hours-audit', selectedComponent?.id],
    enabled: !!selectedComponent?.id && rhCounterType === 'MASTER',
    staleTime: 60 * 1000, // Cache for 1 minute
  });
  
  const latestAuditUpdate = runningHoursAudit.length > 0 ? runningHoursAudit[0] : null;
  
  // Helper to get display label for counter type
  const getCounterTypeLabel = (type: string) => {
    switch (type) {
      case 'MASTER': return 'Master (RH Owner)';
      case 'INHERITED': return 'Inherited (Uses Master Counter)';
      case 'NONE': 
      default: return 'Not RH Driven';
    }
  };
  
  
  // Get component's own RH and timestamp values (used as fallback)
  const comp = selectedComponent as any;
  const componentRh = comp?.currentCumulativeRH ?? comp?.runningHours;
  const componentLastUpdated = comp?.lastUpdated ?? comp?.rhLastUpdated;
  
  // Unified loading state for INHERITED type - pending while loading OR data not yet available
  const isMasterPending = rhCounterType === 'INHERITED' && (isMasterLoading || masterComponent === undefined);
  
  // Dummy date fallback for Last Updated when no real timestamp exists
  const DUMMY_DATE = '15 Dec 2025';
  
  // Get running hours value - always show component RH value for all types
  const getRunningHoursValue = (): string => {
    if (rhCounterType === 'INHERITED') {
      if (isMasterPending) return 'Loading...';
      // Nullish coalescing: master RH → component RH → dash
      const inheritedRh = masterComponent?.currentCumulativeRH ?? masterComponent?.runningHours ?? componentRh;
      return inheritedRh != null ? String(inheritedRh) : '—';
    }
    
    // For MASTER, show "0" as fallback (RH-driven component)
    if (rhCounterType === 'MASTER') {
      return componentRh != null ? String(componentRh) : '0';
    }
    
    // For NONE, show actual value if exists, otherwise dash (not RH-driven)
    return componentRh != null ? String(componentRh) : '—';
  };
  
  // Get last updated date - using nullish coalescing for proper fallback chain
  const getLastUpdatedValue = (): string => {
    if (rhCounterType === 'INHERITED') {
      if (isMasterPending) return 'Loading...';
      // Nullish coalescing: master timestamp → component timestamp → dummy date
      const inheritedUpdated = masterComponent?.lastUpdated ?? masterComponent?.rhLastUpdated ?? componentLastUpdated;
      return inheritedUpdated ?? DUMMY_DATE;
    }
    
    // For MASTER and NONE, audit timestamp → component timestamp → dummy date
    const masterUpdated = latestAuditUpdate?.dateUpdatedLocal ?? componentLastUpdated;
    return masterUpdated ?? DUMMY_DATE;
  };
  
  // Get counter source - shows appropriate value based on type (per spec B7.B.2)
  // MASTER: "Self" (same), INHERITED: parent component, NONE: no value needed
  const getCounterSourceValue = (): string => {
    if (rhCounterType === 'MASTER') return 'Self';
    if (rhCounterType === 'INHERITED') {
      // Show parent component name for inherited type
      return parentComponent?.name ?? parentId ?? '—';
    }
    // For NONE type, no value needed per spec
    return '—';
  };
  
  // Check if edit should be enabled (only for MASTER type AND user has permission - Office/Admin only, not Ship)
  const isEditEnabled = rhCounterType === 'MASTER' && canModifyData();
  
  if (!selectedComponent) {
    return <div className="text-sm text-gray-500">Select a component to view running hours</div>;
  }
  
  return (
    <div className="space-y-4">
      {/* Running Hours Table with 4 columns */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid="table-running-hours">
          <thead>
            <tr className="bg-[#52BAF3] text-white">
              <th data-marker="B7.B.TH1" className="px-4 py-2 text-left text-xs font-semibold border border-gray-300">RH Counter Type</th>
              <th data-marker="B7.B.TH2" className="px-4 py-2 text-left text-xs font-semibold border border-gray-300">RH Counter Source</th>
              <th data-marker="B7.B.TH3" className="px-4 py-2 text-left text-xs font-semibold border border-gray-300">Running Hours</th>
              <th data-marker="B7.B.TH4" className="px-4 py-2 text-left text-xs font-semibold border border-gray-300">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white hover:bg-gray-50">
              <td data-marker="B7.B.RHT.V" className="px-4 py-3 text-sm border border-gray-200" data-testid="text-rh-counter-type">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  rhCounterType === 'MASTER' 
                    ? 'bg-blue-100 text-blue-800' 
                    : rhCounterType === 'INHERITED'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getCounterTypeLabel(rhCounterType)}
                </span>
              </td>
              <td data-marker="B7.B.RHS.V" className="px-4 py-3 text-sm border border-gray-200" data-testid="text-rh-counter-source">
                {getCounterSourceValue()}
              </td>
              <td data-marker="B7.B.3" className="px-4 py-3 text-sm font-semibold border border-gray-200" data-testid="text-running-hours">
                {rhCounterType === 'MASTER' || rhCounterType === 'INHERITED' ? (
                  <span className={rhCounterType === 'INHERITED' ? 'text-purple-700' : 'text-gray-900'}>{getRunningHoursValue()}</span>
                ) : (
                  <span className="text-gray-400">{getRunningHoursValue()}</span>
                )}
              </td>
              <td data-marker="B7.B.6" className="px-4 py-3 text-sm border border-gray-200" data-testid="text-last-updated">
                {rhCounterType === 'MASTER' || rhCounterType === 'INHERITED' ? (
                  <span className={rhCounterType === 'INHERITED' ? 'text-purple-700' : 'text-gray-900'}>{getLastUpdatedValue()}</span>
                ) : (
                  <span className="text-gray-400">{getLastUpdatedValue()}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Helper text for INHERITED type */}
      {rhCounterType === 'INHERITED' && (
        <p data-marker="B7.B.HELPER" className="text-xs text-gray-500 italic">
          Running hours are driven by the master counter.
        </p>
      )}
      
      {/* Edit button for MASTER type (when user has permission) */}
      {isEditEnabled && isModifyMode && (
        <div className="flex items-center gap-2">
          <Edit2 data-marker="B7.B.4" className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-600" />
          <span className="text-xs text-gray-500">Click to edit running hours</span>
        </div>
      )}
    </div>
  );
};

const JobRow: React.FC<{
  job: any;
  onRowClick: (job: any) => void;
  toast: any;
}> = ({ job, onRowClick, toast }) => {
  const [showReasonDialog, setShowReasonDialog] = useState(false);

  const generateWOMutation = useMutation({
    mutationFn: async (reason: 'Planning' | 'Breakdown' | 'Other') => {
      const response = await fetch(`/api/jobs/${job.id}/generate-wo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
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
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
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
        data-marker={`B7.C.3-row-${job.id || job.jobNo}`}
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => onRowClick(job)}
        data-testid={`job-row-${job.jobNo}`}
      >
        <td data-marker={`B7.C.3.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900" data-testid={`job-no-${job.jobNo}`}>{job.jobNo}</td>
        <td data-marker={`B7.C.4.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900" data-testid={`job-title-${job.jobNo}`}>{job.jobTitle}</td>
        <td data-marker={`B7.C.5.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900">{job.maintenanceType}</td>
        <td data-marker={`B7.C.6.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900">
          {job.maintenanceBasis === 'Running Hours' 
            ? `${job.intervalRunningHour || 0} RH` 
            : `${job.frequencyValue} ${job.frequencyUnit}`}
        </td>
        <td data-marker={`B7.C.7.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900">{formatProfessionalDate(job.lastDoneDate) || '-'}</td>
        <td data-marker={`B7.C.8.1-${job.id || job.jobNo}`} className="py-3 px-3 text-gray-900">
          {job.maintenanceBasis === 'Running Hours' 
            ? (() => {
                // Calculate remaining RH: Frequency - (Current RH - Last Done RH)
                const frequency = parseFloat(job.intervalRunningHour || '0');
                const currentRH = parseFloat(job.componentCurrentRH || '0');
                const lastDoneRH = parseFloat(job.lastDoneRH || '0');
                const remainingRH = frequency - (currentRH - lastDoneRH);
                return remainingRH > 0 ? `${remainingRH.toFixed(0)} RH` : 'Due';
              })()
            : formatProfessionalDate(job.nextDueDate) || '-'}
        </td>
        <td data-marker={`B7.C.9.1-${job.id || job.jobNo}`} className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
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

  const handleAddJob = () => {
    // Navigate to new job form page for this component (template mode = only Section A)
    setLocation(`/pms/work-order/new/${componentCode}?mode=template`);
  };

  const handleRowClick = (job: any) => {
    // Navigate to Jobs Form page
    setLocation(`/pms/job/${job.id}`);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex justify-end mb-3">
          <Button
            data-marker="B7.C.2"
            onClick={handleAddJob}
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
              <th data-marker="B7.C.3" className="text-left py-2 px-3 font-medium text-gray-600">Job Code</th>
              <th data-marker="B7.C.4" className="text-left py-2 px-3 font-medium text-gray-600">Job Title</th>
              <th data-marker="B7.C.5" className="text-left py-2 px-3 font-medium text-gray-600">Task Type</th>
              <th data-marker="B7.C.6" className="text-left py-2 px-3 font-medium text-gray-600">Frequency</th>
              <th data-marker="B7.C.7" className="text-left py-2 px-3 font-medium text-gray-600">Last Done Date</th>
              <th data-marker="B7.C.8" className="text-left py-2 px-3 font-medium text-gray-600">Next Due Date</th>
              <th data-marker="B7.C.9" className="text-center py-2 px-3 font-medium text-gray-600">Actions</th>
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
              jobs.map((job, index) => (
                <JobRow 
                  key={index}
                  job={job}
                  onRowClick={handleRowClick}
                  toast={toast}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const MaintenanceHistorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  
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
        <div data-marker="B7.D.2" className="text-sm text-gray-600">
          <span className="font-semibold">{maintenanceHistory.length}</span> maintenance record(s) found
        </div>
        <div data-marker="B7.D.3" className="text-xs text-gray-500 italic">
          Records are immutable and cannot be edited or deleted
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th data-marker="B7.D.4" className="text-left py-3 px-3 font-semibold text-gray-700">WO No</th>
              <th data-marker="B7.D.5" className="text-left py-3 px-3 font-semibold text-gray-700">Job Title</th>
              <th data-marker="B7.D.6" className="text-left py-3 px-3 font-semibold text-gray-700">Type</th>
              <th data-marker="B7.D.7" className="text-left py-3 px-3 font-semibold text-gray-700">Date Completed</th>
              <th data-marker="B7.D.8" className="text-left py-3 px-3 font-semibold text-gray-700">Running Hours</th>
              <th data-marker="B7.D.9" className="text-left py-3 px-3 font-semibold text-gray-700">Performed By</th>
              <th data-marker="B7.D.10" className="text-left py-3 px-3 font-semibold text-gray-700">Approved By</th>
              <th data-marker="B7.D.11" className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {maintenanceHistory.map((record, index) => (
              <tr 
                key={index} 
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                onClick={() => setSelectedRecord(record)}
                data-testid={`maintenance-record-${record.workOrderNo}`}
                data-marker={`B7.D.12-row-${index}`}
              >
                <td data-marker={`B7.D.12-${index}`} className="py-3 px-3 text-gray-900 font-medium" data-testid={`wo-no-${record.workOrderNo}`}>
                  {record.workOrderNo}
                </td>
                <td data-marker={`B7.D.13-${index}`} className="py-3 px-3 text-gray-900" data-testid={`job-title-${record.workOrderNo}`}>
                  {record.jobTitle}
                </td>
                <td data-marker={`B7.D.14-${index}`} className="py-3 px-3 text-gray-900">{record.maintenanceType}</td>
                <td data-marker={`B7.D.15-${index}`} className="py-3 px-3 text-gray-900">{record.dateCompleted}</td>
                <td data-marker={`B7.D.16-${index}`} className="py-3 px-3 text-gray-900">
                  {record.runningHoursAtCompletion || '-'}
                </td>
                <td data-marker={`B7.D.17-${index}`} className="py-3 px-3 text-gray-900">{record.performedBy}</td>
                <td data-marker={`B7.D.18-${index}`} className="py-3 px-3 text-gray-900">{record.approvedBy || '-'}</td>
                <td data-marker={`B7.D.19-${index}`} className="py-3 px-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Instruction hint */}
      <div data-marker="B7.D.20" className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        Click on a record to view full details including work description, spares used, and remarks
      </div>

      {/* Record Detail Modal */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              Maintenance Record Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Work Order No.</label>
                  <p className="text-lg font-semibold text-gray-900" data-testid="detail-wo-no">{selectedRecord.workOrderNo}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                  <Badge className="bg-green-100 text-green-800 mt-1">{selectedRecord.status}</Badge>
                </div>
              </div>

              {/* Job Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Job Information
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="text-xs text-gray-500">Job Title</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.jobTitle}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Task Type</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.maintenanceType}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Date Completed</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.dateCompleted}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Running Hours at Completion</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.runningHoursAtCompletion || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Personnel */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" /> Personnel
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="text-xs text-gray-500">Performed By</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.performedBy}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Approved By</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRecord.approvedBy || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Work Description */}
              {selectedRecord.workDescription && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> Work Description
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedRecord.workDescription}</p>
                  </div>
                </div>
              )}

              {/* Spares Used */}
              {selectedRecord.sparesUsed && selectedRecord.sparesUsed.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Spares Used
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-gray-600">Part Code</th>
                          <th className="text-left py-2 text-gray-600">Part Name</th>
                          <th className="text-right py-2 text-gray-600">Qty Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRecord.sparesUsed.map((spare: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2 text-gray-900">{spare.partCode}</td>
                            <td className="py-2 text-gray-900">{spare.partName}</td>
                            <td className="py-2 text-gray-900 text-right">{spare.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedRecord.remarks && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Remarks
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedRecord.remarks}</p>
                  </div>
                </div>
              )}

              {/* Record Metadata */}
              <div className="pt-4 border-t text-xs text-gray-500">
                <p>This record was automatically created when the work order was completed and approved.</p>
                <p className="mt-1">Records are immutable for audit compliance purposes.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SparesSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { isModifyMode } = useModifyMode();
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [editingLocationA, setEditingLocationA] = useState('');
  const [editingLocationB, setEditingLocationB] = useState('');
  
  // Get vesselId from selectedComponent or default to V001
  const vesselId = selectedComponent?.vesselId || selectedComponent?.vesselCode || 'V001';
  
  // Fetch spares scoped to the current vessel to avoid cross-vessel data leakage
  // Note: queryKey[0] is used as the URL by default fetcher, so include vesselId in the URL path
  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: [`/api/spares/${vesselId}`],
    enabled: !!vesselId,
  });
  
  // Fetch vessel location names - URL must include vesselId since default fetcher uses queryKey[0]
  const { data: locationNames = { locationAName: 'Location A', locationBName: 'Location B' } } = useQuery<{
    vesselId: string;
    locationAName: string;
    locationBName: string;
  }>({
    queryKey: [`/api/vessel-location-names/${vesselId}`],
    enabled: !!vesselId,
  });
  
  // Get all components to find children
  const { data: allComponents = [] } = useQuery<any[]>({
    queryKey: ['/api/components'],
  });
  
  // Mutation to update location names
  const updateLocationNamesMutation = useMutation({
    mutationFn: async (data: { locationAName: string; locationBName: string }) => {
      const response = await fetch(`/api/vessel-location-names/${vesselId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, updatedBy: 'User' }),
      });
      if (!response.ok) throw new Error('Failed to update location names');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vessel-location-names/${vesselId}`] });
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
  
  // Find the actual database ID for a component by its code
  const getActualComponentId = (code: string): string | undefined => {
    const comp = allComponents.find((c: any) => (c.componentCode || c.code) === code);
    return comp?.id;
  };
  
  // Find all child component IDs recursively
  // Note: parentId stores parent's componentCode (not id), so we match by code
  const getAllChildIds = (parentCode: string): string[] => {
    const children = allComponents.filter((c: any) => c.parentId === parentCode);
    const childIds = children.map((c: any) => c.id);
    // Recurse using each child's componentCode (or code) as the next parentCode
    const descendantIds = children.flatMap((c: any) => getAllChildIds(c.componentCode || c.code));
    return [...childIds, ...descendantIds];
  };
  
  // Get component IDs to include (parent + all children)
  // Use selectedComponent.code to find the actual database ID and children
  const selectedActualId = selectedComponent ? getActualComponentId(selectedComponent.code) : undefined;
  const relevantComponentIds = selectedComponent 
    ? [selectedActualId, ...getAllChildIds(selectedComponent.code)].filter(Boolean) as string[]
    : [];
  
  // Filter spares for this component AND all its children
  const spares = selectedComponent 
    ? allSpares.filter(s => relevantComponentIds.includes(s.componentId))
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
            <th data-marker="B7.E.2" className="text-left py-2 px-3 font-medium text-gray-600">Part Code</th>
            <th data-marker="B7.E.3" className="text-left py-2 px-3 font-medium text-gray-600">Part Name</th>
            <th data-marker="B7.E.4" className="text-left py-2 px-3 font-medium text-gray-600">Critical</th>
            <th data-marker="B7.E.5" className="text-left py-2 px-3 font-medium text-gray-600">ROB</th>
            <th data-marker="B7.E.6" className="text-left py-2 px-3 font-medium text-gray-600">Min</th>
            <th data-marker="B7.E.7" className="text-left py-2 px-3 font-medium text-gray-600">Stock</th>
            <th data-marker="B7.E.8" className="text-left py-2 px-3 font-medium text-gray-600">Location</th>
            {FEATURES.IHM && (
              <th data-marker="B7.E.9" className="text-center py-2 px-3 font-medium text-gray-600" title="IHM Status">IHM</th>
            )}
          </tr>
        </thead>
        <tbody>
          {spares.map((spare, index) => (
            <tr key={index} className="border-b border-gray-100" data-marker={`B7.E.10-row-${index}`}>
              <td data-marker={`B7.E.10-${index}`} className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares?.[index]?.partCode ?? spare.partCode}
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
              <td data-marker={`B7.E.11-${index}`} className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares?.[index]?.partName ?? spare.partName}
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
              <td data-marker={`B7.E.12-${index}`} className="py-3 px-3">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares?.[index]?.critical ?? spare.critical}
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
              <td data-marker={`B7.E.13-${index}`} className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares?.[index]?.rob ?? spare.rob}
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
              <td data-marker={`B7.E.14-${index}`} className="py-3 px-3 text-gray-900">
                {isModifyMode ? (
                  <ModifyFieldWrapper
                    originalValue={originalSpares?.[index]?.min ?? spare.min}
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
              <td data-marker={`B7.E.15-${index}`} className="py-3 px-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {spare.stock}
                </span>
              </td>
              <td data-marker={`B7.E.16-${index}`} className="py-3 px-3 text-gray-900">
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      data-testid={`location-popup-trigger-${index}`}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>View Locations</span>
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
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-medium text-gray-700">{locationNames.locationAName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{spare.robLocationA ?? 0}</span>
                          <span className="text-xs text-gray-500 ml-1">units</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium text-gray-700">{locationNames.locationBName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{spare.robLocationB ?? 0}</span>
                          <span className="text-xs text-gray-500 ml-1">units</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t text-xs text-gray-500">
                        Total ROB: <span className="font-semibold text-gray-700">{spare.rob}</span> units
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </td>
              {FEATURES.IHM && (
                <td data-marker={`B7.E.17-${index}`} className="py-3 px-3 text-center">
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
    </div>
  );
};

const DrawingsAndManualsSection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  const { canViewDocument, canDownloadDocument } = useAuth();
  
  // Fetch documents for the selected component
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/component-documents/${selectedComponent?.id}`],
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
        <div data-marker="B7.F.2" className="text-sm text-gray-600">
          <span className="font-semibold">{viewableDocuments.length}</span> document(s) available
        </div>
        <AdminOnly>
          <Button data-marker="B7.F.3" size="sm" variant="outline" className="text-xs" data-testid="button-upload-document">
            <Upload className="h-3 w-3 mr-1" />
            Upload Document
          </Button>
        </AdminOnly>
      </div>
      
      <div data-marker="B7.F.4" className="grid grid-cols-2 gap-3">
        {viewableDocuments.map((doc, index) => {
          const IconComponent = getFileTypeIcon(doc.fileType);
          const hasDownloadAccess = canDownloadDocument(doc);
          
          return (
            <div
              key={index}
              data-marker={`B7.F.5-${index}`}
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
      
      <div data-marker="B7.F.6" className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 Document access is controlled by role-based permissions
      </div>
    </div>
  );
};

const ClassificationRegulatorySection: React.FC<{ selectedComponent: ComponentNode | null }> = ({ selectedComponent }) => {
  // Fetch class regulatory data for the selected component
  const { data: classRegData = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/component-class-regulatory/${selectedComponent?.id}`],
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
        <div data-marker="B7.G.2" className="text-sm text-gray-600">
          <span className="font-semibold">{classRegData.length}</span> survey record(s)
        </div>
        <AdminOnly>
          <Button data-marker="B7.G.3" size="sm" variant="outline" className="text-xs" data-testid="button-add-survey">
            <Plus className="h-3 w-3 mr-1" />
            Add Survey
          </Button>
        </AdminOnly>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th data-marker="B7.G.4" className="text-left py-2 px-3 font-medium text-gray-600">Classification Society</th>
              <th data-marker="B7.G.5" className="text-left py-2 px-3 font-medium text-gray-600">Survey Type</th>
              <th data-marker="B7.G.6" className="text-left py-2 px-3 font-medium text-gray-600">Certificate No.</th>
              <th data-marker="B7.G.7" className="text-left py-2 px-3 font-medium text-gray-600">Last Survey</th>
              <th data-marker="B7.G.8" className="text-left py-2 px-3 font-medium text-gray-600">Next Due</th>
              <th data-marker="B7.G.9" className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {classRegData.map((item, index) => (
              <tr key={index} className="border-b border-gray-100" data-marker={`B7.G.10-row-${index}`}>
                <td data-marker={`B7.G.10-${index}`} className="py-3 px-3 text-gray-900">{item.classificationSociety}</td>
                <td data-marker={`B7.G.11-${index}`} className="py-3 px-3 text-gray-900">{item.surveyType}</td>
                <td data-marker={`B7.G.12-${index}`} className="py-3 px-3 text-gray-900">{item.certificateNumber}</td>
                <td data-marker={`B7.G.13-${index}`} className="py-3 px-3 text-gray-900">{item.lastClassSurvey}</td>
                <td data-marker={`B7.G.14-${index}`} className="py-3 px-3 text-gray-900">{item.nextSurveyDue}</td>
                <td data-marker={`B7.G.15-${index}`} className="py-3 px-3">
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
    queryKey: [`/api/component-requisitions/${selectedComponent?.id}`],
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
          No requisitions found for this component
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Requisitions for spares and services will appear here
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div data-marker="B7.H.2" className="text-sm text-gray-600">
          <span className="font-semibold">{requisitions.length}</span> requisition(s)
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th data-marker="B7.H.3" className="text-left py-2 px-3 font-medium text-gray-600">Req. No</th>
              <th data-marker="B7.H.4" className="text-left py-2 px-3 font-medium text-gray-600">Item/Service</th>
              <th data-marker="B7.H.5" className="text-left py-2 px-3 font-medium text-gray-600">Qty</th>
              <th data-marker="B7.H.6" className="text-left py-2 px-3 font-medium text-gray-600">Raised On</th>
              <th data-marker="B7.H.7" className="text-left py-2 px-3 font-medium text-gray-600">Priority</th>
              <th data-marker="B7.H.8" className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.map((req, index) => (
              <tr key={index} className="border-b border-gray-100" data-marker={`B7.H.9-row-${index}`}>
                <td data-marker={`B7.H.9-${index}`} className="py-3 px-3 text-gray-900 font-medium">{req.requisitionNo}</td>
                <td data-marker={`B7.H.10-${index}`} className="py-3 px-3 text-gray-900">{req.itemOrService}</td>
                <td data-marker={`B7.H.11-${index}`} className="py-3 px-3 text-gray-900">{req.quantity} {req.uom}</td>
                <td data-marker={`B7.H.12-${index}`} className="py-3 px-3 text-gray-900">{req.raisedOn}</td>
                <td data-marker={`B7.H.13-${index}`} className="py-3 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.priority === 'Urgent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {req.priority}
                  </span>
                </td>
                <td data-marker={`B7.H.14-${index}`} className="py-3 px-3">
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
  
  // Fetch components from API and build tree
  const { data: fetchedComponents = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: ['/api/components', vesselId],
    enabled: !!vesselId && vesselId !== '',
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
      
      // Determine tree node marker based on level (B6.1 for level 1, B6.2 for level 2, etc.)
      // Level 0 = main categories (B6.1), Level 1 = subgroups (B6.2), Level 2 = sub-subgroups (B6.3), Level 3+ = components (B6.4)
      const getTreeNodeMarker = (lvl: number) => {
        if (lvl === 0) return "B6.1";
        if (lvl === 1) return "B6.2";
        if (lvl === 2) return "B6.3";
        return "B6.4";
      };

      return (
        <div key={node.id}>
          <div
            data-marker={getTreeNodeMarker(level)}
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-blue-50" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              setSelectedComponent(node);
              // Also toggle expansion when clicking on the component row
              if (hasChildren) {
                toggleNode(node.id);
              }
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

  if (showAddEditFullPage) {
    return (
      <ComponentRegisterAddEdit
        onBack={() => {
          setShowAddEditFullPage(false);
          setEditingComponentId(null);
        }}
        componentId={editingComponentId}
        parentComponent={!editingComponentId && selectedComponent ? {
          code: selectedComponent.code,
          id: selectedComponent.id,
          name: selectedComponent.name
        } : undefined}
      />
    );
  }

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
            <h1 data-marker="B1" className={`text-2xl font-semibold ${isChangeRequestMode ? 'text-white' : 'text-gray-800'}`}>
              Components {isChangeMode ? '- Edit Mode' : isChangeRequestMode ? '- Change Request Mode' : ''}
            </h1>
          </div>
          {!isChangeRequestMode && !isChangeMode && (
            <Button 
              data-marker="B5"
              className="bg-[#52baf3] hover:bg-[#40a8e0] text-white"
              onClick={() => {
                setEditingComponentId(null);
                setShowAddEditFullPage(true);
              }}
              data-testid="button-add-component"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Component
            </Button>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Vessel:</span>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger data-marker="B2" className={`w-[200px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map(vessel => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.id} - {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Critical Item:</span>
            <Select value={criticalFilter} onValueChange={setCriticalFilter}>
              <SelectTrigger data-marker="B3" className={`w-[140px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
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
              data-marker="B4"
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
          <div data-marker="B6" className="bg-white rounded-lg shadow-sm h-full flex flex-col">
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
            <div data-marker="B7" className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="p-4 border-b-2 border-[#52baf3] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 data-marker="B7.1" className="text-lg font-semibold text-[#15569e]">
                    {selectedComponent.code} {selectedComponent.name}
                  </h3>
                  {!isChangeRequestMode && !isChangeMode && (
                    <Button
                      data-marker="B7.2"
                      size="sm"
                      variant="outline"
                      className="text-[#52baf3] border-[#52baf3] hover:bg-[#52baf3] hover:text-white"
                      onClick={() => {
                        setEditingComponentId(selectedComponent.id);
                        setShowAddEditFullPage(true);
                      }}
                      data-testid="button-edit-component"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
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
                    const sectionMarkerMap: Record<string, string> = {
                      "A": "B7.A",
                      "B": "B7.B", 
                      "C": "B7.C.1",
                      "D": "B7.D.1",
                      "E": "B7.E.1",
                      "F": "B7.F.1",
                      "G": "B7.G.1",
                      "H": "B7.H.1"
                    };
                    
                    return (
                      <Card key={section.id} data-marker={sectionMarkerMap[section.id]} className="rounded-sm border border-gray-200">
                        <CardHeader 
                          className="py-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSection(section.id)}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-[#16569e]">
                              {section.id}. {section.title}
                            </CardTitle>
                            <span data-marker="B7.3">
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
            id: selectedComponent.id, 
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