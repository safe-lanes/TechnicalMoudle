import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Clock, 
  FileDown,
  ChevronDown,
  Eye,
  MessageSquare,
  Bell,
  Wrench,
  Filter,
  Search
} from "lucide-react";
import type { RecurringDefect, Defect } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const COMING_SOON = true;

interface RecurringDefectWithDetails extends RecurringDefect {
  defects?: Defect[];
}

export default function RecurringDefects() {
  const [activeTab, setActiveTab] = useState<"active" | "all" | "by-equipment" | "by-vessel">("by-equipment");
  const [windowMonths, setWindowMonths] = useState<string>("12");
  const [minOccurrences, setMinOccurrences] = useState<string>("2");
  const [cocOnly, setCocOnly] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringDefectWithDetails | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showCapaDialog, setShowCapaDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [selectedForCapa, setSelectedForCapa] = useState<RecurringDefect | null>(null);
  const [selectedForNotify, setSelectedForNotify] = useState<RecurringDefect | null>(null);
  const [capaDescription, setCapaDescription] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  if (COMING_SOON) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-black dark:text-white">Recurring Defects</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              data-testid="button-export-all"
              disabled
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export All
            </Button>
            <Button
              variant="outline"
              data-testid="button-toggle-filters"
              disabled
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
        <p className="text-lg text-muted-foreground">Coming Soon...</p>
      </div>
    );
  }

  // Export data functionality
  const exportData = (filename: string, data: RecurringDefect[]) => {
    const csvContent = [
      // Headers
      'Equipment Key,Equipment Type,Make,Model,Serial,Location,System,Occurrences,Vessels Affected,Last Occurrence,COC Flag',
      // Data rows
      ...data.map(rd => {
        const parts = rd.equipmentKey.split('|');
        return [
          rd.equipmentKey,
          parts[0] || '',
          parts[1] || '',
          parts[2] || '',
          parts[3] || '',
          parts[4] || '',
          parts[5] || '',
          rd.occurrenceCount.toString(),
          rd.vesselsAffected.toString(),
          rd.lastOccurrenceDate ? new Date(rd.lastOccurrenceDate).toLocaleDateString() : '',
          rd.hasCoc ? 'Yes' : 'No'
        ].map(cell => `"${cell}"`).join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Build query params for recurring defects
  const queryParams = new URLSearchParams();
  queryParams.set("windowMonths", windowMonths);
  queryParams.set("minOccurrences", minOccurrences);
  if (cocOnly) queryParams.set("hasCoc", "true");
  
  // Fetch recurring defects
  const { data: recurringDefects = [], isLoading } = useQuery<RecurringDefect[]>({
    queryKey: [`/technical/api/recurring-defects?${queryParams.toString()}`]
  });

  // Filter recurring defects based on active tab
  const filteredDefects = (recurringDefects || []).filter(rd => {
    if (activeTab === "active") {
      return rd.openCount > 0;
    }
    if (searchTerm && !rd.equipmentKey.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Load defects for selected recurring defect
  const loadDefectsForRecurring = async (recurringId: number) => {
    try {
      const response = await apiRequest("GET", `/technical/api/recurring-defects/${recurringId}/defects`);
      const defects = await response.json();
      const recurring = recurringDefects.find(r => r.id === recurringId);
      if (recurring) {
        setSelectedRecurring({ ...recurring, defects: Array.isArray(defects) ? defects : [] });
        setShowDrillDown(true);
      }
    } catch (error) {
      console.error("Failed to load defects for recurring pattern:", error);
      // Show the drill down panel without detailed defects
      const recurring = recurringDefects.find(r => r.id === recurringId);
      if (recurring) {
        setSelectedRecurring({ ...recurring, defects: [] });
        setShowDrillDown(true);
      }
    }
  };

  const formatEquipmentKey = (key: string) => {
    const parts = key.split("|").filter(p => p);
    if (parts.length === 1) return parts[0];
    return parts.join(" › ");
  };

  // CAPA creation handler
  const handleCreateCapa = (recurring: RecurringDefect) => {
    setSelectedForCapa(recurring);
    setCapaDescription(`Corrective Action for Recurring Pattern: ${formatEquipmentKey(recurring.equipmentKey)}\n\nProblem Statement:\nRecurring defects identified for ${formatEquipmentKey(recurring.equipmentKey)} with ${recurring.occurrenceCount} occurrences across ${recurring.vesselsAffected} vessel(s).\n\nRoot Cause Analysis:\n[To be completed]\n\nCorrective Actions:\n1. \n2. \n3. \n\nPreventive Actions:\n1. \n2. \n\nImplementation Timeline:\n- Immediate actions: \n- Long-term actions: \n\nResponsible Person: [Name/Department]\nTarget Completion Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`);
    setShowCapaDialog(true);
  };

  const handleSubmitCapa = () => {
    if (selectedForCapa) {
      toast({
        title: "CAPA Created",
        description: `Corrective action plan created for ${formatEquipmentKey(selectedForCapa.equipmentKey)}`,
      });
      setShowCapaDialog(false);
      setCapaDescription("");
      setSelectedForCapa(null);
    }
  };

  // Fleet notification handler
  const handleNotifyFleet = (recurring: RecurringDefect) => {
    setSelectedForNotify(recurring);
    const vesselNames = (recurring as any).vesselNames || `${recurring.vesselsAffected} vessel(s)`;
    setNotifyMessage(`FLEET ADVISORY: Recurring Equipment Issue\n\nEquipment: ${formatEquipmentKey(recurring.equipmentKey)}\n\nSummary:\nWe have identified a recurring defect pattern affecting ${recurring.vesselsAffected} vessel(s) with ${recurring.occurrenceCount} total occurrences.\n\nAffected Vessels:\n${vesselNames}\n\nLast Occurrence: ${recurring.lastOccurrenceDate ? new Date(recurring.lastOccurrenceDate).toLocaleDateString() : 'N/A'}\n\nRecommended Actions:\n1. Inspect similar equipment on your vessel\n2. Review maintenance procedures\n3. Report any similar issues immediately\n4. Implement preventive maintenance as advised\n\n${recurring.hasCoc ? '⚠️ CRITICAL: This is a Condition of Class (CoC) issue requiring immediate attention.' : ''}\n\nFor technical support, contact: [Department/Contact]\n\nThis is an automated notification from the PMS Recurring Defects System.`);
    setShowNotifyDialog(true);
  };

  const handleSendNotification = () => {
    if (selectedForNotify) {
      toast({
        title: "Fleet Notification Sent",
        description: `Alert sent to all vessels regarding ${formatEquipmentKey(selectedForNotify.equipmentKey)}`,
      });
      setShowNotifyDialog(false);
      setNotifyMessage("");
      setSelectedForNotify(null);
    }
  };

  const renderFiltersBar = () => (
    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-gray-50">
      <div className="flex items-center gap-2">
        <Label htmlFor="window" className="text-sm whitespace-nowrap">Time Window</Label>
        <Select value={windowMonths} onValueChange={setWindowMonths}>
          <SelectTrigger id="window" className="w-[120px]" data-testid="select-window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">6 Months</SelectItem>
            <SelectItem value="12">12 Months</SelectItem>
            <SelectItem value="24">2 Years</SelectItem>
            <SelectItem value="36">3 Years</SelectItem>
            <SelectItem value="48">4 Years</SelectItem>
            <SelectItem value="60">5 Years</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Label htmlFor="occurrences" className="text-sm whitespace-nowrap">Min Occurrences</Label>
        <Select value={minOccurrences} onValueChange={setMinOccurrences}>
          <SelectTrigger id="occurrences" className="w-[100px]" data-testid="select-occurrences">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">≥ 2</SelectItem>
            <SelectItem value="3">≥ 3</SelectItem>
            <SelectItem value="5">≥ 5</SelectItem>
            <SelectItem value="10">≥ 10</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Label htmlFor="department" className="text-sm whitespace-nowrap">Department</Label>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger id="department" className="w-[140px]" data-testid="select-department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="deck">Deck</SelectItem>
            <SelectItem value="engine">Engine</SelectItem>
            <SelectItem value="navigation">Navigation</SelectItem>
            <SelectItem value="safety">Safety</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Checkbox
          id="coc-only"
          checked={cocOnly}
          onCheckedChange={(checked) => setCocOnly(checked as boolean)}
          data-testid="checkbox-coc"
        />
        <Label htmlFor="coc-only" className="text-sm">CoC Only</Label>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-[180px]"
            data-testid="input-search"
          />
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setWindowMonths("12");
          setMinOccurrences("2");
          setSelectedDepartment("all");
          setCocOnly(false);
          setSearchTerm("");
        }}
        data-testid="button-clear-filters"
      >
        Clear
      </Button>
    </div>
  );

  const renderVesselTable = () => {
    // Group recurring defects by vessel
    const vesselGroups = filteredDefects.reduce((groups, recurring) => {
      const vesselNamesStr = (recurring as any).vesselNames || '';
      const vessels: string[] = vesselNamesStr ? vesselNamesStr.split(',') : [];
      vessels.forEach((vessel: string) => {
        const vesselName = vessel.trim();
        if (!groups[vesselName]) {
          groups[vesselName] = [];
        }
        groups[vesselName].push(recurring);
      });
      return groups;
    }, {} as Record<string, RecurringDefect[]>);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Vessel</TableHead>
            <TableHead className="text-center">Total Patterns</TableHead>
            <TableHead className="text-center">Critical (CoC)</TableHead>
            <TableHead>Top Equipment</TableHead>
            <TableHead>Latest Issue</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(vesselGroups).map(([vessel, patterns]) => {
            const cocCount = patterns.filter(p => p.hasCoc).length;
            const latestPattern = patterns.reduce((latest, p) => 
              !latest || (p.lastOccurrenceDate && p.lastOccurrenceDate > latest.lastOccurrenceDate) ? p : latest
            , patterns[0]);
            const topEquipment = patterns[0]; // Could be improved to find most frequent
            
            return (
              <TableRow key={vessel}>
                <TableCell className="font-medium">
                  <Badge variant="secondary">{vessel}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{patterns.length}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {cocCount > 0 && (
                    <Badge className="bg-blue-100 text-blue-700">{cocCount}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{formatEquipmentKey(topEquipment.equipmentKey)}</span>
                </TableCell>
                <TableCell>
                  {latestPattern.lastOccurrenceDate ? 
                    new Date(latestPattern.lastOccurrenceDate).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      title="View Patterns"
                      onClick={() => {
                        // Could expand to show all patterns for this vessel
                        const firstPattern = patterns[0];
                        loadDefectsForRecurring(firstPattern.id);
                      }}
                      data-testid={`button-vessel-view-${vessel}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      title="Export"
                      onClick={() => exportData(`recurring_defects_${vessel}`, patterns)}
                      data-testid={`button-vessel-export-${vessel}`}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderEquipmentTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment</TableHead>
          <TableHead className="text-center">Occurrences</TableHead>
          <TableHead className="text-center">Vessels Affected</TableHead>
          <TableHead className="text-center">Open Defects</TableHead>
          <TableHead>Last Occurrence</TableHead>
          <TableHead className="text-center">MTBF (days)</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDefects.map((recurring) => (
          <TableRow key={recurring.id}>
            <TableCell className="font-medium">
              {formatEquipmentKey(recurring.equipmentKey)}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="outline">{recurring.occurrenceCount}</Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary">{recurring.vesselsAffected}</Badge>
            </TableCell>
            <TableCell className="text-center">
              {recurring.openCount > 0 ? (
                <Badge variant="destructive">{recurring.openCount}</Badge>
              ) : (
                <Badge variant="outline">0</Badge>
              )}
            </TableCell>
            <TableCell>{recurring.lastOccurrenceDate}</TableCell>
            <TableCell className="text-center">
              {recurring.mtbfDays || "-"}
            </TableCell>
            <TableCell className="text-center">
              {recurring.hasCoc && (
                <Badge className="bg-blue-100 text-blue-700">CoC</Badge>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => loadDefectsForRecurring(recurring.id)}
                  title="View Details"
                  data-testid={`button-drill-${recurring.id}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  title="Create CAPA"
                  data-testid={`button-capa-${recurring.id}`}
                  onClick={() => handleCreateCapa(recurring)}
                >
                  <Wrench className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  title="Notify Fleet"
                  data-testid={`button-notify-${recurring.id}`}
                  onClick={() => handleNotifyFleet(recurring)}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  title="Export"
                  data-testid={`button-export-${recurring.id}`}
                  onClick={() => exportData(`recurring_defect_${recurring.equipmentKey}`, [recurring])}
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderDrillDownPanel = () => (
    <Sheet open={showDrillDown} onOpenChange={setShowDrillDown}>
      <SheetContent className="w-[800px] sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>Defect Details</SheetTitle>
          <SheetDescription>
            {selectedRecurring && formatEquipmentKey(selectedRecurring.equipmentKey)}
          </SheetDescription>
        </SheetHeader>
        
        {selectedRecurring && (
          <div className="mt-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-muted-foreground">Total Occurrences</p>
                <p className="text-xl font-bold">{selectedRecurring.occurrenceCount}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-muted-foreground">Vessels Affected</p>
                <p className="text-xl font-bold">{selectedRecurring.vesselsAffected}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-muted-foreground">MTBF (days)</p>
                <p className="text-xl font-bold">{selectedRecurring.mtbfDays || "-"}</p>
              </div>
            </div>
            
            <h3 className="font-semibold mb-3">Linked Defects</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {selectedRecurring.defects?.map((defect) => (
                <Card key={defect.id} className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{defect.id}</Badge>
                      <Badge variant="secondary">{defect.vesselName}</Badge>
                      {defect.is_coc && (
                        <Badge className="bg-blue-100 text-blue-700">CoC</Badge>
                      )}
                    </div>
                    <Badge 
                      variant={defect.status === "Open" ? "destructive" : "default"}
                    >
                      {defect.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Issue Date: {defect.issueDate}
                  </p>
                  <p className="text-sm line-clamp-2">{defect.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" data-testid={`button-view-defect-${defect.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-attachments-${defect.id}`}>
                      Attachments
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading recurring defects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black dark:text-white">Recurring Defects</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            data-testid="button-export-all"
            onClick={() => exportData('recurring_defects_all', recurringDefects)}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {showFilters && renderFiltersBar()}

      <Card>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <CardHeader>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="by-equipment">By Equipment</TabsTrigger>
              <TabsTrigger value="by-vessel">By Vessel</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="active" className="mt-0">
              {filteredDefects.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recurring defects found with current filters</p>
                </div>
              ) : (
                renderEquipmentTable()
              )}
            </TabsContent>
            <TabsContent value="all" className="mt-0">
              {filteredDefects.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recurring defects found with current filters</p>
                </div>
              ) : (
                renderEquipmentTable()
              )}
            </TabsContent>
            <TabsContent value="by-equipment" className="mt-0">
              {filteredDefects.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recurring defects found with current filters</p>
                </div>
              ) : (
                renderEquipmentTable()
              )}
            </TabsContent>
            <TabsContent value="by-vessel" className="mt-0">
              {filteredDefects.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recurring defects found with current filters</p>
                </div>
              ) : (
                renderVesselTable()
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {renderDrillDownPanel()}

      {/* CAPA Creation Dialog */}
      <Dialog open={showCapaDialog} onOpenChange={setShowCapaDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Create Corrective Action Plan (CAPA)</DialogTitle>
            <DialogDescription>
              {selectedForCapa && (
                <>Create a corrective action plan for: {formatEquipmentKey(selectedForCapa.equipmentKey)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={capaDescription}
              onChange={(e) => setCapaDescription(e.target.value)}
              placeholder="Enter CAPA details..."
              className="h-96 font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapaDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCapa} disabled={!capaDescription.trim()}>
              Create CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fleet Notification Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Fleet-Wide Notification</DialogTitle>
            <DialogDescription>
              {selectedForNotify && (
                <>Send advisory to all vessels regarding: {formatEquipmentKey(selectedForNotify.equipmentKey)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
              placeholder="Enter notification message..."
              className="h-96 font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendNotification} disabled={!notifyMessage.trim()}>
              <Bell className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}