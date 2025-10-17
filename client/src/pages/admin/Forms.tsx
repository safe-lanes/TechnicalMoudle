import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Eye, FileText } from "lucide-react";
import FormConfigurationModal from "@/components/admin/FormConfigurationModal";

export default function Forms() {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);

  const forms = [
    { 
      id: 1, 
      name: "Crew Appraisal Form", 
      version: "1.0", 
      date: "2025-01-15",
      status: "Published"
    },
    { 
      id: 2, 
      name: "Equipment Inspection Form", 
      version: "2.1", 
      date: "2025-02-20",
      status: "Draft"
    },
    { 
      id: 3, 
      name: "Safety Checklist Form", 
      version: "1.2", 
      date: "2025-03-10",
      status: "Published"
    },
  ];

  const handleEditForm = (form: any) => {
    setSelectedForm(form);
    setIsFormModalOpen(true);
  };

  const handleNewForm = () => {
    setSelectedForm(null);
    setIsFormModalOpen(true);
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Forms Configuration</h2>
            <p className="text-gray-600 mt-1">Manage and configure system forms</p>
          </div>
          <Button onClick={handleNewForm} data-testid="button-new-form">
            <Plus className="h-4 w-4 mr-2" />
            New Form
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Forms</CardTitle>
            <CardDescription>
              Configure and manage form templates used throughout the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        {form.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{form.version}</Badge>
                    </TableCell>
                    <TableCell>{form.date}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={form.status === 'Published' ? 'default' : 'outline'}
                        className={form.status === 'Published' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {form.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditForm(form)}
                          data-testid={`button-edit-form-${form.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-preview-form-${form.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {isFormModalOpen && (
        <FormConfigurationModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setSelectedForm(null);
          }}
          formName={selectedForm?.name || "New Form"}
          currentVersion={selectedForm?.version}
          versionDate={selectedForm?.date}
        />
      )}
    </>
  );
}
