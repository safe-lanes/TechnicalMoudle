import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Ship } from "lucide-react";
import MachineryComponentUpload from "./MachineryComponentUpload";
import JobUpload from "./JobUpload";
import { VESSELS, type VesselId } from "@/lib/vessels";

type TemplateType = 'machinery' | 'stores' | 'spares' | 'jobs' | 'template5' | 'template6';

export default function BulkDataImport() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('machinery');
  const [selectedVessel, setSelectedVessel] = useState<VesselId>('V001');

  const templates = [
    { id: 'machinery' as TemplateType, number: 1, name: 'Machinery Components' },
    { id: 'stores' as TemplateType, number: 2, name: 'Stores' },
    { id: 'spares' as TemplateType, number: 3, name: 'Spares' },
    { id: 'jobs' as TemplateType, number: 4, name: 'Jobs' },
    { id: 'template5' as TemplateType, number: 5, name: 'Template 5' },
    { id: 'template6' as TemplateType, number: 6, name: 'Template 6' },
  ];

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Left Sidebar - Templates */}
      <div className="w-72 bg-sky-500 p-4">
        <Card className="bg-sky-500 border-none shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">TEMPLATES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`w-full text-left px-4 py-3 rounded transition-colors ${
                  selectedTemplate === template.id
                    ? 'bg-white text-sky-600 font-medium'
                    : 'text-white hover:bg-sky-400'
                }`}
                data-testid={`template-${template.id}`}
              >
                {template.number}. {template.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Template Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {/* Vessel Selector Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <Ship className="h-5 w-5 text-sky-600" />
            <div className="flex items-center gap-3">
              <Label htmlFor="vessel-select" className="text-sm font-medium text-gray-700">
                Select Vessel:
              </Label>
              <Select value={selectedVessel} onValueChange={(value) => setSelectedVessel(value as VesselId)}>
                <SelectTrigger id="vessel-select" className="w-64" data-testid="select-vessel">
                  <SelectValue placeholder="Choose vessel..." />
                </SelectTrigger>
                <SelectContent>
                  {VESSELS.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id} data-testid={`vessel-${vessel.id}`}>
                      {vessel.id} - {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-gray-500 ml-auto">
              All imports will be associated with the selected vessel
            </p>
          </div>
        </div>

        {/* Template Content */}
        <div className="p-6">
          {selectedTemplate === 'machinery' ? (
            <MachineryComponentUpload vesselId={selectedVessel} />
          ) : selectedTemplate === 'jobs' ? (
            <JobUpload vesselId={selectedVessel} />
          ) : selectedTemplate === 'stores' ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Stores bulk upload functionality will be available soon
                </p>
              </CardContent>
            </Card>
          ) : selectedTemplate === 'spares' ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Spares bulk upload functionality will be available soon
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Select a template from the left to begin
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
