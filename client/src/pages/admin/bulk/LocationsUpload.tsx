import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle, AlertTriangle, AlertCircle, FileSpreadsheet, MapPin } from "lucide-react";

const FIELD_MAPPINGS = [
  { field: "Location Name", required: true, description: "Unique name for the storage location (e.g., Engine Room Store, Deck Locker)" },
  { field: "Location Type", required: false, description: "Classification type (e.g., STORE, LOCKER, BOX, COMPARTMENT). Defaults to empty if not provided." },
];

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface LocationsUploadProps {
  vesselId: string;
}

export default function LocationsUpload({ vesselId }: LocationsUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));

    if (!validTypes.includes(fileExtension.toLowerCase())) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setImportResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/technical/api/bulk/locations/template');
      if (!response.ok) throw new Error('Failed to download template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Locations_Import_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Template Downloaded',
        description: 'Locations import template has been downloaded.'
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download the template file.',
        variant: 'destructive'
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!vesselId) {
      toast({
        title: 'No Vessel Selected',
        description: 'Please select a vessel before importing locations.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/technical/api/bulk/locations/import?vesselId=${encodeURIComponent(vesselId)}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult(result);

      if (result.errors.length === 0) {
        toast({
          title: 'Import Successful',
          description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`
        });
      } else {
        toast({
          title: 'Import Completed with Issues',
          description: `${result.created} created, ${result.updated} updated. ${result.errors.length} error(s).`,
          variant: 'destructive'
        });
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'An error occurred during import.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = ['.csv', '.xls', '.xlsx'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      if (validTypes.includes(fileExtension.toLowerCase())) {
        setSelectedFile(file);
        setImportResult(null);
      } else {
        toast({
          title: 'Invalid File',
          description: 'Please upload a .xlsx, .xls, or .csv file',
          variant: 'destructive'
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-sky-600" />
            <h1 className="text-2xl font-bold" data-testid="locations-upload-header">Location Import</h1>
          </div>
          <p className="text-gray-600 mt-1" data-testid="locations-upload-description">
            Import vessel storage locations via CSV or Excel files
          </p>
        </div>
        <Button onClick={handleDownloadTemplate} variant="outline" data-testid="button-download-locations-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-locations-upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-locations-mapping">Field Mapping Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Upload CSV, XLS, or XLSX files containing location data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  selectedFile ? 'border-sky-400 bg-sky-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="locations-drop-zone"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-12 w-12 text-sky-500" />
                    <p className="font-medium text-sky-700">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <p className="font-medium text-gray-600">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-gray-400">
                      Supports .xlsx, .xls, and .csv files
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading || !vesselId}
                  data-testid="button-upload-locations"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Importing...' : 'Import Locations'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Card data-testid="locations-import-result">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {importResult.created} Created
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {importResult.updated} Updated
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    {importResult.skipped} Skipped
                  </Badge>
                  {importResult.errors.length > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {importResult.errors.length} Error(s)
                    </Badge>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Errors:
                    </p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Guide</CardTitle>
              <CardDescription>Required and optional fields for location import</CardDescription>
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
                  {FIELD_MAPPINGS.map((mapping) => (
                    <TableRow key={mapping.field}>
                      <TableCell className="font-medium">{mapping.field}</TableCell>
                      <TableCell>
                        {mapping.required ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{mapping.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-700 mb-2">Notes:</p>
                <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
                  <li>Location Name must be unique per vessel</li>
                  <li>Duplicate location names within the same file will be skipped</li>
                  <li>If a location already exists for the vessel, its type will be updated if different</li>
                  <li>The vessel is determined by the vessel selected in the header</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
