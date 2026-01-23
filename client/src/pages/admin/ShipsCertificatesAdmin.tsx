import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Search, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Interface for label configuration (used by Company Group, Master Category, Master Group)
interface LabelConfig {
  key: string;  // Letter for Category/Company Group, Number for Master Group
  label: string;
}

// Initial Company Group labels (A-I) - configurable via modal
const INITIAL_COMPANY_GROUP_LABELS: LabelConfig[] = [
  { key: "A", label: "Statutory" },
  { key: "B", label: "Value Add" },
  { key: "C", label: "Others" },
  { key: "D", label: "" },
  { key: "E", label: "" },
  { key: "F", label: "" },
  { key: "G", label: "" },
  { key: "H", label: "" },
  { key: "I", label: "" },
];

// Initial Master Category labels (A-F) - configurable via modal
const INITIAL_MASTER_CATEGORY_LABELS: LabelConfig[] = [
  { key: "A", label: "Statutory" },
  { key: "B", label: "Value Add" },
  { key: "C", label: "Others" },
  { key: "D", label: "" },
  { key: "E", label: "" },
  { key: "F", label: "" },
];

// Initial Master Group labels (1-10) - configurable via modal
const INITIAL_MASTER_GROUP_LABELS: LabelConfig[] = [
  { key: "1", label: "Safety" },
  { key: "2", label: "Environment" },
  { key: "3", label: "Cargo" },
  { key: "4", label: "Navigation" },
  { key: "5", label: "" },
  { key: "6", label: "" },
  { key: "7", label: "" },
  { key: "8", label: "" },
  { key: "9", label: "" },
  { key: "10", label: "" },
];

type MasterLabelTab = "category" | "group";

type TabType = "master" | "company" | "vessel";
type ViewMode = "view" | "edit";

interface MasterCertificate {
  id: number;
  masterId: string;
  certificateName: string;
  category: string;
  group: string;
  requirementRef: string;
  applicableToCompany: boolean;
  certificateLabel: string;
}

interface CompanyCertificate {
  id: number;
  masterId: string;
  companyId: string;
  certificateLabel: string;
  requirementRef: string;
  companyGroup: string;
  ranking: string;
}

interface VesselCertificate {
  id: number;
  masterId: string;
  companyId: string;
  certificateLabel: string;
  requirementRef: string;
  companyGroup: string;
  applicable: boolean;
}

const mockMasterData: MasterCertificate[] = [
  { id: 1, masterId: "C0001", certificateName: "Safety Equipment Certificate", category: "A", group: "1", requirementRef: "SOLAS XXX", applicableToCompany: true, certificateLabel: "Safety Equi. Cert." },
  { id: 2, masterId: "C0002", certificateName: "Safety Construction Certificate", category: "A", group: "1", requirementRef: "SOLAS XXX", applicableToCompany: true, certificateLabel: "Safety Const. Cert." },
  { id: 3, masterId: "C0003", certificateName: "International Anti Fouling System Certificate", category: "A", group: "2", requirementRef: "SOLAS XXX", applicableToCompany: false, certificateLabel: "Anti Fouling Cert." },
  { id: 4, masterId: "C0004", certificateName: "Certificate of Fitness", category: "B", group: "3", requirementRef: "SOLAS XXX", applicableToCompany: false, certificateLabel: "Fitness Cert." },
];

const mockCompanyData: CompanyCertificate[] = [
  { id: 1, masterId: "CA001", companyId: "L0001", certificateLabel: "Safety Equi. Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", ranking: "-" },
  { id: 2, masterId: "C0002", companyId: "L0002", certificateLabel: "Safety Const. Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", ranking: "-" },
  { id: 3, masterId: "CA002", companyId: "L0003", certificateLabel: "Anti Fouling Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", ranking: "-" },
  { id: 4, masterId: "MA003", companyId: "L0004", certificateLabel: "Fitness Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", ranking: "-" },
];

const mockVesselData: VesselCertificate[] = [
  { id: 1, masterId: "C0001", companyId: "L0001", certificateLabel: "Safety Equi. Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", applicable: true },
  { id: 2, masterId: "C0002", companyId: "L0002", certificateLabel: "Safety Const. Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", applicable: true },
  { id: 3, masterId: "CA002", companyId: "L0003", certificateLabel: "Anti Fouling Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", applicable: true },
  { id: 4, masterId: "CA003", companyId: "L0004", certificateLabel: "Fitness Cert.", requirementRef: "SOLAS XXX", companyGroup: "A. Statutory", applicable: false },
];

const categories = ["All Categories", "Statutory", "Trading", "Class"];
const groups = ["All Groups", "Safety", "Environment", "Cargo", "Navigation"];
const companyGroups = ["A. Statutory", "B. Trading", "C. Class", "D. Other"];
const vessels = ["Vessel 1", "Vessel 2", "Vessel 3"];

// TODO: Replace these dropdown options with actual values from backend/configuration
// Master Tab - Category dropdown options (A-F for now, will be replaced later)
const MASTER_CATEGORY_OPTIONS = ["A", "B", "C", "D", "E", "F"];

// TODO: Replace these dropdown options with actual values from backend/configuration
// Master Tab - Group dropdown options (1-10 for now, will be replaced later)
const MASTER_GROUP_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// TODO: Replace these dropdown options with actual values from backend/configuration
// Company Tab - Company Group dropdown options (A-I for now, will be replaced later)
const COMPANY_GROUP_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

export default function ShipsCertificatesAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>("master");
  const [viewModes, setViewModes] = useState<Record<TabType, ViewMode>>({
    master: "view",
    company: "view",
    vessel: "view"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedGroup, setSelectedGroup] = useState("All Groups");
  const [selectedVessel, setSelectedVessel] = useState("Vessel 1");
  
  // Configure Company Group Labels modal state
  const [isConfigureLabelsOpen, setIsConfigureLabelsOpen] = useState(false);
  const [companyGroupLabels, setCompanyGroupLabels] = useState<LabelConfig[]>(INITIAL_COMPANY_GROUP_LABELS);
  const [tempCompanyGroupLabels, setTempCompanyGroupLabels] = useState<LabelConfig[]>(INITIAL_COMPANY_GROUP_LABELS);
  
  // Configure Master Labels modal state (Category & Group tabs)
  const [isMasterLabelsOpen, setIsMasterLabelsOpen] = useState(false);
  const [masterLabelTab, setMasterLabelTab] = useState<MasterLabelTab>("category");
  const [masterCategoryLabels, setMasterCategoryLabels] = useState<LabelConfig[]>(INITIAL_MASTER_CATEGORY_LABELS);
  const [masterGroupLabels, setMasterGroupLabels] = useState<LabelConfig[]>(INITIAL_MASTER_GROUP_LABELS);
  const [tempMasterCategoryLabels, setTempMasterCategoryLabels] = useState<LabelConfig[]>(INITIAL_MASTER_CATEGORY_LABELS);
  const [tempMasterGroupLabels, setTempMasterGroupLabels] = useState<LabelConfig[]>(INITIAL_MASTER_GROUP_LABELS);
  
  // Helper to get next letter in alphabet
  const getNextLetter = (labels: LabelConfig[]): string => {
    if (labels.length === 0) return "A";
    const lastKey = labels[labels.length - 1].key;
    return String.fromCharCode(lastKey.charCodeAt(0) + 1);
  };
  
  // Helper to get next number
  const getNextNumber = (labels: LabelConfig[]): string => {
    if (labels.length === 0) return "1";
    const lastKey = parseInt(labels[labels.length - 1].key);
    return String(lastKey + 1);
  };
  
  // ===== Company Group Labels Modal Functions =====
  const openConfigureLabels = () => {
    setTempCompanyGroupLabels([...companyGroupLabels]);
    setIsConfigureLabelsOpen(true);
  };
  
  const saveCompanyGroupLabels = () => {
    setCompanyGroupLabels([...tempCompanyGroupLabels]);
    setIsConfigureLabelsOpen(false);
  };
  
  const cancelConfigureLabels = () => {
    setTempCompanyGroupLabels([...companyGroupLabels]);
    setIsConfigureLabelsOpen(false);
  };
  
  const addCompanyGroupLabelRow = () => {
    const nextLetter = getNextLetter(tempCompanyGroupLabels);
    if (nextLetter <= "Z") {
      setTempCompanyGroupLabels([...tempCompanyGroupLabels, { key: nextLetter, label: "" }]);
    }
  };
  
  const updateCompanyGroupLabel = (index: number, newLabel: string) => {
    const updated = [...tempCompanyGroupLabels];
    updated[index] = { ...updated[index], label: newLabel };
    setTempCompanyGroupLabels(updated);
  };
  
  const getFormattedCompanyGroupLabel = (key: string): string => {
    const found = companyGroupLabels.find(g => g.key === key);
    if (found && found.label) {
      return `${found.key}. ${found.label}`;
    }
    return key;
  };
  
  // ===== Master Labels Modal Functions (Category & Group) =====
  const openMasterLabels = () => {
    setTempMasterCategoryLabels([...masterCategoryLabels]);
    setTempMasterGroupLabels([...masterGroupLabels]);
    setMasterLabelTab("category");
    setIsMasterLabelsOpen(true);
  };
  
  const saveMasterLabels = () => {
    setMasterCategoryLabels([...tempMasterCategoryLabels]);
    setMasterGroupLabels([...tempMasterGroupLabels]);
    setIsMasterLabelsOpen(false);
  };
  
  const cancelMasterLabels = () => {
    setTempMasterCategoryLabels([...masterCategoryLabels]);
    setTempMasterGroupLabels([...masterGroupLabels]);
    setIsMasterLabelsOpen(false);
  };
  
  const addMasterCategoryRow = () => {
    const nextLetter = getNextLetter(tempMasterCategoryLabels);
    if (nextLetter <= "Z") {
      setTempMasterCategoryLabels([...tempMasterCategoryLabels, { key: nextLetter, label: "" }]);
    }
  };
  
  const addMasterGroupRow = () => {
    const nextNumber = getNextNumber(tempMasterGroupLabels);
    setTempMasterGroupLabels([...tempMasterGroupLabels, { key: nextNumber, label: "" }]);
  };
  
  const updateMasterCategoryLabel = (index: number, newLabel: string) => {
    const updated = [...tempMasterCategoryLabels];
    updated[index] = { ...updated[index], label: newLabel };
    setTempMasterCategoryLabels(updated);
  };
  
  const updateMasterGroupLabel = (index: number, newLabel: string) => {
    const updated = [...tempMasterGroupLabels];
    updated[index] = { ...updated[index], label: newLabel };
    setTempMasterGroupLabels(updated);
  };
  
  const getFormattedMasterCategoryLabel = (key: string): string => {
    const found = masterCategoryLabels.find(g => g.key === key);
    if (found && found.label) {
      return `${found.key}. ${found.label}`;
    }
    return key;
  };
  
  const getFormattedMasterGroupLabel = (key: string): string => {
    const found = masterGroupLabels.find(g => g.key === key);
    if (found && found.label) {
      return `${found.key}. ${found.label}`;
    }
    return key;
  };

  const currentViewMode = viewModes[activeTab];

  const toggleViewMode = () => {
    setViewModes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] === "view" ? "edit" : "view"
    }));
  };

  const exitEditMode = () => {
    setViewModes(prev => ({
      ...prev,
      [activeTab]: "view"
    }));
  };

  const renderMasterTab = () => {
    const filteredData = mockMasterData.filter(cert => {
      const matchesSearch = cert.certificateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cert.masterId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All Categories" || cert.category === selectedCategory;
      const matchesGroup = selectedGroup === "All Groups" || cert.group === selectedGroup;
      return matchesSearch && matchesCategory && matchesGroup;
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Certificate"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-certificate"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]" data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[140px]" data-testid="select-group">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((grp) => (
                <SelectItem key={grp} value={grp}>{grp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#52baf3] text-white text-sm">
                <tr>
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Name</th>
                  <th className="px-3 py-3 text-left font-medium">Category</th>
                  <th className="px-3 py-3 text-left font-medium">Group</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                  <th className="px-3 py-3 text-center font-medium">Applicable to Company</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
                  {viewModes.master === "edit" && (
                    <th className="px-3 py-3 text-center font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((cert, idx) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm">{idx + 1}</td>
                    <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId}</td>
                    <td className="px-3 py-3 text-sm">{cert.certificateName}</td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.master === "edit" ? (
                        <Select defaultValue={cert.category}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-category-${cert.id}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterCategoryLabels.map((cat: LabelConfig) => (
                              <SelectItem key={cat.key} value={cat.key}>
                                {getFormattedMasterCategoryLabel(cat.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.category ? getFormattedMasterCategoryLabel(cert.category) : cert.category
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.master === "edit" ? (
                        <Select defaultValue={cert.group}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-group-${cert.id}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterGroupLabels.map((grp: LabelConfig) => (
                              <SelectItem key={grp.key} value={grp.key}>
                                {getFormattedMasterGroupLabel(grp.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.group ? getFormattedMasterGroupLabel(cert.group) : cert.group
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.master === "edit" ? (
                        <Input 
                          defaultValue={cert.requirementRef} 
                          className="h-8 text-sm"
                          data-testid={`input-requirement-${cert.id}`}
                        />
                      ) : (
                        cert.requirementRef
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {viewModes.master === "edit" ? (
                        <Checkbox 
                          defaultChecked={cert.applicableToCompany}
                          data-testid={`checkbox-applicable-${cert.id}`}
                        />
                      ) : (
                        <Checkbox 
                          checked={cert.applicableToCompany}
                          disabled
                          data-testid={`checkbox-applicable-${cert.id}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.master === "edit" ? (
                        <Input 
                          defaultValue={cert.certificateLabel} 
                          className="h-8 text-sm"
                          data-testid={`input-label-${cert.id}`}
                        />
                      ) : (
                        cert.certificateLabel
                      )}
                    </td>
                    {viewModes.master === "edit" && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-edit-${cert.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" data-testid={`button-delete-${cert.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {viewModes.master === "edit" && filteredData.length < 10 && Array.from({ length: Math.max(0, 10 - filteredData.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm text-muted-foreground">{filteredData.length + idx + 1}</td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" data-testid={`input-masterid-empty-${idx}`} /></td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" data-testid={`input-certname-empty-${idx}`} /></td>
                    <td className="px-3 py-3">
                      <Select>
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-category-empty-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {masterCategoryLabels.map((cat: LabelConfig) => (
                            <SelectItem key={cat.key} value={cat.key}>
                              {getFormattedMasterCategoryLabel(cat.key)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Select>
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-group-empty-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {masterGroupLabels.map((grp: LabelConfig) => (
                            <SelectItem key={grp.key} value={grp.key}>
                              {getFormattedMasterGroupLabel(grp.key)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" data-testid={`input-requirement-empty-${idx}`} /></td>
                    <td className="px-3 py-3 text-center"><Checkbox data-testid={`checkbox-applicable-empty-${idx}`} /></td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" data-testid={`input-label-empty-${idx}`} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCompanyTab = () => {
    // Derive company data from Master tab - only certificates with applicableToCompany checked
    const companyDataFromMaster = mockMasterData
      .filter(cert => cert.applicableToCompany)
      .map((cert, idx) => ({
        id: cert.id,
        masterId: cert.masterId,
        certificateLabel: cert.certificateLabel,
        companyId: "", // Editable - user enters this
        requirementRef: cert.requirementRef, // Pre-filled from Master, but editable
        companyGroup: "", // Editable dropdown
      }));

    const filteredData = companyDataFromMaster.filter(cert => {
      const matchesSearch = cert.certificateLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cert.masterId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Training"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-company"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#52baf3] text-white text-sm">
                <tr>
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Company ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                  <th className="px-3 py-3 text-left font-medium">Company Group</th>
                  <th className="px-3 py-3 text-center font-medium">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((cert, idx) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm">{idx + 1}</td>
                    <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId}</td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.companyId}
                          className="h-8 text-sm"
                          placeholder=""
                          data-testid={`input-companyid-${cert.id}`}
                        />
                      ) : (
                        cert.companyId || "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">{cert.certificateLabel}</td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.requirementRef}
                          className="h-8 text-sm"
                          data-testid={`input-requirement-company-${cert.id}`}
                        />
                      ) : (
                        cert.requirementRef
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Select defaultValue={cert.companyGroup}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-companygroup-${cert.id}`}>
                            <SelectValue placeholder={getFormattedCompanyGroupLabel("A")} />
                          </SelectTrigger>
                          <SelectContent>
                            {companyGroupLabels.map((grp: LabelConfig) => (
                              <SelectItem key={grp.key} value={grp.key}>
                                {getFormattedCompanyGroupLabel(grp.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.companyGroup ? getFormattedCompanyGroupLabel(cert.companyGroup) : getFormattedCompanyGroupLabel("A")
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          disabled={viewModes.company === "view"}
                          data-testid={`button-moveup-${cert.id}`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          disabled={viewModes.company === "view"}
                          data-testid={`button-movedown-${cert.id}`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderVesselTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-[160px]" data-testid="select-vessel">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel) => (
                <SelectItem key={vessel} value={vessel}>{vessel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {viewModes.vessel === "edit" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800">Revision Mode - Editing 1 vessel</span>
                <Checkbox id="vessel-1" defaultChecked />
                <label htmlFor="vessel-1" className="text-sm">Vessel 1</label>
              </div>
              <span className="text-sm text-blue-600">Changes apply to all selected vessels</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#52baf3] text-white text-sm">
                <tr>
                  {viewModes.vessel === "edit" && (
                    <th className="px-3 py-3 text-center font-medium w-12">Applicable</th>
                  )}
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Company ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                  <th className="px-3 py-3 text-left font-medium">Company Group</th>
                  {viewModes.vessel === "edit" && (
                    <th className="px-3 py-3 text-center font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockVesselData.map((cert, idx) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    {viewModes.vessel === "edit" && (
                      <td className="px-3 py-3 text-center">
                        <Checkbox 
                          checked={cert.applicable}
                          className="border-blue-500 data-[state=checked]:bg-blue-500"
                          data-testid={`checkbox-vessel-applicable-${cert.id}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 text-sm">{idx + 1}</td>
                    <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId}</td>
                    <td className="px-3 py-3 text-sm">{cert.companyId}</td>
                    <td className="px-3 py-3 text-sm">{cert.certificateLabel}</td>
                    <td className="px-3 py-3 text-sm">{cert.requirementRef}</td>
                    <td className="px-3 py-3 text-sm">{cert.companyGroup}</td>
                    {viewModes.vessel === "edit" && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-edit-vessel-${cert.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" data-testid={`button-delete-vessel-${cert.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {viewModes.vessel === "edit" && mockVesselData.length < 10 && Array.from({ length: Math.max(0, 10 - mockVesselData.length) }).map((_, idx) => (
                  <tr key={`empty-vessel-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-center"><Checkbox className="border-blue-500" /></td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{mockVesselData.length + idx + 1}</td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" /></td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" /></td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" /></td>
                    <td className="px-3 py-3"><Input className="h-8 text-sm" placeholder="" /></td>
                    <td className="px-3 py-3">
                      <Select>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {companyGroups.map(grp => (
                            <SelectItem key={grp} value={grp}>{grp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between relative">
        <h1 className="text-2xl font-semibold text-gray-800">Ship Certificates Admin</h1>
        
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
                  Cancel
                </Button>
                {activeTab === "master" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                    onClick={openMasterLabels}
                    data-testid="button-configure-master-labels"
                  >
                    Configure Labels
                  </Button>
                )}
                {activeTab === "company" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                    onClick={openConfigureLabels}
                    data-testid="button-configure-labels"
                  >
                    Configure Labels
                  </Button>
                )}
                {activeTab === "vessel" && (
                  <>
                    <Button variant="outline" size="sm" className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300" data-testid="button-save-draft">
                      Save Draft
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="button-submit">
                      Submit
                    </Button>
                  </>
                )}
                {activeTab !== "vessel" && (
                  <Button 
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-save"
                  >
                    Save
                  </Button>
                )}
              </>
            )}
            
            {currentViewMode === "edit" && (
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                data-testid="button-new"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
      </div>

      <div className="mt-4">
        {activeTab === "master" && renderMasterTab()}
        {activeTab === "company" && renderCompanyTab()}
        {activeTab === "vessel" && renderVesselTab()}
      </div>

      {/* Configure Company Group Labels Modal */}
      <Dialog open={isConfigureLabelsOpen} onOpenChange={setIsConfigureLabelsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Group Labels</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Define custom labels for each company group. Leave blank to show just the letter.
            </p>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {tempCompanyGroupLabels.map((group: LabelConfig, index: number) => (
              <div key={group.key} className="flex items-center gap-3">
                <span className="w-6 text-sm font-medium text-muted-foreground">{group.key}.</span>
                <Input
                  value={group.label}
                  onChange={(e) => updateCompanyGroupLabel(index, e.target.value)}
                  placeholder={`Label for group ${group.key}`}
                  className="flex-1"
                  data-testid={`input-group-label-${group.key}`}
                />
              </div>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={addCompanyGroupLabelRow}
            className="w-full gap-2"
            disabled={tempCompanyGroupLabels.length >= 26}
            data-testid="button-add-group-row"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
          
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={cancelConfigureLabels} data-testid="button-cancel-labels">
              Cancel
            </Button>
            <Button onClick={saveCompanyGroupLabels} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-labels">
              Save Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Master Labels Modal (Category & Group tabs) */}
      <Dialog open={isMasterLabelsOpen} onOpenChange={setIsMasterLabelsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {masterLabelTab === "category" ? "Category" : "Group"} Labels</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Define custom labels for each {masterLabelTab === "category" ? "category" : "group"}. Leave blank to show just the {masterLabelTab === "category" ? "letter" : "number"}.
            </p>
          </DialogHeader>
          
          {/* Tabs for Category and Group */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={masterLabelTab === "category" ? "default" : "outline"}
              size="sm"
              onClick={() => setMasterLabelTab("category")}
              className={masterLabelTab === "category" ? "bg-blue-600 hover:bg-blue-700" : ""}
              data-testid="tab-master-category"
            >
              Category
            </Button>
            <Button
              variant={masterLabelTab === "group" ? "default" : "outline"}
              size="sm"
              onClick={() => setMasterLabelTab("group")}
              className={masterLabelTab === "group" ? "bg-blue-600 hover:bg-blue-700" : ""}
              data-testid="tab-master-group"
            >
              Group
            </Button>
          </div>
          
          {/* Category Tab Content */}
          {masterLabelTab === "category" && (
            <>
              <div className="space-y-3 max-h-[300px] overflow-y-auto py-2">
                {tempMasterCategoryLabels.map((cat: LabelConfig, index: number) => (
                  <div key={cat.key} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-medium text-muted-foreground">{cat.key}.</span>
                    <Input
                      value={cat.label}
                      onChange={(e) => updateMasterCategoryLabel(index, e.target.value)}
                      placeholder={`Label for category ${cat.key}`}
                      className="flex-1"
                      data-testid={`input-category-label-${cat.key}`}
                    />
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={addMasterCategoryRow}
                className="w-full gap-2"
                disabled={tempMasterCategoryLabels.length >= 26}
                data-testid="button-add-category-row"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </>
          )}
          
          {/* Group Tab Content */}
          {masterLabelTab === "group" && (
            <>
              <div className="space-y-3 max-h-[300px] overflow-y-auto py-2">
                {tempMasterGroupLabels.map((grp: LabelConfig, index: number) => (
                  <div key={grp.key} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-medium text-muted-foreground">{grp.key}.</span>
                    <Input
                      value={grp.label}
                      onChange={(e) => updateMasterGroupLabel(index, e.target.value)}
                      placeholder={`Label for group ${grp.key}`}
                      className="flex-1"
                      data-testid={`input-master-group-label-${grp.key}`}
                    />
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={addMasterGroupRow}
                className="w-full gap-2"
                data-testid="button-add-master-group-row"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </>
          )}
          
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={cancelMasterLabels} data-testid="button-cancel-master-labels">
              Cancel
            </Button>
            <Button onClick={saveMasterLabels} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-master-labels">
              Save Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
