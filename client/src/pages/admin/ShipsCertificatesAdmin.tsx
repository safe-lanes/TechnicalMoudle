import { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Search, Save, X, ChevronUp, ChevronDown, Loader2, Check, ChevronsUpDown, Ship, Undo2 } from "lucide-react";
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
  isSystemDefined?: boolean;
  companyId?: string;
  companyGroup?: string;
  companySequence?: number;
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

const categories = ["All Categories", "Statutory", "Trading", "Class"];
const groups = ["All Groups", "Safety", "Environment", "Cargo", "Navigation"];
const companyGroups = ["A. Statutory", "B. Trading", "C. Class", "D. Other"];

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
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [vesselPopoverOpen, setVesselPopoverOpen] = useState(false);
  
  // Master data state with sequence management
  const [masterData, setMasterData] = useState<MasterCertificate[]>(STARTER_KIT_MASTER_DATA);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deletedMasterIds, setDeletedMasterIds] = useState<string[]>([]);
  
  // Track if save was performed (to show Exit instead of Cancel)
  const [hasSavedInSession, setHasSavedInSession] = useState<Record<string, boolean>>({
    master: false,
    company: false,
    vessel: false,
  });
  
  // Fetch saved certificates from database
  const { data: savedCertificates, isLoading: isLoadingCertificates } = useQuery({
    queryKey: ['/technical/api/admin/ship-certificates-master'],
  });
  
  // Fetch vessels from Vessel Master (Admin > Masters > Vessel Master ID:001)
  // Uses the external API via useVessels hook which maps vessel data correctly
  const { data: vesselMasterData = [], isLoading: isLoadingVessels } = useVessels();
  
  // Extract vessel names for the dropdown
  const vesselOptions = vesselMasterData.map(v => v.name).filter(Boolean);
  
  // Toggle vessel selection
  const toggleVesselSelection = (vesselName: string) => {
    setSelectedVessels(prev => 
      prev.includes(vesselName)
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName]
    );
  };
  
  // Toggle all vessels
  const toggleAllVessels = () => {
    if (selectedVessels.length === vesselOptions.length) {
      setSelectedVessels([]);
    } else {
      setSelectedVessels([...vesselOptions]);
    }
  };
  
  // Note: Vessels are not auto-selected on load - user must select vessels to see certificate configuration
  
  // Load saved certificates from database on mount
  useEffect(() => {
    if (savedCertificates && Array.isArray(savedCertificates) && savedCertificates.length > 0) {
      const masterRecords: MasterCertificate[] = [];
      const companyRecords: CompanyCertificate[] = [];
      const vesselRecords: VesselCertificate[] = [];

      for (const cert of savedCertificates) {
        const masterId = cert.masterId || cert.master_id;
        const storedCompanyId = cert.companyId || cert.company_id;
        const category = cert.category;

        if (category === 'Company') {
          companyRecords.push({
            id: cert.id,
            masterId: masterId,
            companyId: storedCompanyId || "",
            certificateLabel: cert.certificateLabel || cert.certificate_label || "",
            requirementRef: cert.requirementRef || cert.requirement_ref || "",
            companyGroup: cert.companyGroup || cert.company_group || "",
            ranking: "-",
          });
        } else if (category === 'Vessel') {
          vesselRecords.push({
            id: cert.id,
            masterId: masterId,
            companyId: storedCompanyId || "",
            certificateLabel: cert.certificateLabel || cert.certificate_label || "",
            requirementRef: cert.requirementRef || cert.requirement_ref || "",
            companyGroup: cert.companyGroup || cert.company_group || "",
            applicable: true,
          });
        } else {
          masterRecords.push({
            id: cert.id,
            sequence: cert.sequence,
            masterId,
            certificateName: cert.certificateName || cert.certificate_name,
            category,
            group: cert.group,
            requirementRef: cert.requirementRef || cert.requirement_ref || "",
            applicableToCompany: cert.applicableToCompany || cert.applicable_to_company || false,
            certificateLabel: cert.certificateLabel || cert.certificate_label || "",
            isSystemDefined: cert.isSystemDefined || cert.is_system_defined || false,
            companyId: storedCompanyId || ("C" + masterId),
            companyGroup: cert.companyGroup || cert.company_group || "",
            companySequence: cert.companySequence || cert.company_sequence || undefined,
          });
        }
      }

      setMasterData(masterRecords);
      setCompanyOnlyCerts(companyRecords);
      setVesselOnlyCerts(vesselRecords);
      setHasUnsavedChanges(false);
    }
  }, [savedCertificates]);
  
  // Save certificates mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: { 
      certificates: MasterCertificate[]; 
      deletedMasterIds?: string[];
      vesselSpecificCerts?: string[];
      targetVessels?: Array<{ id: string; name: string }>;
    }) => {
      const response = await apiRequest('POST', '/technical/api/admin/ship-certificates-master', payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Saved successfully",
        description: `${data.inserted || 0} new certificates added, ${data.updated || 0} updated${data.deleted ? `, ${data.deleted} deleted` : ''}`,
      });
      setHasUnsavedChanges(false);
      setDeletedMasterIds([]);
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: true }));
      setCompanyOnlyCerts([]);
      setVesselOnlyCerts([]);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-certificates-master'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-certificate-applicability'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save certificates",
        variant: "destructive",
      });
    },
  });
  
  // Load labels configuration from database
  const { data: savedLabels } = useQuery<Record<string, Array<{key: string, label: string}>>>({
    queryKey: ['/technical/api/admin/ship-certificates-labels'],
  });
  
  // Save labels mutation
  const saveLabelsMutation = useMutation({
    mutationFn: async ({ configType, labels }: { configType: string, labels: LabelConfig[] }) => {
      const response = await apiRequest('POST', '/technical/api/admin/ship-certificates-labels', { configType, labels });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/ship-certificates-labels'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save labels",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  const deleteCertificateRow = (id: number) => {
    const cert = masterData.find(c => c.id === id);
    if (!cert || cert.isSystemDefined) return;
    if (cert.masterId) {
      setDeletedMasterIds(prev => [...prev, cert.masterId]);
    }
    setHasUnsavedChanges(true);
  };

  const undoDeleteRow = (masterId: string) => {
    setDeletedMasterIds(prev => prev.filter(id => id !== masterId));
    if (deletedMasterIds.length <= 1) {
      setHasUnsavedChanges(masterData.some(c => c.isSystemDefined === false));
    }
  };

  // Handle save button click
  const handleSave = () => {
    // Find the highest existing VES- sequence number from both masterData and vesselOnlyCerts
    let maxVesSeq = 0;
    for (const cert of masterData) {
      const vesMatch = cert.masterId.match(/^VES-(\d+)$/);
      if (vesMatch) {
        const seq = parseInt(vesMatch[1], 10);
        if (seq > maxVesSeq) maxVesSeq = seq;
      }
    }
    for (const cert of vesselOnlyCerts) {
      const vesMatch = cert.masterId.match(/^VES-(\d+)$/);
      if (vesMatch) {
        const seq = parseInt(vesMatch[1], 10);
        if (seq > maxVesSeq) maxVesSeq = seq;
      }
    }

    // Find the highest existing CMP- sequence number from both masterData and companyOnlyCerts
    let maxCmpSeq = 0;
    for (const cert of masterData) {
      const cmpMatch = cert.masterId.match(/^CMP-(\d+)$/);
      if (cmpMatch) {
        const seq = parseInt(cmpMatch[1], 10);
        if (seq > maxCmpSeq) maxCmpSeq = seq;
      }
    }
    for (const cert of companyOnlyCerts) {
      const cmpMatch = cert.masterId.match(/^CMP-(\d+)$/);
      if (cmpMatch) {
        const seq = parseInt(cmpMatch[1], 10);
        if (seq > maxCmpSeq) maxCmpSeq = seq;
      }
    }

    // Convert new company-only certificates (ones without CMP- masterId) to save format
    let nextCmpSeq = maxCmpSeq + 1;
    const companyCertsForSave: MasterCertificate[] = companyOnlyCerts.map((cert, idx) => {
      const hasCmpId = /^CMP-\d+$/.test(cert.masterId);
      const newMasterId = hasCmpId ? cert.masterId : `CMP-${String(nextCmpSeq++).padStart(3, '0')}`;

      return {
        id: cert.id,
        sequence: masterData.length + idx + 1,
        masterId: newMasterId,
        certificateName: cert.certificateLabel,
        category: 'Company',
        group: cert.companyGroup || 'Company Specific',
        requirementRef: cert.requirementRef || '',
        applicableToCompany: true,
        certificateLabel: cert.certificateLabel,
        isActive: true,
        companyId: cert.companyId || newMasterId.replace('CMP-', 'CV'),
        companyGroup: cert.companyGroup || '',
        companySequence: masterData.length + idx + 1,
      };
    });
    
    // Convert vessel-only certificates to master format with VES- IDs
    let nextVesSeq = maxVesSeq + 1;
    const baseSequence = masterData.length + companyCertsForSave.length;
    const vesselOnlyCertsWithIds: MasterCertificate[] = vesselOnlyCerts.map((cert, idx) => {
      const hasVesId = /^VES-\d+$/.test(cert.masterId);
      const newMasterId = hasVesId ? cert.masterId : `VES-${String(nextVesSeq++).padStart(3, '0')}`;
      
      return {
        id: cert.id,
        sequence: baseSequence + idx + 1,
        masterId: newMasterId,
        certificateName: cert.certificateLabel,
        category: 'Vessel',
        group: cert.companyGroup || 'Vessel Specific',
        requirementRef: cert.requirementRef || '',
        applicableToCompany: true,
        certificateLabel: cert.certificateLabel,
        isActive: true,
        companyId: cert.companyId || newMasterId.replace('VES-', 'VV'),
        companyGroup: cert.companyGroup || '',
        companySequence: baseSequence + idx + 1,
      };
    });
    
    // Send Master data + Company certs + Vessel certs as separate items but in one payload
    // Company certs have category='Company' — on reload they route to companyOnlyCerts, not masterData
    const deletedSet = new Set(deletedMasterIds);
    const allCertificates = [...masterData.filter(c => !deletedSet.has(c.masterId)), ...companyCertsForSave, ...vesselOnlyCertsWithIds];
    
    // Get selected vessel info (ID and name) for vessel-specific certificate applicability
    const targetVessels = vesselMasterData
      .filter(v => selectedVessels.includes(v.name))
      .map(v => ({ id: String(v.id), name: v.name }));
    const vesselMasterIds = vesselOnlyCertsWithIds.map(c => c.masterId);
    
    saveMutation.mutate({ 
      certificates: allCertificates,
      deletedMasterIds: deletedMasterIds.length > 0 ? deletedMasterIds : undefined,
      vesselSpecificCerts: vesselMasterIds,
      targetVessels: targetVessels,
    });
  };
  
  // Load labels from database when available
  useEffect(() => {
    if (savedLabels) {
      if (savedLabels.master_category && savedLabels.master_category.length > 0) {
        setMasterCategoryLabels(savedLabels.master_category);
      }
      if (savedLabels.master_group && savedLabels.master_group.length > 0) {
        setMasterGroupLabels(savedLabels.master_group);
      }
      if (savedLabels.company_group && savedLabels.company_group.length > 0) {
        setCompanyGroupLabels(savedLabels.company_group);
      }
    }
  }, [savedLabels]);

  // ========== VESSEL CERTIFICATE APPLICABILITY ==========
  
  // Get selected vessel IDs for API calls
  const getSelectedVesselIds = () => {
    return vesselMasterData
      .filter(v => selectedVessels.includes(v.name))
      .map(v => String(v.id));
  };
  
  // Fetch vessel certificate applicability for selected vessels
  const selectedVesselIds = vesselMasterData
    .filter(v => selectedVessels.includes(v.name))
    .map(v => String(v.id));
  
  const vesselIdsQueryParam = selectedVesselIds.join(',');
  
  const { data: vesselApplicabilityData = [], isLoading: isLoadingApplicability, refetch: refetchApplicability } = useQuery<Array<{vesselId: string, masterId: string, isApplicable: boolean}>>({
    queryKey: ['/technical/api/admin/vessel-certificate-applicability', vesselIdsQueryParam],
    queryFn: async () => {
      if (selectedVesselIds.length === 0) return [];
      const response = await fetch(`/technical/api/admin/vessel-certificate-applicability?vesselIds=${vesselIdsQueryParam}`);
      if (!response.ok) throw new Error('Failed to fetch applicability');
      return response.json();
    },
    enabled: selectedVesselIds.length > 0,
  });
  
  // Initialize vessel applicability mutation
  const initializeVesselMutation = useMutation({
    mutationFn: async ({ vesselId, vesselName }: { vesselId: string, vesselName: string }) => {
      const response = await apiRequest('POST', '/technical/api/admin/vessel-certificate-applicability/initialize', { vesselId, vesselName });
      return response.json();
    },
    onSuccess: () => {
      refetchApplicability();
    },
    onError: (error: any, variables: { vesselId: string, vesselName: string }) => {
      // Remove from initialized set to allow retry
      setInitializedVesselIds(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(variables.vesselId);
        return newSet;
      });
      toast({
        title: "Initialization failed",
        description: `Failed to initialize certificates for ${variables.vesselName}`,
        variant: "destructive",
      });
    },
  });
  
  // Update single applicability mutation
  const updateApplicabilityMutation = useMutation({
    mutationFn: async ({ vesselId, vesselName, masterId, isApplicable }: { vesselId: string, vesselName: string, masterId: string, isApplicable: boolean }) => {
      const response = await apiRequest('PATCH', '/technical/api/admin/vessel-certificate-applicability', { vesselId, vesselName, masterId, isApplicable });
      return response.json();
    },
    onSuccess: () => {
      refetchApplicability();
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update applicability",
        variant: "destructive",
      });
    },
  });
  
  // Bulk update applicability mutation
  const bulkUpdateApplicabilityMutation = useMutation({
    mutationFn: async ({ vessels, masterId, isApplicable }: { vessels: Array<{id: string, name: string}>, masterId: string, isApplicable: boolean }) => {
      const response = await apiRequest('POST', '/technical/api/admin/vessel-certificate-applicability/bulk-update', { vessels, masterId, isApplicable });
      return response.json();
    },
    onSuccess: () => {
      refetchApplicability();
    },
    onError: (error: any) => {
      toast({
        title: "Bulk update failed",
        description: error.message || "Failed to update applicability for multiple vessels",
        variant: "destructive",
      });
    },
  });
  
  // Track vessels that have been initialized to prevent duplicate requests
  const [initializedVesselIds, setInitializedVesselIds] = useState<Set<string>>(new Set());
  
  // Initialize selected vessels when they are first selected
  useEffect(() => {
    if (selectedVessels.length > 0 && vesselMasterData.length > 0 && !isLoadingApplicability) {
      const existingVesselIds = new Set(vesselApplicabilityData.map((a: {vesselId: string}) => a.vesselId));
      
      // Find vessels that need initialization (not in DB and not already being initialized)
      selectedVessels.forEach(vesselName => {
        const vesselData = vesselMasterData.find(v => v.name === vesselName);
        if (vesselData) {
          const vesselId = String(vesselData.id);
          const needsInit = !existingVesselIds.has(vesselId) && !initializedVesselIds.has(vesselId);
          
          if (needsInit) {
            // Mark as being initialized to prevent duplicate requests
            setInitializedVesselIds(prev => new Set(Array.from(prev).concat([vesselId])));
            initializeVesselMutation.mutate({ vesselId, vesselName });
          }
        }
      });
    }
  }, [selectedVessels, vesselMasterData, vesselApplicabilityData, isLoadingApplicability, initializedVesselIds]);
  
  // Get Company certificates (those with applicableToCompany = true)
  // For VES-xxx certificates, only show if selected vessels have applicability records
  const companyCertificates = masterData.filter(cert => {
    if (!cert.applicableToCompany) return false;
    
    // For vessel-specific certificates (VES-xxx), only show if at least one selected vessel has an applicability record
    if (cert.masterId.startsWith('VES-')) {
      const vesselIds = getSelectedVesselIds();
      if (vesselIds.length === 0) return false;
      
      // Check if any selected vessel has an applicability record for this VES- certificate
      return vesselIds.some(vesselId => 
        vesselApplicabilityData.some((a: any) => a.vesselId === vesselId && a.masterId === cert.masterId)
      );
    }
    
    // Non-VES certificates (CMP-, category-based Master certs) show for all vessels
    return true;
  });
  
  // Check for conflicts when multiple vessels are selected
  const hasApplicabilityConflict = (): { hasConflict: boolean, conflictingMasterIds: string[] } => {
    if (selectedVessels.length <= 1) return { hasConflict: false, conflictingMasterIds: [] };
    
    const vesselIds = getSelectedVesselIds();
    const conflictingMasterIds: string[] = [];
    
    // For each company certificate, check if all selected vessels have the same applicability
    companyCertificates.forEach(cert => {
      const applicabilityValues = vesselIds.map(vesselId => {
        const record = vesselApplicabilityData.find((a: any) => a.vesselId === vesselId && a.masterId === cert.masterId);
        return record ? record.isApplicable : true; // Default to true if not yet initialized
      });
      
      // Check if all values are the same
      const allSame = applicabilityValues.every(val => val === applicabilityValues[0]);
      if (!allSame) {
        conflictingMasterIds.push(cert.masterId);
      }
    });
    
    return { hasConflict: conflictingMasterIds.length > 0, conflictingMasterIds };
  };
  
  const conflictCheck = hasApplicabilityConflict();
  
  // Get applicability for a certificate (considering multi-vessel selection)
  const getCertificateApplicability = (masterId: string): boolean | 'mixed' => {
    const vesselIds = getSelectedVesselIds();
    
    if (vesselIds.length === 0) return true;
    
    const applicabilityValues = vesselIds.map(vesselId => {
      const record = vesselApplicabilityData.find((a: any) => a.vesselId === vesselId && a.masterId === masterId);
      return record ? record.isApplicable : true; // Default to true
    });
    
    const allTrue = applicabilityValues.every(val => val === true);
    const allFalse = applicabilityValues.every(val => val === false);
    
    if (allTrue) return true;
    if (allFalse) return false;
    return 'mixed';
  };
  
  // Handle applicability checkbox change
  const handleApplicabilityChange = (masterId: string, isApplicable: boolean) => {
    const vesselIds = getSelectedVesselIds();
    
    if (vesselIds.length === 1) {
      // Single vessel update
      const vesselId = vesselIds[0];
      const vesselName = selectedVessels[0];
      updateApplicabilityMutation.mutate({ vesselId, vesselName, masterId, isApplicable });
    } else {
      // Multi-vessel bulk update
      const vessels = selectedVessels.map(name => {
        const vesselData = vesselMasterData.find(v => v.name === name);
        return { id: String(vesselData?.id || ''), name };
      });
      bulkUpdateApplicabilityMutation.mutate({ vessels, masterId, isApplicable });
    }
  };
  
  // Track changes to master data
  const updateMasterDataWithTracking = (updater: (prev: MasterCertificate[]) => MasterCertificate[]) => {
    setMasterData(prev => {
      const newData = updater(prev);
      setHasUnsavedChanges(true);
      return newData;
    });
  };
  
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
  
  // Company sequence overrides - stores { certId: sequence } for independent Company sequences
  const [companySequences, setCompanySequences] = useState<Record<number, number>>({});
  
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
  
  // Company-specific certificates (not derived from Master)
  const [companyOnlyCerts, setCompanyOnlyCerts] = useState<CompanyCertificate[]>([]);
  const [isAddingNewCompany, setIsAddingNewCompany] = useState(false);
  const [newCompanyEntryData, setNewCompanyEntryData] = useState<Partial<CompanyCertificate>>({
    companyId: "",
    certificateLabel: "",
    requirementRef: "",
    companyGroup: "",
  });
  const [newCompanyEntryError, setNewCompanyEntryError] = useState("");
  
  // Vessel-specific certificates (not derived from Company)
  const [vesselOnlyCerts, setVesselOnlyCerts] = useState<VesselCertificate[]>([]);
  const [isAddingNewVessel, setIsAddingNewVessel] = useState(false);
  const [newVesselEntryData, setNewVesselEntryData] = useState<Partial<VesselCertificate>>({
    applicable: true,
    certificateLabel: "",
    requirementRef: "",
    companyGroup: "",
  });
  const [newVesselEntryError, setNewVesselEntryError] = useState("");
  
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
  
  const saveCompanyGroupLabels = async () => {
    setCompanyGroupLabels([...tempCompanyGroupLabels]);
    setIsConfigureLabelsOpen(false);
    
    // Save to database
    try {
      await saveLabelsMutation.mutateAsync({ configType: 'company_group', labels: tempCompanyGroupLabels });
      toast({
        title: "Labels saved",
        description: "Company group labels have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving company labels:", error);
      toast({
        title: "Error saving labels",
        description: "Failed to save company group labels. Please try again.",
        variant: "destructive",
      });
    }
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
  
  const saveMasterLabels = async () => {
    // Update local state
    setMasterCategoryLabels([...tempMasterCategoryLabels]);
    setMasterGroupLabels([...tempMasterGroupLabels]);
    setIsMasterLabelsOpen(false);
    
    // Save to database
    try {
      await saveLabelsMutation.mutateAsync({ configType: 'master_category', labels: tempMasterCategoryLabels });
      await saveLabelsMutation.mutateAsync({ configType: 'master_group', labels: tempMasterGroupLabels });
      toast({
        title: "Labels saved",
        description: "Category and group labels have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving labels:", error);
    }
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
  
  // ===== Company Tab New Entry Functions =====
  const handleAddNewCompany = () => {
    setNewCompanyEntryData({
      companyId: "",
      certificateLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setNewCompanyEntryError("");
    setIsAddingNewCompany(true);
  };
  
  const saveNewCompanyEntry = () => {
    if (!newCompanyEntryData.certificateLabel?.trim()) {
      setNewCompanyEntryError("Certificate Label is mandatory");
      return;
    }
    
    const newId = Math.max(...companyOnlyCerts.map(c => c.id), 0) + 1000;
    
    const newCert: CompanyCertificate = {
      id: newId,
      masterId: "",
      companyId: newCompanyEntryData.companyId || "",
      certificateLabel: newCompanyEntryData.certificateLabel?.trim() || "",
      requirementRef: newCompanyEntryData.requirementRef || "",
      companyGroup: newCompanyEntryData.companyGroup || "",
      ranking: "-",
    };
    
    setCompanyOnlyCerts(prev => [...prev, newCert]);
    setIsAddingNewCompany(false);
    setNewCompanyEntryError("");
    setHasUnsavedChanges(true);
  };
  
  const cancelNewCompanyEntry = () => {
    setIsAddingNewCompany(false);
    setNewCompanyEntryData({
      companyId: "",
      certificateLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setNewCompanyEntryError("");
  };
  
  // ===== Vessel Tab New Entry Functions =====
  const handleAddNewVessel = () => {
    setNewVesselEntryData({
      applicable: true,
      certificateLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setNewVesselEntryError("");
    setIsAddingNewVessel(true);
  };
  
  const saveNewVesselEntry = () => {
    if (!newVesselEntryData.certificateLabel?.trim()) {
      setNewVesselEntryError("Certificate Label is mandatory");
      return;
    }
    
    const newId = Math.max(...vesselOnlyCerts.map(c => c.id), 0) + 2000;
    
    const newCert: VesselCertificate = {
      id: newId,
      masterId: "",
      companyId: "",
      certificateLabel: newVesselEntryData.certificateLabel?.trim() || "",
      requirementRef: newVesselEntryData.requirementRef || "",
      companyGroup: newVesselEntryData.companyGroup || "",
      applicable: newVesselEntryData.applicable ?? true,
    };
    
    setVesselOnlyCerts(prev => [...prev, newCert]);
    setIsAddingNewVessel(false);
    setNewVesselEntryError("");
    setHasUnsavedChanges(true);
  };
  
  const cancelNewVesselEntry = () => {
    setIsAddingNewVessel(false);
    setNewVesselEntryData({
      applicable: true,
      certificateLabel: "",
      requirementRef: "",
      companyGroup: "",
    });
    setNewVesselEntryError("");
  };
  
  // Update master certificate fields in state
  const updateMasterField = (certId: number, field: keyof MasterCertificate, value: any) => {
    setMasterData(prev => prev.map(cert => 
      cert.id === certId ? { ...cert, [field]: value } : cert
    ));
  };
  
  // Handle applicableToCompany checkbox toggle - auto-populate label with certificate name and default companyId
  const handleApplicableToCompanyChange = (certId: number, checked: boolean) => {
    setMasterData(prev => prev.map(cert => {
      if (cert.id !== certId) return cert;
      return {
        ...cert,
        applicableToCompany: checked,
        // Auto-populate Certificate Label with Certificate Name when checked (only if label is empty)
        certificateLabel: checked && !cert.certificateLabel ? cert.certificateName : cert.certificateLabel,
        // Generate default Company ID when checked (if not already set)
        companyId: checked && !cert.companyId ? ("C" + cert.masterId) : cert.companyId,
      };
    }));
    setHasUnsavedChanges(true);
  };
  
  // Handle Select All toggle for applicableToCompany - applies to filtered certificates only
  const handleSelectAllApplicable = (filteredIds: number[], checked: boolean) => {
    setMasterData(prev => prev.map(cert => {
      if (!filteredIds.includes(cert.id)) return cert;
      return {
        ...cert,
        applicableToCompany: checked,
        // Auto-populate Certificate Label with Certificate Name when checked (only if label is empty)
        certificateLabel: checked && !cert.certificateLabel ? cert.certificateName : cert.certificateLabel
      };
    }));
    setHasUnsavedChanges(true);
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
    const isEnteringEdit = viewModes[activeTab] === "view";
    setViewModes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] === "view" ? "edit" : "view"
    }));
    // Reset hasSavedInSession when entering Edit mode
    if (isEnteringEdit) {
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: false }));
    }
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
            <SelectTrigger className="w-[180px]" data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              {MASTER_CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat} value={cat}>{getFormattedMasterCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[180px]" data-testid="select-group">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Groups">All Groups</SelectItem>
              {MASTER_GROUP_OPTIONS.map((grp) => (
                <SelectItem key={grp} value={grp}>{getFormattedMasterGroupLabel(grp)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden flex-1">
          {filteredData.length === 0 && !isAddingNew ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400">
              <p className="text-lg mb-2">No Certificates Configured</p>
              <p className="text-sm">Click "Edit" and then "+ New" to add your first certificate</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#52baf3] text-white text-sm">
                <tr>
                  {viewModes.master === "edit" && (
                    <th className="px-3 py-3 text-center font-medium w-20">Sequence</th>
                  )}
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Name</th>
                  <th className="px-3 py-3 text-left font-medium">Category</th>
                  <th className="px-3 py-3 text-left font-medium">Group</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                  <th className="px-3 py-3 text-center font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <span>Applicable to Company</span>
                      {viewModes.master === "edit" && (() => {
                        const allChecked = filteredData.length > 0 && filteredData.every(c => c.applicableToCompany);
                        const someChecked = filteredData.some(c => c.applicableToCompany);
                        const isIndeterminate = someChecked && !allChecked;
                        return (
                          <Checkbox
                            checked={isIndeterminate ? "indeterminate" : allChecked}
                            disabled={filteredData.length === 0}
                            onCheckedChange={(checked) => {
                              const filteredIds = filteredData.map(c => c.id);
                              handleSelectAllApplicable(filteredIds, checked === true || checked === "indeterminate" ? !allChecked : true);
                            }}
                            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#52baf3] data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-[#52baf3]"
                            data-testid="checkbox-select-all-applicable"
                          />
                        );
                      })()}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
                  {viewModes.master === "edit" && (
                    <th className="px-3 py-3 text-center font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((cert, idx) => {
                  const isPendingDelete = deletedMasterIds.includes(cert.masterId);
                  return (
                  <tr key={cert.id} className={cn("hover:bg-gray-50", isPendingDelete && "bg-red-50 opacity-60")}>
                    {viewModes.master === "edit" && (
                      <td className="px-3 py-3 text-sm text-center">
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
                      </td>
                    )}
                    <td className={cn("px-3 py-3 text-sm", isPendingDelete && "line-through")}>{idx + 1}</td>
                    <td className={cn("px-3 py-3 text-sm font-medium text-blue-600", isPendingDelete && "line-through")}>{cert.masterId}</td>
                    <td className={cn("px-3 py-3 text-sm", isPendingDelete && "line-through")}>{cert.certificateName}</td>
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
                          {isPendingDelete ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => undoDeleteRow(cert.masterId)} data-testid={`button-undo-delete-${cert.id}`} title="Undo deletion">
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          ) : cert.isSystemDefined ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground opacity-30 cursor-not-allowed" disabled data-testid={`button-delete-disabled-${cert.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteCertificateRow(cert.id)} data-testid={`button-delete-${cert.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )})}
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
          )}
        </div>
      </div>
    );
  };

  // Handler to update company-specific fields in masterData
  const updateCompanyField = (certId: number, field: 'companyId' | 'companyGroup' | 'companySequence', value: string | number) => {
    setMasterData(prev => prev.map(cert => 
      cert.id === certId 
        ? { ...cert, [field]: value }
        : cert
    ));
    setHasUnsavedChanges(true);
  };

  // Handler for Company tab sequence reordering - mirrors updateMasterSequence logic
  const updateCompanySequence = (certId: number, newSequence: number) => {
    setMasterData(prevData => {
      // Get only certificates applicable to Company tab
      const companyCerts = prevData.filter(c => c.applicableToCompany);
      const currentCert = companyCerts.find(c => c.id === certId);
      if (!currentCert) return prevData;

      const oldSequence = currentCert.companySequence ?? currentCert.sequence;
      if (newSequence === oldSequence) return prevData;

      // Get IDs of certificates in Company tab
      const companyIds = new Set(companyCerts.map(c => c.id));

      // First, ensure all company certs have companySequence initialized
      // Then apply the reordering logic
      return prevData.map(c => {
        // Only affect Company-applicable certificates
        if (!companyIds.has(c.id)) return c;

        // Get the effective sequence for this cert
        const certOldSeq = c.companySequence ?? c.sequence;

        if (c.id === certId) {
          return { ...c, companySequence: newSequence };
        }

        // Moving up (e.g., 4 → 2): shift items in [newSequence, oldSequence-1] down by 1
        if (newSequence < oldSequence) {
          if (certOldSeq >= newSequence && certOldSeq < oldSequence) {
            return { ...c, companySequence: certOldSeq + 1 };
          }
        }
        // Moving down (e.g., 1 → 4): shift items in [oldSequence+1, newSequence] up by 1
        else {
          if (certOldSeq > oldSequence && certOldSeq <= newSequence) {
            return { ...c, companySequence: certOldSeq - 1 };
          }
        }

        // If not in the shift range, still initialize companySequence to its current effective value
        // to ensure consistency for future reordering operations
        if (c.companySequence === undefined) {
          return { ...c, companySequence: certOldSeq };
        }

        return c;
      });
    });
    setHasUnsavedChanges(true);
  };

  const renderCompanyTab = () => {
    // Derive company data from Master tab - only certificates with applicableToCompany checked
    const companyDataFromMaster = masterData
      .filter((cert: MasterCertificate) => cert.applicableToCompany)
      .map((cert: MasterCertificate, idx: number) => ({
        id: cert.id,
        masterId: cert.masterId,
        certificateLabel: cert.certificateLabel,
        // Use stored companyId if exists, otherwise default to "C" + Master ID
        companyId: cert.companyId || ("C" + cert.masterId),
        requirementRef: cert.requirementRef, // Pre-filled from Master, but editable
        // Use stored companyGroup if exists
        companyGroup: cert.companyGroup || "",
        // Use stored companySequence if exists, or fall back to companySequences state, or inherit from Master
        sequence: cert.companySequence ?? companySequences[cert.id] ?? cert.sequence,
      }));

    const sortedCompanyData = [...companyDataFromMaster].sort((a, b) => a.sequence - b.sequence);

    const filteredData = sortedCompanyData.filter(cert => {
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
              placeholder="Search Certificate"
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
                  {viewModes.company === "edit" && (
                    <th className="px-3 py-3 text-center font-medium w-20">Sequence</th>
                  )}
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Company ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
                  <th className="px-3 py-3 text-left font-medium">Requirement/Ref</th>
                  <th className="px-3 py-3 text-left font-medium">Company Group</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((cert, idx) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    {viewModes.company === "edit" && (
                      <td className="px-3 py-3 text-sm text-center">
                        <Input
                          key={`seq-company-${cert.id}-${cert.sequence}`}
                          type="number"
                          defaultValue={cert.sequence}
                          className="h-8 text-sm w-16 text-center"
                          min={1}
                          onBlur={(e) => {
                            const newSeq = parseInt(e.target.value, 10);
                            if (!isNaN(newSeq) && newSeq > 0) {
                              updateCompanySequence(cert.id, newSeq);
                            }
                          }}
                          data-testid={`input-sequence-company-${cert.id}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 text-sm">{idx + 1}</td>
                    <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId}</td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.companyId}
                          className="h-8 text-sm"
                          placeholder=""
                          onBlur={(e) => updateCompanyField(cert.id, 'companyId', e.target.value)}
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
                        <Select 
                          defaultValue={cert.companyGroup}
                          onValueChange={(value) => updateCompanyField(cert.id, 'companyGroup', value)}
                        >
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
                        cert.companyGroup ? getFormattedCompanyGroupLabel(cert.companyGroup) : "-"
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Company-only certificates (not from Master) */}
                {companyOnlyCerts.map((cert, idx) => (
                  <tr key={`company-only-${cert.id}`} className="hover:bg-gray-50 bg-green-50">
                    {viewModes.company === "edit" && (
                      <td className="px-3 py-3 text-sm text-center">-</td>
                    )}
                    <td className="px-3 py-3 text-sm">{filteredData.length + idx + 1}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-400">{cert.masterId && /^CMP-/.test(cert.masterId) ? cert.masterId : "-"}</td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.companyId}
                          className="h-8 text-sm"
                          placeholder=""
                          onBlur={(e) => {
                            setCompanyOnlyCerts(prev => prev.map(c => 
                              c.id === cert.id ? { ...c, companyId: e.target.value } : c
                            ));
                          }}
                          data-testid={`input-companyid-only-${cert.id}`}
                        />
                      ) : (
                        cert.companyId || "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.certificateLabel}
                          className="h-8 text-sm"
                          onBlur={(e) => {
                            setCompanyOnlyCerts(prev => prev.map(c => 
                              c.id === cert.id ? { ...c, certificateLabel: e.target.value } : c
                            ));
                          }}
                          data-testid={`input-label-only-${cert.id}`}
                        />
                      ) : (
                        cert.certificateLabel
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Input 
                          defaultValue={cert.requirementRef}
                          className="h-8 text-sm"
                          onBlur={(e) => {
                            setCompanyOnlyCerts(prev => prev.map(c => 
                              c.id === cert.id ? { ...c, requirementRef: e.target.value } : c
                            ));
                          }}
                          data-testid={`input-requirement-only-${cert.id}`}
                        />
                      ) : (
                        cert.requirementRef
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {viewModes.company === "edit" ? (
                        <Select 
                          defaultValue={cert.companyGroup}
                          onValueChange={(value) => {
                            setCompanyOnlyCerts(prev => prev.map(c => 
                              c.id === cert.id ? { ...c, companyGroup: value } : c
                            ));
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-companygroup-only-${cert.id}`}>
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
                        cert.companyGroup ? getFormattedCompanyGroupLabel(cert.companyGroup) : "-"
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* New entry row for Company-specific certificate */}
                {viewModes.company === "edit" && isAddingNewCompany && (
                  <tr className="bg-blue-50">
                    <td className="px-3 py-3 text-sm text-center">-</td>
                    <td className="px-3 py-3 text-sm">New</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-400">-</td>
                    <td className="px-3 py-3 text-sm">
                      <Input 
                        value={newCompanyEntryData.companyId || ""}
                        onChange={(e) => setNewCompanyEntryData(prev => ({ ...prev, companyId: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Company ID"
                        data-testid="input-new-company-id"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <Input 
                        value={newCompanyEntryData.certificateLabel || ""}
                        onChange={(e) => setNewCompanyEntryData(prev => ({ ...prev, certificateLabel: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Certificate Label *"
                        data-testid="input-new-company-label"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <Input 
                        value={newCompanyEntryData.requirementRef || ""}
                        onChange={(e) => setNewCompanyEntryData(prev => ({ ...prev, requirementRef: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Requirement/Ref"
                        data-testid="input-new-company-requirement"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={newCompanyEntryData.companyGroup || ""}
                          onValueChange={(value) => setNewCompanyEntryData(prev => ({ ...prev, companyGroup: value }))}
                        >
                          <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-new-company-group">
                            <SelectValue placeholder="Select Group" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyGroupLabels.map((grp: LabelConfig) => (
                              <SelectItem key={grp.key} value={grp.key}>
                                {getFormattedCompanyGroupLabel(grp.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={saveNewCompanyEntry} className="text-green-600" data-testid="button-save-new-company">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelNewCompanyEntry} className="text-red-600" data-testid="button-cancel-new-company">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* New entry error for Company tab */}
                {viewModes.company === "edit" && isAddingNewCompany && newCompanyEntryError && (
                  <tr>
                    <td colSpan={7} className="px-3 py-2 text-sm text-red-500">{newCompanyEntryError}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderVesselTab = () => {
    // Get display text for selected vessels
    const getVesselDisplayText = () => {
      if (selectedVessels.length === 0) return "Select vessels...";
      if (selectedVessels.length === vesselOptions.length && vesselOptions.length > 0) return "All Vessels";
      if (selectedVessels.length === 1) return selectedVessels[0];
      return `${selectedVessels.length} vessels selected`;
    };
    
    return (
      <div className="space-y-4">
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
                  <span className="truncate">{getVesselDisplayText()}</span>
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
                      vesselOptions.map((vessel) => (
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
                Conflict detected: Selected vessels have different applicability settings for {conflictCheck.conflictingMasterIds.length} certificate(s).
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

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#52baf3] text-white text-sm">
                <tr>
                  <th className="px-3 py-3 text-center font-medium w-12">Applicable</th>
                  <th className="px-3 py-3 text-left font-medium w-12">#</th>
                  <th className="px-3 py-3 text-left font-medium">Master ID</th>
                  <th className="px-3 py-3 text-left font-medium">Company ID</th>
                  <th className="px-3 py-3 text-left font-medium">Certificate Label</th>
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
                        <p className="text-muted-foreground">Select at least one vessel to view certificate configuration</p>
                      </div>
                    </td>
                  </tr>
                ) : isLoadingApplicability ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading certificate configuration...</p>
                      </div>
                    </td>
                  </tr>
                ) : (companyCertificates.length === 0 && companyOnlyCerts.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Ship className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No certificates are marked as applicable to Company. Configure the Company tab first.</p>
                      </div>
                    </td>
                  </tr>
                ) : companyCertificates.map((cert, idx) => {
                  const applicability = getCertificateApplicability(cert.masterId);
                  const isMixed = applicability === 'mixed';
                  const isChecked = applicability === true;
                  const companyGroupLabel = companyGroupLabels.find(g => g.key === cert.companyGroup)?.label || "";
                  const displayCompanyGroup = cert.companyGroup ? `${cert.companyGroup}. ${companyGroupLabel}` : "";
                  
                  return (
                    <tr key={cert.id} className={cn("hover:bg-gray-50", isMixed && "bg-amber-50")}>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox 
                            checked={isMixed ? false : isChecked}
                            onCheckedChange={(checked) => {
                              if (!conflictCheck.hasConflict && viewModes.vessel === "edit") {
                                handleApplicabilityChange(cert.masterId, !!checked);
                              }
                            }}
                            disabled={conflictCheck.hasConflict || viewModes.vessel !== "edit"}
                            className={cn(
                              "border-blue-500 data-[state=checked]:bg-blue-500",
                              isMixed && "border-amber-500 bg-amber-100"
                            )}
                            data-testid={`checkbox-vessel-applicable-${cert.id}`}
                          />
                          {isMixed && (
                            <span className="text-xs text-amber-600">Mixed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">{idx + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId}</td>
                      <td className="px-3 py-3 text-sm">{cert.companyId || `C${cert.masterId}`}</td>
                      <td className="px-3 py-3 text-sm">{cert.certificateLabel || cert.certificateName}</td>
                      <td className="px-3 py-3 text-sm">{cert.requirementRef}</td>
                      <td className="px-3 py-3 text-sm">{displayCompanyGroup}</td>
                    </tr>
                  );
                })}
                
                {/* Company-only certificates (inherited from Company tab) */}
                {selectedVessels.length > 0 && companyOnlyCerts.map((cert, idx) => {
                  const companyGroupLabel = companyGroupLabels.find(g => g.key === cert.companyGroup)?.label || "";
                  const displayCompanyGroup = cert.companyGroup ? `${cert.companyGroup}. ${companyGroupLabel}` : "";
                  const applicability = getCertificateApplicability(cert.masterId);
                  const isMixed = applicability === 'mixed';
                  const isChecked = applicability === true;
                  
                  return (
                    <tr key={`company-inherited-${cert.id}`} className={cn("hover:bg-gray-50 bg-green-50", isMixed && "bg-amber-50")}>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox 
                            checked={isMixed ? false : isChecked}
                            onCheckedChange={(checked) => {
                              if (!conflictCheck.hasConflict && viewModes.vessel === "edit") {
                                handleApplicabilityChange(cert.masterId, !!checked);
                              }
                            }}
                            disabled={conflictCheck.hasConflict || viewModes.vessel !== "edit"}
                            className={cn(
                              "border-blue-500 data-[state=checked]:bg-blue-500",
                              isMixed && "border-amber-500 bg-amber-100"
                            )}
                            data-testid={`checkbox-vessel-company-applicable-${cert.id}`}
                          />
                          {isMixed && (
                            <span className="text-xs text-amber-600">Mixed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">{companyCertificates.length + idx + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-blue-600">{cert.masterId && /^CMP-/.test(cert.masterId) ? cert.masterId : "-"}</td>
                      <td className="px-3 py-3 text-sm">{cert.companyId || "-"}</td>
                      <td className="px-3 py-3 text-sm">{cert.certificateLabel}</td>
                      <td className="px-3 py-3 text-sm">{cert.requirementRef}</td>
                      <td className="px-3 py-3 text-sm">{displayCompanyGroup}</td>
                    </tr>
                  );
                })}
                
                {/* Vessel-only certificates (not from Company) */}
                {selectedVessels.length > 0 && vesselOnlyCerts.map((cert, idx) => {
                  const companyGroupLabel = companyGroupLabels.find(g => g.key === cert.companyGroup)?.label || "";
                  const displayCompanyGroup = cert.companyGroup ? `${cert.companyGroup}. ${companyGroupLabel}` : "";
                  
                  return (
                    <tr key={`vessel-only-${cert.id}`} className="hover:bg-gray-50 bg-green-50">
                      <td className="px-3 py-3 text-center">
                        <Checkbox 
                          checked={cert.applicable}
                          onCheckedChange={(checked) => {
                            if (viewModes.vessel === "edit") {
                              setVesselOnlyCerts(prev => prev.map(c => 
                                c.id === cert.id ? { ...c, applicable: !!checked } : c
                              ));
                            }
                          }}
                          disabled={viewModes.vessel !== "edit"}
                          className="border-blue-500 data-[state=checked]:bg-blue-500"
                          data-testid={`checkbox-vessel-only-applicable-${cert.id}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm">{companyCertificates.length + companyOnlyCerts.length + idx + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-400">-</td>
                      <td className="px-3 py-3 text-sm text-gray-400">-</td>
                      <td className="px-3 py-3 text-sm">
                        {viewModes.vessel === "edit" ? (
                          <Input 
                            defaultValue={cert.certificateLabel}
                            className="h-8 text-sm"
                            onBlur={(e) => {
                              setVesselOnlyCerts(prev => prev.map(c => 
                                c.id === cert.id ? { ...c, certificateLabel: e.target.value } : c
                              ));
                            }}
                            data-testid={`input-vessel-label-only-${cert.id}`}
                          />
                        ) : (
                          cert.certificateLabel
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {viewModes.vessel === "edit" ? (
                          <Input 
                            defaultValue={cert.requirementRef}
                            className="h-8 text-sm"
                            onBlur={(e) => {
                              setVesselOnlyCerts(prev => prev.map(c => 
                                c.id === cert.id ? { ...c, requirementRef: e.target.value } : c
                              ));
                            }}
                            data-testid={`input-vessel-requirement-only-${cert.id}`}
                          />
                        ) : (
                          cert.requirementRef
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {viewModes.vessel === "edit" ? (
                          <Select 
                            defaultValue={cert.companyGroup}
                            onValueChange={(value) => {
                              setVesselOnlyCerts(prev => prev.map(c => 
                                c.id === cert.id ? { ...c, companyGroup: value } : c
                              ));
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm" data-testid={`select-vessel-companygroup-only-${cert.id}`}>
                              <SelectValue placeholder="Select Group" />
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
                          displayCompanyGroup
                        )}
                      </td>
                    </tr>
                  );
                })}
                
                {/* New entry row for Vessel-specific certificate */}
                {viewModes.vessel === "edit" && isAddingNewVessel && selectedVessels.length > 0 && (
                  <tr className="bg-blue-50">
                    <td className="px-3 py-3 text-center">
                      <Checkbox 
                        checked={newVesselEntryData.applicable ?? true}
                        onCheckedChange={(checked) => setNewVesselEntryData(prev => ({ ...prev, applicable: !!checked }))}
                        className="border-blue-500 data-[state=checked]:bg-blue-500"
                        data-testid="checkbox-new-vessel-applicable"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">New</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-400">-</td>
                    <td className="px-3 py-3 text-sm text-gray-400">-</td>
                    <td className="px-3 py-3 text-sm">
                      <Input 
                        value={newVesselEntryData.certificateLabel || ""}
                        onChange={(e) => setNewVesselEntryData(prev => ({ ...prev, certificateLabel: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Certificate Label *"
                        data-testid="input-new-vessel-label"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <Input 
                        value={newVesselEntryData.requirementRef || ""}
                        onChange={(e) => setNewVesselEntryData(prev => ({ ...prev, requirementRef: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Requirement/Ref"
                        data-testid="input-new-vessel-requirement"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={newVesselEntryData.companyGroup || ""}
                          onValueChange={(value) => setNewVesselEntryData(prev => ({ ...prev, companyGroup: value }))}
                        >
                          <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-new-vessel-group">
                            <SelectValue placeholder="Select Group" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyGroupLabels.map((grp: LabelConfig) => (
                              <SelectItem key={grp.key} value={grp.key}>
                                {getFormattedCompanyGroupLabel(grp.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={saveNewVesselEntry} className="text-green-600" data-testid="button-save-new-vessel">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelNewVesselEntry} className="text-red-600" data-testid="button-cancel-new-vessel">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* New entry error for Vessel tab */}
                {viewModes.vessel === "edit" && isAddingNewVessel && newVesselEntryError && (
                  <tr>
                    <td colSpan={7} className="px-3 py-2 text-sm text-red-500">{newVesselEntryError}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6">
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
                  {hasSavedInSession[activeTab] ? "Exit" : "Cancel"}
                </Button>
                {activeTab === "master" && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={openMasterLabels}
                      data-testid="button-configure-master-labels"
                    >
                      Configure Labels
                    </Button>
                    <Button 
                      size="sm"
                      className="gap-2"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-master"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saveMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
                {activeTab === "company" && (
                  <>
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-company"
                    >
                      {saveMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {saveMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={openConfigureLabels}
                      data-testid="button-configure-labels"
                    >
                      Configure Labels
                    </Button>
                  </>
                )}
                {activeTab === "vessel" && (
                  <>
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-vessel"
                    >
                      {saveMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {saveMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </>
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
            
            {currentViewMode === "edit" && activeTab === "company" && (
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={handleAddNewCompany}
                data-testid="button-new-company"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            )}
            
            {currentViewMode === "edit" && activeTab === "vessel" && selectedVessels.length > 0 && (
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={handleAddNewVessel}
                data-testid="button-new-vessel"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
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
