import * as React from "react"
import { cn } from "@/lib/utils"

interface FormSectionProps {
  partLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ partLabel, title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn("bg-white border border-gray-200 shadow-sm rounded-lg p-6", className)}>
      <h2 className="text-xl font-semibold text-[#1e3a5f]">
        {partLabel}: {title}
      </h2>
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
      <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}

export function FormField({ label, children, className, required }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label className="text-sm text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500",
          className
        )}
        {...props}
      />
    );
  }
);
FormInput.displayName = "FormInput";

interface FormSectionContentProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function FormSectionContent({ children, columns = 3, className }: FormSectionContentProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3"
  };
  
  return (
    <div className={cn(`grid ${gridCols[columns]} gap-x-6 gap-y-4`, className)}>
      {children}
    </div>
  );
}

interface FormSubSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSubSection({ title, children, className }: FormSubSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      )}
      {children}
    </div>
  );
}
