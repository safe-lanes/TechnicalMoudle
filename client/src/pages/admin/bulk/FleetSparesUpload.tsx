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
import { Download, Upload, CheckCircle, AlertTriangle, Clock, FileSpreadsheet } from "lucide-react";

const FIELD_MAPPINGS = [
  { field: "Part Code", required: true, description: "Unique spare part identifier" },
  { field: "Fleet Equipment Code", required: true, description: "Must exist in Fleet Equipment Master" },
  { field: "Fleet Equipment Name", required: false, description: "Auto-filled from Fleet Equipment" },
  { field: "Part Name", required: true, description: "Descriptive name of spare part" },
  { field: "Part Number", required: false, description: "Manufacturer part number" },
  { field: "UOM", required: true, description: "Unit of Measurement (PCS, KG, LTR, etc.)" },
  { field: "Drawing No.", required: false, description: "Reference to technical drawing" },
  { field: "Position No.", required: false, description: "Assembly position number" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Must match Maker List" },
  { field: "Specification", required: false, description: "Technical specifications" },
  { field: "Criticality", required: false, description: "Critical / Non-Critical" },
  { field: "Min Stock", required: false, description: "Minimum stock level" },
  { field: "Max Stock", required: false, description: "Maximum stock level" },
  { field: "Notes", required: false, description: "Additional remarks" },
  { field: "Is Active", required: false, description: "Yes/No - defaults to Yes" },
];

const MOCK_HISTORY: any[] = [];

export default function FleetSparesUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<string>("upsert");
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
    toast({
      title: 'Template Downloaded',
      description: 'Fleet Spares template has been downloaded.'
    });
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      toast({
        title: 'Upload Successful',
        description: 'Fleet Spares data has been imported successfully.'
      });
      setSelectedFile(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fleet Spares Upload</h1>
          <p className="text-gray-600 mt-1">Bulk import Fleet Spare templates via CSV or Excel files</p>
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
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Upload CSV, XLS, or XLSX files containing fleet spare data</CardDescription>
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
                onClick={() => document.getElementById('fleet-spares-file-input')?.click()}
              >
                <Input
                  id="fleet-spares-file-input"
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
              <CardDescription>Reference for all available fields in the Fleet Spares template</CardDescription>
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
              <CardDescription>Previous uploads for Fleet Spares data</CardDescription>
            </CardHeader>
            <CardContent>
              {MOCK_HISTORY.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
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
