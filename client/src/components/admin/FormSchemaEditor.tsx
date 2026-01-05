import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, X, Eye, Code, Settings, Plus, Trash2, Copy, Move } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FormVersion {
  id: number;
  formId: number;
  versionNo: number;
  versionDate: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  authorUserId: string;
  changelog: string | null;
  schemaJson: string;
}

interface FormSchemaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: FormVersion;
  formName: string;
  onUpdate: () => void;
}

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  validation?: any;
}

interface FormSection {
  key: string;
  title: string;
  layout: string;
  fields: FormField[];
}

interface FormSchema {
  title: string;
  sections: FormSection[];
}

export default function FormSchemaEditor({
  open,
  onOpenChange,
  version,
  formName,
  onUpdate
}: FormSchemaEditorProps) {
  const [activeTab, setActiveTab] = useState('visual');
  const [schema, setSchema] = useState<FormSchema>({ title: '', sections: [] });
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [changelog, setChangelog] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    if (version.schemaJson) {
      try {
        const parsed = JSON.parse(version.schemaJson);
        setSchema(parsed);
      } catch (error) {
        console.error('Failed to parse schema JSON:', error);
      }
    }
  }, [version.schemaJson]);

  // Update schema mutation
  const updateSchemaMutation = useMutation({
    mutationFn: (schemaJson: any) =>
      apiRequest(`/technical/api/admin/forms/${version.formId}/versions/${version.id}/schema`, {
        method: 'PUT',
        body: JSON.stringify({ schemaJson }),
      }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Schema saved successfully',
      });
      onUpdate();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save schema',
        variant: 'destructive',
      });
    },
  });

  // Publish version mutation
  const publishMutation = useMutation({
    mutationFn: (changelog: string) =>
      apiRequest(`/technical/api/admin/forms/${version.formId}/versions/${version.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ userId: 'admin', changelog }),
      }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Version published successfully',
      });
      setPublishDialogOpen(false);
      onUpdate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish version',
        variant: 'destructive',
      });
    },
  });

  // Discard draft mutation
  const discardMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/technical/api/admin/forms/${version.formId}/versions/${version.id}/discard`, {
        method: 'POST',
      }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Draft discarded',
      });
      onUpdate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to discard draft',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateSchemaMutation.mutate(JSON.stringify(schema));
  };

  const handlePublish = () => {
    if (!changelog) {
      toast({
        title: 'Error',
        description: 'Please enter a changelog',
        variant: 'destructive',
      });
      return;
    }
    publishMutation.mutate(changelog);
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard this draft? All changes will be lost.')) {
      discardMutation.mutate();
    }
  };

  const addSection = () => {
    const newSection: FormSection = {
      key: `section_${Date.now()}`,
      title: 'New Section',
      layout: 'grid-2',
      fields: []
    };
    setSchema({
      ...schema,
      sections: [...schema.sections, newSection]
    });
  };

  const updateSection = (index: number, section: FormSection) => {
    const newSections = [...schema.sections];
    newSections[index] = section;
    setSchema({ ...schema, sections: newSections });
  };

  const deleteSection = (index: number) => {
    const newSections = schema.sections.filter((_, i) => i !== index);
    setSchema({ ...schema, sections: newSections });
  };

  const addField = (sectionIndex: number) => {
    const newField: FormField = {
      key: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false
    };
    const newSections = [...schema.sections];
    newSections[sectionIndex].fields.push(newField);
    setSchema({ ...schema, sections: newSections });
  };

  const updateField = (sectionIndex: number, fieldIndex: number, field: FormField) => {
    const newSections = [...schema.sections];
    newSections[sectionIndex].fields[fieldIndex] = field;
    setSchema({ ...schema, sections: newSections });
  };

  const deleteField = (sectionIndex: number, fieldIndex: number) => {
    const newSections = [...schema.sections];
    newSections[sectionIndex].fields = newSections[sectionIndex].fields.filter((_, i) => i !== fieldIndex);
    setSchema({ ...schema, sections: newSections });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  Form Schema Editor - {formName}
                </DialogTitle>
                <DialogDescription>
                  Version {version.versionNo} ({version.status})
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {version.status === 'DRAFT' && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleDiscard}>
                      <X className="h-4 w-4 mr-1" />
                      Discard
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" onClick={() => setPublishDialogOpen(true)} style={{ backgroundColor: '#52baf3', color: 'white' }}>
                      Publish
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="visual">
                <Settings className="h-4 w-4 mr-2" />
                Visual Editor
              </TabsTrigger>
              <TabsTrigger value="json">
                <Code className="h-4 w-4 mr-2" />
                JSON Editor
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="visual" className="flex-1 overflow-y-auto">
              <div className="space-y-4 p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Form Sections</h3>
                  <Button size="sm" onClick={addSection}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Section
                  </Button>
                </div>
                
                {schema.sections.map((section, sIndex) => (
                  <Card key={section.key}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge style={{ backgroundColor: '#52baf3', color: 'white' }}>
                            {section.key}
                          </Badge>
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(sIndex, { ...section, title: e.target.value })}
                            className="max-w-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={section.layout}
                            onValueChange={(value) => updateSection(sIndex, { ...section, layout: value })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="grid-1">Single Column</SelectItem>
                              <SelectItem value="grid-2">2 Columns</SelectItem>
                              <SelectItem value="grid-3">3 Columns</SelectItem>
                              <SelectItem value="grid-4">4 Columns</SelectItem>
                              <SelectItem value="grid-5">5 Columns</SelectItem>
                              <SelectItem value="file-upload">File Upload</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSection(sIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-2">
                          <Label>Fields</Label>
                          <Button size="sm" variant="outline" onClick={() => addField(sIndex)}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add Field
                          </Button>
                        </div>
                        {section.fields.map((field, fIndex) => (
                          <div key={field.key} className="flex gap-2 items-center p-2 border rounded">
                            <Input
                              value={field.key}
                              onChange={(e) => updateField(sIndex, fIndex, { ...field, key: e.target.value })}
                              placeholder="Field Key"
                              className="w-32"
                            />
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(sIndex, fIndex, { ...field, label: e.target.value })}
                              placeholder="Label"
                              className="flex-1"
                            />
                            <Select
                              value={field.type}
                              onValueChange={(value) => updateField(sIndex, fIndex, { ...field, type: value })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="datetime">DateTime</SelectItem>
                                <SelectItem value="select">Select</SelectItem>
                                <SelectItem value="textarea">Textarea</SelectItem>
                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                <SelectItem value="radio">Radio</SelectItem>
                                <SelectItem value="file">File</SelectItem>
                                <SelectItem value="repeater">Repeater</SelectItem>
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(sIndex, fIndex, { ...field, required: e.target.checked })}
                              />
                              Required
                            </label>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteField(sIndex, fIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="json" className="flex-1 overflow-y-auto">
              <div className="p-4">
                <textarea
                  className="w-full h-full min-h-[500px] p-4 font-mono text-sm border rounded"
                  value={JSON.stringify(schema, null, 2)}
                  onChange={(e) => {
                    try {
                      const newSchema = JSON.parse(e.target.value);
                      setSchema(newSchema);
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="border rounded-lg p-6 bg-gray-50">
                  <h3 className="text-xl font-semibold mb-4">{schema.title || formName}</h3>
                  {schema.sections.map((section) => (
                    <div key={section.key} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge style={{ backgroundColor: '#52baf3', color: 'white' }}>
                          {section.key}
                        </Badge>
                        <h4 className="text-lg font-medium">{section.title}</h4>
                      </div>
                      <div className={`grid gap-4 ${
                        section.layout === 'grid-1' ? 'grid-cols-1' :
                        section.layout === 'grid-2' ? 'grid-cols-2' :
                        section.layout === 'grid-3' ? 'grid-cols-3' :
                        section.layout === 'grid-4' ? 'grid-cols-4' :
                        section.layout === 'grid-5' ? 'grid-cols-5' :
                        'grid-cols-1'
                      }`}>
                        {section.fields.map((field) => (
                          <div key={field.key}>
                            <Label>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            {field.type === 'textarea' ? (
                              <textarea className="w-full p-2 border rounded mt-1" rows={3} disabled />
                            ) : field.type === 'select' ? (
                              <Select disabled>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </Select>
                            ) : (
                              <Input type={field.type} disabled className="mt-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Form Version</DialogTitle>
            <DialogDescription>
              Enter a changelog to describe the changes in this version. This will make the current published version archived.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="changelog">Changelog *</Label>
              <textarea
                id="changelog"
                className="w-full px-3 py-2 border rounded-md mt-1"
                rows={4}
                placeholder="Describe what changed in this version..."
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!changelog}
              style={{ backgroundColor: '#52baf3', color: 'white' }}
            >
              Publish Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}