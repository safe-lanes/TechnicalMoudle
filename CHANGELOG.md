# Changelog

All notable changes to the Seafarer Technical Management System will be documented in this file.

## [1.1.0] - 2024-12-01

### Status: ✅ All Issues Verified

All 11 fixes have been tested and verified via comprehensive end-to-end testing.

### Bug Fixes

This release addresses 11 critical issues identified in the PMS system:

#### Issue #1: Component Edits Not Persisting
- **Problem**: When editing a component and clicking save, changes were lost on page refresh
- **Solution**: Fixed API endpoint to properly call `storage.updateComponent()` method
- **Files Modified**: `server/routes.ts`

#### Issue #2: New Components Not Appearing in Tree
- **Problem**: After creating a new component, it would not appear in the component tree until full page refresh
- **Solution**: Fixed parent ID lookup logic and tree refresh mechanism
- **Files Modified**: `server/persistentStorage.ts`

#### Issue #3: Spares ROB History Not Tracking
- **Problem**: Updates to spare parts ROB (Remaining On Board) were not creating transaction history records
- **Solution**: Added transaction logging for all ROB updates with proper history tracking
- **Files Modified**: `server/routes.ts`

#### Issue #4: Spares Component Tree Not Displaying
- **Problem**: The hierarchical component tree on the Spares page was not rendering
- **Solution**: Fixed hierarchical tree rendering and data fetching
- **Files Modified**: `SparesPage.tsx`

#### Issue #5: Counter-Based Work Order Validation Error
- **Problem**: Creating work orders for Running Hours-based jobs would fail validation
- **Solution**: Fixed validation logic to properly handle counter-based job types
- **Files Modified**: `WorkOrderFormPage.tsx`

#### Issue #6: Unplanned Work Order Missing Component List
- **Problem**: When creating an unplanned work order, the component dropdown was empty
- **Solution**: Fixed component fetch to retrieve all active components for the dropdown
- **Files Modified**: `WorkOrderFormPage.tsx`

#### Issue #7: Unplanned Work Order Save Failing
- **Problem**: Submitting an unplanned work order form would fail with server error
- **Solution**: Fixed save payload construction to match expected API format
- **Files Modified**: `server/routes.ts`

#### Issue #8: Change Request Approval Not Applying Changes
- **Problem**: When approving a Modify PMS change request, the approved changes were not applied to the target entity
- **Solution**: Implemented automatic entity update on approval with field name normalization and fallback lookup
- **Files Modified**: `server/routes/modifyPms.ts`

#### Issue #9: Running Hours Not Inheriting
- **Problem**: Child components were not inheriting Running Hours from their parent components
- **Solution**: Added `effectiveRH` and `rhInherited` fields to API response; UI displays "(Inherited)" indicator
- **Files Modified**: `server/persistentStorage.ts`

#### Issue #10: Missing Is Active Toggle
- **Problem**: Component edit form was missing the ability to set a component as inactive
- **Solution**: Added "Is Active" dropdown with Active/Inactive options, plus "Vessel Code" and "Is Parent" fields
- **Files Modified**: `ComponentRegisterAddEdit.tsx`

#### Issue #11: Bulk Imports All Going to Components
- **Problem**: Fleet Jobs and Fleet Spares bulk uploads were using mock implementations that didn't actually save data
- **Solution**: Replaced mock `setTimeout` implementations with proper `UniformBulkUpload` component
- **Files Modified**: `FleetJobsUpload.tsx`, `FleetSparesUpload.tsx`

### Technical Improvements

- Added detailed logging for bulk import type routing to aid debugging
- Enhanced error messages for validation failures
- Improved data persistence verification across all modules

### Known Limitations

- Running Hours inheritance only works for components with properly defined parent relationships
- Bulk import templates must match exact column headers
- Change requests for hardcoded main categories (IDs 1-8) are rejected as they are organizational placeholders

### Future Improvements

- Add batch editing support for multiple components
- Implement undo functionality for bulk imports
- Add export functionality for all data types
- Enhance Running Hours inheritance visualization in component tree
