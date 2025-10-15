import React, { useState, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Edit2, FileText, ArrowLeft, Plus, Check, Package, X, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ComponentRegisterForm from "@/components/ComponentRegisterForm";
import ComponentRegisterFormCR from "@/components/ComponentRegisterFormCR";
import WorkOrderForm from "@/components/WorkOrderForm";
import { ReviewChangesDrawer } from "@/components/ReviewChangesDrawer";
import { useChangeRequest } from "@/contexts/ChangeRequestContext";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useLocation } from "wouter";
import { getComponentCategory } from "@/utils/componentUtils";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { FEATURES } from '@/config/features';
import { useQuery } from '@tanstack/react-query';
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
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
    maker: "",
    model: "",
    serialNo: "",
    department: "",
    componentCategory: "",
    componentCode: "",
    critical: "",
    classItem: "",
    location: "",
    commissionedDate: "",
    installationDate: "",
    rating: "",
    conditionBased: "",
    noOfUnits: "",
    eqptSystemDept: "",
    parentComponent: "",
    dimensionsSize: "",
    notes: ""
  });
  
  // Track original component data for modify mode
  const [originalComponentData, setOriginalComponentData] = useState<typeof componentData | null>(null);
  
  // Update component data when selected component changes
  useEffect(() => {
    if (selectedComponent) {
      // Use empty values - will be populated from database after Excel upload
      const newData = {
        maker: "",
        model: "",
        serialNo: "",
        department: "",
        componentCategory: getComponentCategory(selectedComponent.id),
        componentCode: selectedComponent.code,
        critical: "",
        classItem: "",
        location: "",
        commissionedDate: "",
        installationDate: "",
        rating: "",
        conditionBased: "",
        noOfUnits: "",
        eqptSystemDept: "",
        parentComponent: "",
        dimensionsSize: "",
        notes: ""
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
      {/* Always visible first 2 rows */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Maker</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.maker}
              onChange={(e) => handleFieldChange('maker', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('maker') || hasPreviewChange('maker') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-field-value="maker"
            />
          ) : (
            <div className="text-sm text-gray-900">
              {componentData.maker}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Model</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('model') || hasPreviewChange('model') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-field-value="model"
            />
          ) : (
            <div className="text-sm text-gray-900">
              {componentData.model}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Serial No</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.serialNo}
              onChange={(e) => handleFieldChange('serialNo', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('serialNo') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-field-value="serialNo"
            />
          ) : (
            <div className="text-sm text-gray-900">
              {componentData.serialNo}
            </div>
          )}
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Department</label>
          {isChangeMode ? (
            <input
              type="text"
              value={componentData.department}
              onChange={(e) => handleFieldChange('department', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('department') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-field-value="department"
            />
          ) : (
            <div className="text-sm text-gray-900">
              {componentData.department}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Component Code</label>
          <div className="text-sm text-gray-900">
            {componentData.componentCode}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Component Category</label>
          <div className="text-sm text-gray-900">
            {componentData.componentCategory}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Critical</label>
          {isChangeMode || isPreviewMode ? (
            <select
              value={isPreviewMode && hasPreviewChange('critical') ? getPreviewValue('critical') : componentData.critical}
              onChange={(e) => handleFieldChange('critical', e.target.value)}
              disabled={isPreviewMode}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('critical') || hasPreviewChange('critical') ? 'text-red-600 border-red-300 bg-red-50' : 'text-[#52BAF3] border-[#52BAF3]'
              } ${isPreviewMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              data-field-value="critical"
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900">
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
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Class Item</label>
          {isChangeMode ? (
            <select
              value={componentData.classItem}
              onChange={(e) => handleFieldChange('classItem', e.target.value)}
              className={`text-sm w-full px-2 py-1 border rounded ${
                changedFields.has('classItem') ? 'text-red-600 border-red-300' : 'text-[#52BAF3] border-[#52BAF3]'
              }`}
              data-field-value="classItem"
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <div className="text-sm text-gray-900">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                componentData.classItem === "Yes" 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {componentData.classItem}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Third row */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Location</label>
          <div className="text-sm text-gray-900">
            {componentData.location}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>Commissioned Date</label>
          <div className="text-sm text-gray-900">
            {componentData.commissionedDate}
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>&nbsp;</label>
          <div className="text-sm text-gray-900">
            &nbsp;
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1`}>&nbsp;</label>
          <div className="text-sm text-gray-900">
            &nbsp;
          </div>
        </div>
      </div>

      {/* Additional details - only visible when expanded */}
      {isExpanded && (
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Installation Date</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.installationDate || componentData.installationDate}
                  currentValue={componentData.installationDate}
                  fieldName="installationDate"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('installationDate', value)}
                >
                  <input
                    type="date"
                    value={componentData.installationDate}
                    onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.installationDate}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Commissioned Date</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.commissionedDate || componentData.commissionedDate}
                  currentValue={componentData.commissionedDate}
                  fieldName="commissionedDate"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('commissionedDate', value)}
                >
                  <input
                    type="date"
                    value={componentData.commissionedDate}
                    onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.commissionedDate}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Rating</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.rating || componentData.rating}
                  currentValue={componentData.rating}
                  fieldName="rating"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('rating', value)}
                >
                  <input
                    type="text"
                    value={componentData.rating}
                    onChange={(e) => handleFieldChange('rating', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                    placeholder="e.g., High Performance"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.rating}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Condition Based</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.conditionBased || componentData.conditionBased}
                  currentValue={componentData.conditionBased}
                  fieldName="conditionBased"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('conditionBased', value)}
                >
                  <select
                    value={componentData.conditionBased}
                    onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.conditionBased}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">No of Units</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.noOfUnits || componentData.noOfUnits}
                  currentValue={componentData.noOfUnits}
                  fieldName="noOfUnits"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('noOfUnits', value)}
                >
                  <input
                    type="text"
                    value={componentData.noOfUnits}
                    onChange={(e) => handleFieldChange('noOfUnits', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.noOfUnits}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Eqpt. System / Dept.</label>
              <div className="text-sm text-gray-900">
                {componentData.eqptSystemDept}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Parent Component</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.parentComponent || componentData.parentComponent}
                  currentValue={componentData.parentComponent}
                  fieldName="parentComponent"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('parentComponent', value)}
                >
                  <input
                    type="text"
                    value={componentData.parentComponent}
                    onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                    placeholder="e.g., Level 6.1.1"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.parentComponent}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Dimensions / Size</label>
              {isModifyMode || isChangeMode ? (
                <ModifyFieldWrapper
                  originalValue={originalComponentData?.dimensionsSize || componentData.dimensionsSize}
                  currentValue={componentData.dimensionsSize}
                  fieldName="dimensionsSize"
                  isModifyMode={isModifyMode || isChangeMode}
                  onFieldChange={(field, value) => handleFieldChange('dimensionsSize', value)}
                >
                  <input
                    type="text"
                    value={componentData.dimensionsSize}
                    onChange={(e) => handleFieldChange('dimensionsSize', e.target.value)}
                    className="text-sm w-full px-2 py-1 border rounded"
                    placeholder="e.g., 0.5m x 0.3m"
                  />
                </ModifyFieldWrapper>
              ) : (
                <div className="text-sm text-gray-900">
                  {componentData.dimensionsSize}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Notes</label>
            <div className="text-sm text-gray-900">
              {componentData.notes}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RunningHoursConditionSection: React.FC = () => {
  const { isChangeRequestMode } = useChangeRequest();
  const { isModifyMode } = useModifyMode();
  
  // State for running hours data - empty until populated from database
  const [runningHoursData, setRunningHoursData] = useState({
    currentHours: "",
    updatedDate: "",
    vibration: 0,
    temperature: 0,
    pressure: 0
  });
  
  const [originalData] = useState(runningHoursData);
  
  const handleFieldChange = (field: string, value: any) => {
    setRunningHoursData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <div className="space-y-6">
      {/* Running Hours */}
      <div className="flex items-start gap-8">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Running Hours:</label>
          <Edit2 className="h-4 w-4 text-gray-500" />
        </div>
        <div className="flex gap-12">
          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Current</label>
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
                />
              </ModifyFieldWrapper>
            ) : (
              <div className="text-sm font-semibold text-gray-900">{runningHoursData.currentHours}</div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Updated</label>
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
                />
              </ModifyFieldWrapper>
            ) : (
              <div className="text-sm font-semibold text-gray-900">{runningHoursData.updatedDate}</div>
            )}
          </div>
        </div>
      </div>

      {/* Condition Monitoring Metrics */}
      <div>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Condition Monitoring Metrics:</label>
        </div>
        <div className="grid grid-cols-3 gap-8">
          {/* Vibration */}
          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-2">Vibration</label>
            {isModifyMode ? (
              <ModifyFieldWrapper
                originalValue={originalData.vibration}
                currentValue={runningHoursData.vibration}
                fieldName="vibration"
                isModifyMode={isModifyMode}
                onFieldChange={(field, value) => handleFieldChange('vibration', value)}
              >
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={runningHoursData.vibration}
                    onChange={(e) => handleFieldChange('vibration', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs">{runningHoursData.vibration}%</span>
                </div>
              </ModifyFieldWrapper>
            ) : (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${runningHoursData.vibration}%` }}></div>
              </div>
            )}
          </div>
          
          {/* Temperature */}
          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-2">Temperature</label>
            {isModifyMode ? (
              <ModifyFieldWrapper
                originalValue={originalData.temperature}
                currentValue={runningHoursData.temperature}
                fieldName="temperature"
                isModifyMode={isModifyMode}
                onFieldChange={(field, value) => handleFieldChange('temperature', value)}
              >
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={runningHoursData.temperature}
                    onChange={(e) => handleFieldChange('temperature', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs">{runningHoursData.temperature}%</span>
                </div>
              </ModifyFieldWrapper>
            ) : (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${runningHoursData.temperature}%` }}></div>
              </div>
            )}
          </div>
          
          {/* Pressure */}
          <div>
            <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-2">Pressure</label>
            {isModifyMode ? (
              <ModifyFieldWrapper
                originalValue={originalData.pressure}
                currentValue={runningHoursData.pressure}
                fieldName="pressure"
                isModifyMode={isModifyMode}
                onFieldChange={(field, value) => handleFieldChange('pressure', value)}
              >
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={runningHoursData.pressure}
                    onChange={(e) => handleFieldChange('pressure', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs">{runningHoursData.pressure}%</span>
                </div>
              </ModifyFieldWrapper>
            ) : (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${runningHoursData.pressure}%` }}></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkOrdersSection: React.FC<{ componentCode: string; componentName: string }> = ({ componentCode, componentName }) => {
  const [isWorkOrderFormOpen, setIsWorkOrderFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
  
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
  
  // Empty until populated from database - work orders are linked to components
  const workOrders: any[] = [];

  const handleAddWorkOrder = () => {
    setSelectedWorkOrder(null);
    setIsWorkOrderFormOpen(true);
  };

  const handleRowClick = (workOrder: any) => {
    setSelectedWorkOrder(workOrder);
    setIsWorkOrderFormOpen(true);
  };

  const handleWorkOrderSubmit = (formData: any) => {
    console.log('Work Order submitted:', formData);
    // Handle saving the work order
    setIsWorkOrderFormOpen(false);
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
            Add WO
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">W.O No.</th>
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Job Title</th>
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Assigned to</th>
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Due Date</th>
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Status</th>
              <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Date Completed</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((order, index) => (
              <tr 
                key={index} 
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleRowClick(order)}
              >
                <td className="py-3 px-3 text-gray-900">{order.templateCode}</td>
                <td className="py-3 px-3 text-gray-900">{order.jobTitle}</td>
                <td className="py-3 px-3 text-gray-900">{order.assignedTo}</td>
                <td className="py-3 px-3 text-gray-900">{order.dueDate}</td>
                <td className="py-3 px-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === "Due" 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-gray-900">{order.dateCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Work Order Form Dialog */}
      <WorkOrderForm
        isOpen={isWorkOrderFormOpen}
        onClose={() => setIsWorkOrderFormOpen(false)}
        onSubmit={handleWorkOrderSubmit}
        component={{ code: componentCode, name: componentName }}
        workOrder={selectedWorkOrder}
      />
    </>
  );
};

const MaintenanceHistorySection: React.FC = () => {
  // Empty until populated from database
  const maintenanceHistory: any[] = [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Title</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Work Order No</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Assigned to</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Status</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Date Completed</th>
          </tr>
        </thead>
        <tbody>
          {maintenanceHistory.map((record, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-3 px-3 text-gray-900">{record.title}</td>
              <td className="py-3 px-3 text-gray-900">{record.workOrderNo}</td>
              <td className="py-3 px-3 text-gray-900">{record.assignedTo}</td>
              <td className="py-3 px-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {record.status}
                </span>
              </td>
              <td className="py-3 px-3 text-gray-900">{record.dateCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SparesSection: React.FC = () => {
  const { isModifyMode } = useModifyMode();
  
  // Empty until populated from database
  const [spares, setSpares] = useState<any[]>([]);
  
  const [originalSpares] = useState(JSON.parse(JSON.stringify(spares)));
  
  const handleFieldChange = (index: number, field: string, value: string) => {
    const updatedSpares = [...spares];
    updatedSpares[index] = {
      ...updatedSpares[index],
      [field]: value
    };
    setSpares(updatedSpares);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Part Code</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Part Name</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Critical</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">ROB</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Min</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Stock</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Location</th>
            {FEATURES.IHM && (
              <th className="text-center py-2 px-3 font-medium text-[#8798ad]" title="IHM Status">IHM</th>
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

const DrawingsAndManualsSection: React.FC = () => {
  // Empty until populated from database
  const documents: any[] = [];

  return (
    <div className="grid grid-cols-2 gap-4">
      {documents.map((doc, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-md"
        >
          <doc.icon className="h-5 w-5 text-gray-600" />
          <span className="text-sm text-gray-700">{doc.name}</span>
        </div>
      ))}
    </div>
  );
};

const ClassificationRegulatorySection: React.FC = () => {
  const { isChangeRequestMode } = useChangeRequest();
  const { isModifyMode } = useModifyMode();
  
  // Empty until populated from database
  const [classData, setClassData] = useState({
    classificationSociety: "",
    certificateNo: "",
    lastClassSurvey: "",
    nextClassSurvey: ""
  });
  
  const [originalClassData] = useState(classData);
  
  const handleFieldChange = (field: string, value: string) => {
    setClassData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <div className="space-y-4">
      {/* First row */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Classification Society</label>
          {isModifyMode ? (
            <ModifyFieldWrapper
              originalValue={originalClassData.classificationSociety}
              currentValue={classData.classificationSociety}
              fieldName="classificationSociety"
              isModifyMode={isModifyMode}
              onFieldChange={(field, value) => handleFieldChange('classificationSociety', value)}
            >
              <input
                type="text"
                value={classData.classificationSociety}
                onChange={(e) => handleFieldChange('classificationSociety', e.target.value)}
                className="text-sm w-full px-2 py-1 border rounded"
              />
            </ModifyFieldWrapper>
          ) : (
            <div className="text-sm text-gray-900">{classData.classificationSociety}</div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Certificate No.</label>
          {isModifyMode ? (
            <ModifyFieldWrapper
              originalValue={originalClassData.certificateNo}
              currentValue={classData.certificateNo}
              fieldName="certificateNo"
              isModifyMode={isModifyMode}
              onFieldChange={(field, value) => handleFieldChange('certificateNo', value)}
            >
              <input
                type="text"
                value={classData.certificateNo}
                onChange={(e) => handleFieldChange('certificateNo', e.target.value)}
                className="text-sm w-full px-2 py-1 border rounded"
              />
            </ModifyFieldWrapper>
          ) : (
            <div className="text-sm text-gray-900">{classData.certificateNo}</div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Last Class Survey</label>
          {isModifyMode ? (
            <ModifyFieldWrapper
              originalValue={originalClassData.lastClassSurvey}
              currentValue={classData.lastClassSurvey}
              fieldName="lastClassSurvey"
              isModifyMode={isModifyMode}
              onFieldChange={(field, value) => handleFieldChange('lastClassSurvey', value)}
            >
              <input
                type="text"
                value={classData.lastClassSurvey}
                onChange={(e) => handleFieldChange('lastClassSurvey', e.target.value)}
                className="text-sm w-full px-2 py-1 border rounded"
              />
            </ModifyFieldWrapper>
          ) : (
            <div className="text-sm text-gray-900">{classData.lastClassSurvey}</div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Next Class Survey</label>
          {isModifyMode ? (
            <ModifyFieldWrapper
              originalValue={originalClassData.nextClassSurvey}
              currentValue={classData.nextClassSurvey}
              fieldName="nextClassSurvey"
              isModifyMode={isModifyMode}
              onFieldChange={(field, value) => handleFieldChange('nextClassSurvey', value)}
            >
              <input
                type="text"
                value={classData.nextClassSurvey}
                onChange={(e) => handleFieldChange('nextClassSurvey', e.target.value)}
                className="text-sm w-full px-2 py-1 border rounded"
              />
            </ModifyFieldWrapper>
          ) : (
            <div className="text-sm text-gray-900">{classData.nextClassSurvey}</div>
          )}
        </div>
      </div>

      {/* Second row - empty until populated from database */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Survey Type</label>
          <div className="text-sm text-gray-900"></div>
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Class Requirements</label>
          <div className="text-sm text-gray-900"></div>
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Class Code</label>
          <div className="text-sm text-gray-900"></div>
        </div>
        <div>
          <label className="text-xs font-medium ${isChangeRequestMode ? 'text-white' : 'text-[#8798ad]'} block mb-1">Information</label>
          <div className="text-sm text-gray-900"></div>
        </div>
      </div>
    </div>
  );
};

const RequisitionsSection: React.FC = () => {
  // Empty until populated from database
  const requisitions: any[] = [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Req. ID</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Req. Date</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Title / Description</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Requested Date</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Status</th>
            <th className="text-left py-2 px-3 font-medium text-[#8798ad]">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {requisitions.map((req, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-3 px-3 text-gray-900">{req.reqId}</td>
              <td className="py-3 px-3 text-gray-900">{req.reqDate}</td>
              <td className="py-3 px-3 text-gray-900">{req.titleDescription}</td>
              <td className="py-3 px-3 text-gray-900">{req.requestedDate}</td>
              <td className="py-3 px-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  req.status === "Approved" ? "bg-green-100 text-green-800" :
                  req.status === "Ordered" ? "bg-blue-100 text-blue-800" :
                  req.status === "Open" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {req.status}
                </span>
              </td>
              <td className="py-3 px-3 text-gray-900">{req.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Components: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<ComponentNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));
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
  
  // Fetch components from API and build tree
  const vesselId = "V001"; // Default vessel ID
  const { data: fetchedComponents = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: ['/api/components', vesselId],
  });
  
  // Build component tree from fetched data
  const componentTreeData = React.useMemo(() => {
    // Start with the 8 hardcoded main categories
    const mainCategories: ComponentNode[] = [
      { id: "1", code: "1", name: "Ship General", children: [] },
      { id: "2", code: "2", name: "Hull", children: [] },
      { id: "3", code: "3", name: "Equipment for Cargo", children: [] },
      { id: "4", code: "4", name: "Ship's Equipment", children: [] },
      { id: "5", code: "5", name: "Equipment for Crew & Passengers", children: [] },
      { id: "6", code: "6", name: "Machinery Main Components", children: [] },
      { id: "7", code: "7", name: "Systems for Machinery Main Components", children: [] },
      { id: "8", code: "8", name: "Ship Common Systems", children: [] }
    ];
    
    if (!fetchedComponents || fetchedComponents.length === 0) {
      return mainCategories;
    }
    
    // Build a map for quick lookup
    const componentMap = new Map<string, ComponentNode>();
    
    // First, add all main categories to the map
    mainCategories.forEach(cat => {
      componentMap.set(cat.code, cat);
    });
    
    // Convert fetched components to ComponentNode format and add to map
    fetchedComponents.forEach((comp: any) => {
      const node: ComponentNode = {
        id: comp.componentCode || comp.id,
        code: comp.componentCode || comp.id,
        name: comp.name,
        children: []
      };
      componentMap.set(node.code, node);
    });
    
    // Build parent-child relationships
    fetchedComponents.forEach((comp: any) => {
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

  const formSections = [
    { id: "A", title: "Component Information" },
    { id: "B", title: "Running Hours & Condition Monitoring" },
    { id: "C", title: "Work Orders" },
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
            <Select defaultValue="all">
              <SelectTrigger className={`w-[150px] ${isChangeRequestMode ? 'border-white bg-white/10 text-white' : ''}`}>
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                <SelectItem value="vessel1">Vessel 1</SelectItem>
                <SelectItem value="vessel2">Vessel 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isChangeRequestMode ? 'text-white' : 'text-gray-600'}`}>Critical Item:</span>
            <Select defaultValue="all">
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
              placeholder="Search Components..."
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
                {renderComponentTree(componentTreeData)}
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
                            <RunningHoursConditionSection />
                          ) : section.id === "C" ? (
                            <WorkOrdersSection 
                              componentCode={selectedComponent?.code || ""} 
                              componentName={selectedComponent?.name || ""} 
                            />
                          ) : section.id === "D" ? (
                            <MaintenanceHistorySection />
                          ) : section.id === "E" ? (
                            <SparesSection />
                          ) : section.id === "F" ? (
                            <DrawingsAndManualsSection />
                          ) : section.id === "G" ? (
                            <ClassificationRegulatorySection />
                          ) : section.id === "H" ? (
                            <RequisitionsSection />
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
            // Normal mode - just close the form
            toast({
              title: "Success",
              description: "Component saved successfully"
            });
            setIsComponentFormOpen(false);
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