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
import { Plus, Pencil, Trash2, Search, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { id: 1, masterId: "C0001", certificateName: "Safety Equipment Certificate", category: "Statutory", group: "Safety", requirementRef: "SOLAS XXX", applicableToCompany: true, certificateLabel: "Safety Equi. Cert." },
  { id: 2, masterId: "C0002", certificateName: "Safety Construction Certificate", category: "Statutory", group: "Safety", requirementRef: "SOLAS XXX", applicableToCompany: true, certificateLabel: "Safety Const. Cert." },
  { id: 3, masterId: "C0003", certificateName: "International Anti Fouling System Certificate", category: "Statutory", group: "Environment", requirementRef: "SOLAS XXX", applicableToCompany: false, certificateLabel: "Anti Fouling Cert." },
  { id: 4, masterId: "C0004", certificateName: "Certificate of Fitness", category: "Trading", group: "Cargo", requirementRef: "SOLAS XXX", applicableToCompany: false, certificateLabel: "Fitness Cert." },
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
  const [nextRGDate, setNextRGDate] = useState("21/01/2026");

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
                            {/* TODO: Replace MASTER_CATEGORY_OPTIONS with actual values */}
                            {MASTER_CATEGORY_OPTIONS.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.category
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.master === "edit" ? (
                        <Select defaultValue={cert.group}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-group-${cert.id}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* TODO: Replace MASTER_GROUP_OPTIONS with actual values */}
                            {MASTER_GROUP_OPTIONS.map(grp => (
                              <SelectItem key={grp} value={grp}>{grp}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.group
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
                          {/* TODO: Replace MASTER_CATEGORY_OPTIONS with actual values */}
                          {MASTER_CATEGORY_OPTIONS.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Select>
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-group-empty-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {/* TODO: Replace MASTER_GROUP_OPTIONS with actual values */}
                          {MASTER_GROUP_OPTIONS.map(grp => (
                            <SelectItem key={grp} value={grp}>{grp}</SelectItem>
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
                  <th className="px-3 py-3 text-left font-medium">Company ID</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement</th>
                  <th className="px-3 py-3 text-left font-medium">Company Group</th>
                  <th className="px-3 py-3 text-center font-medium">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((cert, idx) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm">{idx + 1}</td>
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
                            <SelectValue placeholder="A. Statutory" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* TODO: Replace COMPANY_GROUP_OPTIONS with actual values */}
                            {COMPANY_GROUP_OPTIONS.map(grp => (
                              <SelectItem key={grp} value={grp}>{grp}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        cert.companyGroup || "A. Statutory"
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Next RG:</span>
            <Input 
              value={nextRGDate} 
              onChange={(e) => setNextRGDate(e.target.value)}
              className="w-[130px] h-9"
              data-testid="input-next-rg"
            />
          </div>
          <Button variant="default" className="bg-green-600 hover:bg-green-700" data-testid="button-review">
            + Review
          </Button>
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
                {activeTab === "company" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
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
                    <Button variant="outline" size="sm" className="bg-red-100 hover:bg-red-200 text-red-800 border-red-300" data-testid="button-reject">
                      Reject
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
    </div>
  );
}
