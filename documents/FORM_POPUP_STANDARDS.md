# Form Popup Standards Guide

## Overview

This guide establishes consistent spacing and styling standards for all form modal popups in the application.

## StandardFormPopup Component

### Purpose
Provides consistent spacing and styling for all form modal popups across the application.

### Features
- **Equal spacing on all sides**: 1rem padding via `p-4`
- **Consistent modal height**: `h-[calc(100vh-2rem)]`
- **Responsive design**: Works on mobile and desktop
- **Standard close button**: Consistent UX across all forms
- **Optional title header**: With integrated close button

### Usage

#### Basic Usage
```tsx
import { FormPopup } from "@/components/ui/form-popup"

<FormPopup title="Form Title" onClose={handleClose}>
  <YourFormContent />
</FormPopup>
```

#### Advanced Usage with Custom Components
```tsx
import { FormPopupOverlay, FormPopupContent } from "@/components/ui/form-popup"

<FormPopupOverlay>
  <FormPopupContent className="max-w-4xl">
    <YourCustomFormContent />
  </FormPopupContent>
</FormPopupOverlay>
```

## Migration Guide

### From Custom Modal Implementation

**Before:**
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
  <div className="bg-white rounded-lg w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
    {/* Content */}
  </div>
</div>
```

**After:**
```tsx
<FormPopup title="Your Form Title" onClose={handleClose}>
  {/* Content */}
</FormPopup>
```

### Benefits of Migration
- ✅ Consistent spacing across all forms
- ✅ Reduced code duplication
- ✅ Responsive design built-in
- ✅ Accessibility improvements
- ✅ Easier maintenance

## Spacing Standards

### Core Specifications
- **Outer padding**: `p-4` (1rem on all sides)
- **Modal height**: `h-[calc(100vh-2rem)]` (accounts for padding)
- **Max width**: `w-full` (customizable via className)
- **Border radius**: `rounded-lg`
- **Shadow**: `shadow-lg`

### Visual Result
- Equal spacing on top, bottom, left, and right
- No excessive vertical gaps
- Professional, balanced appearance
- Consistent across all devices

## Future Development

### New Form Popups
All new form popups should use the StandardFormPopup component by default.

### Customization
If you need custom styling, extend the base component:
```tsx
<FormPopup 
  className="max-w-6xl"  // Custom width
  title="Custom Title"
  onClose={handleClose}
>
  <YourContent />
</FormPopup>
```

### Testing
Test all form popups at different screen sizes to ensure consistent spacing:
- Mobile: 320px - 768px
- Tablet: 768px - 1024px  
- Desktop: 1024px+

## Examples

### Current Implementations
- ✅ Admin FormEditor: Uses consistent spacing
- ✅ Crew Appraisal Form: Uses consistent spacing

### Component Hierarchy
```
FormPopupOverlay (p-4)
  └── FormPopupContent (h-[calc(100vh-2rem)])
      ├── Header (optional)
      └── Content Area
```

This standard ensures all form popups maintain visual consistency and professional appearance across the application.