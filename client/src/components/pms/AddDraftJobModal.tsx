import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface DraftJob {
  jobTitle: string;
  maintenanceType: string;
  maintenanceBasis: string;
  frequencyValue: string;
  frequencyUnit: string;
  lastDoneDate: string;
  lastDoneRH: string;
  assignedTo: string;
  jobPriority: string;
  briefWorkDescription: string;
}

export const EMPTY_DRAFT_JOB: DraftJob = {
  jobTitle: '',
  maintenanceType: '',
  maintenanceBasis: 'Calendar',
  frequencyValue: '',
  frequencyUnit: 'Months',
  lastDoneDate: '',
  lastDoneRH: '',
  assignedTo: '',
  jobPriority: 'Low',
  briefWorkDescription: '',
};

interface AddDraftJobModalProps {
  open: boolean;
  onClose: () => void;
  onSaveDraft: (job: DraftJob) => void;
  componentCode: string;
  componentName: string;
}

export function AddDraftJobModal({
  open,
  onClose,
  onSaveDraft,
  componentCode,
  componentName,
}: AddDraftJobModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<DraftJob>(EMPTY_DRAFT_JOB);

  const isRH = formData.maintenanceBasis === 'Running Hours';

  const handleClose = () => {
    setFormData(EMPTY_DRAFT_JOB);
    onClose();
  };

  const handleSaveDraft = () => {
    if (!formData.jobTitle.trim()) {
      toast({ title: 'Validation Error', description: 'Job Title is required.', variant: 'destructive' });
      return;
    }
    onSaveDraft({ ...formData });
    setFormData(EMPTY_DRAFT_JOB);
    onClose();
  };

  const setField = (key: keyof DraftJob, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Job</DialogTitle>
          <DialogDescription>
            Draft job linked to this component. It will be saved to the database when you save the component.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-md border border-blue-100">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Component Code</label>
              <div className="text-sm font-semibold text-[#16569e]">{componentCode || '—'}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Component Name</label>
              <div className="text-sm font-semibold text-[#16569e]">{componentName || '—'}</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Job Title<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={e => setField('jobTitle', e.target.value)}
              className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
              placeholder="Enter job title"
              data-testid="input-draft-job-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Task Type</label>
              <select
                value={formData.maintenanceType}
                onChange={e => setField('maintenanceType', e.target.value)}
                className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                data-testid="select-draft-task-type"
              >
                <option value="">Select Task Type</option>
                <option value="Inspection">Inspection</option>
                <option value="Overhaul">Overhaul</option>
                <option value="Service">Service</option>
                <option value="Testing">Testing</option>
                <option value="Renewal">Renewal</option>
                <option value="Lubrication">Lubrication</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Maintenance Basis</label>
              <select
                value={formData.maintenanceBasis}
                onChange={e => {
                  const basis = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    maintenanceBasis: basis,
                    frequencyUnit: basis === 'Running Hours' ? 'Hours' : 'Months',
                    lastDoneDate: '',
                    lastDoneRH: '',
                  }));
                }}
                className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                data-testid="select-draft-maintenance-basis"
              >
                <option value="Calendar">Calendar</option>
                <option value="Running Hours">Running Hours</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {isRH ? 'RH Interval (Hours)' : 'Frequency Value'}
              </label>
              <input
                type="number"
                value={formData.frequencyValue}
                onChange={e => setField('frequencyValue', e.target.value)}
                className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                placeholder={isRH ? 'e.g. 500' : 'e.g. 3'}
                min="1"
                data-testid="input-draft-frequency-value"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Frequency Unit</label>
              {isRH ? (
                <div className="text-sm px-2 py-1.5 border rounded bg-gray-50 text-gray-700 border-gray-300">Hours</div>
              ) : (
                <select
                  value={formData.frequencyUnit}
                  onChange={e => setField('frequencyUnit', e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                  data-testid="select-draft-frequency-unit"
                >
                  <option value="Days">Days</option>
                  <option value="Weeks">Weeks</option>
                  <option value="Months">Months</option>
                  <option value="Years">Years</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {isRH ? 'Last Done RH' : 'Last Done Date'}
              </label>
              {isRH ? (
                <input
                  type="number"
                  value={formData.lastDoneRH}
                  onChange={e => setField('lastDoneRH', e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                  placeholder="e.g. 12000"
                  min="0"
                  data-testid="input-draft-last-done-rh"
                />
              ) : (
                <input
                  type="date"
                  value={formData.lastDoneDate}
                  onChange={e => setField('lastDoneDate', e.target.value)}
                  className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                  data-testid="input-draft-last-done-date"
                />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
              <select
                value={formData.jobPriority}
                onChange={e => setField('jobPriority', e.target.value)}
                className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
                data-testid="select-draft-priority"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Assigned To (Rank)</label>
            <input
              type="text"
              value={formData.assignedTo}
              onChange={e => setField('assignedTo', e.target.value)}
              className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none"
              placeholder="e.g. Chief Engineer"
              data-testid="input-draft-assigned-to"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Brief Work Description</label>
            <textarea
              value={formData.briefWorkDescription}
              onChange={e => setField('briefWorkDescription', e.target.value)}
              className="text-sm w-full px-2 py-1.5 border rounded border-gray-300 focus:border-blue-400 focus:outline-none resize-none"
              rows={3}
              placeholder="Describe the work to be done..."
              data-testid="textarea-draft-description"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={handleClose} data-testid="btn-draft-job-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSaveDraft}
            className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
            data-testid="btn-draft-job-save"
          >
            Save Draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
