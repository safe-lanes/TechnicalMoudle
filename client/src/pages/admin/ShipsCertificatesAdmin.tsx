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
  sequence: number;
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

// Starter Kit Master Certificate Data - loaded from CSV
const STARTER_KIT_MASTER_DATA: MasterCertificate[] = [
  { id: 1, sequence: 1, masterId: "A1-001", certificateName: "Certificate of Registry", category: "A", group: "1", requirementRef: "UNCLOS Article 94; National Regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 2, sequence: 2, masterId: "A1-002", certificateName: "Certificate of Class", category: "A", group: "1", requirementRef: "IACS Rules; SOLAS I/6", applicableToCompany: false, certificateLabel: "" },
  { id: 3, sequence: 3, masterId: "A1-003", certificateName: "International Tonnage Certificate (1969)", category: "A", group: "1", requirementRef: "Tonnage 1969, Article 7", applicableToCompany: false, certificateLabel: "" },
  { id: 4, sequence: 4, masterId: "A1-004", certificateName: "International Load Line Certificate", category: "A", group: "1", requirementRef: "LL 1966, Article 16; LL PROT 1988, Article 16", applicableToCompany: false, certificateLabel: "" },
  { id: 5, sequence: 5, masterId: "A1-005", certificateName: "International Load Line Exemption Certificate", category: "A", group: "1", requirementRef: "LL 1966, Article 16; LL PROT 1988, Article 16", applicableToCompany: false, certificateLabel: "" },
  { id: 6, sequence: 6, masterId: "A1-006", certificateName: "Load Line 1966 - Conditions of Freeboard Assignment", category: "A", group: "1", requirementRef: "LL 1966, Article 16; LL PROT 1988, Article 16", applicableToCompany: false, certificateLabel: "" },
  { id: 7, sequence: 7, masterId: "A1-007", certificateName: "Exemption Certificate (SOLAS)", category: "A", group: "1", requirementRef: "SOLAS 1974, Reg I/12; SOLAS PROT 1988, Reg I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 8, sequence: 8, masterId: "A1-008", certificateName: "Cargo Ship Safety Construction Certificate", category: "A", group: "1", requirementRef: "SOLAS I/12; 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 9, sequence: 9, masterId: "A1-009", certificateName: "Cargo Ship Safety Equipment Certificate", category: "A", group: "1", requirementRef: "SOLAS I/12; 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 10, sequence: 10, masterId: "A1-010", certificateName: "Record of Safety Equipment (Form 'E')", category: "A", group: "1", requirementRef: "SOLAS I/12; 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 11, sequence: 11, masterId: "A1-011", certificateName: "Cargo Ship Safety Radio Certificate", category: "A", group: "1", requirementRef: "SOLAS I/12 (GMDSS); 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 12, sequence: 12, masterId: "A1-012", certificateName: "Record of Radio Equipment (Form 'R')", category: "A", group: "1", requirementRef: "SOLAS I/12 (GMDSS); 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 13, sequence: 13, masterId: "A1-013", certificateName: "Record of Approved GMDSS Radio Installation", category: "A", group: "1", requirementRef: "SOLAS I/12 (GMDSS); 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 14, sequence: 14, masterId: "A1-014", certificateName: "GMDSS Shore Based Maintenance Certificate", category: "A", group: "1", requirementRef: "SOLAS I/12 (GMDSS); 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 15, sequence: 15, masterId: "A1-015", certificateName: "Ship Radio Station Licence", category: "A", group: "1", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 16, sequence: 16, masterId: "A1-016", certificateName: "Cargo Ship Safety Certificate", category: "A", group: "1", requirementRef: "SOLAS 1988 Prot I/12", applicableToCompany: false, certificateLabel: "" },
  { id: 17, sequence: 17, masterId: "A1-017", certificateName: "International Oil Pollution Prevention Certificate", category: "A", group: "1", requirementRef: "MARPOL Annex I, Reg 7", applicableToCompany: false, certificateLabel: "" },
  { id: 18, sequence: 18, masterId: "A1-018", certificateName: "IOPP Form A (Ships Other than Oil Tankers)", category: "A", group: "1", requirementRef: "MARPOL Annex I, Reg 7", applicableToCompany: false, certificateLabel: "" },
  { id: 19, sequence: 19, masterId: "A1-019", certificateName: "IOPP Form B (Oil Tankets)", category: "A", group: "1", requirementRef: "MARPOL Annex I, Reg 7", applicableToCompany: false, certificateLabel: "" },
  { id: 20, sequence: 20, masterId: "A1-020", certificateName: "International Sewage Pollution Prevention Certificate", category: "A", group: "1", requirementRef: "MARPOL Annex IV, Reg 5", applicableToCompany: false, certificateLabel: "" },
  { id: 21, sequence: 21, masterId: "A1-021", certificateName: "International Air Pollution Prevention Certificate", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 22, sequence: 22, masterId: "A1-022", certificateName: "Record of Construction and Equipment (Annex VI) IAPP", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 23, sequence: 23, masterId: "A1-023", certificateName: "Engine International Air Pollution Prevention Certificate", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 13", applicableToCompany: false, certificateLabel: "" },
  { id: 24, sequence: 24, masterId: "A1-024", certificateName: "Safety Management Certificate (SMC)", category: "A", group: "1", requirementRef: "SOLAS IX/4; ISM Code §13", applicableToCompany: false, certificateLabel: "" },
  { id: 25, sequence: 25, masterId: "A1-025", certificateName: "Document of Compliance (DOC)", category: "A", group: "1", requirementRef: "SOLAS IX/4; ISM Code §13", applicableToCompany: false, certificateLabel: "" },
  { id: 26, sequence: 26, masterId: "A1-026", certificateName: "International Ship Security Certificate (ISSC)", category: "A", group: "1", requirementRef: "SOLAS XI-2/9.1.1; ISPS Code Part A §19", applicableToCompany: false, certificateLabel: "" },
  { id: 27, sequence: 27, masterId: "A1-027", certificateName: "Letter of Approval for the Ship Security Plan", category: "A", group: "1", requirementRef: "SOLAS XI-2/9.1.1; ISPS Code Part A §19", applicableToCompany: false, certificateLabel: "" },
  { id: 28, sequence: 28, masterId: "A1-028", certificateName: "Continous Synopsis Record (CSR)", category: "A", group: "1", requirementRef: "SOLAS", applicableToCompany: false, certificateLabel: "" },
  { id: 29, sequence: 29, masterId: "A1-029", certificateName: "International Energy Efficiency Certificate (IEEC)", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 30, sequence: 30, masterId: "A1-030", certificateName: "Record of construction for the IEE Certificate", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 31, sequence: 31, masterId: "A1-031", certificateName: "EEDI Technical File", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 32, sequence: 32, masterId: "A1-032", certificateName: "EEXI Technical File", category: "A", group: "1", requirementRef: "MARPOL Annex VI, Reg 6", applicableToCompany: false, certificateLabel: "" },
  { id: 33, sequence: 33, masterId: "A1-033", certificateName: "Statement of Compliance – Fuel Oil Consumption Reporting", category: "A", group: "1", requirementRef: "MARPOL VI Regs 6, 27, 28", applicableToCompany: false, certificateLabel: "" },
  { id: 34, sequence: 34, masterId: "A1-034", certificateName: "International Anti-Fouling System Certificate", category: "A", group: "1", requirementRef: "AFS 2001, Annex 4 Reg 2", applicableToCompany: false, certificateLabel: "" },
  { id: 35, sequence: 35, masterId: "A1-035", certificateName: "Record of the Anti Fouling System / Endorsement of the Record", category: "A", group: "1", requirementRef: "AFS 2001, Annex 4 Reg 2", applicableToCompany: false, certificateLabel: "" },
  { id: 36, sequence: 36, masterId: "A1-036", certificateName: "Civil Liability Insurance Certificate (CLC Bunker Oil)", category: "A", group: "1", requirementRef: "Bunkers 2001, Article 7", applicableToCompany: false, certificateLabel: "" },
  { id: 37, sequence: 37, masterId: "A1-037", certificateName: "Civil Liability Insurance Certificate (CLC Wreck Removal)", category: "A", group: "1", requirementRef: "Nairobi WRC 2007, Article 12", applicableToCompany: false, certificateLabel: "" },
  { id: 38, sequence: 38, masterId: "A1-038", certificateName: "Minimum Safe Manning Certificate", category: "A", group: "1", requirementRef: "SOLAS V/14; STCW Reg I/14", applicableToCompany: false, certificateLabel: "" },
  { id: 39, sequence: 39, masterId: "A1-039", certificateName: "International Ballast Water Management Certificate", category: "A", group: "1", requirementRef: "BWM 2004, Article 19 & Annex Reg E-2", applicableToCompany: false, certificateLabel: "" },
  { id: 40, sequence: 40, masterId: "A1-040", certificateName: "Certificate of Entry (P&I)", category: "A", group: "1", requirementRef: "Flag State Regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 41, sequence: 41, masterId: "A1-041", certificateName: "Ship Sanitation Control Certificate (SSCC)/ Exemption Certificate", category: "A", group: "1", requirementRef: "WHO International Health Regulations (IHR 2005)", applicableToCompany: false, certificateLabel: "" },
  { id: 42, sequence: 42, masterId: "A1-042", certificateName: "Maritime Labour Convention (MLC) Certificate", category: "A", group: "1", requirementRef: "MLC, 2006 Title 5", applicableToCompany: false, certificateLabel: "" },
  { id: 43, sequence: 43, masterId: "A1-043", certificateName: "Declaration of Maritime Labour Convention I (DMLC I)", category: "A", group: "1", requirementRef: "MLC, 2006 Title 5", applicableToCompany: false, certificateLabel: "" },
  { id: 44, sequence: 44, masterId: "A1-044", certificateName: "Declaration of Maritime Labour Convention II (DMLC II)", category: "A", group: "1", requirementRef: "MLC, 2006 Title 5", applicableToCompany: false, certificateLabel: "" },
  { id: 45, sequence: 45, masterId: "A1-045", certificateName: "Certificate of Insurance in Respect of Repatriation Costs", category: "A", group: "1", requirementRef: "MLC 2006, Regulation 2.5, Standard A2.5.2", applicableToCompany: false, certificateLabel: "" },
  { id: 46, sequence: 46, masterId: "A1-046", certificateName: "Certificate of Insurance in Respect of Shipowner's Liability (Death/Disability)", category: "A", group: "1", requirementRef: "MLC 2006, Regulation 4.2, Standard A4.2.1", applicableToCompany: false, certificateLabel: "" },
  { id: 47, sequence: 47, masterId: "A1-047", certificateName: "International Certificate on Inventory of Hazardous Materials (IHM Certificate)", category: "A", group: "1", requirementRef: "Hong Kong Convention (2009), Article 5, EU SRR 1257/2013", applicableToCompany: false, certificateLabel: "" },
  { id: 48, sequence: 48, masterId: "A1-048", certificateName: "Voyage Data Recorder – Certificate of Compliance", category: "A", group: "1", requirementRef: "SOLAS V/18.8", applicableToCompany: false, certificateLabel: "" },
  { id: 49, sequence: 49, masterId: "A1-049", certificateName: "AIS – Annual Test Report", category: "A", group: "1", requirementRef: "SOLAS V/18.9; MSC.1/Circ.1252", applicableToCompany: false, certificateLabel: "" },
  { id: 50, sequence: 50, masterId: "A2-001", certificateName: "Civil Liability Insurance for Oil Pollution Damage (CLC Oil)", category: "A", group: "2", requirementRef: "CLC 1992, Article VII", applicableToCompany: false, certificateLabel: "" },
  { id: 51, sequence: 51, masterId: "A2-002", certificateName: "Condition Assessment Scheme (CAS) Statement", category: "A", group: "2", requirementRef: "MARPOL I Reg 20, 21; MEPC.94(46)", applicableToCompany: false, certificateLabel: "" },
  { id: 52, sequence: 52, masterId: "A3-001", certificateName: "International Pollution Prevention Certificate for Noxious Liquid Substances", category: "A", group: "3", requirementRef: "MARPOL Annex II, Reg 9", applicableToCompany: false, certificateLabel: "" },
  { id: 53, sequence: 53, masterId: "A4-001", certificateName: "Certificate of Fitness (Dangerous Chemicals)", category: "A", group: "4", requirementRef: "BCH Code §1.6", applicableToCompany: false, certificateLabel: "" },
  { id: 54, sequence: 54, masterId: "A4-002", certificateName: "International Certificate of Fitness (Dangerous Chemicals)", category: "A", group: "4", requirementRef: "IBC Code §1.5", applicableToCompany: false, certificateLabel: "" },
  { id: 55, sequence: 55, masterId: "A4-003", certificateName: "Addendum to the Ships Certificate of Fitness", category: "A", group: "4", requirementRef: "BCH Code §1.6", applicableToCompany: false, certificateLabel: "" },
  { id: 56, sequence: 56, masterId: "A5-001", certificateName: "Certificate of Fitness (Liquefied Gases)", category: "A", group: "5", requirementRef: "GC Code §1.6", applicableToCompany: false, certificateLabel: "" },
  { id: 57, sequence: 57, masterId: "A5-002", certificateName: "International Certificate of Fitness (Liquefied Gases)", category: "A", group: "5", requirementRef: "IGC Code §1.4", applicableToCompany: false, certificateLabel: "" },
  { id: 58, sequence: 58, masterId: "A6-001", certificateName: "International Certificate of Fitness for INF Cargo", category: "A", group: "6", requirementRef: "SOLAS VII/16; INF Code §1.3", applicableToCompany: false, certificateLabel: "" },
  { id: 59, sequence: 59, masterId: "A7-001", certificateName: "IMSBC Code Fitness certificate", category: "A", group: "7", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 60, sequence: 60, masterId: "A7-002", certificateName: "Document of Authorization for the Carriage of Grain", category: "A", group: "7", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 61, sequence: 61, masterId: "A8-001", certificateName: "Document of Compliance for Dangerous Goods", category: "A", group: "8", requirementRef: "SOLAS II-2/19.4", applicableToCompany: false, certificateLabel: "" },
  { id: 62, sequence: 62, masterId: "A8-002", certificateName: "Polar Ship Certificate", category: "A", group: "8", requirementRef: "Polar Code Part I-A §1.3", applicableToCompany: false, certificateLabel: "" },
  { id: 63, sequence: 63, masterId: "A9-001", certificateName: "Suez Canal Tonnage Certificate", category: "A", group: "9", requirementRef: "Suez Canal regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 64, sequence: 64, masterId: "A9-002", certificateName: "Panama Canal Tonnage Certificate", category: "A", group: "9", requirementRef: "Panama Canal regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 65, sequence: 65, masterId: "A9-003", certificateName: "USCG COC", category: "A", group: "9", requirementRef: "USCG Regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 66, sequence: 66, masterId: "A9-004", certificateName: "USCG COFR", category: "A", group: "9", requirementRef: "USCG Regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 67, sequence: 67, masterId: "A9-005", certificateName: "California COFR", category: "A", group: "9", requirementRef: "California (US) Regulations", applicableToCompany: false, certificateLabel: "" },
  { id: 68, sequence: 68, masterId: "B10-001", certificateName: "ISO 9001", category: "B", group: "10", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 69, sequence: 69, masterId: "B10-002", certificateName: "ISO 14001", category: "B", group: "10", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 70, sequence: 70, masterId: "B10-003", certificateName: "ISO 45001", category: "B", group: "10", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
  { id: 71, sequence: 71, masterId: "B10-004", certificateName: "ISO 50001", category: "B", group: "10", requirementRef: "", applicableToCompany: false, certificateLabel: "" },
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
  
  // Master data state with sequence management
  const [masterData, setMasterData] = useState<MasterCertificate[]>(STARTER_KIT_MASTER_DATA);
  
  // Function to update sequence with auto-adjustment for conflicts
  const updateMasterSequence = (certId: number, newSequence: number) => {
    setMasterData(prevData => {
      const currentCert = prevData.find(c => c.id === certId);
      if (!currentCert) return prevData;
      
      const oldSequence = currentCert.sequence;
      if (newSequence === oldSequence) return prevData;
      
      return prevData.map(c => {
        if (c.id === certId) {
          return { ...c, sequence: newSequence };
        }
        
        // Moving up (e.g., 4 → 2): shift items in [newSequence, oldSequence-1] down by 1
        if (newSequence < oldSequence) {
          if (c.sequence >= newSequence && c.sequence < oldSequence) {
            return { ...c, sequence: c.sequence + 1 };
          }
        }
        // Moving down (e.g., 1 → 4): shift items in [oldSequence+1, newSequence] up by 1
        else {
          if (c.sequence > oldSequence && c.sequence <= newSequence) {
            return { ...c, sequence: c.sequence - 1 };
          }
        }
        
        return c;
      });
    });
  };
  
  // Sort master data by sequence
  const sortedMasterData = [...masterData].sort((a, b) => a.sequence - b.sequence);
  
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
  
  // New Entry states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newEntryData, setNewEntryData] = useState<Partial<MasterCertificate>>({
    category: "",
    group: "",
    certificateName: "",
    requirementRef: "",
    applicableToCompany: false,
    certificateLabel: "",
  });
  const [newEntryError, setNewEntryError] = useState("");
  
  // Reorder confirmation dialog state
  const [showReorderConfirm, setShowReorderConfirm] = useState(false);
  const [pendingNewEntryId, setPendingNewEntryId] = useState<number | null>(null);
  
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
  
  // ===== New Certificate Entry Functions =====
  
  // Generate next Master ID for a given Category + Group combination
  // Format: CategoryLetter + GroupNumber + "-" + 3-digit sequence (e.g., A1-001, B10-002)
  const generateMasterId = (category: string, group: string): string => {
    const prefix = `${category}${group}-`;
    
    // Find all existing certificates with this Category+Group combination
    const existingWithPrefix = masterData.filter(c => c.masterId.startsWith(prefix));
    
    if (existingWithPrefix.length === 0) {
      return `${prefix}001`;
    }
    
    // Find the highest sequence number
    let maxSequence = 0;
    existingWithPrefix.forEach(c => {
      const parts = c.masterId.split('-');
      if (parts.length === 2) {
        const seq = parseInt(parts[1], 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    });
    
    // Generate next sequence number with 3-digit padding
    const nextSeq = (maxSequence + 1).toString().padStart(3, '0');
    return `${prefix}${nextSeq}`;
  };
  
  // Start adding a new certificate - adds a new row at the end
  const handleAddNew = () => {
    if (activeTab !== "master") return;
    
    setNewEntryData({
      category: "",
      group: "",
      certificateName: "",
      requirementRef: "",
      applicableToCompany: false,
      certificateLabel: "",
    });
    setNewEntryError("");
    setIsAddingNew(true);
  };
  
  // Save the new certificate entry
  const saveNewEntry = () => {
    // Validate mandatory fields
    if (!newEntryData.category || !newEntryData.group) {
      setNewEntryError("Category and Group are mandatory");
      return;
    }
    
    if (!newEntryData.certificateName?.trim()) {
      setNewEntryError("Certificate Name is mandatory");
      return;
    }
    
    // Generate Master ID
    const masterId = generateMasterId(newEntryData.category, newEntryData.group);
    
    // Generate new ID and sequence (add to end)
    const newId = Math.max(...masterData.map(c => c.id), 0) + 1;
    const newSequence = masterData.length + 1;
    
    const newCert: MasterCertificate = {
      id: newId,
      sequence: newSequence,
      masterId,
      certificateName: newEntryData.certificateName?.trim() || "",
      category: newEntryData.category,
      group: newEntryData.group,
      requirementRef: newEntryData.requirementRef || "",
      applicableToCompany: newEntryData.applicableToCompany || false,
      certificateLabel: newEntryData.certificateLabel || "",
    };
    
    setMasterData(prev => [...prev, newCert]);
    setIsAddingNew(false);
    setNewEntryError("");
    
    // Show reorder confirmation dialog
    setPendingNewEntryId(newId);
    setShowReorderConfirm(true);
  };
  
  // Cancel adding new entry
  const cancelNewEntry = () => {
    setIsAddingNew(false);
    setNewEntryData({
      category: "",
      group: "",
      certificateName: "",
      requirementRef: "",
      applicableToCompany: false,
      certificateLabel: "",
    });
    setNewEntryError("");
  };
  
  // Update master certificate fields in state
  const updateMasterField = (certId: number, field: keyof MasterCertificate, value: any) => {
    setMasterData(prev => prev.map(cert => 
      cert.id === certId ? { ...cert, [field]: value } : cert
    ));
  };
  
  // Handle applicableToCompany checkbox toggle - auto-populate label with certificate name
  const handleApplicableToCompanyChange = (certId: number, checked: boolean) => {
    setMasterData(prev => prev.map(cert => {
      if (cert.id !== certId) return cert;
      return {
        ...cert,
        applicableToCompany: checked,
        // Auto-populate Certificate Label with Certificate Name when checked (only if label is empty)
        certificateLabel: checked && !cert.certificateLabel ? cert.certificateName : cert.certificateLabel
      };
    }));
  };
  
  // Reorder the newly added certificate to the end of its Category+Group section
  const reorderToGroupSection = () => {
    if (pendingNewEntryId === null) return;
    
    const newEntry = masterData.find(c => c.id === pendingNewEntryId);
    if (!newEntry) return;
    
    // Find the last certificate in the same Category+Group section
    const sameSectionCerts = masterData
      .filter(c => c.category === newEntry.category && c.group === newEntry.group && c.id !== newEntry.id)
      .sort((a, b) => a.sequence - b.sequence);
    
    if (sameSectionCerts.length > 0) {
      const lastInSection = sameSectionCerts[sameSectionCerts.length - 1];
      const targetSequence = lastInSection.sequence + 1;
      
      // Only reorder if not already at the target position
      if (newEntry.sequence !== targetSequence) {
        updateMasterSequence(newEntry.id, targetSequence);
      }
    }
    
    setShowReorderConfirm(false);
    setPendingNewEntryId(null);
  };
  
  // Skip reordering - keep at end
  const skipReorder = () => {
    setShowReorderConfirm(false);
    setPendingNewEntryId(null);
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
    const filteredData = sortedMasterData.filter(cert => {
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
                  <th className="px-3 py-3 text-center font-medium w-20">Sequence</th>
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
                    <td className="px-3 py-3 text-sm text-center">
                      {viewModes.master === "edit" ? (
                        <Input
                          key={`seq-${cert.id}-${cert.sequence}`}
                          type="number"
                          defaultValue={cert.sequence}
                          className="h-8 text-sm w-16 text-center"
                          min={1}
                          onBlur={(e) => {
                            const newSeq = parseInt(e.target.value, 10);
                            if (!isNaN(newSeq) && newSeq > 0) {
                              updateMasterSequence(cert.id, newSeq);
                            }
                          }}
                          data-testid={`input-sequence-${cert.id}`}
                        />
                      ) : (
                        cert.sequence
                      )}
                    </td>
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
                          checked={cert.applicableToCompany}
                          onCheckedChange={(checked) => handleApplicableToCompanyChange(cert.id, !!checked)}
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
                          value={cert.certificateLabel} 
                          onChange={(e) => updateMasterField(cert.id, 'certificateLabel', e.target.value)}
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
                {/* New Entry Row */}
                {viewModes.master === "edit" && isAddingNew && (
                  <tr className="bg-green-50 border-2 border-green-300">
                    <td className="px-3 py-3 text-sm text-center text-muted-foreground">
                      {masterData.length + 1}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{masterData.length + 1}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground italic">
                      {newEntryData.category && newEntryData.group 
                        ? generateMasterId(newEntryData.category, newEntryData.group)
                        : "(Auto-generated)"}
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        className="h-8 text-sm" 
                        placeholder="Certificate Name *"
                        value={newEntryData.certificateName || ""}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setNewEntryData(prev => ({ 
                            ...prev, 
                            certificateName: newName,
                            // Sync label with name if applicable is checked and label is empty or matches previous name
                            certificateLabel: prev.applicableToCompany && (!prev.certificateLabel || prev.certificateLabel === prev.certificateName) 
                              ? newName 
                              : prev.certificateLabel
                          }));
                        }}
                        data-testid="input-new-certname"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Select 
                        value={newEntryData.category || ""} 
                        onValueChange={(val) => setNewEntryData(prev => ({ ...prev, category: val }))}
                      >
                        <SelectTrigger className={cn("h-8 text-sm", !newEntryData.category && "border-red-300")} data-testid="select-new-category">
                          <SelectValue placeholder="Select *" />
                        </SelectTrigger>
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
                      <Select 
                        value={newEntryData.group || ""} 
                        onValueChange={(val) => setNewEntryData(prev => ({ ...prev, group: val }))}
                      >
                        <SelectTrigger className={cn("h-8 text-sm", !newEntryData.group && "border-red-300")} data-testid="select-new-group">
                          <SelectValue placeholder="Select *" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterGroupLabels.map((grp: LabelConfig) => (
                            <SelectItem key={grp.key} value={grp.key}>
                              {getFormattedMasterGroupLabel(grp.key)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        className="h-8 text-sm" 
                        placeholder="Requirement/Ref"
                        value={newEntryData.requirementRef || ""}
                        onChange={(e) => setNewEntryData(prev => ({ ...prev, requirementRef: e.target.value }))}
                        data-testid="input-new-requirement"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Checkbox 
                        checked={newEntryData.applicableToCompany || false}
                        onCheckedChange={(checked) => {
                          const isChecked = !!checked;
                          setNewEntryData(prev => ({ 
                            ...prev, 
                            applicableToCompany: isChecked,
                            // Auto-populate Certificate Label with Certificate Name when checked
                            certificateLabel: isChecked && !prev.certificateLabel ? (prev.certificateName || "") : prev.certificateLabel
                          }));
                        }}
                        data-testid="checkbox-new-applicable"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        className="h-8 text-sm" 
                        placeholder="Certificate Label"
                        value={newEntryData.certificateLabel || ""}
                        onChange={(e) => setNewEntryData(prev => ({ ...prev, certificateLabel: e.target.value }))}
                        data-testid="input-new-label"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-green-600" 
                          onClick={saveNewEntry}
                          data-testid="button-save-new"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive"
                          onClick={cancelNewEntry}
                          data-testid="button-cancel-new"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {/* Show error message if validation fails */}
                {viewModes.master === "edit" && isAddingNew && newEntryError && (
                  <tr>
                    <td colSpan={10} className="px-3 py-2 text-sm text-red-600 bg-red-50">
                      {newEntryError}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCompanyTab = () => {
    // Derive company data from Master tab - only certificates with applicableToCompany checked
    const companyDataFromMaster = masterData
      .filter((cert: MasterCertificate) => cert.applicableToCompany)
      .map((cert: MasterCertificate, idx: number) => ({
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
            
            {currentViewMode === "edit" && activeTab === "master" && (
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={handleAddNew}
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

      {/* Reorder Confirmation Dialog */}
      <Dialog open={showReorderConfirm} onOpenChange={setShowReorderConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Certificate</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              The new certificate has been added at the end of the table. Would you like to move it to the end of its Category+Group section for better organization?
            </p>
          </DialogHeader>
          
          {pendingNewEntryId && (() => {
            const entry = masterData.find(c => c.id === pendingNewEntryId);
            if (entry) {
              return (
                <div className="py-4 space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Master ID:</span>{" "}
                    <span className="font-medium text-blue-600">{entry.masterId}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Certificate:</span>{" "}
                    <span className="font-medium">{entry.certificateName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <span className="font-medium">{getFormattedMasterCategoryLabel(entry.category)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Group:</span>{" "}
                    <span className="font-medium">{getFormattedMasterGroupLabel(entry.group)}</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={skipReorder} data-testid="button-skip-reorder">
              No, Keep at End
            </Button>
            <Button onClick={reorderToGroupSection} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-reorder">
              Yes, Reorder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
