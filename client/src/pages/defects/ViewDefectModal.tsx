import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Paperclip, 
  Link, 
  Calendar, 
  User, 
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import type { Defect } from "@shared/schema";

interface ViewDefectModalProps {
  open: boolean;
  onClose: () => void;
  defectId: string;
}

export default function ViewDefectModal({ open, onClose, defectId }: ViewDefectModalProps) {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    equipment: true,
    dates: true,
    description: true,
    causeAnalysis: true,
    actions: true,
    notes: false,
    linkedDefects: false,
    closure: false
  });

  const { data: defect, isLoading } = useQuery<Defect>({
    queryKey: ['/api/defects', defectId],
    queryFn: async () => {
      const response = await fetch(`/api/defects/${defectId}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    },
    enabled: open && !!defectId
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (isLoading || !defect) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Loading Defect Report...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-blue-600 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Viewing Defect Report - {defect.id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Badge 
                variant={defect.status === 'Closed' ? 'default' : defect.critical ? 'destructive' : 'secondary'}
              >
                {defect.status}
              </Badge>
              {defect.critical && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Critical
                </Badge>
              )}
            </div>

            {/* Basic Information */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('basic')}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.basic ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Basic Information
                </CardTitle>
              </CardHeader>
              {expandedSections.basic && (
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Vessel</Label>
                    <Input value={defect.vesselName} disabled />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={defect.category} disabled />
                  </div>
                  <div>
                    <Label>Defect Type</Label>
                    <Input value={defect.defectType || '-'} disabled />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Input value={defect.priority || 'Medium'} disabled />
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Input value={defect.severity || '-'} disabled />
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Input value={defect.source || '-'} disabled />
                  </div>
                  <div>
                    <Label>Reported By</Label>
                    <Input value={defect.reportedBy} disabled />
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <Input value={defect.assignedTo || '-'} disabled />
                  </div>
                  <div>
                    <Label>Responsible Dept</Label>
                    <Input value={defect.responsibleDept || '-'} disabled />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Equipment/Hardware */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('equipment')}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.equipment ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Equipment / Hardware
                </CardTitle>
              </CardHeader>
              {expandedSections.equipment && (
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Equipment Category</Label>
                    <Input value={defect.equipmentCategory || '-'} disabled />
                  </div>
                  <div>
                    <Label>Equipment Type</Label>
                    <Input value={defect.equipmentType || '-'} disabled />
                  </div>
                  <div>
                    <Label>Make</Label>
                    <Input value={defect.equipmentMake || '-'} disabled />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input value={defect.equipmentModel || '-'} disabled />
                  </div>
                  <div>
                    <Label>Serial No</Label>
                    <Input value={defect.equipmentSerialNo || '-'} disabled />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={defect.equipmentLocation || '-'} disabled />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('dates')}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.dates ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Calendar className="h-4 w-4" />
                  Dates
                </CardTitle>
              </CardHeader>
              {expandedSections.dates && (
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Issue Date</Label>
                    <Input value={defect.issueDate} disabled />
                  </div>
                  <div>
                    <Label>Target Date</Label>
                    <Input value={defect.targetDate || '-'} disabled />
                  </div>
                  <div>
                    <Label>Date Completed</Label>
                    <Input value={defect.dateCompleted || '-'} disabled />
                  </div>
                  <div>
                    <Label>Created On</Label>
                    <Input value={formatDate(defect.createdAt.toString())} disabled />
                  </div>
                  <div>
                    <Label>Last Updated</Label>
                    <Input value={formatDate(defect.updatedAt.toString())} disabled />
                  </div>
                  <div>
                    <Label>Verified Date</Label>
                    <Input value={defect.verifiedDate || '-'} disabled />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Description */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('description')}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.description ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Description
                </CardTitle>
              </CardHeader>
              {expandedSections.description && (
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Defect Description</Label>
                      <Textarea 
                        value={defect.description} 
                        disabled 
                        className="min-h-[100px]"
                      />
                    </div>
                    <div>
                      <Label>Action Taken / Requested</Label>
                      <Textarea 
                        value={defect.actionTakenRequested || '-'} 
                        disabled 
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Cause Analysis */}
            <Card>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('causeAnalysis')}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.causeAnalysis ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Cause Analysis
                </CardTitle>
              </CardHeader>
              {expandedSections.causeAnalysis && (
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Immediate Cause</Label>
                      <Textarea 
                        value={defect.immediateCauseExplanation || '-'} 
                        disabled 
                        className="min-h-[60px]"
                      />
                    </div>
                    <div>
                      <Label>Root Cause</Label>
                      <Textarea 
                        value={defect.rootCauseExplanation || '-'} 
                        disabled 
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Notes */}
            {defect.notes && defect.notes.length > 0 && (
              <Card>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection('notes')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    {expandedSections.notes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Paperclip className="h-4 w-4" />
                    Notes ({defect.notes.length})
                  </CardTitle>
                </CardHeader>
                {expandedSections.notes && (
                  <CardContent>
                    <div className="space-y-4">
                      {defect.notes.map((note: any, index: number) => (
                        <div key={note.noteId || index} className="border rounded-lg p-4">
                          <div className="flex justify-between text-sm text-gray-500 mb-2">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {note.createdBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(note.createdOn)}
                            </span>
                          </div>
                          <p className="text-sm">{note.noteText}</p>
                          {note.attachments && note.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {note.attachments.map((file: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  {file.split('/').pop()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Linked Defects */}
            {defect.linkedDefects && defect.linkedDefects.length > 0 && (
              <Card>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection('linkedDefects')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    {expandedSections.linkedDefects ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Link className="h-4 w-4" />
                    Linked Defects ({defect.linkedDefects.length})
                  </CardTitle>
                </CardHeader>
                {expandedSections.linkedDefects && (
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {defect.linkedDefects.map((linkedId: string) => (
                        <Badge key={linkedId} variant="outline" className="cursor-pointer hover:bg-gray-100">
                          {linkedId}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Closure Information */}
            {defect.status === 'Closed' && defect.closureComment && (
              <Card>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection('closure')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    {expandedSections.closure ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Closure Information
                  </CardTitle>
                </CardHeader>
                {expandedSections.closure && (
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Closed By</Label>
                          <Input value={defect.closedBy || '-'} disabled />
                        </div>
                        <div>
                          <Label>Closed On</Label>
                          <Input value={formatDate(defect.closedOn)} disabled />
                        </div>
                      </div>
                      <div>
                        <Label>Closure Comment</Label>
                        <Textarea 
                          value={defect.closureComment || '-'} 
                          disabled 
                          className="min-h-[80px]"
                        />
                      </div>
                      {defect.closureFiles && defect.closureFiles.length > 0 && (
                        <div>
                          <Label>Closure Attachments</Label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {defect.closureFiles.map((file: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Paperclip className="h-3 w-3 mr-1" />
                                {file.split('/').pop()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}