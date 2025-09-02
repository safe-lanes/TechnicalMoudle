import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IHM_MATERIALS, IHM_PRESENCE, IHM_EVIDENCE_TYPES } from '@/config/features';

interface IhmManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId?: string;
  spareId?: string;
  type: 'component' | 'spare';
}

const IhmManagementModal: React.FC<IhmManagementModalProps> = ({
  isOpen,
  onClose,
  componentId,
  spareId,
  type
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [presence, setPresence] = useState<string>('Unknown');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [evidenceType, setEvidenceType] = useState<string>('None');
  const [evidenceFileName, setEvidenceFileName] = useState<string>('');
  const [verifiedDate, setVerifiedDate] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  
  // Fetch existing IHM data
  const { data: existingData } = useQuery({
    queryKey: [`/api/ihm/${type}/${type === 'component' ? componentId : spareId}`],
    enabled: isOpen && !!(componentId || spareId),
  });
  
  useEffect(() => {
    if (existingData) {
      setPresence(existingData.presence || 'Unknown');
      setSelectedMaterials(existingData.materials || []);
      setEvidenceType(existingData.evidenceType || 'None');
      setEvidenceFileName(existingData.evidenceFileName || '');
      setVerifiedDate(existingData.verifiedDate || '');
      setSupplier(existingData.supplier || '');
      setRemarks(existingData.remarks || '');
    }
  }, [existingData]);
  
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/ihm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to save IHM data');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'IHM data saved successfully'
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/ihm/${type}/${type === 'component' ? componentId : spareId}`] 
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save IHM data',
        variant: 'destructive'
      });
    }
  });
  
  const handleSave = () => {
    const data = {
      ...(type === 'component' ? { componentId } : { spareId }),
      presence,
      materials: selectedMaterials,
      evidenceType,
      evidenceFileName,
      verifiedDate,
      supplier,
      remarks,
      vesselId: 'V001'
    };
    
    saveMutation.mutate(data);
  };
  
  const toggleMaterial = (material: string) => {
    setSelectedMaterials(prev => 
      prev.includes(material) 
        ? prev.filter(m => m !== material)
        : [...prev, material]
    );
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenceFileName(file.name);
      // In a real implementation, you would upload the file to storage
      toast({
        title: 'File selected',
        description: `${file.name} will be uploaded on save`
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage IHM Data</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="presence">Presence</Label>
            <Select value={presence} onValueChange={setPresence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IHM_PRESENCE.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Materials</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
              {IHM_MATERIALS.map(material => (
                <div key={material} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={material}
                    checked={selectedMaterials.includes(material)}
                    onCheckedChange={() => toggleMaterial(material)}
                  />
                  <label
                    htmlFor={material}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {material}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="evidenceType">Evidence Type</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IHM_EVIDENCE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="evidenceFile">Evidence File</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                id="evidenceFile"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              {evidenceFileName && (
                <span className="text-sm text-gray-600 self-center">
                  Current: {evidenceFileName}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="verifiedDate">Verified Date</Label>
              <Input
                type="date"
                id="verifiedDate"
                value={verifiedDate}
                onChange={(e) => setVerifiedDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Enter supplier name"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter any additional remarks"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IhmManagementModal;