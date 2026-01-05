# Archived Files

This folder contains unused/dead code files that were identified and archived on 05-Jan-2026.
These files are kept for reference in case functionality needs to be restored.

## Archived Files

### admin/
- **WorkOrderUpload.tsx** - Bulk work order upload UI (incomplete - no backend API exists)

### defects/
- **DefectForm.tsx** - Old defect form (replaced by DefectFormWizard)
- **DefectFormSimple.tsx** - Simplified defect form (never integrated)
- **DefectsRecurring.tsx** - Duplicate of RecurringDefects.tsx in parent folder

### modify-pms/
- **ModifyPMS.tsx** - Duplicate component (system uses components/modifyPms/ModifyPMS.tsx instead)

### spares/
- **Spares.tsx** - Old spares page (replaced by SparesNew.tsx)

### change-requests/
- **ChangeRequestsLogWithTabs.tsx** - Change request UI (not connected to navigation)

## Reason for Archiving
These files were identified as dead code during a codebase audit:
1. Not imported by any other component
2. Not registered in App.tsx routes
3. Not accessible via navigation (SideMenuBar/TopMenuBar)
4. Some had no corresponding backend API endpoints
