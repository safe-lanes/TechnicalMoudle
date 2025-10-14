import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, X, Eye, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UploadResult {
  success: boolean;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    data?: any;
  }>;
  preview?: Array<any>;
}

interface FieldMapping {
  fileHeader: string;
  dbField: string;
  required: boolean;
  dataType: string;
  example: string;
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { fileHeader: "Component ID", dbField: "id", required: true, dataType: "text", example: "ME001" },
  { fileHeader: "Component Name", dbField: "name", required: true, dataType: "text", example: "Main Engine" },
  { fileHeader: "Component Code", dbField: "componentCode", required: false, dataType: "text", example: "ME001" },
  { fileHeader: "Parent ID", dbField: "parentId", required: false, dataType: "text", example: "null" },
  { fileHeader: "Category", dbField: "category", required: true, dataType: "text", example: "ENGINE" },
  { fileHeader: "Vessel ID", dbField: "vesselId", required: true, dataType: "text", example: "V001" },
  { fileHeader: "Current Cumulative RH", dbField: "currentCumulativeRH", required: false, dataType: "decimal", example: "45230.5" },
  { fileHeader: "Last Updated", dbField: "lastUpdated", required: false, dataType: "date", example: "2025-10-03" },
  { fileHeader: "Maker", dbField: "maker", required: false, dataType: "text", example: "MAN B&W" },
  { fileHeader: "Model", dbField: "model", required: false, dataType: "text", example: "6S60MC-C" },
  { fileHeader: "Serial No", dbField: "serialNo", required: false, dataType: "text", example: "SN123456" },
  { fileHeader: "Department Category", dbField: "deptCategory", required: false, dataType: "text", example: "Engineering" },
  { fileHeader: "Component Category", dbField: "componentCategory", required: false, dataType: "text", example: "Main Propulsion" },
  { fileHeader: "Location", dbField: "location", required: false, dataType: "text", example: "Engine Room" },
  { fileHeader: "Commissioned Date", dbField: "commissionedDate", required: false, dataType: "date", example: "2020-01-15" },
  { fileHeader: "Critical", dbField: "critical", required: false, dataType: "boolean", example: "false" },
  { fileHeader: "Class Item", dbField: "classItem", required: false, dataType: "boolean", example: "false" }
];

export default function AdminMachineryUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showMappingGuide, setShowMappingGuide] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Simulate upload progress
      setUploadProgress(30);
      
      return apiRequest('/api/components/upload', {
        method: 'POST',
        body: formData
      });
    },
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      setUploadProgress(100);
      
      if (data.success) {
        toast({
          title: "Upload Successful",
          description: `Created: ${data.created}, Updated: ${data.updated}, Failed: ${data.failed}`,
        });
        
        // Invalidate components cache to refresh the Components page
        queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      } else {
        toast({
          title: "Upload Completed with Errors",
          description: `Check the error report for details. Failed rows: ${data.failed}`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
      setUploadProgress(0);
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['.csv', '.xls', '.xlsx'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV, XLS, or XLSX file",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      setUploadResult(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10);
    uploadMutation.mutate(selectedFile);
  };

  const downloadTemplate = () => {
    // Create CSV content
    const headers = FIELD_MAPPINGS.map(m => m.fileHeader).join(',');
    const exampleRow = FIELD_MAPPINGS.map(m => m.example).join(',');
    const csvContent = `${headers}\n${exampleRow}`;
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'machinery_components_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your data for upload",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Machinery Component Upload</h1>
          <p className="text-gray-600 mt-2">Bulk import machinery components via CSV or Excel files</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping Guide</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>File Upload</CardTitle>
                <CardDescription>
                  Upload CSV, XLS, or XLSX files containing machinery component data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={isProcessing}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <span className="text-sm font-medium text-gray-700">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      CSV, XLS, or XLSX (max 10MB)
                    </span>
                  </label>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                    <div className="flex items-center">
                      <FileSpreadsheet className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadResult(null);
                        setUploadProgress(0);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Upload and Import
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Results</CardTitle>
                <CardDescription>
                  Summary of the last upload operation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploadResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {uploadResult.created}
                        </div>
                        <div className="text-sm text-gray-600">Created</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {uploadResult.updated}
                        </div>
                        <div className="text-sm text-gray-600">Updated</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {uploadResult.failed}
                        </div>
                        <div className="text-sm text-gray-600">Failed</div>
                      </div>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-medium mb-2">Import Errors:</div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {uploadResult.errors.map((error, idx) => (
                              <div key={idx} className="text-xs">
                                Row {error.row}: {error.field} - {error.message}
                              </div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {uploadResult.success && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Import completed successfully. Data has been added to the Components module.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No upload results yet</p>
                    <p className="text-sm mt-1">Upload a file to see results here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Reference</CardTitle>
              <CardDescription>
                Ensure your file headers match these field names exactly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Header</TableHead>
                    <TableHead>Database Field</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Example Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIELD_MAPPINGS.map((mapping, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{mapping.fileHeader}</TableCell>
                      <TableCell className="font-mono text-sm">{mapping.dbField}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.dataType}</Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.required ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{mapping.example}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important Notes:</strong>
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>Date fields should be in YYYY-MM-DD format</li>
                    <li>Boolean fields accept: true/false, yes/no, 1/0</li>
                    <li>Decimal fields accept numbers with up to 2 decimal places</li>
                    <li>Parent ID should reference existing component IDs or be empty</li>
                    <li>Vessel ID must match existing vessel codes (e.g., V001, V002)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                Recent file upload operations and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Upload history will be displayed here</p>
                <p className="text-sm mt-1">Previous uploads and their status will appear in this section</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}