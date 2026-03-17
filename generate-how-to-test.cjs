const XLSX = require('xlsx');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'attached_assets', 'PMS_Test_Cases_Comprehensive_(1)_1773732351055.xlsx');
const OUTPUT_FILE = path.join(__dirname, 'PMS_Test_Cases_With_HowToTest.xlsx');

function generateHowToTest(testCase) {
  const id = testCase['Test Case ID'] || '';
  const section = testCase['Module/Section'] || '';
  const scenario = testCase['Test Scenario'] || '';
  const steps = testCase['Test Steps'] || '';
  const testData = testCase['Test Data'] || '';
  const expected = testCase['Expected Result'] || '';

  if (id.startsWith('COMP-')) return generateComponentHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('WO-')) return generateWorkOrderHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('RH-')) return generateRunningHoursHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('SP-')) return generateSparesHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('ST-')) return generateStoresHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('RPT-')) return generateReportsHowToTest(id, section, scenario, steps, testData, expected);
  if (id.startsWith('DASH-')) return generateDashboardHowToTest(id, section, scenario, steps, testData, expected);
  return 'No instructions available for this test case.';
}

function generateComponentHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'COMP-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Components" to open the Components page.\n3. In the top-right vessel dropdown, select a vessel (e.g., "Vessel 11").\n4. Wait for the component tree to load in the left panel.\n5. VERIFY: The component tree displays a hierarchical list of components grouped under main categories (1-Engine, 2-Deck, etc.).\n6. VERIFY: Each component shows its code and name (e.g., "702.005.01 - FO Separators No.01").\n7. VERIFY: Clicking on any component in the tree reveals its details in the right panel (Component Information section).\n8. VERIFY: The total component count is displayed at the top of the tree panel.`,

    'COMP-002': `HOW TO TEST:\n1. Navigate to PMS > Components from the sidebar.\n2. Select a vessel from the dropdown to load components.\n3. Look for the items-per-page dropdown at the bottom of the component tree (if pagination exists) or count the visible components.\n4. The component tree in RSMS uses a hierarchical tree view rather than a flat paginated list. Nodes are expanded/collapsed by clicking the chevron arrows.\n5. VERIFY: If a pagination control exists, select "10" and confirm only 10 top-level items display per page.\n6. VERIFY: Navigation controls (Next/Previous) work if pagination is present.\nNOTE: The current RSMS component view uses an expandable tree structure. If no explicit pagination dropdown exists, document this as "Tree view - pagination not applicable" in the Comments column.`,

    'COMP-003': `HOW TO TEST:\n1. Navigate to PMS > Components from the sidebar.\n2. Select a vessel from the dropdown.\n3. If the component tree has a pagination or items-per-page selector at the bottom, select "25".\n4. VERIFY: Up to 25 top-level items are displayed per page.\nNOTE: If the tree view does not have explicit page-size controls, note "Tree view without pagination selector" in Comments.`,

    'COMP-004': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. If pagination controls exist, select "50" from the items-per-page dropdown.\n3. VERIFY: Up to 50 items display per page.\nNOTE: Same caveat as COMP-002/003 regarding tree view pagination.`,

    'COMP-005': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. If pagination controls exist, select "100" from the items-per-page dropdown.\n3. VERIFY: Up to 100 items display per page and performance remains acceptable (page loads within a few seconds).\nNOTE: Same caveat as COMP-002/003 regarding tree view pagination.`,

    'COMP-006': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Look at the component tree — it is sorted by component code by default (e.g., 101, 102, 201, 301, etc.).\n3. If a sort toggle or column header for "Code" exists, click it to change sort direction.\n4. VERIFY: Components are ordered by their numeric component code.\n5. VERIFY: After toggling sort, the order reverses (descending) or returns to ascending.`,

    'COMP-007': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. If a sort option for "Component Name" exists (column header or dropdown), click it.\n3. VERIFY: Components rearrange alphabetically by name.\n4. VERIFY: Clicking again reverses the order (Z-A).\nNOTE: The tree view may not support sorting by name independently. If not available, note in Comments.`,

    'COMP-008': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel with components loaded.\n2. Locate the search bar at the top of the component tree panel (magnifying glass icon).\n3. Type a component code (e.g., "702.005") into the search bar.\n4. VERIFY: The tree filters to show only components whose code matches or contains "702.005".\n5. VERIFY: Parent nodes auto-expand to reveal matching child components.\n6. Clear the search field and VERIFY that the full tree reappears.`,

    'COMP-009': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. In the search bar at the top of the tree panel, type a component name (e.g., "pump" or "separator").\n3. VERIFY: The tree filters to show only components whose name contains the search text.\n4. VERIFY: Matching components are highlighted or their parent nodes auto-expand.\n5. Clear the search and VERIFY the full tree returns.`,

    'COMP-010': `HOW TO TEST:\n1. Navigate to PMS > Components.\n2. Locate the vessel dropdown in the top-right area of the page (or the global vessel selector bar).\n3. Select a different vessel (e.g., switch from "Vessel 11" to "Vessel 14").\n4. VERIFY: The component tree refreshes and shows components for the newly selected vessel.\n5. VERIFY: Component count updates to reflect the new vessel's data.\n6. Switch back to the original vessel and VERIFY the tree reloads correctly.`,

    'COMP-011': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Look for a "Maintenance Basis" filter dropdown or checkbox above or beside the component tree.\n3. If the filter exists, select "Calendar" and VERIFY only calendar-based components show.\n4. Select "Running Hours" and VERIFY only RH-based components show.\nNOTE: The current RSMS Components page may not have a maintenance basis filter at the component list level (maintenance basis is a Job-level concept). If this filter does not exist, note "Filter not available — maintenance basis is at Job level" in Comments.`,

    'COMP-012': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Look for a component count display near the top of the tree panel (e.g., "Total Components: 3622" or a count shown in the header area).\n3. VERIFY: The count is visible and matches the actual number of components loaded.\n4. Apply a search filter (e.g., type "pump") and VERIFY the count updates to reflect filtered results.`,

    'COMP-013': `HOW TO TEST:\n1. Navigate to PMS > Components on a desktop browser.\n2. VERIFY: The page has a two-panel layout — tree on the left, details on the right.\n3. Resize the browser window to tablet width (768px).\n4. VERIFY: The layout adjusts appropriately — panels may stack vertically or the tree may collapse.\n5. Resize to mobile width (375px).\n6. VERIFY: Content remains accessible and readable; no horizontal scrollbar overflow.\n7. VERIFY: All buttons and interactive elements are still tappable/clickable.`,

    'COMP-014': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Look for the "+ Add / Edit Component" button (blue button with plus icon) in the header area of the Components page.\n3. Click the button.\n4. VERIFY: The Add/Edit Component form opens, showing a component tree on the left and a blank form on the right.\n5. VERIFY: The form has sections: Component Information (Section A), and additional sections like Running Hours & Condition Monitoring (Section B).\n6. VERIFY: The form title shows "Add / Edit Component" or similar heading.`,

    'COMP-015': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. In the component tree on the left, click a parent component (e.g., "702 - Fuel Oil System") to set it as the parent.\n3. The form should auto-populate:\n   - Parent Component Code (from selected parent)\n   - Component Code (auto-generated, e.g., "702.006")\n   - Component Category (auto-derived from code)\n4. Fill in all mandatory fields:\n   - Component Name: "Test Component ABC"\n   - Equipment/System Department: select "Engine" from dropdown\n   - Maker: type or select a maker\n5. Set Criticality to "Yes" or "No".\n6. Click the "Save" button at the bottom of the form.\n7. VERIFY: A success toast message appears ("Component saved successfully" or similar).\n8. VERIFY: The new component appears in the tree under the parent you selected.`,

    'COMP-016': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component in the tree.\n3. Leave the Component Name field empty.\n4. Leave the Equipment/System Department as "Select" (no selection).\n5. Click the "Save" button.\n6. VERIFY: Validation errors appear — red border/text around the empty required fields.\n7. VERIFY: A message like "This field is required" appears next to each missing mandatory field.\n8. VERIFY: The form does NOT save — no success message appears.`,

    'COMP-017': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component in the tree.\n3. Note the auto-generated component code (e.g., "702.006").\n4. Try to manually type an invalid code format (e.g., "ABC" or "1.2.3.4.5.6").\n5. VERIFY: The system either prevents invalid input, shows a validation error, or the code field is read-only/auto-generated.\n6. VERIFY: Valid codes follow the hierarchical format (e.g., "X01", "X01.001", "X01.001.01").`,

    'COMP-018': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component in the tree.\n3. Note the auto-generated component code.\n4. Manually change the component code to match an existing component's code (e.g., "702.005.01").\n5. Fill in all required fields and click "Save".\n6. VERIFY: The system shows an error message indicating the component code already exists (e.g., "Duplicate component code").\n7. VERIFY: The form does NOT save with a duplicate code.`,

    'COMP-019': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent and fill required fields.\n3. In the Component Name field, type a very short name (e.g., "A" — 1 character).\n4. Click Save and check if a minimum length validation error appears.\n5. Clear the name and type a very long name (200+ characters).\n6. Click Save.\n7. VERIFY: If there is a max length, an appropriate error appears. If no limit, the name saves correctly.\n8. VERIFY: Minimum and maximum length constraints (if any) are clearly communicated.`,

    'COMP-020': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component and fill required fields (name, department, etc.).\n3. This test verifies that a component can have jobs with "Calendar" maintenance basis.\n4. After saving the component, add a job to it with maintenance basis set to "Calendar".\n5. Set the frequency (e.g., "3 Months") and a due date.\n6. VERIFY: The job is created successfully with Calendar basis.\n7. VERIFY: The job appears in the component's jobs list showing "Calendar" as the maintenance type.`,

    'COMP-021': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component and fill required fields.\n3. After saving the component, go to the Running Hours & Condition Monitoring section (Section B in the form).\n4. Set the RH Counter Type to "Master" or "Inherited".\n5. Add a job with maintenance basis "Running Hours".\n6. Set the frequency (e.g., "500 RH").\n7. VERIFY: The job is created with Running Hours basis.\n8. VERIFY: The component now shows RH tracking information in its details.`,

    'COMP-022': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent and fill required fields.\n3. Find the "Class Item" dropdown (in the form, near the bottom of Section A).\n4. Change it from "No" to "Yes".\n5. Save the component.\n6. VERIFY: The Class Item field shows "Yes" when viewing the saved component.\n7. Change it back to "No" and save again.\n8. VERIFY: The field correctly toggles between Yes/No.`,

    'COMP-023': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component.\n3. Find the "Equipment / System Department" dropdown.\n4. Click the dropdown and VERIFY it shows options: Engine, Deck, Electrical, Galley, LSA, FFA.\n5. Select "Engine" and VERIFY it is selected.\n6. Change to "Deck" and VERIFY the selection updates.\n7. Save the component and reopen it.\n8. VERIFY: The department selection persisted correctly after save.`,

    'COMP-024': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component.\n3. Find the "Criticality" dropdown (shows "Yes" / "No" options).\n4. Select "Yes" (Critical).\n5. Save the component.\n6. VERIFY: In the component tree and detail view, the component shows a criticality indicator (red badge or "Yes" label).\n7. Edit the component and change criticality to "No".\n8. VERIFY: The criticality indicator updates accordingly.`,

    'COMP-025': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Fill in all required fields for a new component.\n3. Locate the "Save" button (bottom of the form).\n4. Click Save.\n5. VERIFY: The button shows a loading state (spinner) while saving.\n6. VERIFY: A success toast appears after save completes.\n7. VERIFY: The form data is persisted — reopening the component shows the saved values.\n8. VERIFY: Clicking Save with no changes still succeeds (idempotent save).`,

    'COMP-026': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Begin filling in fields (type a name, select a department, etc.).\n3. Find and click the "Back" arrow button (top-left of the Add/Edit form, arrow icon).\n4. VERIFY: The form closes and you return to the main Components tree view.\n5. VERIFY: The partially entered data is NOT saved — opening the form again shows a blank form.\n6. VERIFY: No error messages appear during cancellation.`,

    'COMP-027': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Fill in all required fields and click "Save".\n3. VERIFY: A green success toast notification appears at the top or bottom-right of the screen.\n4. VERIFY: The message reads something like "Component saved successfully" or "Component created".\n5. VERIFY: The toast auto-dismisses after a few seconds or can be manually closed.`,

    'COMP-028': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Create and save a new component successfully.\n3. After save completes:\n4. VERIFY: You are either redirected back to the Components list/tree view, OR the form stays open showing the saved component in edit mode.\n5. VERIFY: The newly created component is visible in the component tree.\n6. VERIFY: You can click on the new component in the tree to see its details.`,

    'COMP-029': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Click on any existing component in the tree (e.g., "702.005.01 - FO Separators No.01").\n3. In the component details panel (right side), look for an Edit button or the "+ Add / Edit Component" button.\n4. Click it to open the component in editing mode.\n5. VERIFY: The Add/Edit Component form opens with the selected component pre-loaded.\n6. VERIFY: All fields are populated with the component's existing data.\n7. VERIFY: The component tree on the left highlights/selects the component being edited.`,

    'COMP-030': `HOW TO TEST:\n1. Navigate to PMS > Components, select a vessel, and click on a component to view its details.\n2. Click the edit button to open the Add/Edit Component form.\n3. VERIFY each field is pre-populated with saved data:\n   - Component Code matches (e.g., "702.005.01")\n   - Component Name matches (e.g., "FO Separators No.01")\n   - Parent Component Code is correct\n   - Maker, Model, Serial No fields show saved values\n   - Equipment/System Department dropdown shows the correct selection\n   - Criticality shows "Yes" or "No" correctly\n   - Class Item shows saved value\n   - Running Hours section shows current RH data\n4. VERIFY: No fields show blank when they should have data.`,

    'COMP-031': `HOW TO TEST:\n1. Open an existing component in the Add/Edit Component form.\n2. Locate the Component Name field.\n3. Change the name from its current value to a new name (e.g., add " - Updated" to the end).\n4. Click "Save".\n5. VERIFY: Success toast appears.\n6. VERIFY: The component tree updates to show the new name.\n7. VERIFY: Opening the component again shows the updated name.\n8. Revert the name back to the original and save again to clean up.`,

    'COMP-032': `HOW TO TEST:\n1. Open an existing component in the Add/Edit Component form.\n2. Modify one or more fields (e.g., change the maker, update the model).\n3. Click "Save".\n4. VERIFY: A success message appears.\n5. VERIFY: Changes are persisted — close and reopen the component to confirm.\n6. VERIFY: The component tree reflects any visible changes (e.g., if name was changed).\n7. VERIFY: Modified fields show their new values, not the old ones.`,

    'COMP-033': `HOW TO TEST:\n1. Open an existing component in the Add/Edit Component form.\n2. Modify some fields (change name, maker, etc.).\n3. Instead of clicking Save, click the "Back" arrow button.\n4. VERIFY: You return to the Components tree view.\n5. Click on the same component again to view its details.\n6. VERIFY: All values remain as they were BEFORE your edits — changes were NOT saved.\n7. VERIFY: No partial data was persisted.`,

    'COMP-034': `HOW TO TEST:\n1. Open an existing component that has associated work orders or jobs.\n2. Look at the Jobs tab or section in the component details.\n3. Confirm at least one job exists for this component.\n4. Try to modify the Component Code field in the edit form.\n5. VERIFY: The Component Code field is either read-only (grayed out) or shows a warning that it cannot be changed when jobs exist.\n6. VERIFY: If you somehow change the code and try to save, the system blocks the change with an error message.\nNOTE: Component code changes could break job/WO associations, so the system should prevent this.`,

    'COMP-035': `HOW TO TEST:\n1. Open an existing component and make a change (e.g., update the model name).\n2. Click "Save".\n3. VERIFY: A confirmation/success message appears indicating the update was saved.\n4. VERIFY: The message is clear (e.g., "Component updated successfully").\n5. VERIFY: The toast notification auto-dismisses after a few seconds.\n6. VERIFY: No error messages appear alongside the success message.`,

    'COMP-036': `HOW TO TEST:\n1. First, create a new test component with no jobs attached:\n   - Navigate to PMS > Components, click "+ Add / Edit Component"\n   - Create a simple component (e.g., name: "Test Delete Component")\n   - Save it\n2. Now try to delete this component:\n   - Select the component in the tree\n   - Look for a Delete button (trash icon) in the edit form or component details\n   - Click Delete\n3. VERIFY: A confirmation dialog appears asking "Are you sure you want to delete?"\n4. Click "Yes" / "Confirm".\n5. VERIFY: The component is removed from the tree.\n6. VERIFY: A success message confirms deletion.`,

    'COMP-037': `HOW TO TEST:\n1. Navigate to PMS > Components and select a component that has active/planned work orders.\n2. Try to delete this component (look for Delete button).\n3. VERIFY: The system prevents deletion with a clear error message (e.g., "Cannot delete: component has active work orders").\n4. VERIFY: The component remains in the tree — it was NOT deleted.\n5. VERIFY: The error message explains WHY deletion was blocked.`,

    'COMP-038': `HOW TO TEST:\n1. Navigate to PMS > Components and select a component that has only completed (historical) work orders — no active or planned ones.\n2. Try to delete this component.\n3. VERIFY: The system either allows deletion (with a warning about losing history) or prevents it (to preserve maintenance records).\n4. Document the actual behavior: Does the system allow or prevent deletion when only completed jobs exist?\n5. VERIFY: If deletion is allowed, the historical records are handled appropriately (archived or cascade-deleted).`,

    'COMP-039': `HOW TO TEST:\n1. Navigate to PMS > Components and select a component.\n2. Click the Delete button.\n3. VERIFY: A confirmation dialog/modal appears before deletion occurs.\n4. VERIFY: The dialog clearly states what will be deleted (component name/code).\n5. VERIFY: The dialog has both "Confirm" and "Cancel" buttons.\n6. VERIFY: No deletion occurs until you explicitly confirm.\n7. Click "Confirm" to verify the deletion proceeds.`,

    'COMP-040': `HOW TO TEST:\n1. Navigate to PMS > Components and select a component.\n2. Click the Delete button.\n3. When the confirmation dialog appears, click "Cancel" (not Confirm).\n4. VERIFY: The dialog closes.\n5. VERIFY: The component is still present in the tree — it was NOT deleted.\n6. VERIFY: All component data is intact (click it to view details).\n7. VERIFY: No error messages appear.`,

    'COMP-041': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. In the component tree (left panel), click on any component (e.g., "702.005.01 - FO Separators No.01").\n3. VERIFY: The right panel updates to show the Component Information section.\n4. VERIFY: The selected component is highlighted in the tree.\n5. VERIFY: Details load without errors.\n6. Click on a different component and VERIFY the details panel updates to show the newly selected component.`,

    'COMP-042': `HOW TO TEST:\n1. Navigate to PMS > Components, select a vessel, and click on a component.\n2. In the right detail panel, VERIFY these fields are displayed:\n   - Component Code\n   - Component Name\n   - Component Category\n   - Maker\n   - Model\n   - Serial No\n   - Drawing No\n   - Location\n   - Criticality (with colored badge — red for Yes, gray for No)\n   - Condition Based (Yes/No)\n   - Installation Date\n   - Commissioned Date\n   - Rating\n   - Equipment/System Department\n   - Running Hours\n   - Is Active status\n   - Class Item\n   - Notes\n3. VERIFY: Fields with no data show as blank (not "undefined" or "null").\n4. Additional fields visible for Sail Admin: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Maker Code, Model Code.`,

    'COMP-043': `HOW TO TEST:\n1. Navigate to PMS > Components, select a vessel, and click on a component that has jobs.\n2. In the right detail panel, look for a "Jobs" section or tab.\n3. VERIFY: The associated jobs list is displayed showing job titles, maintenance basis (Calendar/RH), frequency, and status.\n4. VERIFY: Each job entry is clickable to navigate to the job details.\n5. VERIFY: If the component has no jobs, the section shows an empty state message (e.g., "No jobs found").`,

    'COMP-044': `HOW TO TEST:\n1. Navigate to PMS > Components, select a vessel, and click on a component.\n2. Look for a "Maintenance History" section or tab in the detail panel.\n3. VERIFY: Historical work orders and maintenance activities for this component are listed.\n4. VERIFY: Each entry shows: work order number, job title, completion date, status.\n5. VERIFY: History is sorted by date (most recent first).\n6. VERIFY: If no history exists, an appropriate empty state is shown.`,

    'COMP-045': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Apply some filters (type "pump" in search bar, or select a criticality filter).\n3. Note which filters are active and your scroll position.\n4. Click on a component to view its details (or open the Add/Edit form).\n5. Click the "Back" button (left arrow) to return to the component list.\n6. VERIFY: The search text is still in the search bar.\n7. VERIFY: Any active filters are still applied.\n8. VERIFY: The component tree shows the same filtered results as before.\n9. VERIFY: You do not need to re-select the vessel.`,

    'COMP-046': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Click on a component to view its details.\n3. In the Jobs section, look for an "Add Job" or "+" button.\n4. Click it to open the job creation form.\n5. Fill in the required job fields:\n   - Job Title (e.g., "Annual Inspection")\n   - Maintenance Basis (Calendar or Running Hours)\n   - Frequency (e.g., "12 Months")\n   - Assigned To rank\n6. Save the job.\n7. VERIFY: The job appears in the component's jobs list.\n8. VERIFY: A corresponding work order template is created in the Work Orders page.`,

    'COMP-047': `HOW TO TEST:\n1. Navigate to PMS > Components and select a vessel.\n2. Click on a component that has multiple jobs assigned.\n3. Look at the Jobs section in the detail panel.\n4. VERIFY: All jobs for this component are listed.\n5. VERIFY: Each job shows its title, maintenance basis, frequency, and status.\n6. VERIFY: You can click on individual jobs to see their full details.\n7. VERIFY: Jobs are properly linked to work orders.`,

    'COMP-048': `HOW TO TEST:\n1. Navigate to PMS > Components and select a component.\n2. Add or edit a job for this component.\n3. Test different frequency configurations:\n   a. Calendar basis: Set frequency to "3 Months" and VERIFY it saves.\n   b. Calendar basis: Change to "6 Months" and VERIFY.\n   c. Calendar basis: Try "1 Year" and VERIFY.\n   d. Running Hours basis: Set frequency to "500" RH and VERIFY.\n   e. Running Hours basis: Change to "2000" RH and VERIFY.\n4. VERIFY: Each frequency value is saved and displayed correctly.\n5. VERIFY: The corresponding work order due dates recalculate based on the new frequency.`,

    'COMP-049': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component.\n3. In the Component Name field, enter a very long name (200+ characters):\n   "Main Engine Cylinder Head Assembly Including Exhaust Valve Mechanism And Fuel Injection System With Associated Piping And Control Instrumentation For Continuous Monitoring Of Temperature Pressure And Flow Rate Parameters During Normal Sea Going Operation"\n4. Fill other required fields and click "Save".\n5. VERIFY: The component saves successfully (no error).\n6. VERIFY: In the component tree, the long name is truncated with ellipsis ("...") to fit the layout.\n7. VERIFY: Hovering over the truncated name shows the full name in a tooltip.\n8. VERIFY: The full name is visible in the detail panel on the right side.\n9. VERIFY: No layout breakage — panels, buttons remain properly aligned.`,

    'COMP-050': `HOW TO TEST:\n1. Navigate to PMS > Components and click "+ Add / Edit Component".\n2. Select a parent component.\n3. In the Component Name field, enter a name with special characters:\n   'Test & Component "Alpha" <Beta> / Gamma (100%) #1'\n4. Fill other required fields and click "Save".\n5. VERIFY: The component saves without error.\n6. VERIFY: Special characters are preserved when viewing the component (not escaped or garbled).\n7. VERIFY: The component appears correctly in the tree and detail views.\n8. VERIFY: Search still works when searching for the special characters (e.g., search for "&" or "#1").`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Components from the sidebar.\n2. ${steps.replace(/\n/g, '\n3. ')}\n4. VERIFY: ${expected}`;
}

function generateWorkOrderHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'WO-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Work orders".\n3. Select a vessel from the vessel dropdown.\n4. VERIFY: The Work Orders list page loads showing a table with columns: Work Order No, Job Title, Component, Assigned To, Due Date, Status.\n5. VERIFY: Status tabs appear at the top: Planned, Due, Overdue, Pending Approval, Completed — each with a count badge.\n6. VERIFY: The "Planned" tab is selected by default.\n7. VERIFY: Work orders are listed with their current data.`,

    'WO-002': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click the "Planned" tab at the top.\n3. VERIFY: Only work orders with "Active" or "Postponed" status are shown.\n4. VERIFY: The count badge on the "Planned" tab matches the number of rows displayed.\n5. VERIFY: No "Due", "Overdue", "Pending Approval", or "Completed" items appear in this tab.`,

    'WO-003': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click the "Due" tab.\n3. VERIFY: Only work orders within the warning window (due within 30 days for Calendar, or within 720 RH for Running Hours) are displayed.\n4. VERIFY: Items that are past their due date but within grace period ("Grace P") also appear here.\n5. VERIFY: The count badge matches the number of visible rows.\n6. VERIFY: Status badges show "Due" or "Due (Grace P)" in yellow/orange.`,

    'WO-004': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click the "Overdue" tab.\n3. VERIFY: Only work orders that have breached their due date AND exceeded the grace period are shown.\n4. VERIFY: Status badges show "Overdue" in red.\n5. VERIFY: The count badge on the tab matches the row count.\n6. VERIFY: These represent items that need immediate attention.`,

    'WO-005': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click the "Pending Approval" tab.\n3. VERIFY: Only work orders submitted for approval (completed by crew but not yet approved by superintendent) are shown.\n4. VERIFY: Status badges show "Pending Approval" in purple.\n5. VERIFY: The count badge matches.\n6. VERIFY: Each work order in this tab should have completion details already filled in.`,

    'WO-006': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click the "Completed" tab.\n3. VERIFY: Only work orders with "Completed" status (approved and closed) are shown.\n4. VERIFY: Status badges show "Completed" in green.\n5. VERIFY: The count badge matches.\n6. VERIFY: These work orders have both completion data and approval information.`,

    'WO-007': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Look at each status tab: Planned, Due, Overdue, Pending Approval, Completed.\n3. VERIFY: Each tab has a numeric count badge next to its label.\n4. VERIFY: The counts are non-negative numbers.\n5. Add up all tab counts and compare with the total number of non-execution work orders.\n6. VERIFY: Counts update dynamically when work orders change status (e.g., after approving a pending WO, the Pending Approval count decreases and Completed count increases).`,

    'WO-008': `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Locate the vessel filter dropdown (top area of the page or global vessel selector).\n3. Select "Vessel 11" and note the work orders displayed.\n4. Switch to "Vessel 14" and VERIFY the list refreshes with different work orders.\n5. Switch to "All Vessels" (if available) and VERIFY work orders from multiple vessels appear.\n6. VERIFY: Tab counts update to reflect the selected vessel's data.`,

    'WO-009': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Locate the "Period" filter dropdown.\n3. Select different period options (e.g., "This Month", "This Quarter", "This Year").\n4. VERIFY: Work orders filter to show only items within the selected period.\n5. For RH-based periods (if available): select "RH - Next 250 hrs", "RH - Next 500 hrs", "RH - Next 1000 hrs".\n6. VERIFY: Only Running Hours-based work orders appear when an RH filter is selected, and only those within the specified threshold.\n7. Clear the period filter and VERIFY all work orders return.`,

    'WO-010': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Locate the "Rank" filter dropdown.\n3. VERIFY: The dropdown lists ranks/roles found in existing work orders (e.g., "Chief Engineer", "2nd Engineer", "Bosun").\n4. Select a rank (e.g., "Chief Engineer").\n5. VERIFY: Only work orders assigned to that rank are displayed.\n6. Clear the filter and VERIFY all work orders return.`,

    'WO-011': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Locate the "Criticality" filter dropdown.\n3. Select "Critical".\n4. VERIFY: Only work orders marked as critical (criticality = "Yes") are shown.\n5. Select "Non-Critical".\n6. VERIFY: Only non-critical work orders appear.\n7. Clear the filter and VERIFY all work orders return.`,

    'WO-012': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Apply multiple filters simultaneously:\n   - Set Period to a specific range\n   - Set Rank to a specific role\n   - Set Criticality to "Critical"\n   - Type a search term in the search bar\n3. VERIFY: Results reflect ALL filters combined (AND logic).\n4. VERIFY: Tab counts update to reflect the filtered subset.\n5. Clear one filter at a time and VERIFY the results expand appropriately.`,

    'WO-013': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Apply several filters (period, rank, criticality, search text).\n3. Look for a "Clear All" or "Clear Filters" button.\n4. Click it.\n5. VERIFY: All filters reset to their default (empty/all) state.\n6. VERIFY: The full unfiltered list of work orders reappears.\n7. VERIFY: The search bar is cleared.`,

    'WO-014': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Locate the search bar (magnifying glass icon).\n3. Type a work order code/number (e.g., "WO-702").\n4. VERIFY: The list filters to show only work orders matching the search term.\n5. VERIFY: Partial matches work (typing "702" shows all WOs containing "702").\n6. Clear the search and VERIFY all work orders return.`,

    'WO-015': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. In the search bar, type a component name (e.g., "Separator" or "Pump").\n3. VERIFY: Work orders associated with components matching that name are displayed.\n4. VERIFY: The search matches against the "Component" column.\n5. Clear the search and VERIFY the full list returns.`,

    'WO-016': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. In the search bar, type a job title (e.g., "Inspection" or "Overhaul").\n3. VERIFY: Work orders with matching job titles are displayed.\n4. VERIFY: Partial matches work.\n5. Clear the search and VERIFY the full list returns.`,

    'WO-017': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel with many work orders.\n2. Look at the bottom of the work orders table for pagination controls.\n3. VERIFY: Page navigation buttons appear (First, Previous, Next, Last or page numbers).\n4. VERIFY: An items-per-page dropdown is available (10, 25, 50, 100).\n5. Click "Next" and VERIFY the next page of work orders loads.\n6. Change items per page to 25 and VERIFY the page size changes.\n7. VERIFY: The current page indicator shows the correct page number.`,

    'WO-018': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click on column headers in the work orders table to sort.\n3. Click "Due Date" header and VERIFY work orders sort by date.\n4. Click again to toggle between ascending/descending.\n5. Try sorting by "Work Order No" and VERIFY alphabetical/numeric sorting.\n6. Try sorting by "Status" and VERIFY grouping by status.\n7. VERIFY: A sort indicator (arrow up/down) appears on the active sort column.`,

    'WO-019': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Work orders and select a vessel.\n3. Look for an "Export" button (download icon) in the toolbar area.\n4. Click it and select "Excel" or "Export to Excel".\n5. VERIFY: An Excel (.xlsx) file downloads.\n6. Open the downloaded file.\n7. VERIFY: It contains columns matching the on-screen table (Work Order No, Job Title, Component, Assigned To, Due Date, Status, etc.).\n8. VERIFY: All work orders (not just the current page) are exported.\n9. VERIFY: The file name includes the vessel name and timestamp.`,

    'WO-020': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Work orders and select a vessel.\n3. Click the Export button and select "PDF" or "Export to PDF".\n4. VERIFY: A PDF file downloads (or opens in a new tab).\n5. VERIFY: The PDF contains a formatted table of work orders.\n6. VERIFY: Headers, vessel name, and date are included in the PDF.`,

    'WO-021': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Work orders and select a vessel.\n3. Look for "Distributed Jobs" export option in the Export menu.\n4. Click to export as Excel.\n5. VERIFY: The exported file contains jobs distributed/sorted by assigned rank.\n6. VERIFY: Jobs are grouped or separated by responsible person/rank.`,

    'WO-022': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Work orders and select a vessel.\n3. Export Distributed Jobs as PDF.\n4. VERIFY: A PDF file downloads with jobs organized by assigned rank.\n5. VERIFY: The PDF is properly formatted for printing/distribution.`,

    'WO-023': `HOW TO TEST:\n1. Log in as a NON-Sail Admin user (e.g., Client Admin, Vessel User, or Head of Dept).\n2. Navigate to PMS > Work orders.\n3. Look for the Export button in the toolbar.\n4. VERIFY: The Export button is NOT visible for this user role.\n5. VERIFY: There is no way to trigger Excel/PDF export.\n6. Log in as Sail Admin and VERIFY the Export button IS visible.`,

    'WO-024': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Look at the Status column in the work orders table.\n3. VERIFY badge colors match these statuses:\n   - "Planned" / "Active" = sky blue\n   - "Due" = yellow\n   - "Due (Grace P)" = orange\n   - "Overdue" = red\n   - "Pending Approval" = purple\n   - "Completed" = green\n   - "Postponed" = blue\n   - "Rejected" = red\n   - "Draft" = gray\n4. VERIFY: Each status has a distinct, readable color badge.\n5. VERIFY: Badge text matches the actual status.`,

    'WO-025': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Look for a work order count display (e.g., "Showing 1-10 of 145" at the bottom, or tab counts).\n3. VERIFY: The total count is visible and accurate.\n4. Apply a filter and VERIFY the count updates to reflect filtered results.\n5. VERIFY: Tab count badges sum up correctly.`,

    'WO-026': `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Look for a "+ Add Work Order" or "Create Work Order" button (plus icon in toolbar).\n3. Click it.\n4. VERIFY: A new work order creation form opens.\n5. VERIFY: The form has fields for: Component, Job, Assigned To, Due Date, etc.\n6. VERIFY: Some fields may auto-populate based on selected component/job.`,

    'WO-027': `HOW TO TEST:\n1. Start creating a new work order (click "+ Add Work Order").\n2. In the "Component" dropdown or selector, browse the available components.\n3. Select a component (e.g., "702.005.01 - FO Separators No.01").\n4. VERIFY: The component is selected and displayed in the field.\n5. VERIFY: Selecting a component may filter the available jobs to only those associated with that component.`,

    'WO-028': `HOW TO TEST:\n1. Start creating a new work order.\n2. First select a component.\n3. Then look at the "Job" dropdown.\n4. VERIFY: Only jobs associated with the selected component are shown.\n5. Select a job.\n6. VERIFY: The job details (title, maintenance basis, frequency) are reflected in the form.\n7. Change the component and VERIFY the job dropdown updates to show the new component's jobs.`,

    'WO-029': `HOW TO TEST:\n1. Start creating a new work order.\n2. Select a component and a job.\n3. VERIFY: The following fields auto-populate based on the job:\n   - Job Title\n   - Maintenance Basis (Calendar or Running Hours)\n   - Frequency Value and Unit\n   - Assigned To (from job default)\n   - Criticality (from component)\n4. VERIFY: Auto-populated fields can still be manually overridden if needed.`,

    'WO-030': `HOW TO TEST:\n1. Start creating a new work order.\n2. Leave the Component field empty and click Save.\n3. VERIFY: A validation error appears for the Component field.\n4. Select a component but leave the Job field empty and click Save.\n5. VERIFY: A validation error appears for the Job field.\n6. Fill all required fields and click Save.\n7. VERIFY: No validation errors — the work order saves successfully.`,

    'WO-031': `HOW TO TEST:\n1. Create a new work order by selecting a component and job.\n2. After saving, look at the generated Work Order number/code.\n3. VERIFY: The code follows the template format (e.g., "WO-702.005.01-INS-M3" based on component code, task type, and frequency).\n4. VERIFY: Each new work order gets a unique code.\n5. Create another work order for the same component and VERIFY the codes are different.`,

    'WO-032': `HOW TO TEST:\n1. Navigate to PMS > Work orders and select a vessel.\n2. Click on any work order row in the table.\n3. VERIFY: The work order detail page opens (full-screen view).\n4. VERIFY: The URL changes to /pms/work-order/{id}.\n5. VERIFY: The detail page shows comprehensive work order information.`,

    'WO-033': `HOW TO TEST:\n1. Open a work order by clicking on it in the list.\n2. Look for "Part A - Job Details" section.\n3. VERIFY: Part A displays:\n   - Component name and code\n   - Job title\n   - Work order number / template code\n   - Maintenance basis (Calendar/RH)\n   - Frequency\n   - Due date / due reading\n   - Assigned to\n   - Criticality\n   - Job description/instructions\n4. VERIFY: All fields show data (no "undefined" or empty for fields that should have values).`,

    'WO-034': `HOW TO TEST:\n1. Open a work order (preferably one in "Due" or "Overdue" status).\n2. Look for "Part B - Completion" section.\n3. VERIFY: Part B displays or allows entry of:\n   - Date work completed\n   - Work done description\n   - Current reading (for RH-based WOs)\n   - Materials/spares used\n   - Remarks\n   - Attachments section\n4. VERIFY: For Planned/Active WOs, Part B fields are editable.\n5. VERIFY: For Completed WOs, Part B shows saved completion data.`,

    'WO-035': `HOW TO TEST:\n1. Open a work order detail page.\n2. Look for a "Work History" or "A4 - History" section.\n3. VERIFY: Previous completions for the same job/component are listed.\n4. VERIFY: Each history entry shows: date completed, work done, who completed it.\n5. VERIFY: History is sorted by date (most recent first).\n6. VERIFY: If no history exists, an appropriate message is shown.`,

    'WO-036': `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Click on a work order that has "Planned" or "Active" status.\n3. VERIFY: The form fields are editable (not locked).\n4. Modify a field (e.g., change the Assigned To).\n5. Save the changes.\n6. VERIFY: A success message appears.\n7. Reopen the work order and VERIFY the change persisted.`,

    'WO-037': `HOW TO TEST:\n1. Navigate to PMS > Work orders > Completed tab.\n2. Click on a completed work order.\n3. VERIFY: The form fields are read-only/locked (grayed out or no edit controls).\n4. Try to modify any field.\n5. VERIFY: Modifications are not possible — the form prevents edits.\n6. VERIFY: A visual indicator shows the WO is locked (e.g., lock icon or "Completed" badge).`,

    'WO-038': `HOW TO TEST:\n1. Navigate to PMS > Work orders > Pending Approval tab.\n2. Click on a pending approval work order.\n3. VERIFY: The completion data (Part B) is read-only.\n4. Try to modify Part B fields.\n5. VERIFY: Modifications are blocked — the WO is locked pending superintendent review.\n6. VERIFY: Only the Approve/Reject buttons are actionable.`,

    'WO-039': `HOW TO TEST:\n1. Open a work order in "Due" or "Overdue" status.\n2. In Part B (Completion section), find the "Start Date" field.\n3. Enter a start date.\n4. VERIFY: The date picker allows selecting a valid date.\n5. VERIFY: The start date cannot be in the future (if validation exists).\n6. VERIFY: The start date saves correctly.`,

    'WO-040': `HOW TO TEST:\n1. Open a work order and go to Part B - Completion.\n2. Fill in the "Date Completed" or "Completion Date" field.\n3. VERIFY: The date can be entered via date picker.\n4. VERIFY: Completion date must be on or after the start date (if both fields exist).\n5. Fill in the "Work Done" description.\n6. VERIFY: The text area accepts multi-line input.`,

    'WO-041': `HOW TO TEST:\n1. Open a Running Hours-based work order.\n2. In Part B, find the "Current Reading" field.\n3. Enter the current running hours value.\n4. VERIFY: Only numeric values are accepted.\n5. VERIFY: The value must be greater than or equal to the previous reading.\n6. VERIFY: The field shows the unit "hrs" or similar indicator.`,

    'WO-042': `HOW TO TEST:\n1. Open a work order in Due/Overdue status.\n2. Fill in Part B1 completion fields (start date, work done, etc.).\n3. VERIFY: Part B1 contains the basic completion information.\n4. Look for Part B2 section (additional completion details).\n5. Fill in Part B2 fields if present.\n6. VERIFY: Both sections are required before submission.`,

    'WO-043': `HOW TO TEST:\n1. Open a work order and fill Part B completion fields.\n2. Click "Submit for Approval" button.\n3. VERIFY: A confirmation dialog appears.\n4. Confirm the submission.\n5. VERIFY: The work order status changes to "Pending Approval".\n6. VERIFY: The WO moves from Due/Overdue tab to the Pending Approval tab.\n7. VERIFY: A success toast message appears.`,

    'WO-044': `HOW TO TEST:\n1. Open a work order and fill Part B completion.\n2. For Calendar-based WOs, after submission and approval, check the next due date.\n3. VERIFY: The next due date = completion date + frequency (e.g., if frequency is 3 months and completed on Jan 15, next due is Apr 15).\n4. VERIFY: The next due date is calculated automatically.`,

    'WO-045': `HOW TO TEST:\n1. Open an RH-based work order and complete it.\n2. Enter a current reading (e.g., 5000 hrs).\n3. Submit and get it approved.\n4. VERIFY: The next due reading = current reading + frequency (e.g., if frequency is 500 RH and current is 5000, next due is 5500).\n5. VERIFY: The calculation appears in the work order details.`,
  };

  if (instructions[id]) return instructions[id];

  const num = parseInt(id.replace('WO-', ''));
  
  if (num >= 46 && num <= 62) {
    return generateWOCompletionTest(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 63 && num <= 69) {
    return generateWOLayer1Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 70 && num <= 82) {
    return generateWOLayer2Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 83 && num <= 91) {
    return generateWOLayer3Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 92 && num <= 97) {
    return generateWOLayer4Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 98 && num <= 102) {
    return generateWOLayer5Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 103 && num <= 114) {
    return generateWOLayer6Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 115 && num <= 136) {
    return generateWOLayer7Test(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 137 && num <= 144) {
    return generateWOApprovalTest(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 145 && num <= 153) {
    return generateWOAttachmentTest(id, num, section, scenario, steps, testData, expected);
  }
  if (num >= 154 && num <= 168) {
    return generateWOMiscTest(id, num, section, scenario, steps, testData, expected);
  }

  return `HOW TO TEST:\n1. Navigate to PMS > Work orders from the sidebar.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOCompletionTest(id, num, section, scenario, steps, testData, expected) {
  const map = {
    46: `HOW TO TEST:\n1. Open a work order in Due status.\n2. Go to Part B2 (Completion section).\n3. Fill in the "Remarks" field with notes about the work performed.\n4. VERIFY: The text area accepts multi-line input.\n5. VERIFY: Remarks can include detailed descriptions of work completed.\n6. Fill in spare parts used (if applicable).\n7. VERIFY: Spare parts can be selected from the spares linked to the component.`,
    47: `HOW TO TEST:\n1. Open a work order in Due status.\n2. In Part B, look for the safety-related fields.\n3. Fill in safety precautions taken.\n4. VERIFY: Safety fields accept text input.\n5. VERIFY: Fields are saved correctly when the WO is submitted.`,
    48: `HOW TO TEST:\n1. Open a work order in Due status.\n2. Fill in all Part B1 fields (basic completion info).\n3. Fill in all Part B2 fields (additional details).\n4. Click "Submit for Approval".\n5. VERIFY: All fields validate correctly.\n6. VERIFY: The WO status changes to "Pending Approval".\n7. VERIFY: A success message appears.`,
    49: `HOW TO TEST:\n1. Open a work order and fill Part B completion fields.\n2. Enter the completion date.\n3. For Calendar-based WOs, VERIFY the next due date is calculated.\n4. For RH-based WOs, enter the current reading and VERIFY the next due reading is calculated.\n5. VERIFY: The calculation follows the formula: next due = completion point + frequency.`,
    50: `HOW TO TEST:\n1. Open a work order.\n2. Fill Part B and submit for approval.\n3. Wait for or simulate superintendent approval.\n4. VERIFY: After approval, the WO status becomes "Completed".\n5. VERIFY: A new work order (next cycle) is automatically generated for the same job.\n6. VERIFY: The new WO has the calculated next due date.`,
    51: `HOW TO TEST:\n1. Open a work order in Due/Overdue status.\n2. In Part B1 (primary completion section), fill in:\n   - Date work was started\n   - Date work was completed\n   - Description of work done\n3. VERIFY: All Part B1 fields accept input.\n4. VERIFY: Date fields use a date picker.\n5. VERIFY: The work done text field supports multi-line input.`,
    52: `HOW TO TEST:\n1. Open a work order and go to Part B1.\n2. Enter a completion date that is BEFORE the start date.\n3. Try to submit.\n4. VERIFY: A validation error prevents submission (completion date must be >= start date).\n5. Fix the dates so completion is after or equal to start.\n6. VERIFY: Submission proceeds successfully.`,
    53: `HOW TO TEST:\n1. Open an RH-based work order.\n2. In Part B1, find the "Current Reading" or "Completion Reading" field.\n3. Enter the current cumulative running hours.\n4. VERIFY: The system accepts the value.\n5. VERIFY: If the value is less than the previous reading, a validation error appears.\n6. VERIFY: The next due reading is calculated (current + frequency).`,
    54: `HOW TO TEST:\n1. Open a work order and go to Part B1.\n2. Leave required fields empty (e.g., completion date, work done).\n3. Click "Submit".\n4. VERIFY: Validation errors highlight the empty required fields.\n5. VERIFY: A message like "This field is required" appears.\n6. VERIFY: The form does NOT submit until all required B1 fields are filled.`,
    55: `HOW TO TEST:\n1. Open a work order in Due status.\n2. Fill in Part B1 completion fields.\n3. Look for Part B1 "Remarks" or "Additional Notes" field.\n4. Enter remarks.\n5. VERIFY: The field saves correctly.\n6. VERIFY: Remarks appear when reviewing the completed WO.`,
    56: `HOW TO TEST:\n1. Open a work order.\n2. Fill all Part B1 fields with valid data.\n3. Submit the work order.\n4. VERIFY: Part B1 data is saved and displayed correctly when reopening the WO.\n5. VERIFY: All entered values match what was submitted.`,
    57: `HOW TO TEST:\n1. Open a work order with existing Part B1 data (previously saved draft).\n2. VERIFY: Previously saved B1 fields are pre-populated.\n3. Modify some fields.\n4. Save again.\n5. VERIFY: Updated values are persisted correctly.`,
    58: `HOW TO TEST:\n1. Open a work order in Due/Overdue status.\n2. Scroll to Part B2 (secondary completion details).\n3. Fill in any condition assessment fields.\n4. VERIFY: Dropdown or text fields accept input.\n5. VERIFY: Condition ratings (if present) have clear options (Good, Fair, Poor, etc.).`,
    59: `HOW TO TEST:\n1. Open a work order and go to Part B2.\n2. Fill in findings/observations.\n3. VERIFY: The text area accepts detailed multi-line input.\n4. VERIFY: Content is preserved when saving.\n5. VERIFY: Special characters in findings are handled correctly.`,
    60: `HOW TO TEST:\n1. Open a work order and go to Part B2.\n2. Fill in recommendations or follow-up actions.\n3. VERIFY: The field accepts text input.\n4. VERIFY: Content saves and displays correctly after submission.`,
    61: `HOW TO TEST:\n1. Open a work order.\n2. Fill all Part B2 fields.\n3. VERIFY: Part B2 fields work independently from Part B1.\n4. VERIFY: Both sections can be saved together.\n5. Submit the complete work order.\n6. VERIFY: All Part B2 data is included in the submitted work order.`,
    62: `HOW TO TEST:\n1. Open a work order.\n2. Fill Part B1 but leave Part B2 fields empty.\n3. Try to submit.\n4. VERIFY: If Part B2 fields are required, validation errors appear.\n5. VERIFY: If Part B2 fields are optional, the WO submits successfully with only Part B1 filled.\n6. Document which B2 fields are required vs optional.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Open a work order.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer1Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    63: `HOW TO TEST:\n1. Open a work order in Due/Overdue status.\n2. In Part B, enter a completion date that is significantly in the past (e.g., 30+ days ago).\n3. Submit the work order.\n4. VERIFY: The system detects the backdating and triggers Layer 1 validation.\n5. VERIFY: A warning appears indicating the completion date is backdated.\n6. VERIFY: The work order may be flagged for superintendent review.`,
    64: `HOW TO TEST:\n1. Open a work order and complete it with today's date.\n2. VERIFY: No backdating warning appears.\n3. Now open another work order and enter a date 7 days ago.\n4. VERIFY: The system's backdating threshold — does a warning appear at 7 days? 14 days? 30 days?\n5. Document the actual threshold for backdating detection.`,
    65: `HOW TO TEST:\n1. Complete a work order with a backdated date (e.g., 45 days ago).\n2. VERIFY: The backdating is flagged in the system.\n3. Check the superintendent notifications.\n4. VERIFY: The superintendent receives a notification about the backdated completion.\n5. VERIFY: The notification includes the WO number and the extent of backdating.`,
    66: `HOW TO TEST:\n1. Complete a work order with a severely backdated date (e.g., 90+ days ago).\n2. VERIFY: The system shows a clear warning about the extreme backdating.\n3. VERIFY: The severity of the warning increases with the extent of backdating.\n4. Check if additional approvals are required for severely backdated completions.`,
    67: `HOW TO TEST:\n1. Complete a work order with a backdated date.\n2. Try to change the date after submission.\n3. VERIFY: Once submitted, the completion date cannot be modified.\n4. VERIFY: The backdating record is immutable in the system history.`,
    68: `HOW TO TEST:\n1. Log in as a Sail Admin.\n2. Navigate to the Dashboard.\n3. Look for anomaly detection or compliance section.\n4. VERIFY: Backdated work orders appear in the anomaly list.\n5. VERIFY: Each backdated WO shows the backdating duration.\n6. VERIFY: The anomaly can be acknowledged or flagged for further review.`,
    69: `HOW TO TEST:\n1. Complete multiple work orders: some with today's date, some backdated.\n2. Navigate to Reports or Dashboard anomaly section.\n3. VERIFY: The system accurately identifies which WOs are backdated.\n4. VERIFY: Non-backdated WOs are NOT flagged as anomalies.\n5. VERIFY: The backdating count/statistics are accurate.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Test Layer 1 (Backdating) validation.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer2Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    70: `HOW TO TEST:\n1. Identify a work order that was previously completed (has a history cycle).\n2. Look for the next cycle of the same job.\n3. Skip completing the current cycle and try to complete a future one.\n4. VERIFY: The system detects the missed cycle.\n5. VERIFY: A warning or flag appears indicating cycles were skipped.`,
    71: `HOW TO TEST:\n1. Find a job with regular cycles (e.g., 3-month intervals).\n2. Check the work order history.\n3. VERIFY: All cycles are accounted for — no gaps in the completion chain.\n4. If a cycle was missed, VERIFY the system flags it in the anomaly detection.`,
    72: `HOW TO TEST:\n1. Create a scenario where multiple consecutive cycles are missed.\n2. Navigate to the anomaly or compliance section.\n3. VERIFY: The system identifies the specific cycles that were skipped.\n4. VERIFY: The missed cycle count is accurate.\n5. VERIFY: The severity indicator reflects the number of missed cycles.`,
    73: `HOW TO TEST:\n1. Complete a work order normally (no missed cycles).\n2. VERIFY: No missed cycle warning appears.\n3. VERIFY: The work history shows a continuous chain of completions.\n4. VERIFY: The anomaly section does NOT flag this job for missed cycles.`,
    74: `HOW TO TEST:\n1. Find a work order with a missed cycle flag.\n2. Go back and complete the missed cycle retroactively.\n3. VERIFY: The missed cycle flag is cleared or updated.\n4. VERIFY: The compliance status improves after the catch-up completion.`,
    75: `HOW TO TEST:\n1. Navigate to the Dashboard anomaly section (Sail Admin only).\n2. Look for the "Cycle Skip Rate" card.\n3. VERIFY: The card shows the percentage of jobs with missed cycles.\n4. VERIFY: Clicking the card shows details of affected work orders.`,
    76: `HOW TO TEST:\n1. Check missed cycle detection for Calendar-based work orders.\n2. VERIFY: The system correctly identifies missed calendar cycles based on due dates and completion dates.\n3. Repeat for Running Hours-based work orders.\n4. VERIFY: RH-based missed cycles are detected based on reading thresholds.`,
    77: `HOW TO TEST:\n1. Find a job that has exactly one missed cycle.\n2. VERIFY: The system accurately counts it as 1 missed cycle.\n3. Find a job with 3 missed cycles.\n4. VERIFY: The count shows exactly 3.\n5. VERIFY: The counts are reliable and consistent across views.`,
    78: `HOW TO TEST:\n1. View the missed cycles for a specific vessel.\n2. VERIFY: Only cycles for that vessel are shown.\n3. Switch to another vessel.\n4. VERIFY: The data updates to reflect the new vessel's missed cycles.\n5. VERIFY: Cross-vessel contamination does not occur.`,
    79: `HOW TO TEST:\n1. Navigate to the compliance or anomaly panel.\n2. Look at missed cycle data for multiple jobs.\n3. VERIFY: Sorting and filtering of missed cycles works correctly.\n4. VERIFY: You can filter by severity, component, or date range.`,
    80: `HOW TO TEST:\n1. Complete all overdue work orders for a specific component.\n2. VERIFY: The missed cycle indicators clear for that component.\n3. VERIFY: The overall compliance rate improves.\n4. VERIFY: The dashboard reflects the updated compliance status.`,
    81: `HOW TO TEST:\n1. Open a work order that has been flagged for missed cycles.\n2. Check the work order detail page.\n3. VERIFY: A visual indicator (badge, warning icon) shows the missed cycle flag.\n4. VERIFY: The flag provides context (e.g., "2 cycles missed" or "Last completed: 6 months ago").`,
    82: `HOW TO TEST:\n1. Navigate to the anomaly detection section.\n2. Review the missed cycle rate across all vessels.\n3. VERIFY: The overall rate is calculated correctly.\n4. VERIFY: Trends over time are visible (if a trend chart exists).\n5. VERIFY: The data refreshes when new completions are recorded.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Test Layer 2 (Missed Cycles) validation.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer3Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    83: `HOW TO TEST:\n1. Open a work order and view its work history (Section A4).\n2. VERIFY: The history section lists all previous completions for the same job.\n3. VERIFY: Each history entry shows: completion date, work done description, who completed it.\n4. VERIFY: History is sorted chronologically (most recent first).`,
    84: `HOW TO TEST:\n1. Open a work order with extensive history (5+ previous completions).\n2. VERIFY: All historical entries are accessible (scroll or pagination).\n3. VERIFY: Performance is acceptable — no excessive loading time.\n4. VERIFY: Each entry is clearly separated and readable.`,
    85: `HOW TO TEST:\n1. Open a work order and check its history.\n2. Compare the "work done" descriptions across multiple cycles.\n3. VERIFY: The system does NOT flag identical descriptions as anomalous (if the same work is done each cycle, that can be normal).\n4. VERIFY: Suspiciously short or copy-pasted descriptions may trigger Layer 3 analysis.`,
    86: `HOW TO TEST:\n1. Complete a work order with a detailed work description.\n2. After approval, verify it appears in the work history.\n3. VERIFY: The new entry is added at the top of the history list.\n4. VERIFY: The entry contains: date, description, current reading (for RH WOs), who completed it.`,
    87: `HOW TO TEST:\n1. Open a work order with history entries.\n2. Check that each entry includes timestamps.\n3. VERIFY: Dates are formatted consistently (e.g., "15 Mar 2026").\n4. VERIFY: Time information is included where relevant.\n5. VERIFY: History entries cannot be modified after approval.`,
    88: `HOW TO TEST:\n1. Open a work order history.\n2. Check for completeness of records.\n3. VERIFY: No history entries are missing (compare with the expected number of cycles based on job creation date and frequency).\n4. VERIFY: Each completion has a corresponding history entry.`,
    89: `HOW TO TEST:\n1. Navigate to a component's detail page.\n2. Check the maintenance history section.\n3. VERIFY: All work orders completed for this component appear in the history.\n4. VERIFY: History spans across different jobs for the same component.\n5. VERIFY: The history provides a comprehensive maintenance record.`,
    90: `HOW TO TEST:\n1. Open a work order history for a job with RH-based maintenance.\n2. VERIFY: Each entry shows the running hours reading at completion.\n3. VERIFY: RH readings increase monotonically (each entry has a higher reading than the previous).\n4. VERIFY: Any anomalies in RH progression are flagged.`,
    91: `HOW TO TEST:\n1. Export work history data if an export option is available.\n2. VERIFY: Exported data matches on-screen history.\n3. VERIFY: All fields are included in the export.\n4. If no export exists, note this in Comments.\n5. VERIFY: History data is consistent between the WO detail view and the component maintenance history view.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. Test Layer 3 (Work History) validation.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer4Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    92: `HOW TO TEST:\n1. Open a work order that has been completed and approved.\n2. Navigate to the approval section.\n3. Look for the Chief Engineer (CE) remarks field.\n4. VERIFY: CE remarks are displayed if entered during completion.\n5. VERIFY: The remarks field shows who entered them and when.`,
    93: `HOW TO TEST:\n1. Open a work order in completion mode (Part B).\n2. Find the "CE Remarks" or "Chief Engineer Comments" field.\n3. Enter remarks.\n4. VERIFY: The field accepts multi-line text input.\n5. VERIFY: Remarks are saved when the WO is submitted.\n6. VERIFY: Remarks appear in the approved/completed WO view.`,
    94: `HOW TO TEST:\n1. Complete a work order WITHOUT entering CE remarks.\n2. Submit for approval.\n3. VERIFY: The system either allows submission without CE remarks (if optional) or requires them (if mandatory).\n4. Document whether CE remarks are required or optional.`,
    95: `HOW TO TEST:\n1. Complete a work order with CE remarks.\n2. Get it approved.\n3. VERIFY: The CE remarks are visible in the completed WO.\n4. VERIFY: Remarks cannot be modified after approval.\n5. VERIFY: The superintendent can see the CE remarks when reviewing.`,
    96: `HOW TO TEST:\n1. Enter very long CE remarks (500+ characters).\n2. Submit the work order.\n3. VERIFY: The full text is saved and displayed correctly.\n4. VERIFY: No text truncation occurs.\n5. VERIFY: The display area expands to show all content.`,
    97: `HOW TO TEST:\n1. Enter CE remarks with special characters (&, <, >, ", etc.).\n2. Submit the work order.\n3. VERIFY: Special characters are preserved correctly.\n4. VERIFY: No HTML injection or display issues occur.\n5. VERIFY: The remarks render exactly as entered.`
  };
  return map[num] || `HOW TO TEST:\n1. Open a work order.\n2. Test Layer 4B (CE Remarks) functionality.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer5Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    98: `HOW TO TEST:\n1. Complete a work order and submit for approval.\n2. Log in as a superintendent (or check the superintendent notifications page).\n3. Navigate to PMS > Superintendent page (from sidebar).\n4. VERIFY: A notification appears for the newly submitted work order.\n5. VERIFY: The notification includes: WO number, job title, vessel, submission date.`,
    99: `HOW TO TEST:\n1. Navigate to the Superintendent Notifications page.\n2. VERIFY: Pending work orders for approval are listed.\n3. VERIFY: Each entry shows key details (WO number, component, vessel).\n4. VERIFY: The list can be sorted or filtered.\n5. VERIFY: Clicking on a notification navigates to the WO detail page.`,
    100: `HOW TO TEST:\n1. Submit multiple work orders for approval from different vessels.\n2. Navigate to the Superintendent page.\n3. VERIFY: All pending approvals appear in the list.\n4. VERIFY: They can be filtered by vessel.\n5. VERIFY: The count of pending items is accurate.`,
    101: `HOW TO TEST:\n1. Navigate to the Superintendent page.\n2. Approve a work order.\n3. VERIFY: The notification for that WO is removed or marked as acknowledged.\n4. VERIFY: The pending count decreases by one.\n5. VERIFY: The approved WO appears in the Completed tab on the Work Orders page.`,
    102: `HOW TO TEST:\n1. Navigate to the Superintendent page.\n2. Look for backdated or anomalous work orders in the notifications.\n3. VERIFY: Anomalous WOs are highlighted differently (warning icon or different color).\n4. VERIFY: The notification explains why the WO is flagged (e.g., "Backdated by 45 days").\n5. VERIFY: The superintendent can still approve or reject these flagged WOs.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Superintendent page.\n2. Test Layer 5 (Superintendent Notification) functionality.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer6Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    103: `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Dashboard.\n3. Scroll down to the "Compliance Anomaly Detection" panel (only visible to Sail Admin).\n4. VERIFY: The anomaly panel loads and shows detection results.\n5. VERIFY: Anomalies are categorized (Cycle Skip, Backdating, Bulk Completion, Schedule Drift).\n6. VERIFY: Each anomaly card shows a count and severity indicator.`,
    104: `HOW TO TEST:\n1. Log in as a Sail Admin and go to the Dashboard.\n2. In the Anomaly Detection panel, look at individual anomaly entries.\n3. VERIFY: Each entry shows: vessel, component, job, anomaly type, severity.\n4. VERIFY: Clicking an anomaly shows more details or navigates to the relevant WO.\n5. VERIFY: Anomalies can be filtered by type or severity.`,
    105: `HOW TO TEST:\n1. Log in as a Sail Admin and navigate to Dashboard.\n2. In the Anomaly panel, look for the "Cycle Skip Rate" card.\n3. VERIFY: It shows the percentage/count of jobs with skipped cycles.\n4. VERIFY: The rate is calculated across the selected vessel(s).\n5. VERIFY: Clicking shows details of which jobs have skipped cycles.`,
    106: `HOW TO TEST:\n1. In the Anomaly Detection panel, look for the "Backdating Frequency" card.\n2. VERIFY: It shows how many work orders were completed with backdated dates.\n3. VERIFY: The count/percentage is accurate.\n4. VERIFY: Details show which WOs were backdated and by how much.`,
    107: `HOW TO TEST:\n1. In the Anomaly Detection panel, look for the "Bulk Completion Events" card.\n2. VERIFY: It flags instances where many work orders were completed on the same date.\n3. VERIFY: The threshold for "bulk" is reasonable (e.g., 5+ WOs on the same day).\n4. VERIFY: Details show the date and the WOs involved.`,
    108: `HOW TO TEST:\n1. In the Anomaly Detection panel, look for the "Schedule Drift" card.\n2. VERIFY: It identifies jobs whose actual completion significantly drifts from their scheduled date.\n3. VERIFY: Both early and late completions are detected.\n4. VERIFY: The drift amount is shown (e.g., "15 days late" or "20 days early").`,
    109: `HOW TO TEST:\n1. Log in as a Sail Admin.\n2. Navigate to the Dashboard anomaly panel.\n3. Use the severity filter dropdown to filter anomalies.\n4. Select "High" severity.\n5. VERIFY: Only high-severity anomalies are shown.\n6. Select "Medium" and VERIFY the list updates.\n7. Select "All" and VERIFY all anomalies reappear.`,
    110: `HOW TO TEST:\n1. In the Anomaly panel, click the "Refresh" button.\n2. VERIFY: Anomaly data refreshes (loading spinner appears briefly).\n3. VERIFY: Any new anomalies since last load appear after refresh.\n4. VERIFY: The refresh completes without errors.`,
    111: `HOW TO TEST:\n1. Generate an anomaly by completing a work order with a significantly backdated date.\n2. Navigate to the Dashboard anomaly panel.\n3. VERIFY: The new anomaly appears in the list.\n4. VERIFY: The anomaly type matches (e.g., "Backdating").\n5. VERIFY: The severity level is appropriate.`,
    112: `HOW TO TEST:\n1. In the Anomaly panel, check anomalies for multiple vessels.\n2. Switch between vessels using the vessel filter.\n3. VERIFY: Anomalies are vessel-specific.\n4. VERIFY: "All Vessels" shows combined anomalies.\n5. VERIFY: No cross-vessel data leakage.`,
    113: `HOW TO TEST:\n1. Review the anomaly detection accuracy.\n2. Find a known good work order (completed on time, no issues).\n3. VERIFY: It is NOT flagged as an anomaly.\n4. Find a known problematic work order.\n5. VERIFY: It IS correctly flagged.\n6. Document any false positives or false negatives.`,
    114: `HOW TO TEST:\n1. Open the Anomaly panel.\n2. Review the overall anomaly summary.\n3. VERIFY: Summary counts match the detail counts.\n4. VERIFY: The panel provides actionable information.\n5. VERIFY: All anomaly types are represented in the summary.`
  };
  return map[num] || `HOW TO TEST:\n1. Log in as Sail Admin.\n2. Navigate to PMS > Dashboard.\n3. Test Layer 6 (Anomaly Detection) functionality.\n4. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOLayer7Test(id, num, section, scenario, steps, testData, expected) {
  const map = {
    115: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Go to Part B and find the "Current Reading" field.\n3. Enter a valid running hours value (e.g., 5000).\n4. VERIFY: The value is accepted.\n5. VERIFY: The next due reading is calculated (current + frequency).\n6. Submit the work order.\n7. VERIFY: RH validation passes — no errors.`,
    116: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading that is LESS than the previous reading.\n3. Try to submit.\n4. VERIFY: Layer 7 RH validation triggers.\n5. VERIFY: An error message appears (e.g., "Current reading cannot be less than previous reading").\n6. VERIFY: The submission is blocked.`,
    117: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading of exactly 0.\n3. Try to submit.\n4. VERIFY: A Zero RH Renewal confirmation dialog appears.\n5. VERIFY: The dialog asks for the reason (Renewal Action Type).\n6. VERIFY: You must provide a reason before proceeding.`,
    118: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter an extremely high Current Reading (e.g., 999999).\n3. VERIFY: The system validates the value against reasonable limits.\n4. VERIFY: A warning appears if the jump is unreasonably large.\n5. Document the system's behavior for extreme values.`,
    119: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a negative value for Current Reading.\n3. VERIFY: The system rejects negative values.\n4. VERIFY: An appropriate error message appears.\n5. VERIFY: Only positive numbers (and zero with justification) are accepted.`,
    120: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading with decimal places (e.g., 5000.5).\n3. VERIFY: Decimal values are either accepted or rounded.\n4. VERIFY: The system handles the decimal consistently.\n5. Document whether decimals are supported.`,
    121: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading equal to the previous reading (no change).\n3. Try to submit.\n4. VERIFY: The system either accepts it (valid: equipment was not run) or flags it.\n5. Document the behavior for zero-delta readings.`,
    122: `HOW TO TEST:\n1. Complete an RH-based work order with a valid reading.\n2. Check the running hours for the component.\n3. VERIFY: The component's cumulative running hours updated to match the entered value.\n4. VERIFY: Child components (inherited RH) also updated if applicable.\n5. VERIFY: The RH history shows the new entry.`,
    123: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading that represents a jump > 200% of expected utilization.\n3. VERIFY: Layer 7 flags this as a suspicious reading.\n4. VERIFY: A warning message appears asking to confirm the value.\n5. VERIFY: The user can either correct the value or confirm it's accurate.`,
    124: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a Current Reading that passes basic validation (> previous reading).\n3. VERIFY: The system also checks against the utilization rate.\n4. VERIFY: If the daily average implied by the new reading exceeds 24 hours, a validation error appears.\n5. VERIFY: Physically impossible readings are blocked.`,
    125: `HOW TO TEST:\n1. Complete an RH-based work order with a meter replacement scenario.\n2. Check the "Meter Replaced" option.\n3. Enter the old meter's final reading and the new meter's starting reading.\n4. VERIFY: The system calculates the new cumulative RH correctly.\n5. VERIFY: The meter replacement is recorded in the RH history.`,
    126: `HOW TO TEST:\n1. Enter an RH reading and submit the work order.\n2. After submission, try to modify the RH reading.\n3. VERIFY: Once submitted, the RH reading cannot be changed.\n4. VERIFY: The reading is immutable in the work order history.`,
    127: `HOW TO TEST:\n1. Complete multiple RH-based work orders for different components.\n2. VERIFY: Each component's RH updates independently.\n3. VERIFY: No cross-contamination of RH values between components.\n4. VERIFY: Each work order correctly references its own component's RH.`,
    128: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Check if the current running hours of the component are pre-populated.\n3. VERIFY: The "Previous Reading" or "Current Component RH" is displayed for reference.\n4. VERIFY: This value matches the component's actual current RH.\n5. VERIFY: The user can see the context for what value to enter.`,
    129: `HOW TO TEST:\n1. Open an RH-based work order.\n2. Enter a valid current reading and submit.\n3. Check that the RH update is isolated to this specific component.\n4. VERIFY: Other components' RH values are NOT affected.\n5. VERIFY: Only inherited children (if applicable) update automatically.`,
    130: `HOW TO TEST:\n1. Open an RH-based work order for a component with inherited RH children.\n2. Update the running hours.\n3. VERIFY: The parent component's RH updates.\n4. VERIFY: All inherited children also update to match.\n5. VERIFY: Non-inherited children are NOT affected.`,
    131: `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Select a component and view its RH history.\n3. VERIFY: A timeline or chart shows RH progression over time.\n4. VERIFY: Each data point corresponds to an RH update event.\n5. VERIFY: The timeline is chronologically ordered.`,
    132: `HOW TO TEST:\n1. View the RH timeline for a component.\n2. Look for meter replacement events in the timeline.\n3. VERIFY: Meter replacements are clearly marked (different color or icon).\n4. VERIFY: The timeline shows the old meter's final reading and new meter's start.\n5. VERIFY: The cumulative total remains accurate across meter changes.`,
    133: `HOW TO TEST:\n1. View the RH timeline for a component with many updates.\n2. VERIFY: The timeline handles large datasets (50+ entries) without performance issues.\n3. VERIFY: Scrolling or pagination works if the timeline is long.\n4. VERIFY: All entries are accessible and readable.`,
    134: `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Select a component.\n3. VERIFY: The current running hours display shows:\n   - Current cumulative RH\n   - Last updated date\n   - Utilization rate (percentage)\n   - Period running hours\n4. VERIFY: All values are formatted correctly (commas for thousands, "hrs" suffix).`,
    135: `HOW TO TEST:\n1. Try to enter an invalid RH value in a work order (e.g., text instead of number).\n2. VERIFY: An error modal or inline error appears.\n3. VERIFY: The error message clearly explains the issue.\n4. VERIFY: The form prevents submission with invalid data.`,
    136: `HOW TO TEST:\n1. Trigger multiple RH validation errors simultaneously.\n2. VERIFY: Each error is displayed clearly.\n3. VERIFY: Error messages don't overlap or hide each other.\n4. VERIFY: The user can address each error individually.\n5. VERIFY: After fixing all errors, submission proceeds normally.`
  };
  return map[num] || `HOW TO TEST:\n1. Open an RH-based work order.\n2. Test Layer 7 (Running Hours Validation) functionality.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOApprovalTest(id, num, section, scenario, steps, testData, expected) {
  const map = {
    137: `HOW TO TEST:\n1. Navigate to PMS > Work orders > Pending Approval tab.\n2. Open a work order pending approval.\n3. Look for the "Approve" button (usually green, with a checkmark icon).\n4. Click "Approve".\n5. If prompted, enter approver remarks.\n6. Confirm the approval.\n7. VERIFY: The WO status changes to "Completed".\n8. VERIFY: The WO moves to the Completed tab.\n9. VERIFY: A success message appears.`,
    138: `HOW TO TEST:\n1. Navigate to PMS > Work orders > Pending Approval tab.\n2. Open a work order pending approval.\n3. Look for the "Reject" button (usually red, with an X icon).\n4. Click "Reject".\n5. VERIFY: A rejection comments field appears (mandatory).\n6. Enter a reason for rejection.\n7. Confirm the rejection.\n8. VERIFY: The WO status changes to "Rejected".\n9. VERIFY: The WO moves back to the appropriate status tab for rework.`,
    139: `HOW TO TEST:\n1. Try to approve a work order without entering remarks.\n2. VERIFY: If remarks are mandatory, the system requires them before approval.\n3. VERIFY: If remarks are optional, approval proceeds without them.\n4. Document which scenario applies.`,
    140: `HOW TO TEST:\n1. Try to reject a work order without entering rejection comments.\n2. VERIFY: The system requires rejection comments (mandatory).\n3. VERIFY: An error appears if comments are empty.\n4. Enter comments and retry.\n5. VERIFY: Rejection proceeds successfully with comments.`,
    141: `HOW TO TEST:\n1. Approve a work order.\n2. VERIFY: After approval, a new work order cycle is automatically generated for the next period.\n3. VERIFY: The new WO has the correct next due date/reading.\n4. VERIFY: The new WO appears in the Planned tab.`,
    142: `HOW TO TEST:\n1. Open a rejected work order.\n2. VERIFY: The rejection reason is displayed.\n3. VERIFY: The completion fields (Part B) are editable again for rework.\n4. Modify the necessary fields.\n5. Resubmit the work order.\n6. VERIFY: The WO goes back to "Pending Approval" status.`,
    143: `HOW TO TEST:\n1. Navigate to the Dashboard.\n2. Look for a "Bulk Approve" option or button.\n3. If available, select multiple pending work orders.\n4. Click "Bulk Approve".\n5. VERIFY: All selected WOs are approved simultaneously.\n6. VERIFY: Each WO's status changes to "Completed".\n7. VERIFY: Next cycle WOs are generated for each.`,
    144: `HOW TO TEST:\n1. Log in as a user without approval permissions (e.g., Vessel User).\n2. Navigate to a pending approval work order.\n3. VERIFY: The Approve/Reject buttons are NOT visible.\n4. VERIFY: Only users with superintendent/admin role can see approval buttons.\n5. Log in as superintendent/admin and VERIFY buttons appear.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders > Pending Approval.\n2. Test the approval workflow.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOAttachmentTest(id, num, section, scenario, steps, testData, expected) {
  const map = {
    145: `HOW TO TEST:\n1. Open a work order detail page.\n2. Scroll to the Attachments section.\n3. Click "Upload" or the attachment button.\n4. Select a file from your computer (e.g., a PDF or image).\n5. VERIFY: The file uploads successfully with a progress indicator.\n6. VERIFY: The uploaded file appears in the attachments list.\n7. VERIFY: File name, size, and upload date are displayed.`,
    146: `HOW TO TEST:\n1. Open a work order with an attachment.\n2. Click on the attachment to view/download it.\n3. VERIFY: The file downloads or opens in a new tab.\n4. VERIFY: The file content is intact (not corrupted).\n5. VERIFY: PDF files open correctly, images display properly.`,
    147: `HOW TO TEST:\n1. Open a work order.\n2. Try to upload a file larger than the size limit (e.g., > 25MB).\n3. VERIFY: An error message appears indicating the file is too large.\n4. VERIFY: The upload is blocked.\n5. Try a file within the limit and VERIFY it uploads successfully.`,
    148: `HOW TO TEST:\n1. Open a work order.\n2. Try to upload an unsupported file type (e.g., .exe or .zip).\n3. VERIFY: An error message appears (e.g., "Invalid file type").\n4. VERIFY: Only supported types are accepted (PDF, images, Word docs).\n5. Upload a valid file type and VERIFY it succeeds.`,
    149: `HOW TO TEST:\n1. Open a work order with attachments.\n2. Click the delete/remove button on an attachment.\n3. VERIFY: A confirmation dialog appears.\n4. Confirm deletion.\n5. VERIFY: The attachment is removed from the list.\n6. VERIFY: A success message appears.`,
    150: `HOW TO TEST:\n1. Open a work order.\n2. Upload multiple attachments (3+).\n3. VERIFY: All files upload successfully.\n4. VERIFY: All files appear in the attachments list.\n5. VERIFY: Each file can be individually viewed or deleted.`,
    151: `HOW TO TEST:\n1. Upload a file with a very long filename (100+ characters).\n2. VERIFY: The file uploads without error.\n3. VERIFY: The filename is displayed (possibly truncated with ellipsis).\n4. VERIFY: The full filename is visible on hover or download.`,
    152: `HOW TO TEST:\n1. Upload a file with special characters in the filename (e.g., "report & summary (final) #1.pdf").\n2. VERIFY: The file uploads successfully.\n3. VERIFY: The filename displays correctly.\n4. VERIFY: The file can be downloaded with its original name.`,
    153: `HOW TO TEST:\n1. Open a completed/approved work order.\n2. Check the attachments section.\n3. VERIFY: Existing attachments are still visible and accessible.\n4. Try to upload a new attachment.\n5. VERIFY: Uploading to a completed WO is either allowed (for record-keeping) or blocked (to maintain immutability).\n6. Document the actual behavior.`
  };
  return map[num] || `HOW TO TEST:\n1. Open a work order.\n2. Test attachment functionality.\n3. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateWOMiscTest(id, num, section, scenario, steps, testData, expected) {
  const map = {
    154: `HOW TO TEST:\n1. Open a work order in editing mode.\n2. Fill in some Part B fields but do NOT submit.\n3. Look for a "Save Draft" button.\n4. Click Save Draft.\n5. VERIFY: The data is saved without changing the WO status.\n6. Close the work order and reopen it.\n7. VERIFY: Draft data is preserved — fields show previously saved values.`,
    155: `HOW TO TEST:\n1. Save a draft work order (partially filled Part B).\n2. Close the browser or navigate away.\n3. Reopen the work order.\n4. VERIFY: Draft data is still there.\n5. Continue filling in fields and submit.\n6. VERIFY: The final submission includes both draft and newly entered data.`,
    156: `HOW TO TEST:\n1. Open a completed and approved work order.\n2. Try to modify any field (Part A or Part B).\n3. VERIFY: All fields are read-only/locked.\n4. VERIFY: No edit buttons are available.\n5. VERIFY: The work order record is immutable after approval.\n6. VERIFY: A lock icon or "Completed" indicator is visible.`,
    157: `HOW TO TEST:\n1. Open a completed work order.\n2. Check that the approval details are locked (approver name, date, remarks).\n3. VERIFY: Approval fields cannot be modified.\n4. VERIFY: The completion data (dates, readings, work done) is also locked.\n5. VERIFY: Only viewing is possible — no editing.`,
    158: `HOW TO TEST:\n1. Open a work order and go to a text field (e.g., Work Done, Remarks).\n2. Enter text up to the character limit.\n3. VERIFY: The system indicates when the limit is reached.\n4. VERIFY: Text beyond the limit is either blocked or truncated.\n5. VERIFY: The character count or remaining characters indicator is visible (if implemented).`,
    159: `HOW TO TEST:\n1. Open a work order text field (Job Title, Remarks, etc.).\n2. Enter text with various character types (letters, numbers, symbols, Unicode).\n3. VERIFY: All standard characters are accepted.\n4. VERIFY: No character causes an error or data corruption.\n5. VERIFY: Saved text displays exactly as entered.`,
    160: `HOW TO TEST:\n1. Open a work order.\n2. Set conflicting field values (e.g., completion date before start date).\n3. Try to save/submit.\n4. VERIFY: Cross-field validation catches the conflict.\n5. VERIFY: A clear error message explains the issue.\n6. Fix the conflict and VERIFY submission succeeds.`,
    161: `HOW TO TEST:\n1. Open an RH-based work order.\n2. VERIFY: Calendar-specific fields (due date) are hidden or disabled.\n3. VERIFY: RH-specific fields (current reading, due reading) are visible.\n4. Open a Calendar-based work order.\n5. VERIFY: RH-specific fields are hidden or disabled.\n6. VERIFY: Calendar-specific fields (due date) are visible.`,
    162: `HOW TO TEST:\n1. Open a work order where the component's criticality is "Yes".\n2. VERIFY: The work order reflects the criticality (displayed as "Critical").\n3. Change the component's criticality.\n4. VERIFY: Existing work orders update to reflect the change (or remain as they were at creation).`,
    163: `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Look for the chat button (message icon) in the bottom-right corner of the screen.\n3. VERIFY: The chat button is visible.\n4. Click it to open the chat panel.\n5. VERIFY: The chat panel opens with an AI assistant.\n6. Type a question about work orders (e.g., "How many overdue work orders are there?").\n7. VERIFY: The chatbot responds with relevant information.`,
    164: `HOW TO TEST:\n1. Open the chatbot panel.\n2. Ask about a specific work order (e.g., "Show me work order WO-702.005.01-INS-M3").\n3. VERIFY: The chatbot provides details about the specified work order.\n4. VERIFY: The response is accurate and matches the actual data.`,
    165: `HOW TO TEST:\n1. Open the chatbot panel.\n2. Ask a maintenance-related question (e.g., "Which components need urgent attention?").\n3. VERIFY: The chatbot provides a helpful response.\n4. VERIFY: Suggested follow-up prompts appear.\n5. VERIFY: The chatbot understands maritime/PMS context.`,
    166: `HOW TO TEST:\n1. Open the chatbot panel.\n2. Type an irrelevant or nonsensical question.\n3. VERIFY: The chatbot responds gracefully (doesn't crash or show errors).\n4. VERIFY: It either redirects to PMS-related topics or provides a polite "I can help with..." message.`,
    167: `HOW TO TEST:\n1. Log in as a NON-Sail Admin user.\n2. Look for the chat button.\n3. VERIFY: The chat button is NOT visible for non-Sail Admin users.\n4. Log in as Sail Admin.\n5. VERIFY: The chat button IS visible.`,
    168: `HOW TO TEST:\n1. Open the chatbot panel.\n2. Have a multi-turn conversation (ask a question, get a response, ask a follow-up).\n3. VERIFY: The chatbot maintains context across messages.\n4. VERIFY: Follow-up questions relate to the previous context.\n5. VERIFY: The conversation history is visible in the chat panel.`
  };
  return map[num] || `HOW TO TEST:\n1. Navigate to PMS > Work orders.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateRunningHoursHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'RH-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Running Hrs".\n3. Select a vessel from the vessel dropdown.\n4. VERIFY: The Running Hours dashboard loads showing a table of parent components with RH tracking.\n5. VERIFY: Each row shows: Component, Component Code, Category, Running Hours (cumulative), Last Updated, Utilization Rate, Period Running Hours.\n6. VERIFY: The utilization rate column has a progress bar visualization.`,

    'RH-002': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Look at the "Utilization Rate" column.\n3. VERIFY: Each component shows a percentage value.\n4. VERIFY: The utilization rate has a colored progress bar (green for normal, amber for moderate, red for high).\n5. VERIFY: The period selector (Weekly/Monthly/Quarterly/Yearly) changes the utilization calculation.\n6. Change the period and VERIFY utilization rates update.`,

    'RH-003': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Look at each component's "Last Updated" column.\n3. VERIFY: Dates are displayed in a readable format (e.g., "15 Mar 2026 14:30").\n4. VERIFY: Components with recent updates show recent dates.\n5. VERIFY: No dates show as "Invalid Date" or "NaN".`,

    'RH-004': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Use the search bar at the top to filter components.\n3. Type a component name (e.g., "Main Engine").\n4. VERIFY: The table filters to show only matching components.\n5. Clear the search and VERIFY all components reappear.`,

    'RH-005': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Change the vessel dropdown.\n3. VERIFY: The running hours data refreshes for the newly selected vessel.\n4. VERIFY: Component list changes to reflect the new vessel's equipment.`,

    'RH-006': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Find the period selector (Weekly/Monthly/Quarterly/Yearly dropdown).\n3. Select "Weekly".\n4. VERIFY: Utilization rates and period running hours update to show weekly data.\n5. Switch to "Quarterly".\n6. VERIFY: Values change to reflect the quarterly period.\n7. VERIFY: The column header updates to show the selected period.`,

    'RH-007': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Look for a component that shows "Inherited" children count.\n3. Click on it (or look for a child-components icon/button).\n4. VERIFY: A popup or expandable section shows the child components that inherit RH from this parent.\n5. VERIFY: Each child shows its current cumulative RH.\n6. VERIFY: Child RH values match the parent (for inherited components).`,

    'RH-008': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Check for components with data quality warnings.\n3. VERIFY: If a component has suspicious data (e.g., extremely high utilization > 100%), a warning indicator appears.\n4. VERIFY: The warning provides context about the issue.\n5. VERIFY: Normal components do NOT show false warnings.`,

    'RH-009': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Click the pencil/edit icon on a component row.\n3. VERIFY: An update dialog opens.\n4. The dialog shows:\n   - Component name\n   - Current (old) running hours value\n   - Field to enter new value\n   - Date updated field\n   - Comments field\n5. Enter a new RH value (higher than current).\n6. Fill in the date and comments.\n7. Click "Update".\n8. VERIFY: Running hours update in the table.\n9. VERIFY: A success toast appears.`,

    'RH-010': `HOW TO TEST:\n1. Open the RH update dialog for a component.\n2. Note the "Update Mode" options: "Set Total" and "Add Delta".\n3. Select "Set Total" and enter a new cumulative value (e.g., 5500).\n4. Click Update.\n5. VERIFY: The component's RH changes to exactly 5500.\n6. Now open the dialog again, select "Add Delta" and enter a delta (e.g., 100).\n7. Click Update.\n8. VERIFY: The component's RH increases by 100 (now 5600).`,

    'RH-011': `HOW TO TEST:\n1. Open the RH update dialog for a component.\n2. Enter a value LESS than the current reading.\n3. Click Update.\n4. VERIFY: A validation error or confirmation dialog appears.\n5. VERIFY: The system warns that the new value is lower (potential data entry error).\n6. If entering 0, VERIFY a "Zero RH Renewal Confirmation" dialog appears asking for the renewal reason.`,

    'RH-012': `HOW TO TEST:\n1. Open the RH update dialog.\n2. Check the "Meter Replaced" checkbox.\n3. VERIFY: Additional fields appear: "Old Meter Final Reading" and "New Meter Start Reading".\n4. Enter the old meter's final reading and the new meter's start value.\n5. Click Update.\n6. VERIFY: The system calculates new cumulative RH correctly (old cumulative + new meter reading).\n7. VERIFY: The meter replacement is recorded in history.`,

    'RH-013': `HOW TO TEST:\n1. Open the RH update dialog.\n2. Enter a new value and leave the "Date Updated" field empty.\n3. VERIFY: The system either auto-fills today's date or requires you to enter a date.\n4. Enter a future date.\n5. VERIFY: The system may prevent future dates (document behavior).\n6. Enter a valid past date.\n7. VERIFY: The update saves with the specified date.`,

    'RH-014': `HOW TO TEST:\n1. Open the RH update dialog.\n2. Enter a valid new RH value.\n3. Add comments explaining the update (e.g., "Monthly RH reading").\n4. Click Update.\n5. VERIFY: The comments are saved.\n6. Check the RH history and VERIFY the comments appear in the entry.`,

    'RH-015': `HOW TO TEST:\n1. Update RH for a parent component that has inherited children.\n2. VERIFY: The parent's RH updates.\n3. VERIFY: All inherited children automatically update to match the parent.\n4. Check individual child RH values.\n5. VERIFY: Cascade update worked correctly for all children.`,

    'RH-016': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Look for a "Bulk Update" button.\n3. Click it.\n4. VERIFY: A bulk update dialog or mode opens.\n5. Enter RH values for multiple components.\n6. Set a common date and comments.\n7. Click "Save All" or equivalent.\n8. VERIFY: All components update simultaneously.\n9. VERIFY: A success message confirms the bulk update.`,

    'RH-017': `HOW TO TEST:\n1. Open the Bulk Update dialog.\n2. Enter valid values for some components and invalid values for others (e.g., negative number).\n3. Click Save All.\n4. VERIFY: Components with valid values update successfully.\n5. VERIFY: Components with invalid values show errors.\n6. VERIFY: The system clearly indicates which updates failed and why.`,

    'RH-018': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Click the "History" tab (next to the main RH view).\n3. VERIFY: The history tab opens showing RH update history.\n4. Select a component from the list.\n5. VERIFY: A history table shows all past RH updates for that component.\n6. VERIFY: Each entry shows: date, old value, new value, source (manual/cascade/work_order), updated by.`,

    'RH-019': `HOW TO TEST:\n1. Open the RH History tab and select a component.\n2. Check the sort order.\n3. VERIFY: History is sorted by date (most recent first by default).\n4. Click the sort toggle to change to ascending.\n5. VERIFY: Oldest entries appear first.\n6. Toggle back and VERIFY descending order returns.`,

    'RH-020': `HOW TO TEST:\n1. Open the RH History tab.\n2. Use the date filter fields (From/To dates).\n3. Enter a date range.\n4. VERIFY: Only history entries within that date range are shown.\n5. Clear the filters and VERIFY all entries reappear.`,

    'RH-021': `HOW TO TEST:\n1. Open the RH History tab.\n2. Search for a specific component or keyword.\n3. VERIFY: The search filters history entries.\n4. VERIFY: Matching entries are highlighted or filtered.`,

    'RH-022': `HOW TO TEST:\n1. Open the RH History tab for a component.\n2. Check the pagination controls at the bottom.\n3. VERIFY: Pagination works (Next, Previous, page numbers).\n4. Change items per page and VERIFY the display updates.\n5. VERIFY: Total entry count is accurate.`,

    'RH-023': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs (main view).\n2. Look for an RH timeline visualization (if available).\n3. VERIFY: The timeline shows RH progression over time.\n4. VERIFY: Data points correspond to actual RH update events.\n5. If no timeline exists on this page, check the component detail page for RH charts.`,

    'RH-024': `HOW TO TEST:\n1. View the RH timeline for a component.\n2. Look for meter replacement events.\n3. VERIFY: Meter replacements are visually distinct on the timeline.\n4. VERIFY: The cumulative total line shows the correct progression across meter changes.\n5. VERIFY: Hovering over data points shows details.`,

    'RH-025': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Find a component with RH-based maintenance jobs.\n3. Check the RH values.\n4. VERIFY: As RH increases, associated jobs approach their due readings.\n5. Navigate to Work Orders and check RH-based WOs.\n6. VERIFY: Due readings are calculated as: last completion reading + frequency.\n7. VERIFY: Status changes from Active to Due when approaching the due reading.`,

    'RH-026': `HOW TO TEST:\n1. Update a component's RH to a value that exceeds a job's due reading.\n2. Navigate to Work Orders.\n3. VERIFY: The RH-based work order's status changes to "Due" or "Overdue".\n4. VERIFY: The computed status reflects the new RH reality.\n5. VERIFY: The dashboard overdue count updates if applicable.`,

    'RH-027': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Find the period selector dropdown.\n3. Select "Weekly".\n4. VERIFY: The utilization data reflects the last 7 days (168 hours max).\n5. VERIFY: Column header shows "Weekly" label.`,

    'RH-028': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Select "Monthly" in the period selector.\n3. VERIFY: Utilization data reflects the last 30 days (720 hours max).\n4. VERIFY: Period running hours show the hours accumulated in the last month.`,

    'RH-029': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Select "Quarterly" then "Yearly" in the period selector.\n3. VERIFY: Each period shows appropriate time range data.\n4. Quarterly = 90 days (2160 hours max).\n5. Yearly = 365 days (8760 hours max).\n6. VERIFY: Utilization percentages recalculate for each period.`,

    'RH-030': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs (main view).\n2. Look for an "Export" button (download icon).\n3. Click it.\n4. VERIFY: A CSV file downloads.\n5. Open the CSV file.\n6. VERIFY: It contains all component RH data visible on screen.\n7. VERIFY: Columns match: Vessel, Component, Code, Category, Running Hours, Last Updated, Utilization Rate, Period RH.`,

    'RH-031': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs > History tab.\n2. Select a component and apply filters.\n3. Look for an "Export" button for history data.\n4. Click it.\n5. VERIFY: A CSV file downloads with the filtered history data.\n6. VERIFY: The export respects the applied filters.`,

    'RH-032': `HOW TO TEST:\n1. Export RH data.\n2. Open the exported file.\n3. VERIFY: Numeric values are formatted correctly (no loss of precision).\n4. VERIFY: Dates are in a readable format.\n5. VERIFY: Component names and codes are complete (no truncation).`,

    'RH-033': `HOW TO TEST:\n1. Export RH data for a vessel with many components (50+).\n2. VERIFY: The export includes ALL components (no data missing).\n3. VERIFY: The file opens without errors in Excel.\n4. VERIFY: Export completes in reasonable time (< 30 seconds).`,

    'RH-034': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Find a component with 0 running hours.\n3. Try to update it.\n4. VERIFY: The system handles the 0-to-new-value transition correctly.\n5. VERIFY: No division-by-zero or other math errors occur in utilization calculations.`,

    'RH-035': `HOW TO TEST:\n1. Navigate to PMS > Running Hrs.\n2. Try to enter an extremely large RH value (e.g., 9,999,999).\n3. VERIFY: The system either accepts it or shows a reasonable upper limit error.\n4. VERIFY: The display handles large numbers correctly (proper formatting with commas).\n5. VERIFY: Utilization calculations remain accurate with large values.`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Running Hrs from the sidebar.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateSparesHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'SP-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Spares".\n3. Select a vessel from the vessel dropdown.\n4. VERIFY: The Spares list page loads showing a table of spare parts.\n5. VERIFY: Columns include: Part Number, Part Name, Component, ROB (Remaining on Board), Min Stock, Unit, Location.\n6. VERIFY: Data loads without errors.`,

    'SP-002': `HOW TO TEST:\n1. Navigate to PMS > Spares and select a vessel.\n2. Look at the bottom of the spares table for pagination controls.\n3. VERIFY: Page navigation works (Next, Previous, page numbers).\n4. VERIFY: Items per page can be changed (10, 25, 50).\n5. VERIFY: Total count is displayed.`,

    'SP-003': `HOW TO TEST:\n1. Navigate to PMS > Spares and select a vessel.\n2. Use the search bar to search by part number.\n3. Type a part number (or partial number).\n4. VERIFY: The table filters to show matching parts.\n5. Clear the search and VERIFY the full list returns.`,

    'SP-004': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Search by part name (e.g., "filter" or "gasket").\n3. VERIFY: Matching spare parts are displayed.\n4. VERIFY: Partial name matches work.`,

    'SP-005': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Filter by component (if a component filter exists).\n3. Select a component.\n4. VERIFY: Only spares linked to that component are shown.`,

    'SP-006': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look for a "Critical" filter or tab.\n3. Apply it.\n4. VERIFY: Only critical spares are shown.\n5. Remove the filter and VERIFY all spares return.`,

    'SP-007': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look for a "Low Stock" filter or indicator.\n3. VERIFY: Spares where ROB <= Min Stock are highlighted or flagged.\n4. VERIFY: The low stock indicator uses a visible color (red or amber).`,

    'SP-008': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Click column headers to sort the table.\n3. Try sorting by Part Number, Part Name, ROB.\n4. VERIFY: Sorting works in ascending and descending order.\n5. VERIFY: A sort indicator appears on the active column.`,

    'SP-009': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Change the vessel filter.\n3. VERIFY: The spares list updates to show spares for the selected vessel.\n4. VERIFY: Counts and data reflect the new vessel.`,

    'SP-010': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look for an Export button.\n3. Click to export the spares list.\n4. VERIFY: A file downloads (Excel or CSV).\n5. VERIFY: The exported data matches the on-screen data.`,

    'SP-011': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look for a total spares count display.\n3. VERIFY: The count is visible and accurate.\n4. Apply a filter and VERIFY the count updates.`,

    'SP-012': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Click the "+ Add Spare" button.\n3. VERIFY: An add spare form opens.\n4. Fill in required fields:\n   - Part Number\n   - Part Name\n   - Component (link to a component)\n   - Unit of measure\n   - Min Stock level\n   - Initial ROB\n5. Click Save.\n6. VERIFY: The spare is created and appears in the list.\n7. VERIFY: A success toast message appears.`,

    'SP-013': `HOW TO TEST:\n1. Open the Add Spare form.\n2. Leave required fields empty.\n3. Click Save.\n4. VERIFY: Validation errors appear for missing required fields.\n5. VERIFY: The form does NOT save until all required fields are filled.`,

    'SP-014': `HOW TO TEST:\n1. Open the Add Spare form.\n2. Enter a part number that already exists.\n3. Fill other fields and click Save.\n4. VERIFY: A duplicate error message appears.\n5. VERIFY: The system prevents duplicate part numbers.`,

    'SP-015': `HOW TO TEST:\n1. Open the Add Spare form.\n2. Enter a negative value for ROB.\n3. VERIFY: The system rejects negative ROB values.\n4. Enter 0 for ROB.\n5. VERIFY: Zero is accepted (valid — no stock on hand).`,

    'SP-016': `HOW TO TEST:\n1. Open the Add Spare form.\n2. Set the "Critical" flag to "Yes".\n3. Save the spare.\n4. VERIFY: The spare is marked as critical in the list.\n5. VERIFY: Critical spares are included in critical stock reports.`,

    'SP-017': `HOW TO TEST:\n1. Click on an existing spare part in the list.\n2. VERIFY: The spare details open for editing.\n3. Modify the Part Name.\n4. Click Save.\n5. VERIFY: Changes are saved and reflected in the list.\n6. VERIFY: A success message appears.`,

    'SP-018': `HOW TO TEST:\n1. Edit an existing spare.\n2. Change the Min Stock level.\n3. Save.\n4. VERIFY: The new min stock is saved.\n5. VERIFY: Low stock indicators update based on the new threshold.\n6. VERIFY: If ROB is now below the new min, a low stock flag appears.`,

    'SP-019': `HOW TO TEST:\n1. Navigate to PMS > Spares and find a spare part.\n2. Look for a "Stock In" or "Receive" button.\n3. Click it and enter a quantity to add (e.g., 10).\n4. Enter a date and optional notes.\n5. Confirm the transaction.\n6. VERIFY: ROB increases by the entered quantity.\n7. VERIFY: The transaction is recorded in the stock history.`,

    'SP-020': `HOW TO TEST:\n1. Find a spare part with ROB > 0.\n2. Look for a "Stock Out" or "Issue" button.\n3. Click it and enter a quantity to issue (e.g., 2).\n4. Confirm the transaction.\n5. VERIFY: ROB decreases by the issued quantity.\n6. VERIFY: The transaction is recorded in history.`,

    'SP-021': `HOW TO TEST:\n1. Find a spare with ROB of 5.\n2. Try to issue more than available (e.g., issue 10).\n3. VERIFY: The system prevents issuing more than ROB.\n4. VERIFY: An error message appears (e.g., "Insufficient stock").`,

    'SP-022': `HOW TO TEST:\n1. Perform a Stock In transaction.\n2. VERIFY: The transaction appears in the stock history with "In" type.\n3. Perform a Stock Out transaction.\n4. VERIFY: It appears in history with "Out" type.\n5. VERIFY: Both transactions show correct quantities, dates, and notes.`,

    'SP-023': `HOW TO TEST:\n1. Perform multiple stock transactions for the same spare.\n2. Check the running ROB balance after each.\n3. VERIFY: ROB calculations are mathematically correct.\n4. VERIFY: The history shows an accurate audit trail.`,

    'SP-024': `HOW TO TEST:\n1. Open a work order and complete it.\n2. In the spares consumption section (Part B), select spares used.\n3. Enter quantities consumed.\n4. Submit the work order.\n5. VERIFY: The spare part's ROB decreases by the consumed quantity.\n6. VERIFY: The consumption is recorded in the spare's transaction history.\n7. VERIFY: The transaction source shows "Work Order".`,

    'SP-025': `HOW TO TEST:\n1. Link a spare part to a work order during completion.\n2. VERIFY: Only spares associated with the work order's component are available for selection.\n3. Enter consumption quantity.\n4. VERIFY: ROB updates correctly after WO submission.`,

    'SP-026': `HOW TO TEST:\n1. Navigate to a spare part's detail page.\n2. Look for a "History" or "Transaction History" section.\n3. VERIFY: All past transactions are listed chronologically.\n4. VERIFY: Each entry shows: date, type (In/Out), quantity, balance after, source, notes.`,

    'SP-027': `HOW TO TEST:\n1. Open stock history for a spare.\n2. Apply date filters.\n3. VERIFY: Only transactions within the selected date range are shown.\n4. Clear filters and VERIFY all transactions return.`,

    'SP-028': `HOW TO TEST:\n1. Open stock history.\n2. VERIFY: Transactions are sorted by date (newest first by default).\n3. Toggle sort order.\n4. VERIFY: Oldest entries appear first when ascending.`,

    'SP-029': `HOW TO TEST:\n1. Check stock history across multiple operations (manual in, manual out, WO consumption).\n2. VERIFY: All transaction types are represented in history.\n3. VERIFY: The running balance is accurate at each point in time.`,

    'SP-030': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Identify spares where ROB is at or below Min Stock.\n3. VERIFY: These spares have a visual low stock indicator (badge, icon, or row highlighting).\n4. VERIFY: The indicator is clearly visible (red or amber color).\n5. Check the Dashboard for low stock count.\n6. VERIFY: Dashboard count matches the number of low-stock spares.`,

    'SP-031': `HOW TO TEST:\n1. Find a spare with ROB = Min Stock.\n2. VERIFY: It is flagged as low stock.\n3. Increase the ROB above Min Stock (stock in).\n4. VERIFY: The low stock indicator is removed.\n5. Decrease ROB to below Min Stock.\n6. VERIFY: The indicator reappears.`,

    'SP-032': `HOW TO TEST:\n1. Navigate to the Dashboard.\n2. Look for "Low Stock" and "Critical Low Stock" count tiles.\n3. VERIFY: Low Stock count matches spares where ROB <= Min.\n4. VERIFY: Critical Low Stock count matches critical spares where ROB <= Min.\n5. VERIFY: Clicking the tile navigates to the filtered spares list.`,

    'SP-033': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look for a category filter or grouping option.\n3. If available, filter by category (e.g., "Engine Parts", "Deck Parts").\n4. VERIFY: Only spares in the selected category are shown.\n5. Document what category options are available.`,

    'SP-034': `HOW TO TEST:\n1. Add a new spare and assign it to a category.\n2. VERIFY: The spare appears under the correct category.\n3. Edit the spare and change its category.\n4. VERIFY: The spare moves to the new category.`,

    'SP-035': `HOW TO TEST:\n1. Navigate to PMS > Spares.\n2. Look at the ROB column.\n3. VERIFY: ROB values are displayed as non-negative integers.\n4. VERIFY: The unit of measure is shown alongside the ROB.\n5. VERIFY: ROB accurately reflects all stock transactions.`,

    'SP-036': `HOW TO TEST:\n1. Perform a stock transaction (add or remove stock).\n2. VERIFY: The ROB updates immediately after the transaction.\n3. Refresh the page.\n4. VERIFY: The ROB persists — it wasn't a UI-only update.\n5. VERIFY: The ROB matches the expected balance.`,

    'SP-037': `HOW TO TEST:\n1. Find a spare with no transaction history and not linked to any WO.\n2. Click on it and look for a "Delete" button.\n3. Click Delete.\n4. VERIFY: A confirmation dialog appears.\n5. Confirm deletion.\n6. VERIFY: The spare is removed from the list.\n7. VERIFY: A success message appears.`,

    'SP-038': `HOW TO TEST:\n1. Find a spare that is linked to work orders or has transaction history.\n2. Try to delete it.\n3. VERIFY: The system prevents deletion (error message: "Cannot delete spare with existing transactions/WO links").\n4. VERIFY: The spare remains in the list.`,

    'SP-039': `HOW TO TEST:\n1. Find a spare and click Delete.\n2. When the confirmation dialog appears, click "Cancel".\n3. VERIFY: The spare is NOT deleted.\n4. VERIFY: All data remains intact.`,

    'SP-040': `HOW TO TEST:\n1. Navigate to PMS > Admin or Spares management.\n2. Look for a "Bulk Import" or "Upload" option for spares.\n3. If available, prepare a CSV/Excel file with multiple spare parts.\n4. Upload the file.\n5. VERIFY: All valid spares are imported.\n6. VERIFY: Invalid entries are flagged with specific error messages.\n7. VERIFY: A summary shows how many were imported vs rejected.`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Spares from the sidebar.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateStoresHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'ST-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Stores".\n3. Select a vessel from the vessel dropdown.\n4. VERIFY: The Stores inventory page loads showing a table of store items.\n5. VERIFY: Columns include: Item Code, Item Name, Category/Type, ROB, Min Stock, Unit, Location.\n6. VERIFY: Data loads without errors.`,

    'ST-002': `HOW TO TEST:\n1. Navigate to PMS > Stores and select a vessel.\n2. Use the search bar to search by item code.\n3. VERIFY: The table filters to show matching items.\n4. Clear the search and VERIFY the full list returns.`,

    'ST-003': `HOW TO TEST:\n1. Navigate to PMS > Stores.\n2. Search by item name (e.g., "rope" or "paint").\n3. VERIFY: Matching store items are displayed.\n4. VERIFY: Partial name matches work.`,

    'ST-004': `HOW TO TEST:\n1. Navigate to PMS > Stores.\n2. Look at pagination controls at the bottom.\n3. VERIFY: Pagination works (Next, Previous, page numbers).\n4. Change items per page.\n5. VERIFY: Display updates accordingly.`,

    'ST-005': `HOW TO TEST:\n1. Navigate to PMS > Stores.\n2. Click column headers to sort.\n3. VERIFY: Sorting works for Item Code, Item Name, ROB.\n4. VERIFY: Sort indicators appear.`,

    'ST-006': `HOW TO TEST:\n1. Navigate to PMS > Stores.\n2. Click "+ Add Item" or similar button.\n3. VERIFY: An add form opens.\n4. Fill in required fields:\n   - Item Code\n   - Item Name\n   - Category/Type\n   - Unit\n   - Min Stock\n   - Initial ROB\n5. Click Save.\n6. VERIFY: The item is created and appears in the list.\n7. VERIFY: A success message appears.`,

    'ST-007': `HOW TO TEST:\n1. Open the Add Store Item form.\n2. Leave required fields empty.\n3. Click Save.\n4. VERIFY: Validation errors appear.\n5. VERIFY: The form does NOT save.`,

    'ST-008': `HOW TO TEST:\n1. Open the Add Store Item form.\n2. Enter a duplicate item code.\n3. Click Save.\n4. VERIFY: The system prevents duplicates with an error message.`,

    'ST-009': `HOW TO TEST:\n1. Add a store item with minimum valid data.\n2. VERIFY: The item saves successfully.\n3. Add another with maximum data (all optional fields filled).\n4. VERIFY: All data saves correctly.`,

    'ST-010': `HOW TO TEST:\n1. Find a store item and look for "Update Quantity" or "Adjust Stock" option.\n2. Enter a positive adjustment (stock in).\n3. VERIFY: ROB increases.\n4. Enter a negative adjustment (stock out).\n5. VERIFY: ROB decreases.\n6. VERIFY: Transactions are recorded in history.`,

    'ST-011': `HOW TO TEST:\n1. Find a store item with ROB of 5.\n2. Try to decrease ROB by 10 (more than available).\n3. VERIFY: The system prevents going below 0.\n4. VERIFY: An error message appears.`,

    'ST-012': `HOW TO TEST:\n1. Update a store item's quantity.\n2. VERIFY: The change is reflected immediately in the table.\n3. Refresh the page.\n4. VERIFY: The updated quantity persists.`,

    'ST-013': `HOW TO TEST:\n1. Navigate to PMS > Stores.\n2. Look for category filters or tabs.\n3. If available, filter by category.\n4. VERIFY: Only items in the selected category are shown.\n5. Clear the filter and VERIFY all items return.`,

    'ST-014': `HOW TO TEST:\n1. Add a new store item and assign it to a specific category.\n2. VERIFY: The item appears under the correct category.\n3. If category management exists, check available categories.`,

    'ST-015': `HOW TO TEST:\n1. Edit a store item and change its category.\n2. Save.\n3. VERIFY: The item moves to the new category.\n4. VERIFY: The old category no longer shows this item.`,

    'ST-016': `HOW TO TEST:\n1. Look for a "Manage Categories" or similar option.\n2. Try to add a new category.\n3. VERIFY: New categories can be created.\n4. Try to delete an empty category.\n5. VERIFY: Empty categories can be deleted.\n6. Try to delete a category with items.\n7. VERIFY: The system prevents deletion or moves items first.`,

    'ST-017': `HOW TO TEST:\n1. Find a store item and open its transaction history.\n2. VERIFY: All past quantity changes are listed.\n3. VERIFY: Each entry shows: date, type (In/Out), quantity, balance after, notes.\n4. VERIFY: History is sorted by date (newest first).`,

    'ST-018': `HOW TO TEST:\n1. Open transaction history for a store item.\n2. Apply date filters.\n3. VERIFY: Only transactions within the date range are shown.\n4. Clear filters and VERIFY all entries return.`,

    'ST-019': `HOW TO TEST:\n1. Perform several transactions on a store item.\n2. Open the transaction history.\n3. VERIFY: The running balance at each point is correct.\n4. VERIFY: All transactions are accounted for.`,

    'ST-020': `HOW TO TEST:\n1. Click on an existing store item.\n2. VERIFY: The item details open for editing.\n3. Modify the Item Name.\n4. Click Save.\n5. VERIFY: Changes are saved and reflected in the list.\n6. VERIFY: A success message appears.`,

    'ST-021': `HOW TO TEST:\n1. Edit a store item and change the Min Stock level.\n2. Save.\n3. VERIFY: The new min stock is saved.\n4. VERIFY: Low stock indicators update accordingly.\n5. VERIFY: If ROB is now below the new min, a warning appears.`,

    'ST-022': `HOW TO TEST:\n1. Look for a "Bulk Update" or "Import" option for stores.\n2. If available, prepare a file with multiple store items.\n3. Upload it.\n4. VERIFY: All valid items are imported/updated.\n5. VERIFY: Invalid entries are flagged.\n6. VERIFY: A summary report shows results.`,

    'ST-023': `HOW TO TEST:\n1. Find a store item with no transaction history.\n2. Click Delete.\n3. VERIFY: A confirmation dialog appears.\n4. Confirm.\n5. VERIFY: The item is removed from the list.\n6. VERIFY: A success message appears.`,

    'ST-024': `HOW TO TEST:\n1. Find a store item with transaction history.\n2. Try to delete it.\n3. VERIFY: The system either prevents deletion or warns about losing history.\n4. Document the actual behavior.`,

    'ST-025': `HOW TO TEST:\n1. Add a store item with a very long name (200+ characters).\n2. VERIFY: The item saves successfully.\n3. VERIFY: The name displays correctly in the list (truncated if needed).\n4. Add an item with special characters in the name.\n5. VERIFY: Characters are preserved correctly.`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Stores from the sidebar.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateReportsHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'RPT-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Reports".\n3. VERIFY: The Reports module opens showing available report categories.\n4. Look for "Work Order Reports" section.\n5. Click on a WO report type (e.g., "Work Order Summary").\n6. VERIFY: The report generates and displays data.`,

    'RPT-002': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Generate a Work Order Status report.\n3. VERIFY: The report shows WOs grouped by status (Planned, Due, Overdue, Completed).\n4. VERIFY: Counts and percentages are accurate.\n5. VERIFY: The report matches the data on the Work Orders page.`,

    'RPT-003': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Generate a Work Order Completion report for a specific date range.\n3. VERIFY: Only WOs completed within the range are included.\n4. VERIFY: Completion details (date, who, work done) are shown.`,

    'RPT-004': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Generate an Overdue Work Orders report.\n3. VERIFY: All overdue WOs are listed.\n4. VERIFY: The report shows days overdue for each WO.\n5. VERIFY: Critical overdue items are highlighted.`,

    'RPT-005': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Generate a Work Order Trend report.\n3. VERIFY: Monthly trends are shown (completions vs due vs overdue).\n4. VERIFY: The chart (if present) accurately represents the data.\n5. VERIFY: The date range can be adjusted.`,

    'RPT-006': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Find and generate a "Component Report" or "Equipment Report".\n3. VERIFY: The report lists all components with key information.\n4. VERIFY: Component hierarchy is maintained.\n5. VERIFY: Critical components are highlighted.`,

    'RPT-007': `HOW TO TEST:\n1. Generate a Component Maintenance History report.\n2. Select a component or component group.\n3. VERIFY: All maintenance activities are listed chronologically.\n4. VERIFY: Details include: WO number, job title, completion date, work done.`,

    'RPT-008': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Find and generate a "Running Hours Report".\n3. VERIFY: Current RH for all tracked components is listed.\n4. VERIFY: Utilization rates are shown.\n5. VERIFY: Last updated dates are accurate.`,

    'RPT-009': `HOW TO TEST:\n1. Generate an RH History report for a specific component.\n2. VERIFY: All RH update events are listed.\n3. VERIFY: Old and new values are shown for each update.\n4. VERIFY: The source of each update (manual, cascade, WO) is indicated.`,

    'RPT-010': `HOW TO TEST:\n1. Generate an RH Utilization report.\n2. VERIFY: The report shows utilization rates by component.\n3. VERIFY: The selected period (weekly/monthly/etc.) is reflected.\n4. VERIFY: High-utilization components are highlighted.`,

    'RPT-011': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Find and generate a "Spares Report" or "Inventory Report".\n3. VERIFY: All spare parts are listed with current ROB.\n4. VERIFY: Min stock levels are shown.\n5. VERIFY: Low stock items are flagged.`,

    'RPT-012': `HOW TO TEST:\n1. Generate a Spares Consumption report.\n2. Select a date range.\n3. VERIFY: All spare consumption (from WOs and manual issues) is listed.\n4. VERIFY: Quantities consumed are accurate.\n5. VERIFY: The report shows which WOs consumed spares.`,

    'RPT-013': `HOW TO TEST:\n1. Generate a Critical Spares report.\n2. VERIFY: Only spares marked as "Critical" are included.\n3. VERIFY: Current stock levels are shown.\n4. VERIFY: Items below minimum stock are highlighted prominently.`,

    'RPT-014': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Find the "Compliance Reports" section.\n3. Generate a Compliance Summary report.\n4. VERIFY: The report shows overall PMS compliance rates.\n5. VERIFY: Compliance is calculated as completed on-time / total due.\n6. VERIFY: The report can be filtered by vessel and date range.`,

    'RPT-015': `HOW TO TEST:\n1. Generate a compliance report broken down by department.\n2. VERIFY: Each department (Engine, Deck, etc.) has its own compliance rate.\n3. VERIFY: The breakdown totals match the overall rate.`,

    'RPT-016': `HOW TO TEST:\n1. Generate a compliance report broken down by component category.\n2. VERIFY: Each category shows its compliance rate.\n3. VERIFY: Categories with low compliance are highlighted.`,

    'RPT-017': `HOW TO TEST:\n1. Generate compliance reports for multiple consecutive months.\n2. VERIFY: A trend is visible (improving or declining compliance).\n3. VERIFY: Month-over-month changes are clear.`,

    'RPT-018': `HOW TO TEST:\n1. Open any report generation screen.\n2. Look for filter options: Vessel, Date Range, Department, Component.\n3. Apply a vessel filter.\n4. VERIFY: Report data is scoped to the selected vessel.\n5. Apply a date range filter.\n6. VERIFY: Only data within the range is included.`,

    'RPT-019': `HOW TO TEST:\n1. Generate a report with specific filters.\n2. Remove all filters.\n3. Regenerate the report.\n4. VERIFY: The unfiltered report shows ALL data.\n5. VERIFY: The filtered and unfiltered reports are consistent.`,

    'RPT-020': `HOW TO TEST:\n1. Apply invalid filter combinations (e.g., "From" date after "To" date).\n2. VERIFY: The system shows a validation error.\n3. VERIFY: No report is generated with invalid filters.`,

    'RPT-021': `HOW TO TEST:\n1. Navigate to a report and click "Generate" or "Run Report".\n2. VERIFY: A loading indicator appears while the report generates.\n3. VERIFY: The report renders in the preview area.\n4. VERIFY: Generation completes in reasonable time.`,

    'RPT-022': `HOW TO TEST:\n1. Generate a report.\n2. Look for "Export" or "Download" buttons (Excel, PDF).\n3. Click Export to Excel.\n4. VERIFY: An Excel file downloads with the report data.\n5. Click Export to PDF.\n6. VERIFY: A PDF file downloads with the formatted report.`,

    'RPT-023': `HOW TO TEST:\n1. Export a report to PDF.\n2. Open the PDF.\n3. VERIFY: The report has proper formatting: headers, footers, page numbers.\n4. VERIFY: Tables are readable and not cut off.\n5. VERIFY: Charts and graphs (if any) render correctly in the export.`,

    'RPT-024': `HOW TO TEST:\n1. Generate a report.\n2. Look at the report header.\n3. VERIFY: The header includes: Report title, vessel name, date range, generation date.\n4. VERIFY: Company/system branding is present if applicable.`,

    'RPT-025': `HOW TO TEST:\n1. Generate a report with a large dataset (many work orders or components).\n2. VERIFY: The report handles the volume without errors.\n3. VERIFY: All data is included (no truncation).\n4. VERIFY: Performance is acceptable (generates within 30 seconds).`,

    'RPT-026': `HOW TO TEST:\n1. Generate two reports with the same parameters.\n2. Compare them.\n3. VERIFY: The reports produce identical results (deterministic).\n4. VERIFY: No random variations occur.`,

    'RPT-027': `HOW TO TEST:\n1. Generate a compliance report with known data.\n2. Manually calculate expected compliance rates.\n3. VERIFY: The report's calculated rates match your manual calculation.\n4. VERIFY: Percentages add up correctly.`,

    'RPT-028': `HOW TO TEST:\n1. Look for a "Scheduled Reports" or "Auto Reports" option in the Reports module.\n2. If available, set up a scheduled report (e.g., monthly compliance report).\n3. VERIFY: The schedule is saved.\n4. VERIFY: The system indicates when the next report will be generated.\n5. If not available, note "Scheduled Reports not implemented" in Comments.`,

    'RPT-029': `HOW TO TEST:\n1. If scheduled reports exist, check if email delivery is configured.\n2. VERIFY: Reports are sent to the configured recipients.\n3. VERIFY: The email contains the report attachment.\n4. If not available, note "Email delivery not implemented" in Comments.`,

    'RPT-030': `HOW TO TEST:\n1. If scheduled reports exist, edit an existing schedule.\n2. Change the frequency (e.g., weekly to monthly).\n3. VERIFY: The updated schedule saves.\n4. Delete a schedule.\n5. VERIFY: The schedule is removed and no more reports are generated.`,

    'RPT-031': `HOW TO TEST:\n1. Look for a "Custom Report" builder or ad-hoc report option.\n2. If available, select custom fields/columns for the report.\n3. Generate the custom report.\n4. VERIFY: Only selected fields appear in the output.\n5. If not available, note "Custom Reports not implemented" in Comments.`,

    'RPT-032': `HOW TO TEST:\n1. Navigate to PMS > Reports.\n2. Apply filters to a report (vessel, date range, department).\n3. VERIFY: Each filter narrows the data appropriately.\n4. Combine multiple filters.\n5. VERIFY: Combined filters work with AND logic.\n6. Clear all filters.\n7. VERIFY: The report shows unfiltered data.`,

    'RPT-033': `HOW TO TEST:\n1. Generate a report and export it.\n2. VERIFY: The exported file reflects the applied filters.\n3. VERIFY: Filters are indicated in the export (e.g., "Vessel: Vessel 11, Period: Jan-Mar 2026").`,

    'RPT-034': `HOW TO TEST:\n1. Generate several different report types.\n2. VERIFY: Each report loads and generates without errors.\n3. VERIFY: Report generation shows a loading state.\n4. VERIFY: Error messages appear if data is unavailable.`,

    'RPT-035': `HOW TO TEST:\n1. Export a report to both Excel and PDF formats.\n2. Compare the content.\n3. VERIFY: Both formats contain the same data.\n4. VERIFY: Excel has sortable columns.\n5. VERIFY: PDF has proper page breaks and formatting.`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Reports from the sidebar.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

function generateDashboardHowToTest(id, section, scenario, steps, testData, expected) {
  const instructions = {
    'DASH-001': `HOW TO TEST:\n1. Log in to RSMS and click "PMS" in the top menu bar.\n2. In the left sidebar, click "Dashboard" (it should be the default page).\n3. Select a vessel from the vessel dropdown.\n4. VERIFY: The Dashboard loads showing overview tiles, charts, and widgets.\n5. VERIFY: Key sections are visible: KPI tiles at the top, status distribution chart, trend chart, overdue WOs widget.`,

    'DASH-002': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Select a specific vessel.\n3. VERIFY: Dashboard data updates to reflect the selected vessel.\n4. Switch to a different vessel.\n5. VERIFY: All tiles, charts, and widgets refresh with the new vessel's data.`,

    'DASH-003': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Select "All Vessels" from the vessel dropdown.\n3. VERIFY: Dashboard shows aggregated data across all vessels.\n4. VERIFY: A Fleet Comparison table appears showing each vessel's KPIs.\n5. VERIFY: You can click a vessel name in the fleet table to drill down.`,

    'DASH-004': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Look at the overall layout.\n3. VERIFY: KPI tiles are at the top.\n4. VERIFY: Charts (pie chart, trend) are in the middle section.\n5. VERIFY: Detail widgets (overdue list, inventory) are below.\n6. VERIFY: The layout is organized and all sections are readable.`,

    'DASH-005': `HOW TO TEST:\n1. Navigate to PMS > Dashboard and select a vessel.\n2. Find the "Overdue WOs" KPI tile.\n3. VERIFY: It shows the count of overdue work orders.\n4. VERIFY: The count matches the Overdue tab count on the Work Orders page.\n5. VERIFY: The tile has a colored indicator (red if overdue count > 0).`,

    'DASH-006': `HOW TO TEST:\n1. Navigate to PMS > Dashboard and select a vessel.\n2. Find the "Completion Rate" or "Compliance" KPI tile.\n3. VERIFY: It shows a percentage value.\n4. VERIFY: The percentage = (completed on time / total due) * 100.\n5. VERIFY: The gauge or progress indicator reflects the rate.`,

    'DASH-007': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Outstanding Tasks" or similar KPI tile.\n3. VERIFY: It shows the count of open/pending work orders.\n4. VERIFY: The count is consistent with Work Orders page data.`,

    'DASH-008': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the Status Distribution pie chart.\n3. VERIFY: The chart shows slices for: Planned, Due, Overdue, Pending Approval, Completed.\n4. VERIFY: Slice sizes are proportional to the actual counts.\n5. VERIFY: Each slice has a distinct color matching the status badge colors.\n6. VERIFY: A legend is visible identifying each slice.`,

    'DASH-009': `HOW TO TEST:\n1. On the Dashboard, look at the Status Distribution pie chart.\n2. Click on a pie segment (e.g., "Overdue").\n3. VERIFY: Clicking navigates to the Work Orders page filtered by that status.\n4. VERIFY: The Work Orders page shows the correct tab/filter pre-selected.`,

    'DASH-010': `HOW TO TEST:\n1. On the Dashboard, hover over each slice of the Status Distribution pie chart.\n2. VERIFY: A tooltip appears showing the exact count and percentage for that status.\n3. VERIFY: The tooltip is readable and positioned correctly.\n4. Hover over different slices and VERIFY each shows accurate data.`,

    'DASH-011': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the 6-month trend chart (line or bar chart).\n3. VERIFY: It shows maintenance activity over the last 6 months.\n4. VERIFY: Each month has a data point.\n5. VERIFY: The chart shows completions, overdue count, or compliance rate trend.\n6. VERIFY: The x-axis shows month labels, y-axis shows counts or percentages.`,

    'DASH-012': `HOW TO TEST:\n1. On the Dashboard trend chart, hover over data points.\n2. VERIFY: A tooltip appears showing the exact value for that month.\n3. VERIFY: Values are formatted correctly (counts as integers, rates as percentages).\n4. Hover over different months and VERIFY accuracy.`,

    'DASH-013': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Top Overdue WOs" widget/list.\n3. VERIFY: It shows the most overdue work orders (sorted by days/hours overdue).\n4. VERIFY: Each entry shows: WO number, job title, component, days overdue.\n5. VERIFY: The list is limited to a reasonable number (e.g., top 5 or 10).`,

    'DASH-014': `HOW TO TEST:\n1. In the Top Overdue WOs widget, click on a work order entry.\n2. VERIFY: You are navigated to the Work Order detail page.\n3. VERIFY: The correct work order is displayed.\n4. Click the browser's back button.\n5. VERIFY: You return to the Dashboard.`,

    'DASH-015': `HOW TO TEST:\n1. In the Top Overdue WOs widget, look for a "View All" link.\n2. Click it.\n3. VERIFY: You are navigated to the Work Orders page, filtered to show all overdue items.\n4. VERIFY: The Overdue tab is pre-selected.`,

    'DASH-016': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Total Spares" count tile.\n3. VERIFY: It shows the total number of spare parts for the selected vessel.\n4. VERIFY: The count matches the total on the Spares page.`,

    'DASH-017': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Low Stock" count tile.\n3. VERIFY: It shows the number of spares where ROB <= Min Stock.\n4. VERIFY: The count matches the actual low stock spares on the Spares page.\n5. VERIFY: If there are low stock items, the tile has a warning color (amber/red).`,

    'DASH-018': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Critical Low Stock" count tile.\n3. VERIFY: It shows spares that are BOTH critical AND below minimum stock.\n4. VERIFY: This is a subset of the Low Stock count.\n5. VERIFY: If there are critical low stock items, the tile shows urgent styling.`,

    'DASH-019': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Total Components" count tile.\n3. VERIFY: It shows the total number of components for the selected vessel.\n4. VERIFY: The count matches what's shown on the Components page.`,

    'DASH-020': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Stores Inventory" or "Total Stores" count tile.\n3. VERIFY: It shows the total number of store items.\n4. VERIFY: The count matches the Stores page total.`,

    'DASH-021': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the Stock Status pie chart (under Inventory section).\n3. VERIFY: It shows the distribution of spares by stock status.\n4. VERIFY: Segments include: Adequate, Low Stock, Critical Low Stock.\n5. VERIFY: Colors are distinct and a legend is visible.`,

    'DASH-022': `HOW TO TEST:\n1. On the Dashboard, find the Stock Status pie chart.\n2. Click on a segment (e.g., "Low Stock").\n3. VERIFY: Clicking navigates to the Spares page filtered by that stock status.\n4. VERIFY: The filtered view shows the correct spares.`,

    'DASH-023': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Look for a "Watch List" widget.\n3. If present, VERIFY it shows items the user has marked for monitoring.\n4. If not visible, note "Watch List widget not visible" in Comments.\n5. Document whether the feature exists and for which roles.`,

    'DASH-024': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Find the "Superintendent" tile or notification indicator.\n3. VERIFY: It shows the count of pending superintendent actions (e.g., WOs awaiting approval).\n4. VERIFY: The count is accurate and matches the Superintendent page.`,

    'DASH-025': `HOW TO TEST:\n1. On the Dashboard, find the Superintendent tile.\n2. Click on it.\n3. VERIFY: You are navigated to the Superintendent Notifications page.\n4. VERIFY: The pending items are displayed.\n5. VERIFY: The navigation is smooth (no errors).`,

    'DASH-026': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to PMS > Dashboard.\n3. Scroll down to find the "Compliance Anomaly Detection" panel.\n4. VERIFY: The panel is visible and shows anomaly categories:\n   - Cycle Skip Rate\n   - Backdating Frequency\n   - Bulk Completion Events\n   - Schedule Drift\n5. VERIFY: Each category has a count and severity indicator.\n6. VERIFY: Individual anomaly entries can be expanded for details.`,

    'DASH-027': `HOW TO TEST:\n1. Log in as a NON-Sail Admin user (e.g., Client Admin, Vessel User).\n2. Navigate to PMS > Dashboard.\n3. Scroll through the entire page.\n4. VERIFY: The "Compliance Anomaly Detection" panel is NOT visible.\n5. VERIFY: No anomaly-related tiles or sections are shown.\n6. Log in as Sail Admin and VERIFY the panel IS visible.`,

    'DASH-028': `HOW TO TEST:\n1. Log in as Sail Admin and go to the Dashboard.\n2. In the Anomaly Detection panel, find the "Cycle Skip Rate" card.\n3. VERIFY: It shows a percentage or count of jobs with skipped maintenance cycles.\n4. Click on it for details.\n5. VERIFY: Details show which jobs/components have skipped cycles.\n6. VERIFY: The rate is calculated accurately.`,

    'DASH-029': `HOW TO TEST:\n1. In the Anomaly Detection panel, find the "Backdating Frequency" card.\n2. VERIFY: It shows how many WOs were completed with backdated dates.\n3. Click for details.\n4. VERIFY: Each backdated WO is listed with the backdating amount.\n5. VERIFY: The count is accurate.`,

    'DASH-030': `HOW TO TEST:\n1. In the Anomaly Detection panel, find the "Bulk Completion Events" card.\n2. VERIFY: It flags dates where an unusually high number of WOs were completed.\n3. Click for details.\n4. VERIFY: The specific dates and WO counts are shown.\n5. VERIFY: The threshold for "bulk" is reasonable.`,

    'DASH-031': `HOW TO TEST:\n1. In the Anomaly Detection panel, find the "Schedule Drift" card.\n2. VERIFY: It shows jobs that are consistently completed earlier or later than scheduled.\n3. Click for details.\n4. VERIFY: Each drifting job shows the average drift amount.\n5. VERIFY: Both early and late drift are detected.`,

    'DASH-032': `HOW TO TEST:\n1. Log in as Sail Admin and go to the Dashboard.\n2. Look for an "Anomaly" KPI tile in the main dashboard tiles section.\n3. VERIFY: The tile shows the total count of detected anomalies.\n4. VERIFY: Clicking the tile scrolls to or navigates to the anomaly detail panel.\n5. VERIFY: The count matches the sum of anomalies in the detail panel.`,

    'DASH-033': `HOW TO TEST:\n1. Log in as a non-Sail Admin user.\n2. Navigate to the Dashboard.\n3. VERIFY: The Anomaly tile is NOT visible in the KPI tiles section.\n4. VERIFY: No anomaly-related information is shown anywhere.\n5. Log in as Sail Admin and VERIFY the tile IS visible.`,

    'DASH-034': `HOW TO TEST:\n1. Log in as Sail Admin and go to the Anomaly panel.\n2. Find the "Severity" filter dropdown.\n3. Select "High".\n4. VERIFY: Only high-severity anomalies are displayed.\n5. Select "Medium".\n6. VERIFY: Only medium-severity anomalies are shown.\n7. Select "All".\n8. VERIFY: All anomalies reappear.`,

    'DASH-035': `HOW TO TEST:\n1. In the Anomaly panel, click the "Refresh" button.\n2. VERIFY: A loading indicator appears.\n3. VERIFY: Anomaly data refreshes.\n4. VERIFY: Any new anomalies since last load appear.\n5. VERIFY: The refresh completes without errors.`,

    'DASH-036': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Locate the vessel filter (dropdown at the top).\n3. Select different vessels.\n4. VERIFY: All dashboard tiles, charts, and widgets update to reflect the selected vessel.\n5. Select "All Vessels".\n6. VERIFY: Aggregated data is shown across all vessels.`,

    'DASH-037': `HOW TO TEST:\n1. On the Dashboard, apply various filters (vessel, year).\n2. Look for a "Clear Filters" option.\n3. Click it.\n4. VERIFY: All filters reset to defaults.\n5. VERIFY: Dashboard shows the default view.`,

    'DASH-038': `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. Look for a year selector (e.g., "2025", "2026").\n3. If available, change the year.\n4. VERIFY: Dashboard data updates to reflect the selected year.\n5. VERIFY: Trend charts and compliance data are year-specific.\n6. If not available, note "Year selector not present" in Comments.`,

    'DASH-039': `HOW TO TEST:\n1. Navigate to any page in RSMS.\n2. Look for a notification bell icon in the header/toolbar area.\n3. VERIFY: The bell icon is visible.\n4. VERIFY: If there are unread notifications, a badge with a count appears on the bell.\n5. If no bell icon exists, note "Notification bell not implemented" in Comments.`,

    'DASH-040': `HOW TO TEST:\n1. Find the notification bell icon.\n2. Click it.\n3. VERIFY: A notification panel or dropdown opens.\n4. VERIFY: Recent notifications are listed.\n5. VERIFY: Each notification shows a title, description, and timestamp.\n6. Click outside the panel to close it.\n7. VERIFY: The panel closes.`,

    'DASH-041': `HOW TO TEST:\n1. Open the notification panel.\n2. Review the types of notifications present.\n3. VERIFY: Different notification types exist (e.g., WO approval requests, overdue alerts, stock warnings).\n4. VERIFY: Each type has a distinct icon or color.\n5. Document the notification types available.`,

    'DASH-042': `HOW TO TEST:\n1. Open the notification panel.\n2. Find an unread notification.\n3. Click on it or look for a "Mark as read" button.\n4. VERIFY: The notification visual changes (no longer bold/highlighted).\n5. VERIFY: The unread count badge decreases.\n6. VERIFY: The read status persists after refreshing the page.`,

    'DASH-043': `HOW TO TEST:\n1. Look for a user profile icon/avatar in the header area.\n2. Click it.\n3. VERIFY: A profile dropdown or page opens.\n4. VERIFY: It shows: user name, role, email (if applicable).\n5. VERIFY: The displayed role matches the logged-in user's actual role.`,

    'DASH-044': `HOW TO TEST:\n1. Click on the user profile icon/avatar.\n2. Look for a "Logout" or "Sign Out" option.\n3. Click Logout.\n4. VERIFY: You are redirected to the login page.\n5. VERIFY: You cannot access protected pages after logout.\n6. VERIFY: Logging back in works correctly.`,

    'DASH-045': `HOW TO TEST:\n1. Open RSMS on a desktop browser (1920px+ width).\n2. Navigate to the Dashboard.\n3. VERIFY: The layout uses the full width effectively.\n4. VERIFY: KPI tiles are in a row.\n5. VERIFY: Charts display at full size.\n6. VERIFY: No wasted whitespace or overlapping elements.`,

    'DASH-046': `HOW TO TEST:\n1. Open RSMS on a tablet (or resize browser to ~768px width).\n2. Navigate to the Dashboard.\n3. VERIFY: The layout adapts — tiles may stack or rearrange.\n4. VERIFY: Charts resize to fit.\n5. VERIFY: All content is accessible without horizontal scrolling.\n6. VERIFY: Navigation is usable on a tablet.`,

    'DASH-047': `HOW TO TEST:\n1. Open RSMS on a mobile device (or resize browser to ~375px width).\n2. Navigate to the Dashboard.\n3. VERIFY: Content stacks vertically.\n4. VERIFY: All tiles and charts are readable.\n5. VERIFY: No content is cut off.\n6. VERIFY: Navigation works (sidebar may collapse to a hamburger menu).\n7. VERIFY: Touch targets are adequately sized.`,

    'DASH-048': `HOW TO TEST:\n1. Disconnect from the network (airplane mode or disable WiFi).\n2. Try to load the Dashboard.\n3. VERIFY: An appropriate error message appears (e.g., "Unable to load data" or "Network error").\n4. VERIFY: The page does not crash — it degrades gracefully.\n5. Reconnect and refresh.\n6. VERIFY: The Dashboard loads normally after reconnection.`,

    'DASH-049': `HOW TO TEST:\n1. Log in to RSMS.\n2. Leave the application idle for a long time (until session times out).\n3. Try to navigate to a new page.\n4. VERIFY: The system redirects to the login page (session expired).\n5. VERIFY: An appropriate message is shown (e.g., "Session expired, please log in again").\n6. VERIFY: No data loss occurs — any unsaved work should be warned about before timeout.`,

    'DASH-050': `HOW TO TEST:\n1. Log in as different user roles and navigate to the Dashboard.\n2. As Vessel User: VERIFY you see vessel-specific data only.\n3. As Client Admin: VERIFY you see data for vessels assigned to your company.\n4. As Sail Admin: VERIFY you see all data including anomaly detection.\n5. VERIFY: Each role sees only what they're permitted to see.\n6. VERIFY: No role can access restricted features.`,

    'DASH-051': `HOW TO TEST:\n1. Log in as a Sail Admin user.\n2. Navigate to any page.\n3. Look for a chat button (message/chat bubble icon) in the bottom-right corner.\n4. VERIFY: The chat button is visible.\n5. Click it.\n6. VERIFY: The AI chat panel opens.\n7. VERIFY: You can type and receive responses.`,

    'DASH-052': `HOW TO TEST:\n1. Log in as a NON-Sail Admin user.\n2. Navigate to any page.\n3. Look for the chat button in the bottom-right corner.\n4. VERIFY: The chat button is NOT visible.\n5. VERIFY: There is no way to access the AI chat feature.\n6. Log in as Sail Admin and VERIFY the button IS visible.`
  };

  return instructions[id] || `HOW TO TEST:\n1. Navigate to PMS > Dashboard.\n2. ${steps.replace(/\n/g, '\n')}\nVERIFY: ${expected}`;
}

// Main execution
try {
  const wb = XLSX.readFile(INPUT_FILE, { cellFormula: true, cellStyles: true, cellNF: true });
  const sheets = wb.SheetNames;
  
  let totalProcessed = 0;

  for (const sheetName of sheets) {
    if (sheetName === 'Summary') continue;

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws);
    
    if (data.length === 0) continue;

    // Get the range of the sheet
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Add header for column M (index 12)
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: 12 });
    ws[headerCell] = { t: 's', v: 'How to Test' };
    
    // Add How to Test for each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const howToTest = generateHowToTest(row);
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 12 });
      ws[cellRef] = { t: 's', v: howToTest };
      totalProcessed++;
    }

    // Update the range to include column M
    range.e.c = Math.max(range.e.c, 12);
    ws['!ref'] = XLSX.utils.encode_range(range);

    // Set column M width
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'][12] = { wch: 80 };
  }

  XLSX.writeFile(wb, OUTPUT_FILE, { cellFormula: true, bookSST: true });
  console.log(`SUCCESS: Generated How-to-Test instructions for ${totalProcessed} test cases.`);
  console.log(`Output file: ${OUTPUT_FILE}`);
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
