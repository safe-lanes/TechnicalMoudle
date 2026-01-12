"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormPopupProps {
  title: string;
  onBack: () => void;
  onSaveDraft?: () => void;
  children: React.ReactNode;
}

export function FormPopup({ title, onBack, onSaveDraft, children }: FormPopupProps) {
  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-md text-gray-600"
            data-testid="button-back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>
        {onSaveDraft && (
          <button
            onClick={onSaveDraft}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600"
            data-testid="button-save-draft"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>
        )}
      </header>
      <div className="flex-1 overflow-hidden flex">
        {children}
      </div>
    </div>
  );
}

interface StandardFormPopupProps {
  children: React.ReactNode
  className?: string
  onClose?: () => void
  title?: string
  isOpen?: boolean
}

export const StandardFormPopup = React.forwardRef<
  HTMLDivElement,
  StandardFormPopupProps
>(({ className, children, onClose, title, isOpen = true, ...props }, ref) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-lg shadow-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden",
          className
        )}
        {...props}
      >
        {title && (
          <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold">{title}</h1>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
})
StandardFormPopup.displayName = "StandardFormPopup"

export const FormPopupOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      className
    )}
    {...props}
  />
))
FormPopupOverlay.displayName = "FormPopupOverlay"

export const FormPopupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-white rounded-lg shadow-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden",
      className
    )}
    {...props}
  />
))
FormPopupContent.displayName = "FormPopupContent"
