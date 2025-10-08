import { useState } from "react";
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
    queryKey: [`/api/recurring-defects?${queryParams.toString()}`]
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
    const defects = await apiRequest("GET", `/api/recurring-defects/${recurringId}/defects`);
    const recurring = recurringDefects.find(r => r.id === recurringId);
    if (recurring) {
      setSelectedRecurring({ ...recurring, defects });
      setShowDrillDown(true);
    }
  };

  const formatEquipmentKey = (key: string) => {
    const parts = key.split("|").filter(p => p);
    if (parts.length === 1) return parts[0];
    return parts.join(" › ");
  };

  const renderStatsCards = () => (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Recurring</p>
              <p className="text-2xl font-bold">{(recurringDefects || []).length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">With Open Defects</p>
              <p className="text-2xl font-bold">{(recurringDefects || []).filter(r => r.openCount > 0).length}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">CoC Related</p>
              <p className="text-2xl font-bold">{(recurringDefects || []).filter(r => r.hasCoc).length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Multi-Vessel</p>
              <p className="text-2xl font-bold">{(recurringDefects || []).filter(r => r.vesselsAffected > 1).length}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFilters = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-4">
          <div>
            <Label htmlFor="window">Time Window</Label>
            <Select value={windowMonths} onValueChange={setWindowMonths}>
              <SelectTrigger id="window" data-testid="select-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
                <SelectItem value="24">24 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="occurrences">Min Occurrences</Label>
            <Select value={minOccurrences} onValueChange={setMinOccurrences}>
              <SelectTrigger id="occurrences" data-testid="select-occurrences">
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
          
          <div>
            <Label htmlFor="department">Department</Label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger id="department" data-testid="select-department">
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
          
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="coc-only"
              checked={cocOnly}
              onCheckedChange={(checked) => setCocOnly(checked as boolean)}
              data-testid="checkbox-coc"
            />
            <Label htmlFor="coc-only">CoC Only</Label>
          </div>
          
          <div className="col-span-2">
            <Label htmlFor="search">Search Equipment</Label>
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
                >
                  <Wrench className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  title="Notify Fleet"
                  data-testid={`button-notify-${recurring.id}`}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  title="Export"
                  data-testid={`button-export-${recurring.id}`}
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Recurring Defects</h1>
          <p className="text-muted-foreground mt-1">
            Two or more defects for the same equipment within the selected period
          </p>
        </div>
        <Button variant="outline" data-testid="button-export-all">
          <FileDown className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      {renderStatsCards()}
      {renderFilters()}

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
                renderEquipmentTable()
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {renderDrillDownPanel()}
    </div>
  );
}