import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import MachineryComponentUpload from "./MachineryComponentUpload";

type TemplateType = 'machinery' | 'stores' | 'spares';

export default function BulkDataImport() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('machinery');

  const templates = [
    { id: 'machinery' as TemplateType, number: 1, name: 'Machinery Components' },
    { id: 'stores' as TemplateType, number: 2, name: 'Stores' },
    { id: 'spares' as TemplateType, number: 3, name: 'Spares' },
    { id: 'template4' as TemplateType, number: 4, name: 'Template 4' },
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
        {selectedTemplate === 'machinery' ? (
          <MachineryComponentUpload />
        ) : selectedTemplate === 'stores' ? (
          <div className="p-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Stores bulk upload functionality will be available soon
                </p>
              </CardContent>
            </Card>
          </div>
        ) : selectedTemplate === 'spares' ? (
          <div className="p-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Spares bulk upload functionality will be available soon
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">
                  Select a template from the left to begin
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
