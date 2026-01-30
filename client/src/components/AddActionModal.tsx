import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";

const actionSchema = z.object({
  actionType: z.string().min(1, "Type is required"),
  proposedBy: z.string().optional(),
  actionDescription: z.string().min(1, "Nature of action is required"),
  responsibility: z.string().optional(),
  email: z.string().optional(),
  dueDate: z.string().optional(),
  dateCompleted: z.string().optional(),
  status: z.string().min(1, "Status is required"),
});

type ActionFormData = z.infer<typeof actionSchema>;

interface AddActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (action: ActionFormData) => void;
  initialData?: ActionFormData | null;
}

export default function AddActionModal({ open, onOpenChange, onSave, initialData }: AddActionModalProps) {
  const form = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      actionType: "",
      proposedBy: "",
      actionDescription: "",
      responsibility: "",
      email: "",
      dueDate: "",
      dateCompleted: "",
      status: "Open",
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    } else {
      form.reset({
        actionType: "",
        proposedBy: "",
        actionDescription: "",
        responsibility: "",
        email: "",
        dueDate: "",
        dateCompleted: "",
        status: "Open",
      });
    }
  }, [initialData, form]);

  const handleSave = (data: ActionFormData) => {
    onSave(data);
    form.reset();
    onOpenChange(false);
  };

  const handleDiscard = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] p-0 gap-0 [&>button]:hidden">
        {/* Blue Header */}
        <div className="bg-[#1976d2] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold">{initialData ? 'Edit Action' : 'Add Action'}</h2>
          <button
            onClick={handleDiscard}
            className="text-white hover:text-gray-200 transition-colors"
            data-testid="button-close-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={form.handleSubmit(handleSave)} className="p-6 space-y-4">
          {/* Row 1: Type and Proposed By */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">
                Type<span className="text-red-500">*</span>
              </Label>
              <Controller
                name="actionType"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      data-testid="select-action-type"
                      className={`h-10 ${fieldState.error ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <SelectValue placeholder="TYPE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Immediate Action">Immediate Action</SelectItem>
                      <SelectItem value="Corrective Action">Corrective Action</SelectItem>
                      <SelectItem value="Preventive Action">Preventive Action</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">Proposed By</Label>
              <Controller
                name="proposedBy"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger data-testid="select-proposed-by" className="h-10 border-gray-300">
                      <SelectValue placeholder="PROPOSED BY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Vessel">Vessel</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Row 2: Nature of Action (Full Width) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600 uppercase font-normal">
              Nature of Action<span className="text-red-500">*</span>
            </Label>
            <Controller
              name="actionDescription"
              control={form.control}
              render={({ field, fieldState }) => (
                <Textarea
                  {...field}
                  data-testid="textarea-action-description"
                  placeholder="NATURE OF ACTION*"
                  className={`min-h-[100px] resize-none ${fieldState.error ? 'border-red-500' : 'border-gray-300'}`}
                />
              )}
            />
          </div>

          {/* Row 3: Responsibility and Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">Responsibility</Label>
              <Controller
                name="responsibility"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger data-testid="select-responsibility" className="h-10 border-gray-300">
                      <SelectValue placeholder="RESPONSIBILITY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Master">Master</SelectItem>
                      <SelectItem value="Chief Officer">Chief Officer</SelectItem>
                      <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                      <SelectItem value="Second Engineer">Second Engineer</SelectItem>
                      <SelectItem value="Safety Officer">Safety Officer</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">Email</Label>
              <Controller
                name="email"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    data-testid="input-email"
                    type="email"
                    placeholder="EMAIL"
                    className="h-10 border-gray-300"
                  />
                )}
              />
            </div>
          </div>

          {/* Row 4: Due Date and Date Closed */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">Due Date</Label>
              <Controller
                name="dueDate"
                control={form.control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        data-testid="button-due-date"
                        className="w-full h-10 justify-start text-left font-normal border-gray-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value + 'T00:00:00'), "PPP") : <span className="text-gray-400">DUE DATE</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">Date Closed</Label>
              <Controller
                name="dateCompleted"
                control={form.control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        data-testid="button-date-closed"
                        className="w-full h-10 justify-start text-left font-normal border-gray-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value + 'T00:00:00'), "PPP") : <span className="text-gray-400">DATE CLOSED</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          {/* Row 5: Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600 uppercase font-normal">
                Status<span className="text-red-500">*</span>
              </Label>
              <Controller
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      data-testid="select-status"
                      className={`h-10 ${fieldState.error ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Close">Close</SelectItem>
                      <SelectItem value="Dry Dock">Dry Dock</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscard}
              data-testid="button-discard"
              className="text-[#1976d2] hover:text-[#1565c0] hover:bg-blue-50"
            >
              DISCARD
            </Button>
            <Button
              type="submit"
              data-testid="button-save-action"
              className="bg-[#1976d2] hover:bg-[#1565c0] text-white px-8"
            >
              SAVE
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
