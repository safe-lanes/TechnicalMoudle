import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ImmediateCauseData {
  unsafeAct: string[];
  unsafeCondition: string[];
}

interface ImmediateCauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ImmediateCauseData) => void;
  initialData?: ImmediateCauseData | null;
}

// Maritime immediate cause options
const UNSAFE_ACT_OPTIONS = [
  "Non conformance to Legislative rules or regulations",
  "Improper use of Tools / Equipment",
  "Unsafe Work Practices",
  "Inadequate Training / Knowledge",
  "Personal Protective Equipment not used",
  "Violation of Safety Procedures",
  "Improper Body Position / Posture",
  "Unsafe lifting / carrying",
  "Working at unsafe speed",
  "Making safety devices inoperative",
  "Using defective equipment",
  "Failure to warn or secure",
  "Operating without authority",
  "Servicing equipment in operation",
  "Improper loading or placement",
  "Taking unsafe position or posture",
  "Working on moving or dangerous equipment",
  "Distracting, teasing, abusing, startling",
  "Failure to use personal protective equipment"
];

const UNSAFE_CONDITION_OPTIONS = [
  "Maintenance / Repair Error",
  "Defective Tools / Equipment",
  "Inadequate Guards / Barriers",
  "Poor Housekeeping",
  "Environmental Hazards",
  "Inadequate Warning Systems",
  "Fire and Explosion Hazards",
  "Poor Ventilation",
  "Noise Exposure",
  "Temperature Extremes",
  "Inadequate Lighting",
  "Congestion or restricted action",
  "Inadequate warning system",
  "Fire and explosion hazards",
  "Poor order and housekeeping",
  "Environmental hazards",
  "Wear of tools and equipment",
  "Design inadequacy",
  "Maintenance inadequacy",
  "Inadequate work procedures"
];

export default function ImmediateCauseModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData 
}: ImmediateCauseModalProps) {
  const [selectedUnsafeActs, setSelectedUnsafeActs] = useState<string[]>(
    initialData?.unsafeAct || []
  );
  const [selectedUnsafeConditions, setSelectedUnsafeConditions] = useState<string[]>(
    initialData?.unsafeCondition || []
  );

  // Sync state with initialData whenever modal opens or data changes
  useEffect(() => {
    if (isOpen) {
      setSelectedUnsafeActs(initialData?.unsafeAct || []);
      setSelectedUnsafeConditions(initialData?.unsafeCondition || []);
    }
  }, [isOpen, initialData]);

  const handleUnsafeActChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedUnsafeActs(prev => [...prev, option]);
    } else {
      setSelectedUnsafeActs(prev => prev.filter(item => item !== option));
    }
  };

  const handleUnsafeConditionChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedUnsafeConditions(prev => [...prev, option]);
    } else {
      setSelectedUnsafeConditions(prev => prev.filter(item => item !== option));
    }
  };

  const handleClear = () => {
    setSelectedUnsafeActs([]);
    setSelectedUnsafeConditions([]);
  };

  const handleSubmit = () => {
    onSubmit({
      unsafeAct: selectedUnsafeActs,
      unsafeCondition: selectedUnsafeConditions
    });
    onClose();
  };

  const handleCancel = () => {
    // Reset to initial data
    setSelectedUnsafeActs(initialData?.unsafeAct || []);
    setSelectedUnsafeConditions(initialData?.unsafeCondition || []);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle style={{ color: '#16569e' }}>
            Select Immediate Cause
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6 p-4">
            {/* Unsafe Act Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{ color: '#16569e' }}>
                Unsafe Act
              </h3>
              <div className="space-y-3">
                {UNSAFE_ACT_OPTIONS.map((option, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Checkbox
                      id={`unsafe-act-${index}`}
                      checked={selectedUnsafeActs.includes(option)}
                      onCheckedChange={(checked) => 
                        handleUnsafeActChange(option, checked as boolean)
                      }
                      style={{ 
                        borderColor: '#16569e',
                        color: '#16569e'
                      }}
                      data-testid={`checkbox-unsafe-act-${index}`}
                    />
                    <label 
                      htmlFor={`unsafe-act-${index}`}
                      className="text-sm leading-5 cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Unsafe Condition Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{ color: '#16569e' }}>
                Unsafe Condition
              </h3>
              <div className="space-y-3">
                {UNSAFE_CONDITION_OPTIONS.map((option, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Checkbox
                      id={`unsafe-condition-${index}`}
                      checked={selectedUnsafeConditions.includes(option)}
                      onCheckedChange={(checked) => 
                        handleUnsafeConditionChange(option, checked as boolean)
                      }
                      style={{ 
                        borderColor: '#16569e',
                        color: '#16569e'
                      }}
                      data-testid={`checkbox-unsafe-condition-${index}`}
                    />
                    <label 
                      htmlFor={`unsafe-condition-${index}`}
                      className="text-sm leading-5 cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClear}
            style={{ 
              color: '#16569e', 
              borderColor: '#16569e' 
            }}
            data-testid="button-clear-selections"
          >
            Clear All
          </Button>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              data-testid="button-cancel-modal"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              style={{ 
                backgroundColor: '#16569e',
                color: 'white',
                borderColor: '#16569e'
              }}
              className="hover:opacity-90"
              data-testid="button-submit-selections"
            >
              Submit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}