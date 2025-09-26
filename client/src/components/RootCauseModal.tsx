import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface RootCauseData {
  individualFactor: string[];
  systemFactor: string[];
}

interface RootCauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RootCauseData) => void;
  initialData?: RootCauseData | null;
}

// Maritime root cause options based on reference image
const INDIVIDUAL_FACTOR_OPTIONS = [
  "Inadequate Physical / Mental / psychological capabilities (e.g. Height, Size, Strength)",
  "Lack of Knowledge",
  "Lack of Skill / Experience",
  "Fatigue / Tiredness",
  "Mental State / Mental Stress",
  "Lack of Motivation / Incentive (Safety precedence over commercial factors)",
  "Inadequate Leadership / Management onboard",
  "Inadequate SHE Control / Risk management",
  "Others (Specify)",
  "Not Applicable"
];

const SYSTEM_FACTOR_OPTIONS = [
  "Inadequate planning / preparation / familiarisation / training requirement",
  "Conflicting Roles / responsibilities",
  "Inadequate Leadership / Supervision",
  "Inadequate Management of change",
  "Inadequate Work site assessment / hazards identification",
  "Inadequate technical design / Standards & specifications",
  "Inadequate Stock control / Spare parts inventory control",
  "Inadequate Work procedures / Standards / Permit to Work system",
  "Inadequate or Poor Quality Purchasing",
  "Inadequate Maintenance or Not Done as per Manufacturer(s) Schedules",
  "Inadequate / Incorrect Tools and Equipment",
  "Wear and Tear (Not Related to Lack of Maintenance)",
  "Abuse or Intentional Misuse of Equipment",
  "Communication",
  "Others (Specify)",
  "Not Applicable"
];

export default function RootCauseModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData 
}: RootCauseModalProps) {
  const [selectedIndividualFactors, setSelectedIndividualFactors] = useState<string[]>(
    initialData?.individualFactor || []
  );
  const [selectedSystemFactors, setSelectedSystemFactors] = useState<string[]>(
    initialData?.systemFactor || []
  );

  // Sync state with initialData whenever modal opens or data changes
  useEffect(() => {
    if (isOpen) {
      setSelectedIndividualFactors(initialData?.individualFactor || []);
      setSelectedSystemFactors(initialData?.systemFactor || []);
    }
  }, [isOpen, initialData]);

  const handleIndividualFactorChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedIndividualFactors(prev => [...prev, option]);
    } else {
      setSelectedIndividualFactors(prev => prev.filter(item => item !== option));
    }
  };

  const handleSystemFactorChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedSystemFactors(prev => [...prev, option]);
    } else {
      setSelectedSystemFactors(prev => prev.filter(item => item !== option));
    }
  };

  const handleClear = () => {
    setSelectedIndividualFactors([]);
    setSelectedSystemFactors([]);
  };

  const handleSubmit = () => {
    onSubmit({
      individualFactor: selectedIndividualFactors,
      systemFactor: selectedSystemFactors
    });
    onClose();
  };

  const handleCancel = () => {
    // Reset to initial data
    setSelectedIndividualFactors(initialData?.individualFactor || []);
    setSelectedSystemFactors(initialData?.systemFactor || []);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader style={{ backgroundColor: '#16569e', color: 'white', margin: '-1.5rem -1.5rem 0 -1.5rem', padding: '1rem 1.5rem' }}>
          <DialogTitle style={{ color: 'white', fontSize: '1.125rem', fontWeight: '600' }}>
            Root Cause
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-8 p-6">
            {/* Individual Factor Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{ color: '#16569e' }}>
                Individual Factor
              </h3>
              <div className="space-y-3">
                {INDIVIDUAL_FACTOR_OPTIONS.map((option, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Checkbox
                      id={`individual-factor-${index}`}
                      checked={selectedIndividualFactors.includes(option)}
                      onCheckedChange={(checked) => 
                        handleIndividualFactorChange(option, checked as boolean)
                      }
                      style={{ 
                        borderColor: '#16569e',
                        color: '#16569e'
                      }}
                      data-testid={`checkbox-individual-factor-${index}`}
                    />
                    <label 
                      htmlFor={`individual-factor-${index}`}
                      className="text-sm leading-5 cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* System Factor Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{ color: '#16569e' }}>
                System Factor
              </h3>
              <div className="space-y-3">
                {SYSTEM_FACTOR_OPTIONS.map((option, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Checkbox
                      id={`system-factor-${index}`}
                      checked={selectedSystemFactors.includes(option)}
                      onCheckedChange={(checked) => 
                        handleSystemFactorChange(option, checked as boolean)
                      }
                      style={{ 
                        borderColor: '#16569e',
                        color: '#16569e'
                      }}
                      data-testid={`checkbox-system-factor-${index}`}
                    />
                    <label 
                      htmlFor={`system-factor-${index}`}
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
            data-testid="button-clear-root-selections"
          >
            Clear All
          </Button>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              data-testid="button-cancel-root-modal"
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
              data-testid="button-save-root-selections"
            >
              SAVE
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}