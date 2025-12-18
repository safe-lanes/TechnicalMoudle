import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sectionData: any) => void;
  nextSectionLetter: string;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextSectionLetter,
}) => {
  const [sectionTitle, setSectionTitle] = useState('');
  const [addFirstField, setAddFirstField] = useState(false);
  const [firstFieldData, setFirstFieldData] = useState({
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
  });

  const handleSave = () => {
    if (!sectionTitle) {
      return;
    }

    const sectionData = {
      id: `section-${nextSectionLetter}`,
      title: `${nextSectionLetter}. ${sectionTitle}`,
      fields: [],
    };

    // Add first field if specified
    if (addFirstField && firstFieldData.label) {
      const fieldKey = firstFieldData.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const suffix = Math.random().toString(36).substring(2, 6);
      
      sectionData.fields.push({
        id: `field_${Date.now()}`,
        key: `${fieldKey}_${suffix}`,
        label: firstFieldData.label,
        type: firstFieldData.type,
        required: firstFieldData.required,
        placeholder: firstFieldData.placeholder,
        active: true,
        locked: false,
      });
    }

    onSave(sectionData);

    // Reset form
    setSectionTitle('');
    setAddFirstField(false);
    setFirstFieldData({
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Section</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Section Title */}
          <div className="space-y-2">
            <Label>Section Title *</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[#16569e]">{nextSectionLetter}.</span>
              <Input
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g., Vendor Extras"
                className="flex-1"
              />
            </div>
          </div>

          {/* Add First Field Option */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAddFirstField(!addFirstField)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {addFirstField ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Add first field now (optional)
              </button>
            </div>

            {addFirstField && (
              <div className="ml-6 space-y-4 p-4 border rounded-lg bg-gray-50">
                {/* Field Label */}
                <div className="space-y-2">
                  <Label>Field Label</Label>
                  <Input
                    value={firstFieldData.label}
                    onChange={(e) => setFirstFieldData(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Field Label"
                  />
                </div>

                {/* Field Type */}
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={firstFieldData.type}
                    onValueChange={(value) => setFirstFieldData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Required */}
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={firstFieldData.required}
                    onCheckedChange={(checked) => setFirstFieldData(prev => ({ ...prev, required: checked }))}
                  />
                  <Label>Required</Label>
                </div>

                {/* Placeholder */}
                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={firstFieldData.placeholder}
                    onChange={(e) => setFirstFieldData(prev => ({ ...prev, placeholder: e.target.value }))}
                    placeholder="Optional placeholder text"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!sectionTitle}>
            Create Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSectionModal;