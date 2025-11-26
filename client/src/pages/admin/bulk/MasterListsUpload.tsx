import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle, AlertTriangle, Clock, FileSpreadsheet, List } from "lucide-react";

const MASTER_LIST_TYPES = [
  { id: "categories", name: "Categories", description: "Equipment and component categories" },
  { id: "departments", name: "Departments", description: "Organizational departments" },
  { id: "task-types", name: "Task Types", description: "Maintenance task types" },
  { id: "priorities", name: "Priorities", description: "Job/task priority levels" },
  { id: "criticality", name: "Criticality Levels", description: "A/B/C criticality" },
  { id: "uom", name: "Units of Measurement", description: "Measurement units" },
  { id: "frequency-units", name: "Frequency Units", description: "Time/interval units" },
  { id: "maintenance-basis", name: "Maintenance Basis", description: "Time/RH/Condition types" },
];

const FIELD_MAPPINGS = [
  { field: "List Type", required: true, description: "Type of master list (Category, Department, etc.)" },
  { field: "Code", required: true, description: "Unique code for the list item" },
  { field: "Name", required: true, description: "Display name for the list item" },
  { field: "Description", required: false, description: "Optional description" },
  { field: "Sort Order", required: false, description: "Display order (numeric)" },
  { field: "Is Active", required: false, description: "Yes/No - defaults to Yes" },
];

const MOCK_HISTORY: any[] = [];

export default function MasterListsUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<string>("upsert");
  const [selectedListType, setSelectedListType] = useState<string>("categories");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDownloadTemplate = () => {
    const listType = MASTER_LIST_TYPES.find(l => l.id === selectedListType);
    toast({
      title: 'Template Downloaded',
      description: `${listType?.name || 'Master List'} template has been downloaded.`
    });
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      toast({
        title: 'Upload Successful',
        description: 'Master List data has been imported successfully.'
      });
      setSelectedFile(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master List Upload</h1>
          <p className="text-gray-600 mt-1">Bulk import lookup table configurations via CSV or Excel files</p>
        </div>
        <Button onClick={handleDownloadTemplate} variant="outline" data-testid="button-download-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">Field Mapping Guide</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Master List Types</CardTitle>
              <CardDescription>Select the type of master list you want to import</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MASTER_LIST_TYPES.map((listType) => (
                  <button
                    key={listType.id}
                    onClick={() => setSelectedListType(listType.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedListType === listType.id
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`list-type-${listType.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <List className="h-4 w-4" />
                      <span className="font-medium text-sm">{listType.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">{listType.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Upload CSV, XLS, or XLSX files containing master list data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Import Mode</Label>
                <Select value={importMode} onValueChange={setImportMode}>
                  <SelectTrigger className="w-full" data-testid="select-import-mode">
                    <SelectValue placeholder="Select import mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add New Records Only</SelectItem>
                    <SelectItem value="update">Update Existing Only</SelectItem>
                    <SelectItem value="upsert">Create & Update (Recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-sky-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('master-lists-file-input')?.click()}
              >
                <Input
                  id="master-lists-file-input"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-1">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-400">CSV, XLS, or XLSX (max 20MB)</p>
                
                {selectedFile && (
                  <div className="mt-4 p-3 bg-sky-50 rounded-lg">
                    <p className="text-sky-700 font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-sky-600">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading}
                  className="w-full"
                  data-testid="button-upload"
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Guide</CardTitle>
              <CardDescription>Reference for all available fields in the Master List template</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIELD_MAPPINGS.map((field) => (
                    <TableRow key={field.field}>
                      <TableCell className="font-medium">{field.field}</TableCell>
                      <TableCell>
                        <Badge variant={field.required ? "destructive" : "secondary"}>
                          {field.required ? "Required" : "Optional"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{field.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>Previous uploads for Master List data</CardDescription>
            </CardHeader>
            <CardContent>
              {MOCK_HISTORY.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>List Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded At</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_HISTORY.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            {item.fileName}
                          </div>
                        </TableCell>
                        <TableCell>{item.listType}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'success' ? 'default' : 'secondary'}>
                            {item.status === 'success' ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Success</>
                            ) : (
                              <><AlertTriangle className="h-3 w-3 mr-1" /> Partial</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="h-3 w-3" />
                            {item.uploadedAt}
                          </div>
                        </TableCell>
                        <TableCell>{item.uploadedBy}</TableCell>
                        <TableCell className="text-green-600">{item.created}</TableCell>
                        <TableCell className="text-blue-600">{item.updated}</TableCell>
                        <TableCell className="text-red-600">{item.errors}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No upload history found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
