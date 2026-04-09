import { useState, useEffect, useMemo } from "react";
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
import { Plus, Pencil, Trash2, Search, Save, X, Loader2, Check, ChevronsUpDown, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useVessels } from "@/hooks/useVessels";

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
  isNew?: boolean;
}

interface VesselSurvey {
  id: number;
  masterId: string;
  companyId: string;
  surveyLabel: string;
  requirementRef: string;
  companyGroup: string;
  applicable: boolean;
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
  const [draftMasterData, setDraftMasterData] = useState<MasterSurvey[] | null>(null);
  const [masterSnapshot, setMasterSnapshot] = useState<MasterSurvey[] | null>(null);
  const [deletedMasterIds, setDeletedMasterIds] = useState<string[]>([]);
  const [deletedDraftIds, setDeletedDraftIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [masterValidationError, setMasterValidationError] = useState("");
  const [invalidSurveyIds, setInvalidSurveyIds] = useState<Set<number>>(new Set());
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
  
  const [companyGroupLabels, setCompanyGroupLabels] = useState<LabelConfig[]>(COMPANY_GROUP_LABELS);
  const [editingCompanyGroupLabels, setEditingCompanyGroupLabels] = useState<LabelConfig[]>(COMPANY_GROUP_LABELS);
  const [companyOnlySurveys, setCompanyOnlySurveys] = useState<MasterSurvey[]>([]);
  const [newCompanySurvey, setNewCompanySurvey] = useState<Partial<MasterSurvey>>({});
  const [isAddingNewCompany, setIsAddingNewCompany] = useState(false);
  const [newCompanyEntryError, setNewCompanyEntryError] = useState("");
  const [companyGroupDialogOpen, setCompanyGroupDialogOpen] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  
  // Vessel tab state
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [vesselPopoverOpen, setVesselPopoverOpen] = useState(false);
  const [vesselOnlySurveys, setVesselOnlySurveys] = useState<VesselSurvey[]>([]);
  const [isAddingNewVessel, setIsAddingNewVessel] = useState(false);
  const [newVesselSurvey, setNewVesselSurvey] = useState<Partial<VesselSurvey>>({});
  const [initializedVesselIds, setInitializedVesselIds] = useState<Set<string>>(new Set());
  
  // Vessel data from hook
  const { data: vesselMasterData, isLoading: isLoadingVessels } = useVessels();
  const vesselOptions = vesselMasterData?.map((v: any) => v.name) || [];

  const currentViewMode = viewModes[activeTab];
  const isEditMode = currentViewMode === "edit";

  const { data: savedSurveys, isLoading: isLoadingSurveys } = useQuery({
    queryKey: ['/technical/api/admin/ship-surveys-master'],
  });
  
  const { data: savedLabels } = useQuery<Record<string, Array<{key: string, label: string}>>>({
    queryKey: ['/technical/api/admin/ship-surveys-labels'],
  });
  
  // Query vessel survey applicability for selected vessels
  const selectedVesselIds = selectedVessels.map(name => {
    const vessel = vesselMasterData?.find((v: any) => v.name === name);
    return vessel?.id || name;
  }).join(',');
  
  const { data: vesselApplicabilityData, isLoading: isLoadingApplicability } = useQuery({
    queryKey: ['/technical/api/admin/vessel-survey-applicability', selectedVesselIds],
    queryFn: async () => {
      if (!selectedVesselIds) return [];
      const res = await fetch(`/technical/api/admin/vessel-survey-applicability?vesselIds=${selectedVesselIds}`);
      return res.json();
    },
    enabled: selectedVessels.length > 0,
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

      const masterOnly: typeof mappedSurveys = [];
      const companyOnly: typeof mappedSurveys = [];
      const vesselOnly: typeof mappedSurveys = [];

      for (const s of mappedSurveys) {
        const mid = s.masterId || '';
        if (s.category === 'Company' || mid.startsWith('CMP-')) {
          companyOnly.push(s);
        } else if (s.category === 'Vessel' || mid.startsWith('VES-')) {
          vesselOnly.push(s);
        } else {
          masterOnly.push(s);
        }
      }

      setCompanyOnlySurveys(companyOnly.map(s => ({
        ...s,
        surveyLabel: s.surveyLabel || s.surveyName,
      })));
      setVesselOnlySurveys(vesselOnly.map(s => ({
        ...s,
        surveyLabel: s.surveyLabel || s.surveyName,
      })));

      const companyItems = masterOnly.filter((s: any) => s.applicableToCompany);
      const effectiveSeqs = companyItems.map((s: any) => s.companySequence ?? s.sequence);
      const hasMissing = companyItems.some((s: any) => s.companySequence === undefined);
      const hasDuplicates = new Set(effectiveSeqs).size !== effectiveSeqs.length;

      if (hasMissing || hasDuplicates) {
        const sortedCompanyIds = [...companyItems]
          .sort((a: any, b: any) => (a.companySequence ?? a.sequence) - (b.companySequence ?? b.sequence))
          .map((s: any) => s.id);
        const companySeqMap = new Map<number, number>();
        sortedCompanyIds.forEach((id: number, idx: number) => {
          companySeqMap.set(id, idx + 1);
        });

        const normalized = masterOnly.map((s: any) => {
          if (s.applicableToCompany && companySeqMap.has(s.id)) {
            return { ...s, companySequence: companySeqMap.get(s.id) };
          }
          return s;
        });
        setMasterData(normalized);
      } else {
        setMasterData(masterOnly);
      }
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
      if (savedLabels.company_group) {
        const merged = COMPANY_GROUP_LABELS.map(def => {
          const saved = savedLabels.company_group.find(s => s.key === def.key);
          return saved ? { key: def.key, label: saved.label } : def;
        });
        setCompanyGroupLabels(merged);
        setEditingCompanyGroupLabels(merged);
      }
    }
  }, [savedLabels]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { 
      surveys: MasterSurvey[]; 
      vesselSpecificSurveys?: string[];
      targetVessels?: { id: string; name: string }[];
    }) => {
      const response = await apiRequest('POST', '/technical/api/admin/ship-surveys-master', payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Saved successfully",
        description: `${data.inserted || 0} new surveys added, ${data.updated || 0} updated`,
      });
      if (activeTab === "master") {
        setDraftMasterData(null);
        setMasterSnapshot(null);
        setDeletedDraftIds([]);
      }
      setHasUnsavedChanges(false);
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: true }));
      setMasterData([]);
      setCompanyOnlySurveys([]);
      setVesselOnlySurveys([]);
      setDeletedMasterIds([]);
      setMasterValidationError("");
      setInvalidSurveyIds(new Set());
      setViewModes(prev => ({ ...prev, [activeTab]: "view" }));
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-surveys-master'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-survey-applicability', selectedVesselIds] });
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
    if (activeTab === "master" && !draftMasterData) return;
    const dataToSave = activeTab === "master" ? draftMasterData! : masterData;
    const idsToDelete = activeTab === "master" ? deletedDraftIds : deletedMasterIds;
    
    const invalidSurveys = dataToSave.filter(s => 
      !s.surveyName?.trim() || !s.category?.trim() || !s.group?.trim()
    );
    
    if (invalidSurveys.length > 0) {
      setInvalidSurveyIds(new Set(invalidSurveys.map(s => s.id)));
      setMasterValidationError("Survey Name, Category, Group are Mandatory");
      return;
    }
    
    setMasterValidationError("");
    setInvalidSurveyIds(new Set());
    
    let deleteErrors = 0;
    for (const masterId of idsToDelete) {
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
    
    if (activeTab === "master") {
      setDeletedDraftIds([]);
    } else {
      setDeletedMasterIds([]);
    }
    
    let maxCmpSeq = 0;
    let maxVesSeq = 0;
    const allSurveysForSeqScan = [...dataToSave, ...companyOnlySurveys, ...vesselOnlySurveys];
    for (const survey of allSurveysForSeqScan) {
      const cmpMatch = survey.masterId.match(/^CMP-(\d+)$/);
      if (cmpMatch) {
        const seq = parseInt(cmpMatch[1], 10);
        if (seq > maxCmpSeq) maxCmpSeq = seq;
      }
      const vesMatch = survey.masterId.match(/^VES-(\d+)$/);
      if (vesMatch) {
        const seq = parseInt(vesMatch[1], 10);
        if (seq > maxVesSeq) maxVesSeq = seq;
      }
    }
    
    // Convert company-only surveys to master format with generated IDs
    let nextCmpSeq = maxCmpSeq + 1;
    const companyOnlySurveysWithIds: MasterSurvey[] = companyOnlySurveys.map((survey, idx) => {
      const newMasterId = survey.masterId.startsWith('CMP-') 
        ? survey.masterId 
        : `CMP-${String(nextCmpSeq++).padStart(3, '0')}`;
      
      return {
        ...survey,
        masterId: newMasterId,
        sequence: dataToSave.length + idx + 1,
        category: 'Company',
        group: survey.companyGroup || 'Company Specific',
        surveyName: survey.surveyLabel,
        applicableToCompany: true,
        companyId: survey.companyId || newMasterId.replace('CMP-', 'CV'),
        companySequence: dataToSave.length + idx + 1,
      };
    });
    
    let nextVesSeq = maxVesSeq + 1;
    const baseSequence = dataToSave.length + companyOnlySurveysWithIds.length;
    const vesselOnlySurveysWithIds: MasterSurvey[] = vesselOnlySurveys.map((survey, idx) => {
      const newMasterId = survey.masterId.startsWith('VES-') 
        ? survey.masterId 
        : `VES-${String(nextVesSeq++).padStart(3, '0')}`;
      
      return {
        id: survey.id,
        sequence: baseSequence + idx + 1,
        masterId: newMasterId,
        surveyName: survey.surveyLabel,
        category: 'Vessel',
        group: survey.companyGroup || 'Vessel Specific',
        requirementRef: survey.requirementRef || '',
        applicableToCompany: false,
        surveyLabel: survey.surveyLabel,
        companyId: survey.companyId || newMasterId.replace('VES-', 'VV'),
        companyGroup: survey.companyGroup || '',
        companySequence: baseSequence + idx + 1,
      };
    });
    
    const includeCompany = activeTab === "company";
    const includeVessel = activeTab === "vessel";

    const sortedDataToSave = [...dataToSave].sort((a, b) => a.sequence - b.sequence);
    sortedDataToSave.forEach((s, i) => { s.sequence = i + 1; });

    const companyFromMaster = sortedDataToSave.filter(s => s.applicableToCompany);
    const allCompanyItems = [
      ...companyFromMaster.map(s => ({ id: s.id, seq: s.companySequence ?? s.sequence, source: 'master' as const })),
      ...companyOnlySurveysWithIds.map(s => ({ id: s.id, seq: s.companySequence ?? s.sequence, source: 'company' as const })),
    ].sort((a, b) => a.seq - b.seq);
    allCompanyItems.forEach((item, i) => {
      const newSeq = i + 1;
      if (item.source === 'master') {
        const survey = sortedDataToSave.find(s => s.id === item.id);
        if (survey) survey.companySequence = newSeq;
      } else {
        const survey = companyOnlySurveysWithIds.find(s => s.id === item.id);
        if (survey) { survey.companySequence = newSeq; survey.sequence = newSeq; }
      }
    });

    const allSurveys = [
      ...sortedDataToSave,
      ...(includeCompany ? companyOnlySurveysWithIds : []),
      ...(includeVessel ? vesselOnlySurveysWithIds : []),
    ];
    
    const vesselMasterIds = includeVessel ? vesselOnlySurveysWithIds.map(s => s.masterId) : [];

    let targetVessels: { id: string; name: string }[] = [];
    if (vesselMasterIds.length > 0) {
      targetVessels = (vesselMasterData || [])
        .filter((v: any) => selectedVessels.includes(v.name))
        .map((v: any) => ({ id: String(v.id), name: v.name }));

      if (targetVessels.length === 0) {
        toast({
          title: "Please select a vessel first",
          description: "Vessel-specific surveys require at least one vessel to be selected on the Vessel tab.",
          variant: "destructive",
        });
        return;
      }
    }
    
    saveMutation.mutate({ 
      surveys: allSurveys,
      vesselSpecificSurveys: vesselMasterIds,
      targetVessels: targetVessels,
    });
  };

  const toggleViewMode = () => {
    const enteringEdit = viewModes[activeTab] === "view";
    if (enteringEdit && activeTab === "master") {
      setMasterSnapshot(masterData.map(s => ({ ...s })));
      const draft = masterData.map(s => ({ ...s }));
      const masterOnly = draft
        .filter(s => !(s.masterId ?? '').startsWith('VES-') && !(s.masterId ?? '').startsWith('CMP-'))
        .sort((a, b) => a.sequence - b.sequence);
      masterOnly.forEach((s, idx) => { s.sequence = idx + 1; });
      draft.sort((a, b) => a.sequence - b.sequence);
      setDraftMasterData(draft);
      setDeletedDraftIds([]);
      setHasUnsavedChanges(false);
      setMasterValidationError("");
      setInvalidSurveyIds(new Set());
    }
    setViewModes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] === "view" ? "edit" : "view"
    }));
  };

  const exitEditMode = () => {
    setMasterValidationError("");
    setInvalidSurveyIds(new Set());
    
    if (activeTab === "master") {
      if (masterSnapshot) {
        setMasterData(masterSnapshot);
      }
      setDraftMasterData(null);
      setMasterSnapshot(null);
      setDeletedDraftIds([]);
    }
    
    queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-surveys-master'] });
    setDeletedMasterIds([]);
    
    setViewModes(prev => ({ ...prev, [activeTab]: "view" }));
    setHasUnsavedChanges(false);
  };

  const addNewRow = () => {
    if (!draftMasterData) return;
    const currentData = draftMasterData;
    const nextSeq = currentData.length > 0 ? Math.max(...currentData.map(s => s.sequence)) + 1 : 1;
    const nextId = currentData.length > 0 ? Math.max(...currentData.map(s => s.id)) + 1 : 1;
    const newMasterId = `NEW-${String(nextSeq).padStart(3, '0')}`;
    
    const newSurvey: MasterSurvey = {
      id: nextId,
      sequence: nextSeq,
      masterId: newMasterId,
      surveyName: "",
      category: "",
      group: "",
      requirementRef: "",
      applicableToCompany: false,
      surveyLabel: "",
      isNew: true,
    };
    
    setDraftMasterData(prev => prev ? [...prev, newSurvey] : [newSurvey]);
    setHasUnsavedChanges(true);
  };

  const recomputeMasterIds = (surveys: MasterSurvey[]): MasterSurvey[] => {
    return surveys.map((s, idx) => ({
      ...s,
      sequence: idx + 1,
      masterId: s.isNew || (s.masterId ?? '').startsWith('NEW-')
        ? (s.category && s.group
            ? `${s.category}${s.group}-${String(idx + 1).padStart(3, '0')}`
            : `NEW-${String(idx + 1).padStart(3, '0')}`)
        : s.masterId
    }));
  };

  const deleteRow = (id: number) => {
    if (!draftMasterData) return;
    const surveyToDelete = draftMasterData.find(s => s.id === id);
    if (surveyToDelete && surveyToDelete.masterId) {
      setDeletedDraftIds(prev => [...prev, surveyToDelete.masterId]);
    }
    setDraftMasterData(prev => {
      if (!prev) return prev;
      const filtered = prev.filter(s => s.id !== id);
      return recomputeMasterIds(filtered);
    });
    setHasUnsavedChanges(true);
  };

  const updateField = (id: number, field: keyof MasterSurvey, value: any) => {
    setDraftMasterData(prev => {
      if (!prev) return prev;
      const updatedData = prev.map(s => {
        if (s.id === id) {
          const updated = { ...s, [field]: value };
          if (field === "category" || field === "group") {
            if (s.isNew || (s.masterId ?? '').startsWith('NEW-')) {
              const cat = field === "category" ? value : s.category;
              const grp = field === "group" ? value : s.group;
              updated.masterId = cat && grp
                ? `${cat}${grp}-${String(s.sequence).padStart(3, '0')}`
                : `NEW-${String(s.sequence).padStart(3, '0')}`;
            }
          }
          return updated;
        }
        return s;
      });
      
      if (field === "surveyName" || field === "category" || field === "group") {
        const invalidSurveys = updatedData.filter(s => 
          !s.surveyName?.trim() || !s.category?.trim() || !s.group?.trim()
        );
        if (invalidSurveys.length === 0) {
          setMasterValidationError("");
          setInvalidSurveyIds(new Set());
        } else {
          setInvalidSurveyIds(new Set(invalidSurveys.map(s => s.id)));
        }
      }
      
      return updatedData;
    });
    setHasUnsavedChanges(true);
  };

  const updateSequence = (surveyId: number, rawSequence: number) => {
    setDraftMasterData(prevData => {
      if (!prevData) return prevData;
      const currentSurvey = prevData.find(s => s.id === surveyId);
      if (!currentSurvey) return prevData;
      
      const newSequence = Math.max(1, Math.min(rawSequence, prevData.length));
      const oldSequence = currentSurvey.sequence;
      if (newSequence === oldSequence) return prevData;
      
      return prevData.map(s => {
        if (s.id === surveyId) {
          return { ...s, sequence: newSequence };
        }
        
        if (newSequence < oldSequence) {
          if (s.sequence >= newSequence && s.sequence < oldSequence) {
            return { ...s, sequence: s.sequence + 1 };
          }
        }
        else {
          if (s.sequence > oldSequence && s.sequence <= newSequence) {
            return { ...s, sequence: s.sequence - 1 };
          }
        }
        
        return s;
      });
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

  const getFormattedCompanyGroupLabel = (key: string) => {
    const found = companyGroupLabels.find(g => g.key === key);
    return found?.label ? `${key}. ${found.label}` : key;
  };

  const updateCompanyField = (surveyId: number, field: 'companyId' | 'companyGroup' | 'companySequence' | 'requirementRef', value: string | number) => {
    setMasterData(prev => prev.map(s => 
      s.id === surveyId 
        ? { ...s, [field]: value }
        : s
    ));
    setHasUnsavedChanges(true);
  };

  const updateCompanySequence = (surveyId: number, rawSequence: number) => {
    const companySurveys = masterData.filter(s => s.applicableToCompany);
    const totalCompanyCount = companySurveys.length + companyOnlySurveys.length;
    const currentSurvey = companySurveys.find(s => s.id === surveyId);
    if (!currentSurvey) return;

    const newSequence = Math.max(1, Math.min(rawSequence, totalCompanyCount));
    const oldSequence = currentSurvey.companySequence ?? currentSurvey.sequence;
    if (newSequence === oldSequence) return;

    const companyIds = new Set(companySurveys.map(s => s.id));

    setMasterData(prevData => prevData.map(s => {
      if (!companyIds.has(s.id)) return s;

      const surveyOldSeq = s.companySequence ?? s.sequence;

      if (s.id === surveyId) {
        return { ...s, companySequence: newSequence };
      }

      if (newSequence < oldSequence) {
        if (surveyOldSeq >= newSequence && surveyOldSeq < oldSequence) {
          return { ...s, companySequence: surveyOldSeq + 1 };
        }
      }
      else {
        if (surveyOldSeq > oldSequence && surveyOldSeq <= newSequence) {
          return { ...s, companySequence: surveyOldSeq - 1 };
        }
      }

      if (s.companySequence === undefined) {
        return { ...s, companySequence: surveyOldSeq };
      }

      return s;
    }));

    setCompanyOnlySurveys(prev => prev.map(s => {
      const surveyOldSeq = s.sequence ?? 999999;
      if (newSequence < oldSequence) {
        if (surveyOldSeq >= newSequence && surveyOldSeq < oldSequence) {
          return { ...s, sequence: surveyOldSeq + 1 };
        }
      } else {
        if (surveyOldSeq > oldSequence && surveyOldSeq <= newSequence) {
          return { ...s, sequence: surveyOldSeq - 1 };
        }
      }
      return s;
    }));

    setHasUnsavedChanges(true);
  };

  const updateCompanyOnlySequence = (surveyId: number, rawSequence: number) => {
    const masterCompanySurveys = masterData.filter(s => s.applicableToCompany);
    const totalCompanyCount = masterCompanySurveys.length + companyOnlySurveys.length;
    const currentSurvey = companyOnlySurveys.find(s => s.id === surveyId);
    if (!currentSurvey) return;

    const newSequence = Math.max(1, Math.min(rawSequence, totalCompanyCount));
    const oldSequence = currentSurvey.sequence ?? 999999;
    if (newSequence === oldSequence) return;

    const masterCompanyIds = new Set(masterCompanySurveys.map(s => s.id));

    setMasterData(prevData => prevData.map(s => {
      if (!masterCompanyIds.has(s.id)) return s;
      const surveyOldSeq = s.companySequence ?? s.sequence;
      if (newSequence < oldSequence) {
        if (surveyOldSeq >= newSequence && surveyOldSeq < oldSequence) {
          return { ...s, companySequence: surveyOldSeq + 1 };
        }
      } else {
        if (surveyOldSeq > oldSequence && surveyOldSeq <= newSequence) {
          return { ...s, companySequence: surveyOldSeq - 1 };
        }
      }
      if (s.companySequence === undefined) {
        return { ...s, companySequence: surveyOldSeq };
      }
      return s;
    }));

    setCompanyOnlySurveys(prev => prev.map(s => {
      const surveyOldSeq = s.sequence ?? 999999;
      if (s.id === surveyId) {
        return { ...s, sequence: newSequence };
      }
      if (newSequence < oldSequence) {
        if (surveyOldSeq >= newSequence && surveyOldSeq < oldSequence) {
          return { ...s, sequence: surveyOldSeq + 1 };
        }
      } else {
        if (surveyOldSeq > oldSequence && surveyOldSeq <= newSequence) {
          return { ...s, sequence: surveyOldSeq - 1 };
        }
      }
      return s;
    }));

    setHasUnsavedChanges(true);
  };

  const handleAddNewCompanySurvey = () => {
    setNewCompanySurvey({
      companyId: "",
      surveyLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setNewCompanyEntryError("");
    setIsAddingNewCompany(true);
  };

  const saveNewCompanySurvey = () => {
    if (!newCompanySurvey.surveyLabel?.trim()) {
      setNewCompanyEntryError("Survey Label is mandatory");
      return;
    }
    
    const existingCmpIds = companyOnlySurveys
      .filter(s => s.masterId?.startsWith("CMP-"))
      .map(s => {
        const num = parseInt(s.masterId?.replace("CMP-", "") || "0", 10);
        return isNaN(num) ? 0 : num;
      });
    const nextCmpNum = existingCmpIds.length > 0 ? Math.max(...existingCmpIds) + 1 : 1;
    const newMasterId = `CMP-${String(nextCmpNum).padStart(3, '0')}`;
    
    const newId = Math.max(...companyOnlySurveys.map(s => s.id), ...masterData.map(s => s.id), 0) + 1000;
    
    const masterCompanyCount = masterData.filter(s => s.applicableToCompany).length;
    const allCompanySeqs = [
      ...masterData.filter(s => s.applicableToCompany).map(s => s.companySequence ?? s.sequence),
      ...companyOnlySurveys.filter(s => s.sequence !== undefined && s.sequence > 0).map(s => s.sequence),
    ];
    const nextSeq = allCompanySeqs.length > 0 ? Math.max(...allCompanySeqs) + 1 : masterCompanyCount + companyOnlySurveys.length + 1;

    const newSurvey: MasterSurvey = {
      id: newId,
      sequence: nextSeq,
      masterId: newMasterId,
      surveyName: newCompanySurvey.surveyLabel?.trim() || "",
      category: "",
      group: "",
      requirementRef: newCompanySurvey.requirementRef || "",
      applicableToCompany: true,
      surveyLabel: newCompanySurvey.surveyLabel?.trim() || "",
      companyId: newCompanySurvey.companyId || newMasterId,
      companyGroup: newCompanySurvey.companyGroup || "",
      companySequence: nextSeq,
    };
    
    setCompanyOnlySurveys(prev => [...prev, newSurvey]);
    setIsAddingNewCompany(false);
    setNewCompanyEntryError("");
    setHasUnsavedChanges(true);
  };

  const cancelNewCompanySurvey = () => {
    setIsAddingNewCompany(false);
    setNewCompanySurvey({});
    setNewCompanyEntryError("");
  };

  const openCompanyGroupDialog = () => {
    setEditingCompanyGroupLabels([...companyGroupLabels]);
    setCompanyGroupDialogOpen(true);
  };

  const saveCompanyGroupLabelsAndClose = () => {
    setCompanyGroupLabels([...editingCompanyGroupLabels]);
    saveLabelsMutation.mutate({ configType: "company_group", labels: editingCompanyGroupLabels });
    setCompanyGroupDialogOpen(false);
    toast({ title: "Labels saved", description: "Company group labels have been updated." });
  };

  // ============================================================
  // Vessel Tab Functions
  // ============================================================
  
  const toggleVesselSelection = (vessel: string) => {
    setSelectedVessels(prev => 
      prev.includes(vessel) 
        ? prev.filter(v => v !== vessel)
        : [...prev, vessel]
    );
  };

  const toggleAllVessels = () => {
    if (selectedVessels.length === vesselOptions.length) {
      setSelectedVessels([]);
    } else {
      setSelectedVessels([...vesselOptions]);
    }
  };

  const hasSavedMasterData = savedSurveys && Array.isArray(savedSurveys) && savedSurveys.length > 0;

  const companyApplicableMasterIds = useMemo(() => {
    const fromMaster = masterData
      .filter(survey => survey.applicableToCompany && !survey.masterId.startsWith('VES-'))
      .map(survey => survey.masterId);
    const fromCompanyOnly = companyOnlySurveys
      .filter(survey => survey.masterId.startsWith('CMP-'))
      .map(survey => survey.masterId);
    return [...fromMaster, ...fromCompanyOnly];
  }, [masterData, companyOnlySurveys]);

  useEffect(() => {
    if (!hasSavedMasterData) return;
    if (selectedVessels.length > 0 && vesselMasterData && vesselMasterData.length > 0 && !isLoadingApplicability) {
      const vesselsToInit: Array<{ vesselId: string; vesselName: string }> = [];

      selectedVessels.forEach(vesselName => {
        const vesselData = vesselMasterData.find((v: any) => v.name === vesselName);
        if (vesselData) {
          const vesselId = String(vesselData.id);
          if (initializedVesselIds.has(vesselId)) return;

          const vesselRecords = (vesselApplicabilityData || []).filter((a: any) => a.vesselId === vesselId);
          const hasNoRecords = vesselRecords.length === 0;
          const existingMasterIds = new Set(vesselRecords.map((a: any) => a.masterId));
          const hasMissingSurveys = companyApplicableMasterIds.some(id => !existingMasterIds.has(id));

          if (hasNoRecords || hasMissingSurveys) {
            vesselsToInit.push({ vesselId, vesselName });
          }
        }
      });

      if (vesselsToInit.length > 0) {
        vesselsToInit.forEach(async (vessel) => {
          try {
            await apiRequest('POST', '/technical/api/admin/vessel-survey-applicability/initialize', {
              vesselId: vessel.vesselId,
              vesselName: vessel.vesselName,
            });
            setInitializedVesselIds(prev => new Set(Array.from(prev).concat(vessel.vesselId)));
            queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-survey-applicability', selectedVesselIds] });
          } catch (err) {
            console.error('Failed to initialize vessel survey applicability:', err);
          }
        });
      }
    }
  }, [selectedVessels, vesselMasterData, vesselApplicabilityData, isLoadingApplicability, hasSavedMasterData, companyApplicableMasterIds]);

  // Detect applicability conflicts across selected vessels
  const hasApplicabilityConflict = (): { hasConflict: boolean; conflictingMasterIds: string[] } => {
    if (selectedVessels.length <= 1) return { hasConflict: false, conflictingMasterIds: [] };
    if (!vesselApplicabilityData || !Array.isArray(vesselApplicabilityData)) return { hasConflict: false, conflictingMasterIds: [] };
    
    // Group applicability data by masterId
    const applicabilityByMasterId: Record<string, boolean[]> = {};
    for (const record of vesselApplicabilityData) {
      if (!applicabilityByMasterId[record.masterId]) {
        applicabilityByMasterId[record.masterId] = [];
      }
      applicabilityByMasterId[record.masterId].push(record.isApplicable);
    }
    
    // Find masterIds where applicability values differ
    const conflictingMasterIds = Object.entries(applicabilityByMasterId)
      .filter(([_, values]) => values.length > 1 && new Set(values).size > 1)
      .map(([masterId]) => masterId);
    
    return { 
      hasConflict: conflictingMasterIds.length > 0, 
      conflictingMasterIds 
    };
  };

  const conflictCheck = hasApplicabilityConflict();

  // Get applicability for a survey
  const getSurveyApplicability = (masterId: string): boolean | 'mixed' => {
    if (!vesselApplicabilityData || !Array.isArray(vesselApplicabilityData)) return false;
    
    const relevantRecords = vesselApplicabilityData.filter((r: any) => r.masterId === masterId);
    if (relevantRecords.length === 0) return false;
    
    const applicableValues = relevantRecords.map((r: any) => r.isApplicable);
    const uniqueValues = new Set(applicableValues);
    
    if (uniqueValues.size > 1) return 'mixed';
    return applicableValues[0];
  };

  // Handle applicability change
  const handleApplicabilityChange = async (masterId: string, isApplicable: boolean) => {
    if (!vesselMasterData) return;
    
    const vessels = selectedVessels.map(name => {
      const vessel = vesselMasterData.find((v: any) => v.name === name);
      return vessel ? { id: vessel.id, name: vessel.name } : null;
    }).filter(Boolean);

    try {
      await apiRequest('POST', '/technical/api/admin/vessel-survey-applicability/bulk-update', {
        vessels,
        masterId,
        isApplicable,
      });
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-survey-applicability', selectedVesselIds] });
    } catch (err) {
      console.error('Failed to update applicability:', err);
      toast({
        title: "Update failed",
        description: "Failed to update survey applicability",
        variant: "destructive",
      });
    }
  };

  // Get selected vessel IDs as array for filtering
  const getSelectedVesselIdsArray = () => {
    return (vesselMasterData || [])
      .filter((v: any) => selectedVessels.includes(v.name))
      .map((v: any) => String(v.id));
  };

  const companySurveys = [...masterData, ...companyOnlySurveys].filter(survey => {
    if (!survey.applicableToCompany) return false;
    
    if (survey.masterId.startsWith('VES-')) {
      const vesselIds = getSelectedVesselIdsArray();
      if (vesselIds.length === 0) return false;
      
      return vesselIds.some(vesselId => 
        vesselApplicabilityData?.some((a: any) => a.vesselId === vesselId && a.masterId === survey.masterId)
      );
    }
    
    return true;
  });

  // Handle adding new vessel-only survey
  const handleAddNewVesselSurvey = () => {
    setNewVesselSurvey({
      surveyLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setIsAddingNewVessel(true);
  };

  const cancelAddNewVessel = () => {
    setIsAddingNewVessel(false);
    setNewVesselSurvey({});
  };

  const saveNewVesselSurvey = async () => {
    if (!newVesselSurvey.surveyLabel) {
      toast({
        title: "Survey Label required",
        description: "Please enter a survey label",
        variant: "destructive",
      });
      return;
    }

    // Generate VES-xxx ID
    const existingVesIds = vesselOnlySurveys
      .filter(s => s.masterId.startsWith('VES-'))
      .map(s => parseInt(s.masterId.replace('VES-', '')) || 0);
    const maxVesNum = existingVesIds.length > 0 ? Math.max(...existingVesIds) : 0;
    const newMasterId = `VES-${String(maxVesNum + 1).padStart(3, '0')}`;

    const newId = Math.max(...vesselOnlySurveys.map(s => s.id), 0) + 2000;
    
    const newSurvey: VesselSurvey = {
      id: newId,
      masterId: newMasterId,
      companyId: "",
      surveyLabel: newVesselSurvey.surveyLabel || "",
      requirementRef: newVesselSurvey.requirementRef || "",
      companyGroup: newVesselSurvey.companyGroup || "",
      applicable: true,
    };

    setVesselOnlySurveys(prev => [...prev, newSurvey]);
    setIsAddingNewVessel(false);
    setNewVesselSurvey({});
    setHasUnsavedChanges(true);
  };

  const activeMasterData = (isEditMode && activeTab === "master" && draftMasterData) ? draftMasterData : masterData;
  const sortedMasterData = [...activeMasterData].sort((a, b) => a.sequence - b.sequence);

  const filteredData = sortedMasterData.filter(survey => {
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
        
          <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as TabType);
                  }} className="absolute left-1/2 -translate-x-1/2">
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
                      className="bg-[#16569e] hover:bg-[#124a87] text-white"
                      data-testid="button-save"
                    >
                      {saveMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-1" /> Save</>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={addNewRow}
                      className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                      data-testid="button-add-row"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Survey
                    </Button>
                  </>
                )}
                {activeTab === "company" && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={openCompanyGroupDialog}
                      data-testid="button-configure-company-labels"
                    >
                      Configure Labels
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="bg-[#16569e] hover:bg-[#124a87] text-white"
                      data-testid="button-save-company"
                    >
                      {saveMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-1" /> Save</>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleAddNewCompanySurvey}
                      className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                      data-testid="button-add-company-survey"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Survey
                    </Button>
                  </>
                )}
                {activeTab === "vessel" && (
                  <>
                    <Button 
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="bg-[#16569e] hover:bg-[#124a87] text-white"
                      data-testid="button-save-vessel"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                    {selectedVessels.length > 0 && (
                      <Button 
                        size="sm" 
                        onClick={handleAddNewVesselSurvey}
                        className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                        data-testid="button-add-vessel-survey"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Survey
                      </Button>
                    )}
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
                      {isEditMode && <th className="px-3 py-3 text-center font-medium w-20">Sequence</th>}
                      <th className="px-4 py-3 text-left font-medium w-12">#</th>
                      <th className="px-4 py-3 text-left font-medium w-28">Master ID</th>
                      <th className="px-4 py-3 text-left font-medium">Survey Name</th>
                      <th className="px-4 py-3 text-left font-medium w-32">Category</th>
                      <th className="px-4 py-3 text-left font-medium w-32">Group</th>
                      <th className="px-4 py-3 text-left font-medium">Requirement Ref</th>
                      <th className="px-4 py-3 text-center font-medium w-24">Apply to Co.</th>
                      {isEditMode && <th className="px-4 py-3 text-center font-medium w-20">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredData.map((survey, idx) => (
                      <tr key={survey.id} className="hover:bg-gray-50">
                        {isEditMode && (
                          <td className="px-3 py-2 text-center">
                            <Input
                              key={`seq-${survey.id}-${survey.sequence}`}
                              type="number"
                              defaultValue={survey.sequence}
                              className="h-8 text-sm w-16 text-center"
                              min={1}
                              onBlur={(e) => {
                                const newSeq = parseInt(e.target.value, 10);
                                if (!isNaN(newSeq) && newSeq > 0) {
                                  updateSequence(survey.id, newSeq);
                                }
                              }}
                              data-testid={`input-sequence-${survey.id}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-mono text-xs">{survey.masterId}</td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Input 
                              value={survey.surveyName} 
                              onChange={(e) => updateField(survey.id, "surveyName", e.target.value)}
                              className={`h-8 ${invalidSurveyIds.has(survey.id) && !survey.surveyName?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                              data-testid={`input-survey-name-${survey.id}`}
                            />
                          ) : (
                            survey.surveyName
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditMode ? (
                            <Select value={survey.category || undefined} onValueChange={(v) => updateField(survey.id, "category", v)}>
                              <SelectTrigger className={`h-8 ${invalidSurveyIds.has(survey.id) && !survey.category?.trim() ? 'border-red-500 focus:border-red-500' : ''}`} data-testid={`select-category-${survey.id}`}>
                                <SelectValue placeholder="Select…" />
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
                            <Select value={survey.group || undefined} onValueChange={(v) => updateField(survey.id, "group", v)}>
                              <SelectTrigger className={`h-8 ${invalidSurveyIds.has(survey.id) && !survey.group?.trim() ? 'border-red-500 focus:border-red-500' : ''}`} data-testid={`select-group-${survey.id}`}>
                                <SelectValue placeholder="Select…" />
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
                          <td className="px-4 py-2 text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => deleteRow(survey.id)}
                              data-testid={`button-delete-${survey.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Show error message if validation fails */}
                    {isEditMode && masterValidationError && (
                      <tr>
                        <td colSpan={10} className="px-3 py-2 text-sm text-red-600 bg-red-50">
                          {masterValidationError}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search surveys..."
                  value={companySearchTerm}
                  onChange={(e) => setCompanySearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-company"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-white rounded-lg border">
              {(() => {
                const companyDataFromMaster = masterData
                  .filter((s) => s.applicableToCompany)
                  .map((s) => ({
                    id: s.id,
                    masterId: s.masterId,
                    surveyLabel: s.surveyLabel || s.surveyName,
                    companyId: s.companyId || ("C" + s.masterId),
                    requirementRef: s.requirementRef,
                    companyGroup: s.companyGroup || "",
                    sequence: s.companySequence ?? s.sequence,
                    isCompanyOnly: false as const,
                  }));

                const companyOnlyMapped = companyOnlySurveys.map((s) => ({
                    id: s.id,
                    masterId: s.masterId,
                    surveyLabel: s.surveyLabel || s.surveyName,
                    companyId: s.companyId || "",
                    requirementRef: s.requirementRef,
                    companyGroup: s.companyGroup || "",
                    sequence: s.sequence,
                    isCompanyOnly: true as const,
                  }));

                const mergedCompanyData = [...companyDataFromMaster, ...companyOnlyMapped]
                  .sort((a, b) => a.sequence - b.sequence);

                const filteredData = mergedCompanyData.filter(s => {
                  const matchesSearch = companySearchTerm === "" || 
                    s.surveyLabel.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
                    s.masterId.toLowerCase().includes(companySearchTerm.toLowerCase());
                  return matchesSearch;
                });

                return (
                  <table className="w-full">
                    <thead className="bg-[#52baf3] text-white text-sm sticky top-0">
                      <tr>
                        {viewModes.company === "edit" && <th className="px-3 py-3 text-center font-medium w-20">Sequence</th>}
                        <th className="px-3 py-3 text-left font-medium w-12">#</th>
                        <th className="px-3 py-3 text-left font-medium">Master ID</th>
                        <th className="px-3 py-3 text-left font-medium">Company ID</th>
                        <th className="px-3 py-3 text-left font-medium">Survey Label</th>
                        <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                        <th className="px-3 py-3 text-left font-medium">Company Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredData.map((survey, idx) => (
                        <tr key={survey.isCompanyOnly ? `company-only-${survey.id}` : survey.id} className={`hover:bg-gray-50 ${survey.isCompanyOnly ? 'bg-green-50' : ''}`}>
                          {viewModes.company === "edit" && (
                            <td className="px-3 py-2 text-center">
                              <Input
                                key={`seq-company-${survey.id}-${survey.sequence}-${survey.isCompanyOnly}`}
                                type="number"
                                defaultValue={survey.sequence}
                                className="h-8 text-sm w-16 text-center"
                                min={1}
                                onBlur={(e) => {
                                  const newSeq = parseInt(e.target.value, 10);
                                  if (!isNaN(newSeq) && newSeq > 0) {
                                    if (survey.isCompanyOnly) {
                                      updateCompanyOnlySequence(survey.id, newSeq);
                                    } else {
                                      updateCompanySequence(survey.id, newSeq);
                                    }
                                  }
                                }}
                                data-testid={`input-sequence-company-${survey.id}`}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className={`px-3 py-2 font-medium ${survey.isCompanyOnly ? 'text-gray-400' : 'text-blue-600'}`}>{survey.masterId || "-"}</td>
                          <td className="px-3 py-2">
                            {viewModes.company === "edit" ? (
                              <Input 
                                defaultValue={survey.companyId}
                                className="h-8 text-sm"
                                onBlur={(e) => {
                                  if (survey.isCompanyOnly) {
                                    setCompanyOnlySurveys(prev => prev.map(s => 
                                      s.id === survey.id ? { ...s, companyId: e.target.value } : s
                                    ));
                                  } else {
                                    updateCompanyField(survey.id, 'companyId', e.target.value);
                                  }
                                }}
                                data-testid={`input-companyid-${survey.id}`}
                              />
                            ) : (
                              survey.companyId || "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {viewModes.company === "edit" && survey.isCompanyOnly ? (
                              <Input 
                                defaultValue={survey.surveyLabel}
                                className="h-8 text-sm"
                                onBlur={(e) => {
                                  setCompanyOnlySurveys(prev => prev.map(s => 
                                    s.id === survey.id ? { ...s, surveyLabel: e.target.value } : s
                                  ));
                                }}
                                data-testid={`input-label-${survey.id}`}
                              />
                            ) : (
                              survey.surveyLabel
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {viewModes.company === "edit" ? (
                              <Input 
                                defaultValue={survey.requirementRef}
                                className="h-8 text-sm"
                                onBlur={(e) => {
                                  if (survey.isCompanyOnly) {
                                    setCompanyOnlySurveys(prev => prev.map(s => 
                                      s.id === survey.id ? { ...s, requirementRef: e.target.value } : s
                                    ));
                                  } else {
                                    updateCompanyField(survey.id, 'requirementRef', e.target.value);
                                  }
                                }}
                                data-testid={`input-requirement-company-${survey.id}`}
                              />
                            ) : (
                              survey.requirementRef
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {viewModes.company === "edit" ? (
                              <Select 
                                defaultValue={survey.companyGroup}
                                onValueChange={(value) => {
                                  if (survey.isCompanyOnly) {
                                    setCompanyOnlySurveys(prev => prev.map(s => 
                                      s.id === survey.id ? { ...s, companyGroup: value } : s
                                    ));
                                  } else {
                                    updateCompanyField(survey.id, 'companyGroup', value);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`select-companygroup-${survey.id}`}>
                                  <SelectValue placeholder="Select Group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {companyGroupLabels.map((grp) => (
                                    <SelectItem key={grp.key} value={grp.key}>
                                      {getFormattedCompanyGroupLabel(grp.key)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              survey.companyGroup ? getFormattedCompanyGroupLabel(survey.companyGroup) : "-"
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      {viewModes.company === "edit" && isAddingNewCompany && (
                        <tr className="bg-blue-50">
                          <td className="px-3 py-2 text-center text-gray-400">-</td>
                          <td className="px-3 py-2">New</td>
                          <td className="px-3 py-2 font-medium text-gray-400">(Auto)</td>
                          <td className="px-3 py-2">
                            <Input 
                              value={newCompanySurvey.companyId || ""}
                              onChange={(e) => setNewCompanySurvey(prev => ({ ...prev, companyId: e.target.value }))}
                              className="h-8 text-sm"
                              placeholder="Company ID"
                              data-testid="input-new-company-id"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              value={newCompanySurvey.surveyLabel || ""}
                              onChange={(e) => setNewCompanySurvey(prev => ({ ...prev, surveyLabel: e.target.value }))}
                              className="h-8 text-sm"
                              placeholder="Survey Label *"
                              data-testid="input-new-company-label"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              value={newCompanySurvey.requirementRef || ""}
                              onChange={(e) => setNewCompanySurvey(prev => ({ ...prev, requirementRef: e.target.value }))}
                              className="h-8 text-sm"
                              placeholder="Requirement/Ref"
                              data-testid="input-new-company-requirement"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Select 
                                value={newCompanySurvey.companyGroup || ""}
                                onValueChange={(value) => setNewCompanySurvey(prev => ({ ...prev, companyGroup: value }))}
                              >
                                <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-new-company-group">
                                  <SelectValue placeholder="Select Group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {companyGroupLabels.map((grp) => (
                                    <SelectItem key={grp.key} value={grp.key}>
                                      {getFormattedCompanyGroupLabel(grp.key)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" onClick={saveNewCompanySurvey} className="text-green-600" data-testid="button-save-new-company">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={cancelNewCompanySurvey} className="text-red-600" data-testid="button-cancel-new-company">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {viewModes.company === "edit" && isAddingNewCompany && newCompanyEntryError && (
                        <tr>
                          <td colSpan={7} className="px-3 py-2 text-sm text-red-500">{newCompanyEntryError}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === "vessel" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Popover open={vesselPopoverOpen} onOpenChange={setVesselPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vesselPopoverOpen}
                    className="w-[220px] justify-between"
                    data-testid="select-vessel"
                  >
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4" />
                      <span className="truncate">
                        {selectedVessels.length === 0 
                          ? "Select vessels..." 
                          : selectedVessels.length === vesselOptions.length && vesselOptions.length > 0 
                            ? "All Vessels" 
                            : selectedVessels.length === 1 
                              ? selectedVessels[0] 
                              : `${selectedVessels.length} vessels selected`}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search vessels..." />
                    <CommandList>
                      <CommandEmpty>No vessels found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all-vessels"
                          onSelect={() => toggleAllVessels()}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedVessels.length === vesselOptions.length && vesselOptions.length > 0
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}>
                            {selectedVessels.length === vesselOptions.length && vesselOptions.length > 0 && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <span className="font-medium">All Vessels</span>
                        </CommandItem>
                        {isLoadingVessels ? (
                          <CommandItem disabled>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading vessels...
                          </CommandItem>
                        ) : (
                          vesselOptions.map((vessel: string) => (
                            <CommandItem
                              key={vessel}
                              value={vessel}
                              onSelect={() => toggleVesselSelection(vessel)}
                              className="cursor-pointer"
                            >
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedVessels.includes(vessel)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50"
                              )}>
                                {selectedVessels.includes(vessel) && <Check className="h-3 w-3" />}
                              </div>
                              <Ship className="mr-2 h-4 w-4 text-muted-foreground" />
                              {vessel}
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedVessels.length > 0 && conflictCheck.hasConflict && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 text-sm font-medium">
                    Conflict detected: Selected vessels have different applicability settings for {conflictCheck.conflictingMasterIds.length} survey(s).
                  </span>
                  <span className="text-amber-600 text-sm">
                    Please select vessels with matching configurations or select one vessel at a time to edit.
                  </span>
                </div>
              </div>
            )}

            {selectedVessels.length > 0 && !conflictCheck.hasConflict && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-blue-800">
                      {selectedVessels.length === 1 ? `Configuring: ${selectedVessels[0]}` : `Configuring ${selectedVessels.length} vessels`}
                    </span>
                    {selectedVessels.length > 1 && selectedVessels.slice(0, 3).map((vessel) => (
                      <div key={vessel} className="flex items-center gap-1">
                        <Checkbox id={`vessel-edit-${vessel}`} defaultChecked disabled />
                        <label htmlFor={`vessel-edit-${vessel}`} className="text-sm">{vessel}</label>
                      </div>
                    ))}
                    {selectedVessels.length > 3 && (
                      <span className="text-sm text-blue-600">+{selectedVessels.length - 3} more</span>
                    )}
                  </div>
                  {selectedVessels.length > 1 && (
                    <span className="text-sm text-blue-600">Changes apply to all selected vessels</span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border overflow-hidden flex-1">
              <div className="overflow-x-auto h-full">
                <table className="w-full">
                  <thead className="bg-[#52baf3] text-white text-sm sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-center font-medium w-12">Applicable</th>
                      <th className="px-3 py-3 text-left font-medium w-12">#</th>
                      <th className="px-3 py-3 text-left font-medium">Master ID</th>
                      <th className="px-3 py-3 text-left font-medium">Company ID</th>
                      <th className="px-3 py-3 text-left font-medium">Survey Label</th>
                      <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                      <th className="px-3 py-3 text-left font-medium">Company Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedVessels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Ship className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">Select at least one vessel to view survey configuration</p>
                          </div>
                        </td>
                      </tr>
                    ) : isLoadingApplicability ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-muted-foreground">Loading survey configuration...</p>
                          </div>
                        </td>
                      </tr>
                    ) : companySurveys.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Ship className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No surveys are marked as applicable to Company. Configure the Company tab first.</p>
                          </div>
                        </td>
                      </tr>
                    ) : companySurveys.map((survey, idx) => {
                      const applicability = getSurveyApplicability(survey.masterId);
                      const isMixed = applicability === 'mixed';
                      const isChecked = applicability === true;
                      const companyGroupLabel = companyGroupLabels.find(g => g.key === survey.companyGroup)?.label || "";
                      const displayCompanyGroup = survey.companyGroup ? `${survey.companyGroup}. ${companyGroupLabel}` : "";
                      
                      return (
                        <tr key={survey.id} className={cn("hover:bg-gray-50", isMixed && "bg-amber-50")}>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox 
                                checked={isMixed ? false : isChecked}
                                onCheckedChange={(checked) => {
                                  if (!conflictCheck.hasConflict && viewModes.vessel === "edit") {
                                    handleApplicabilityChange(survey.masterId, !!checked);
                                  }
                                }}
                                disabled={conflictCheck.hasConflict || viewModes.vessel !== "edit"}
                                className={cn(
                                  "border-blue-500 data-[state=checked]:bg-blue-500",
                                  isMixed && "border-amber-500 bg-amber-100"
                                )}
                                data-testid={`checkbox-vessel-applicable-${survey.id}`}
                              />
                              {isMixed && (
                                <span className="text-xs text-amber-600">Mixed</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm">{idx + 1}</td>
                          <td className="px-3 py-3 text-sm font-medium text-blue-600">{survey.masterId}</td>
                          <td className="px-3 py-3 text-sm">{survey.companyId || "-"}</td>
                          <td className="px-3 py-3 text-sm">{survey.surveyLabel || survey.surveyName}</td>
                          <td className="px-3 py-3 text-sm">{survey.requirementRef}</td>
                          <td className="px-3 py-3 text-sm">{displayCompanyGroup}</td>
                        </tr>
                      );
                    })}
                    
                    {/* Vessel-only surveys (VES-) — filtered by vessel applicability */}
                    {selectedVessels.length > 0 && vesselOnlySurveys.filter(survey => {
                      if (survey.id >= 2000) return true;
                      const vesselIds = getSelectedVesselIdsArray();
                      return vesselIds.some(vesselId =>
                        vesselApplicabilityData?.some((a: any) => a.vesselId === vesselId && a.masterId === survey.masterId && a.isApplicable === true)
                      );
                    }).map((survey, idx) => {
                      const companyGroupLabel = companyGroupLabels.find(g => g.key === survey.companyGroup)?.label || "";
                      const displayCompanyGroup = survey.companyGroup ? `${survey.companyGroup}. ${companyGroupLabel}` : "";
                      
                      return (
                        <tr key={`vessel-only-${survey.id}`} className="hover:bg-gray-50 bg-green-50">
                          <td className="px-3 py-3 text-center">
                            <Checkbox 
                              checked={survey.applicable}
                              onCheckedChange={(checked) => {
                                if (viewModes.vessel === "edit") {
                                  setVesselOnlySurveys(prev => prev.map(s => 
                                    s.id === survey.id ? { ...s, applicable: !!checked } : s
                                  ));
                                }
                              }}
                              disabled={viewModes.vessel !== "edit"}
                              className="border-blue-500 data-[state=checked]:bg-blue-500"
                              data-testid={`checkbox-vessel-only-applicable-${survey.id}`}
                            />
                          </td>
                          <td className="px-3 py-3 text-sm">{companySurveys.length + idx + 1}</td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-400">{survey.masterId}</td>
                          <td className="px-3 py-3 text-sm text-gray-400">-</td>
                          <td className="px-3 py-3 text-sm">
                            {viewModes.vessel === "edit" ? (
                              <Input 
                                defaultValue={survey.surveyLabel}
                                className="h-8 text-sm"
                                onBlur={(e) => {
                                  setVesselOnlySurveys(prev => prev.map(s => 
                                    s.id === survey.id ? { ...s, surveyLabel: e.target.value } : s
                                  ));
                                }}
                                data-testid={`input-vessel-label-only-${survey.id}`}
                              />
                            ) : (
                              survey.surveyLabel
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {viewModes.vessel === "edit" ? (
                              <Input 
                                defaultValue={survey.requirementRef}
                                className="h-8 text-sm"
                                onBlur={(e) => {
                                  setVesselOnlySurveys(prev => prev.map(s => 
                                    s.id === survey.id ? { ...s, requirementRef: e.target.value } : s
                                  ));
                                }}
                                data-testid={`input-vessel-requirement-only-${survey.id}`}
                              />
                            ) : (
                              survey.requirementRef
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {viewModes.vessel === "edit" ? (
                              <Select 
                                defaultValue={survey.companyGroup}
                                onValueChange={(value) => {
                                  setVesselOnlySurveys(prev => prev.map(s => 
                                    s.id === survey.id ? { ...s, companyGroup: value } : s
                                  ));
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`select-vessel-companygroup-only-${survey.id}`}>
                                  <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {companyGroupLabels.map(grp => (
                                    <SelectItem key={grp.key} value={grp.key}>
                                      {grp.key}. {grp.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              displayCompanyGroup
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* New vessel survey entry row */}
                    {viewModes.vessel === "edit" && isAddingNewVessel && selectedVessels.length > 0 && (
                      <tr className="bg-blue-50">
                        <td className="px-3 py-3 text-center">
                          <Checkbox checked disabled className="border-blue-500 bg-blue-500" />
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-400">New</td>
                        <td className="px-3 py-3 text-sm text-gray-400">VES-xxx</td>
                        <td className="px-3 py-3 text-sm text-gray-400">-</td>
                        <td className="px-3 py-3">
                          <Input 
                            value={newVesselSurvey.surveyLabel || ""}
                            onChange={(e) => setNewVesselSurvey(prev => ({ ...prev, surveyLabel: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="Survey Label"
                            data-testid="input-new-vessel-label"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input 
                            value={newVesselSurvey.requirementRef || ""}
                            onChange={(e) => setNewVesselSurvey(prev => ({ ...prev, requirementRef: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="Requirement/Ref"
                            data-testid="input-new-vessel-requirement"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Select 
                              value={newVesselSurvey.companyGroup || ""}
                              onValueChange={(value) => setNewVesselSurvey(prev => ({ ...prev, companyGroup: value }))}
                            >
                              <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-new-vessel-companygroup">
                                <SelectValue placeholder="Select group" />
                              </SelectTrigger>
                              <SelectContent>
                                {companyGroupLabels.map(grp => (
                                  <SelectItem key={grp.key} value={grp.key}>
                                    {grp.key}. {grp.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              size="sm" 
                              onClick={saveNewVesselSurvey}
                              className="bg-green-600 hover:bg-green-700 h-8 px-2"
                              data-testid="button-confirm-new-vessel"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={cancelAddNewVessel}
                              className="h-8 px-2"
                              data-testid="button-cancel-new-vessel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

      <Dialog open={companyGroupDialogOpen} onOpenChange={setCompanyGroupDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Company Group Labels</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-[300px] overflow-auto">
            {editingCompanyGroupLabels.map((item, idx) => (
              <div key={item.key} className="flex items-center gap-3">
                <span className="w-8 font-medium text-gray-600">{item.key}.</span>
                <Input 
                  value={item.label} 
                  onChange={(e) => {
                    const updated = [...editingCompanyGroupLabels];
                    updated[idx] = { ...item, label: e.target.value };
                    setEditingCompanyGroupLabels(updated);
                  }}
                  placeholder="Enter label..."
                  className="flex-1"
                  data-testid={`input-company-group-label-${item.key}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCompanyGroupLabelsAndClose} className="bg-[#5dc86f] hover:bg-[#4db85f] text-white">
              Save Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
