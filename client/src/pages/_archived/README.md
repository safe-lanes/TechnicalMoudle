# Archived Files

This folder contains unused/dead code files that were identified and archived on 05-Jan-2026.
The remaining files are kept for reference in case functionality needs to be restored.
The unused `defects/DefectForm.tsx` and `defects/DefectFormSimple.tsx` reference
copies have been retired; use Git history to recover them if needed. Previous
compiler investigation reports remain historical evidence, not a current inventory.

## Archived Files

### admin/
- **WorkOrderUpload.tsx** - Bulk work order upload UI (incomplete - no backend API exists)

### defects/
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
