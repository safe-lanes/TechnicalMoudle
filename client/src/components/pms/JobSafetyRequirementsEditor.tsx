import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Marker } from "@/components/Marker";
import {
  JOB_SAFETY_FIELDS,
  getJobSafetyList,
  type JobSafetyDraft,
  type JobSafetyField,
} from "@/lib/jobSafetyRequirements";

interface JobSafetyRequirementsEditorProps {
  requirements: unknown;
  draft: JobSafetyDraft;
  onChange: (field: JobSafetyField, value: string) => void;
  disabled?: boolean;
}

export default function JobSafetyRequirementsEditor({
  requirements,
  draft,
  onChange,
  disabled = false,
}: JobSafetyRequirementsEditorProps) {
  return (
    <div className="space-y-3">
      <p id="job-safety-entry-help" className="text-xs text-gray-500">
        Enter one requirement per line. Remove all text to clear a field.
      </p>
      {JOB_SAFETY_FIELDS.map(({ field, label, testId, marker }) => (
        <div key={field} className="space-y-1.5">
          <Label htmlFor={testId} className="text-sm font-semibold text-gray-700" data-testid={marker}>
            <Marker id={marker} />{label}
          </Label>
          <Textarea
            id={testId}
            data-testid={testId}
            aria-describedby="job-safety-entry-help"
            value={draft[field] ?? getJobSafetyList(requirements, field).join("\n")}
            onChange={event => onChange(field, event.target.value)}
            disabled={disabled}
            placeholder="Enter one requirement per line"
            rows={3}
            className="text-sm"
          />
        </div>
      ))}
    </div>
  );
}