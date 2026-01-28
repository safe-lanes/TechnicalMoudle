import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Save, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LabelConfig {
  key: string;
  label: string;
}

const INITIAL_CATEGORY_LABELS: LabelConfig[] = [
  { key: "A", label: "Class" },
  { key: "B", label: "Flag" },
  { key: "C", label: "P&I" },
  { key: "D", label: "" },
  { key: "E", label: "" },
  { key: "F", label: "" },
];

const INITIAL_GROUP_LABELS: LabelConfig[] = [
  { key: "1", label: "Annual" },
  { key: "2", label: "Intermediate" },
  { key: "3", label: "Special" },
  { key: "4", label: "Periodical" },
  { key: "5", label: "" },
  { key: "6", label: "" },
  { key: "7", label: "" },
  { key: "8", label: "" },
  { key: "9", label: "" },
  { key: "10", label: "" },
];

const COMPANY_GROUP_LABELS: LabelConfig[] = [
  { key: "A", label: "Statutory" },
  { key: "B", label: "Commercial" },
  { key: "C", label: "Others" },
  { key: "D", label: "" },
  { key: "E", label: "" },
  { key: "F", label: "" },
  { key: "G", label: "" },
  { key: "H", label: "" },
  { key: "I", label: "" },
];

type MasterLabelTab = "category" | "group";
type TabType = "master" | "company" | "vessel";
type ViewMode = "view" | "edit";

const CATEGORY_OPTIONS = ["A", "B", "C", "D", "E", "F"];
const GROUP_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const COMPANY_GROUP_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

interface MasterSurvey {
  id: number;
  sequence: number;
  masterId: string;
  surveyName: string;
  category: string;
  group: string;
  requirementRef: string;
  applicableToCompany: boolean;
  surveyLabel: string;
  companyId?: string;
  companyGroup?: string;
  companySequence?: number;
}

export default function ShipsSurveysAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>("master");
  const [viewModes, setViewModes] = useState<Record<TabType, ViewMode>>({
    master: "view",
    company: "view",
    vessel: "view"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedGroup, setSelectedGroup] = useState("All Groups");
  
  const [masterData, setMasterData] = useState<MasterSurvey[]>([]);
  const [deletedMasterIds, setDeletedMasterIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasSavedInSession, setHasSavedInSession] = useState<Record<string, boolean>>({
    master: false,
    company: false,
    vessel: false,
  });
  
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [labelsDialogTab, setLabelsDialogTab] = useState<MasterLabelTab>("category");
  const [editingCategoryLabels, setEditingCategoryLabels] = useState<LabelConfig[]>(INITIAL_CATEGORY_LABELS);
  const [editingGroupLabels, setEditingGroupLabels] = useState<LabelConfig[]>(INITIAL_GROUP_LABELS);
  const [categoryLabels, setCategoryLabels] = useState<LabelConfig[]>(INITIAL_CATEGORY_LABELS);
  const [groupLabels, setGroupLabels] = useState<LabelConfig[]>(INITIAL_GROUP_LABELS);

  const currentViewMode = viewModes[activeTab];
  const isEditMode = currentViewMode === "edit";

  const { data: savedSurveys, isLoading: isLoadingSurveys } = useQuery({
    queryKey: ['/technical/api/admin/ship-surveys-master'],
  });
  
  const { data: savedLabels } = useQuery<Record<string, Array<{key: string, label: string}>>>({
    queryKey: ['/technical/api/admin/ship-surveys-labels'],
  });

  useEffect(() => {
    if (savedSurveys && Array.isArray(savedSurveys) && savedSurveys.length > 0) {
      const mappedSurveys = savedSurveys.map((s: any) => ({
        id: s.id,
        sequence: s.sequence,
        masterId: s.masterId || s.master_id,
        surveyName: s.surveyName || s.survey_name,
        category: s.category,
        group: s.group,
        requirementRef: s.requirementRef || s.requirement_ref || "",
        applicableToCompany: s.applicableToCompany || s.applicable_to_company || false,
        surveyLabel: s.surveyLabel || s.survey_label || "",
        companyId: s.companyId || s.company_id || "",
        companyGroup: s.companyGroup || s.company_group || "",
        companySequence: s.companySequence || s.company_sequence || undefined,
      }));
      setMasterData(mappedSurveys);
      setHasUnsavedChanges(false);
    }
  }, [savedSurveys]);
  
  useEffect(() => {
    if (savedLabels) {
      if (savedLabels.category) {
        const merged = INITIAL_CATEGORY_LABELS.map(def => {
          const saved = savedLabels.category.find(s => s.key === def.key);
          return saved ? { key: def.key, label: saved.label } : def;
        });
        setCategoryLabels(merged);
        setEditingCategoryLabels(merged);
      }
      if (savedLabels.group) {
        const merged = INITIAL_GROUP_LABELS.map(def => {
          const saved = savedLabels.group.find(s => s.key === def.key);
          return saved ? { key: def.key, label: saved.label } : def;
        });
        setGroupLabels(merged);
        setEditingGroupLabels(merged);
      }
    }
  }, [savedLabels]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { surveys: MasterSurvey[] }) => {
      const response = await apiRequest('POST', '/technical/api/admin/ship-surveys-master', payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Saved successfully",
        description: `${data.inserted || 0} new surveys added, ${data.updated || 0} updated`,
      });
      setHasUnsavedChanges(false);
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: true }));
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-surveys-master'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save surveys",
        variant: "destructive",
      });
    },
  });
  
  const saveLabelsMutation = useMutation({
    mutationFn: async ({ configType, labels }: { configType: string, labels: LabelConfig[] }) => {
      const response = await apiRequest('POST', '/technical/api/admin/ship-surveys-labels', { configType, labels });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-surveys-labels'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save labels",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    // First, delete any surveys that were removed
    let deleteErrors = 0;
    for (const masterId of deletedMasterIds) {
      try {
        await apiRequest('DELETE', `/technical/api/admin/ship-surveys-master/${masterId}`);
      } catch (err) {
        console.error(`Failed to delete survey ${masterId}:`, err);
        deleteErrors++;
      }
    }
    
    if (deleteErrors > 0) {
      toast({
        title: "Some deletions failed",
        description: `${deleteErrors} survey(s) could not be deleted. Please try again.`,
        variant: "destructive",
      });
      return;
    }
    
    setDeletedMasterIds([]);
    
    // Then save the remaining surveys
    saveMutation.mutate({ surveys: masterData });
  };
  
  const filtersActive = searchTerm !== "" || selectedCategory !== "All Categories" || selectedGroup !== "All Groups";

  const toggleViewMode = () => {
    setViewModes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] === "view" ? "edit" : "view"
    }));
  };

  const exitEditMode = () => {
    if (hasUnsavedChanges) {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-surveys-master'] });
      setDeletedMasterIds([]);
    }
    setViewModes(prev => ({ ...prev, [activeTab]: "view" }));
    setHasUnsavedChanges(false);
  };

  const addNewRow = () => {
    const nextSeq = masterData.length > 0 ? Math.max(...masterData.map(s => s.sequence)) + 1 : 1;
    const nextId = masterData.length > 0 ? Math.max(...masterData.map(s => s.id)) + 1 : 1;
    const newMasterId = `A1-${String(nextSeq).padStart(3, '0')}`;
    
    const newSurvey: MasterSurvey = {
      id: nextId,
      sequence: nextSeq,
      masterId: newMasterId,
      surveyName: "",
      category: "A",
      group: "1",
      requirementRef: "",
      applicableToCompany: false,
      surveyLabel: "",
    };
    
    setMasterData(prev => [...prev, newSurvey]);
    setHasUnsavedChanges(true);
  };

  const recomputeMasterIds = (surveys: MasterSurvey[]): MasterSurvey[] => {
    return surveys.map((s, idx) => ({
      ...s,
      sequence: idx + 1,
      masterId: `${s.category}${s.group}-${String(idx + 1).padStart(3, '0')}`
    }));
  };

  const deleteRow = (id: number) => {
    const surveyToDelete = masterData.find(s => s.id === id);
    if (surveyToDelete && surveyToDelete.masterId) {
      setDeletedMasterIds(prev => [...prev, surveyToDelete.masterId]);
    }
    setMasterData(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return recomputeMasterIds(filtered);
    });
    setHasUnsavedChanges(true);
  };

  const updateField = (id: number, field: keyof MasterSurvey, value: any) => {
    setMasterData(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: value };
        if (field === "category" || field === "group") {
          const cat = field === "category" ? value : s.category;
          const grp = field === "group" ? value : s.group;
          updated.masterId = `${cat}${grp}-${String(s.sequence).padStart(3, '0')}`;
        }
        return updated;
      }
      return s;
    }));
    setHasUnsavedChanges(true);
  };

  const moveRowUp = (id: number) => {
    setMasterData(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx <= 0) return prev;
      const newData = [...prev];
      [newData[idx - 1], newData[idx]] = [newData[idx], newData[idx - 1]];
      return recomputeMasterIds(newData);
    });
    setHasUnsavedChanges(true);
  };

  const moveRowDown = (id: number) => {
    setMasterData(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const newData = [...prev];
      [newData[idx], newData[idx + 1]] = [newData[idx + 1], newData[idx]];
      return recomputeMasterIds(newData);
    });
    setHasUnsavedChanges(true);
  };

  const getCategoryLabel = (key: string) => {
    const found = categoryLabels.find(c => c.key === key);
    return found?.label ? `${key}. ${found.label}` : key;
  };

  const getGroupLabel = (key: string) => {
    const found = groupLabels.find(g => g.key === key);
    return found?.label ? `${key}. ${found.label}` : key;
  };

  const openLabelsDialog = () => {
    setEditingCategoryLabels([...categoryLabels]);
    setEditingGroupLabels([...groupLabels]);
    setLabelsDialogOpen(true);
  };

  const saveLabelsAndClose = () => {
    setCategoryLabels([...editingCategoryLabels]);
    setGroupLabels([...editingGroupLabels]);
    saveLabelsMutation.mutate({ configType: "category", labels: editingCategoryLabels });
    saveLabelsMutation.mutate({ configType: "group", labels: editingGroupLabels });
    setLabelsDialogOpen(false);
    toast({ title: "Labels saved", description: "Category and group labels have been updated." });
  };

  const filteredData = masterData.filter(survey => {
    const matchesSearch = searchTerm === "" || 
      survey.surveyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.masterId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All Categories" || survey.category === selectedCategory;
    const matchesGroup = selectedGroup === "All Groups" || survey.group === selectedGroup;
    return matchesSearch && matchesCategory && matchesGroup;
  });

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between relative">
          <h1 className="text-2xl font-semibold text-gray-800" data-testid="text-page-title">
            Ship Surveys Admin
          </h1>
        
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="absolute left-1/2 -translate-x-1/2">
            <TabsList className="bg-gray-100">
              <TabsTrigger 
                value="master" 
                className={cn(
                  "px-6",
                  activeTab === "master" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-master"
              >
                Master
              </TabsTrigger>
              <TabsTrigger 
                value="company"
                className={cn(
                  "px-6",
                  activeTab === "company" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-company"
              >
                Company
              </TabsTrigger>
              <TabsTrigger 
                value="vessel"
                className={cn(
                  "px-6",
                  activeTab === "vessel" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-vessel"
              >
                Vessel
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            {currentViewMode === "view" ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleViewMode}
                data-testid="button-edit-mode"
              >
                Edit
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exitEditMode}
                  data-testid="button-cancel"
                >
                  {hasSavedInSession[activeTab] ? "Exit" : "Cancel"}
                </Button>
                {activeTab === "master" && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={openLabelsDialog}
                      data-testid="button-configure-labels"
                    >
                      Configure Labels
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                      data-testid="button-save"
                    >
                      {saveMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-1" /> Save</>
                      )}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "master" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search surveys..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Categories">All Categories</SelectItem>
                    {CATEGORY_OPTIONS.map(cat => (
                      <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-[180px]" data-testid="select-group">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Groups">All Groups</SelectItem>
                    {GROUP_OPTIONS.map(grp => (
                      <SelectItem key={grp} value={grp}>{getGroupLabel(grp)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              {isEditMode && (
                <Button 
                  size="sm" 
                  onClick={addNewRow}
                  className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  data-testid="button-add-row"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Survey
                </Button>
              )}
            </div>
            
            <div className="flex-1 overflow-auto bg-white rounded-lg border">
              {isLoadingSurveys ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p className="text-lg mb-2">No surveys configured</p>
                  <p className="text-sm">Click "Edit" and then "Add Survey" to add your first survey</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-[#52baf3] text-white text-sm sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium w-16">Seq</th>
                      <th className="px-4 py-3 text-left font-medium w-28">Master ID</th>
                      <th className="px-4 py-3 text-left font-medium">Survey Name</th>
                      <th className="px-4 py-3 text-left font-medium w-32">Category</th>
                      <th className="px-4 py-3 text-left font-medium w-32">Group</th>
                      <th className="px-4 py-3 text-left font-medium">Requirement Ref</th>
                      <th className="px-4 py-3 text-center font-medium w-24">Apply to Co.</th>
                      {isEditMode && <th className="px-4 py-3 text-center font-medium w-32">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredData.map((survey, idx) => (
                      <tr key={survey.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{survey.sequence}</td>
                        <td className="px-4 py-2 font-mono text-xs">{survey.masterId}</td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Input 
                              value={survey.surveyName} 
                              onChange={(e) => updateField(survey.id, "surveyName", e.target.value)}
                              className="h-8"
                              data-testid={`input-survey-name-${survey.id}`}
                            />
                          ) : (
                            survey.surveyName
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Select value={survey.category} onValueChange={(v) => updateField(survey.id, "category", v)}>
                              <SelectTrigger className="h-8" data-testid={`select-category-${survey.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            getCategoryLabel(survey.category)
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Select value={survey.group} onValueChange={(v) => updateField(survey.id, "group", v)}>
                              <SelectTrigger className="h-8" data-testid={`select-group-${survey.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GROUP_OPTIONS.map(grp => (
                                  <SelectItem key={grp} value={grp}>{grp}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            getGroupLabel(survey.group)
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Input 
                              value={survey.requirementRef} 
                              onChange={(e) => updateField(survey.id, "requirementRef", e.target.value)}
                              className="h-8"
                              data-testid={`input-req-ref-${survey.id}`}
                            />
                          ) : (
                            survey.requirementRef
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {isEditMode ? (
                            <Checkbox 
                              checked={survey.applicableToCompany}
                              onCheckedChange={(checked) => updateField(survey.id, "applicableToCompany", !!checked)}
                              data-testid={`checkbox-apply-company-${survey.id}`}
                            />
                          ) : (
                            survey.applicableToCompany ? "Yes" : "No"
                          )}
                        </td>
                        {isEditMode && (
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => moveRowUp(survey.id)}
                                disabled={filtersActive || masterData.findIndex(s => s.id === survey.id) === 0}
                                title={filtersActive ? "Clear filters to reorder" : undefined}
                                data-testid={`button-move-up-${survey.id}`}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => moveRowDown(survey.id)}
                                disabled={filtersActive || masterData.findIndex(s => s.id === survey.id) === masterData.length - 1}
                                title={filtersActive ? "Clear filters to reorder" : undefined}
                                data-testid={`button-move-down-${survey.id}`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => deleteRow(survey.id)}
                                data-testid={`button-delete-${survey.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-500">Company surveys configuration - filters and actions will appear here</p>
            </div>
            <div className="flex-1 overflow-auto bg-white rounded-lg border">
              <div className="flex items-center justify-center h-full text-gray-400 p-4">
                Company surveys table will be displayed here
              </div>
            </div>
          </div>
        )}

        {activeTab === "vessel" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-500">Vessel surveys configuration - vessel selector and filters will appear here</p>
            </div>
            <div className="flex-1 overflow-auto bg-white rounded-lg border">
              <div className="flex items-center justify-center h-full text-gray-400 p-4">
                Vessel surveys table will be displayed here
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Labels</DialogTitle>
          </DialogHeader>
          <Tabs value={labelsDialogTab} onValueChange={(v) => setLabelsDialogTab(v as MasterLabelTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="category">Category</TabsTrigger>
              <TabsTrigger value="group">Group</TabsTrigger>
            </TabsList>
            <div className="mt-4 space-y-2 max-h-[300px] overflow-auto">
              {labelsDialogTab === "category" && editingCategoryLabels.map((item, idx) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-8 font-medium text-gray-600">{item.key}.</span>
                  <Input 
                    value={item.label} 
                    onChange={(e) => {
                      const updated = [...editingCategoryLabels];
                      updated[idx] = { ...item, label: e.target.value };
                      setEditingCategoryLabels(updated);
                    }}
                    placeholder="Enter label..."
                    className="flex-1"
                    data-testid={`input-category-label-${item.key}`}
                  />
                </div>
              ))}
              {labelsDialogTab === "group" && editingGroupLabels.map((item, idx) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-8 font-medium text-gray-600">{item.key}.</span>
                  <Input 
                    value={item.label} 
                    onChange={(e) => {
                      const updated = [...editingGroupLabels];
                      updated[idx] = { ...item, label: e.target.value };
                      setEditingGroupLabels(updated);
                    }}
                    placeholder="Enter label..."
                    className="flex-1"
                    data-testid={`input-group-label-${item.key}`}
                  />
                </div>
              ))}
            </div>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLabelsAndClose} className="bg-[#5dc86f] hover:bg-[#4db85f] text-white">
              Save Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
