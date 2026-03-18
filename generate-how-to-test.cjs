const ExcelJS = require('exceljs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'attached_assets', 'PMS_Test_Cases_Comprehensive_1773808572368.xlsx');
const OUTPUT_FILE = path.join(__dirname, 'PMS_Test_Cases_With_HowToTest.xlsx');

const NAV = {
  components: 'PMS > Components (left sidebar)',
  workOrders: 'PMS > Work orders (left sidebar)',
  runningHrs: 'PMS > Running Hrs (left sidebar)',
  spares: 'PMS > Spares (left sidebar)',
  stores: 'PMS > Stores (left sidebar)',
  reports: 'PMS > Reports (left sidebar)',
  dashboard: 'PMS > Dashboard (left sidebar)',
  admin: 'PMS > Admin (left sidebar)',
  superintendent: 'PMS > Superintendent page',
};

function generateStructuredHowToTest(tc) {
  const id = tc['Test Case ID'] || '';
  const section = tc['Module/Section'] || '';
  const scenario = tc['Test Scenario'] || '';
  const steps = tc['Test Steps'] || '';
  const testData = tc['Test Data'] || '';
  const expected = tc['Expected Result'] || '';

  if (id.startsWith('COMP-')) return genCOMP(id, section, scenario, steps, testData, expected);
  if (id.startsWith('WO-')) return genWO(id, section, scenario, steps, testData, expected);
  if (id.startsWith('RH-')) return genRH(id, section, scenario, steps, testData, expected);
  if (id.startsWith('SP-')) return genSP(id, section, scenario, steps, testData, expected);
  if (id.startsWith('ST-')) return genST(id, section, scenario, steps, testData, expected);
  if (id.startsWith('RPT-')) return genRPT(id, section, scenario, steps, testData, expected);
  if (id.startsWith('DASH-')) return genDASH(id, section, scenario, steps, testData, expected);

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function fmt(id, scenario, goal, setupSteps, actionSteps, intermediateSteps, finalSteps, checks, whatToVerify, edgeCases) {
  let out = `How to Test: ${id} — ${scenario}\n\n`;
  out += `Goal:\n• ${goal}\n\n`;
  out += `Steps:\n\n`;
  out += `Step 1 — Setup / Pre-condition\n`;
  setupSteps.forEach(s => { out += `• ${s}\n`; });
  out += `\nStep 2 — Action\n`;
  actionSteps.forEach(s => { out += `• ${s}\n`; });
  if (intermediateSteps && intermediateSteps.length > 0) {
    out += `\nStep 3 — Intermediate Action\n`;
    intermediateSteps.forEach(s => { out += `• ${s}\n`; });
  }
  if (finalSteps && finalSteps.length > 0) {
    out += `\nStep ${intermediateSteps && intermediateSteps.length > 0 ? '4' : '3'} — Final Action / Navigation\n`;
    finalSteps.forEach(s => { out += `• ${s}\n`; });
  }
  const verifyStep = intermediateSteps && intermediateSteps.length > 0 ? '5' : (finalSteps && finalSteps.length > 0 ? '4' : '3');
  out += `\nStep ${verifyStep} — Verification\n\n`;
  out += `Check | Expected\n`;
  out += `------|----------\n`;
  checks.forEach(c => { out += `${c[0]} | ${c[1]}\n`; });
  out += `\nWhat to Verify:\n`;
  whatToVerify.forEach(v => { out += `• ${v}\n`; });
  out += `\nEdge Cases:\n`;
  edgeCases.forEach(e => { out += `• ${e}\n`; });
  return out;
}

function genCOMP(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('COMP-', ''));
  const nav = NAV.components;

  if (n === 1) return fmt(id, scenario,
    'Verify the Components list page loads correctly and displays all components in a hierarchical tree with proper columns.',
    ['Log in to RSMS as a user with PMS access.', `Navigate to ${nav}.`, 'Select a vessel from the vessel dropdown (e.g., "Vessel 11").'],
    ['Wait for the component tree to load in the left panel.', 'Observe the hierarchical tree structure showing component codes and names.'],
    ['Click on any component in the tree to view its details in the right panel.'],
    ['Scroll through the tree to verify all components are loaded.'],
    [['Component Tree', 'Displays hierarchical list grouped under main categories (1-Engine, 2-Deck, etc.)'],
     ['Component Entry', 'Shows code and name (e.g., "702.005.01 - FO Separators No.01")'],
     ['Detail Panel', 'Right panel updates with Component Information when a tree node is clicked'],
     ['Component Count', 'Total count is displayed at the top of the tree panel']],
    ['Component tree loads without errors or blank areas', 'All columns (Code, Name, Department) are visible', 'No "undefined" or "null" values appear in component entries', 'Smooth scrolling through the tree'],
    ['Refresh the page (F5) and verify the tree reloads correctly.', 'Try selecting a vessel with zero components — verify an empty state message appears.', 'Use browser back button after navigating to a component detail — verify tree state is preserved.']
  );

  if (n >= 2 && n <= 5) {
    const sizes = { 2: '10', 3: '25', 4: '50', 5: '100' };
    const size = sizes[n];
    return fmt(id, scenario,
      `Verify that the component list displays exactly ${size} items per page when the "${size}" page size is selected.`,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel with many components (50+ components).'],
      ['Locate the items-per-page dropdown at the bottom of the component tree or table.', `Select "${size}" from the dropdown.`],
      ['Count the number of visible top-level items in the current page.'],
      ['Click Next/Previous page buttons to verify pagination navigation.'],
      [['Items Displayed', `Exactly ${size} items (or fewer on the last page) are shown`],
       ['Page Controls', 'Next/Previous buttons are functional and update the view'],
       ['Page Indicator', `Shows correct page number (e.g., "Page 1 of X")`]],
      ['Items-per-page dropdown retains the selected value after page navigation', 'No duplicate items appear across pages', 'Smooth page transitions without flickering'],
      ['Select the last page — verify it shows the remaining items (possibly fewer than ' + size + ').', 'Note: The current RSMS component view uses an expandable tree structure. If no explicit pagination dropdown exists, document "Tree view — pagination not applicable" in Comments.']
    );
  }

  if (n === 6) return fmt(id, scenario,
    'Verify that components can be sorted by component code in ascending and descending order.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel to load components.'],
    ['Click on the "Code" column header in the component list/tree.'],
    ['Observe the sort order of components.', 'Click the "Code" column header again to toggle sort direction.'],
    ['Verify both ascending and descending sort orders.'],
    [['First Click', 'Components sort in ascending order by code (101, 102, 201, 301, etc.)'],
     ['Second Click', 'Components sort in descending order by code (901, 801, 701, etc.)'],
     ['Sort Indicator', 'An arrow icon (▲/▼) appears on the Code column header']],
    ['Sort order persists when navigating between pages (if paginated)', 'No data loss or duplication after sorting', 'Sort indicator is visually clear'],
    ['Sort by code, then apply a search filter — verify the filter works on the sorted data.', 'Sort while the tree is expanded — verify child components maintain proper hierarchy.']
  );

  if (n === 7) return fmt(id, scenario,
    'Verify that components can be sorted by component name in ascending and descending order.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel to load components.'],
    ['Click on the "Name" column header.'],
    ['Observe the sort order — components should rearrange alphabetically.', 'Click again to toggle to reverse alphabetical.'],
    [],
    [['First Click', 'Components sort A-Z by name'],
     ['Second Click', 'Components sort Z-A by name'],
     ['Sort Indicator', 'Arrow icon appears on the Name column header']],
    ['Sort is case-insensitive', 'No data loss after sorting', 'Sort indicator is visible'],
    ['Sort by name, then switch vessel — verify new vessel data also loads sorted.', 'If name sorting is not supported in the tree view, document this in Comments.']
  );

  if (n === 8) return fmt(id, scenario,
    'Verify that searching by component code filters the component tree to show only matching results.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel to load components.'],
    ['Locate the search bar at the top of the component tree panel (magnifying glass icon).', 'Type a known component code (e.g., "702.005") into the search bar.'],
    ['Observe the tree filtering in real-time as you type.'],
    ['Clear the search field and verify the full tree reappears.'],
    [['Search Results', 'Tree filters to show only components whose code matches or contains "702.005"'],
     ['Parent Expansion', 'Parent nodes auto-expand to reveal matching child components'],
     ['Clear Search', 'Full tree reappears when the search field is cleared'],
     ['Result Count', 'Component count updates to reflect filtered results']],
    ['Search updates as the user types (real-time filtering)', 'No error messages during search', 'Empty search shows all components'],
    ['Search for a code that does not exist — verify "No results" or empty state is shown.', 'Search with special characters (e.g., ".") — verify it works correctly.', 'Search, then navigate to component detail and back — verify search text is preserved.']
  );

  if (n === 9) return fmt(id, scenario,
    'Verify that searching by component name filters the component tree to show only matching results.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel to load components.'],
    ['In the search bar, type a component name keyword (e.g., "pump" or "separator").'],
    ['Observe the tree filtering to show matching components.'],
    ['Clear the search and verify the full tree returns.'],
    [['Search Results', 'Tree shows only components whose name contains the search text'],
     ['Matching', 'Search is case-insensitive — "Pump" and "pump" return same results'],
     ['Clear', 'Full tree reappears when search field is cleared']],
    ['Partial matches work (typing "sep" shows "Separator")', 'Parent nodes auto-expand for matching children', 'No errors during name search'],
    ['Search for a name with spaces (e.g., "Main Engine") — verify multi-word search works.', 'Search with very long text (100+ chars) — verify no UI breakage.']
  );

  if (n === 10) return fmt(id, scenario,
    'Verify that selecting a different vessel from the dropdown correctly filters and loads components for that vessel.',
    ['Log in to RSMS.', `Navigate to ${nav}.`],
    ['Select a vessel from the vessel dropdown (e.g., "Vessel 11").', 'Wait for components to load.', 'Note the component count and tree structure.'],
    ['Switch to a different vessel (e.g., "Vessel 14") using the dropdown.'],
    ['Verify the tree refreshes with the new vessel\'s components.'],
    [['Tree Refresh', 'Component tree updates to show components for the newly selected vessel'],
     ['Count Update', 'Component count changes to reflect the new vessel\'s total'],
     ['Data Isolation', 'No components from the previous vessel appear in the new list']],
    ['Vessel dropdown retains the selected vessel after page interactions', 'Component details panel clears or updates when vessel changes', 'No loading errors during vessel switch'],
    ['Rapidly switch between vessels — verify no race condition or mixed data.', 'Select a vessel with zero components — verify empty state is shown.']
  );

  if (n === 11) return fmt(id, scenario,
    'Verify that components can be filtered by maintenance basis type (Calendar vs Running Hours).',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
    ['Look for a "Maintenance Basis" filter dropdown or checkbox near the component tree.', 'Select "Calendar" from the filter.'],
    ['Observe the filtered component list.', 'Switch the filter to "Running Hours".'],
    ['Clear the filter and verify all components reappear.'],
    [['Calendar Filter', 'Only calendar-based maintenance components are shown'],
     ['Running Hours Filter', 'Only RH-based maintenance components are shown'],
     ['Clear Filter', 'All components reappear when the filter is removed']],
    ['Filter count updates to reflect filtered results', 'No UI errors when switching filters', 'Filter state is visually indicated'],
    ['Note: Maintenance basis is a Job-level concept in RSMS. If this filter does not exist at the Component list level, document "Filter not available — maintenance basis is at Job level" in Comments.']
  );

  if (n === 12) return fmt(id, scenario,
    'Verify that the total component count is displayed and updates dynamically when filters are applied.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
    ['Look for a total count display near the top of the tree panel (e.g., "Total Components: 3622").'],
    ['Apply a search filter (e.g., type "pump" in the search bar).'],
    ['Clear the filter and verify the count returns to the original total.'],
    [['Count Visibility', 'Total component count is visible in the header area of the tree panel'],
     ['Count Accuracy', 'Count matches the actual number of components loaded'],
     ['Count Update', 'Count dynamically updates when search or filters are applied'],
     ['Count Reset', 'Count returns to original total when filters are cleared']],
    ['Count is a non-negative integer', 'Count does not show "NaN" or "undefined"', 'Count updates immediately (not after a delay)'],
    ['Apply multiple filters simultaneously — verify count reflects the combined filter result.', 'Switch vessel — verify count updates to new vessel\'s total.']
  );

  if (n === 13) return fmt(id, scenario,
    'Verify that the Components page layout adapts correctly to different screen sizes (desktop, tablet, mobile).',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel to load components.'],
    ['View the page on a desktop browser at full width (1920px).', 'Verify the two-panel layout: tree on left, details on right.'],
    ['Resize the browser to tablet width (768px).', 'Verify layout adapts — panels may stack vertically or tree may collapse.'],
    ['Resize to mobile width (375px).', 'Verify content is accessible and readable.'],
    [['Desktop (1920px)', 'Two-panel layout: tree on left, details on right. Full width utilized.'],
     ['Tablet (768px)', 'Layout adjusts — panels stack or tree collapses. All content accessible.'],
     ['Mobile (375px)', 'Content stacks vertically. No horizontal scrollbar overflow. Buttons tappable.']],
    ['No overlapping elements at any screen size', 'All buttons and interactive elements remain clickable/tappable', 'Text is readable without zooming', 'No horizontal scroll overflow'],
    ['Rotate a tablet between portrait and landscape — verify layout adjusts.', 'On mobile, verify the sidebar menu is accessible via hamburger icon.']
  );

  if (n === 14) return fmt(id, scenario,
    'Verify that clicking the "Add / Edit Component" button opens the component registration form with all sections visible.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
    ['Locate the pencil icon (Edit Components) button in the header area of the Components page.', 'Click the button.'],
    [],
    ['Verify the Add/Edit Component form opens.'],
    [['Form Opens', 'Add/Edit Component form opens showing a component tree on the left and a blank form on the right'],
     ['Section A', 'Component Information section is visible with all fields'],
     ['Section B', 'Running Hours & Condition Monitoring section is visible (collapsible)'],
     ['Section C', 'Jobs section is visible (collapsible)'],
     ['Save Button', '"Save" button is visible at the bottom of the form'],
     ['Back Button', 'Back arrow button is visible at top-left']],
    ['All form fields are empty/default for a new component', 'Form layout is clean with no overlapping elements', 'Section headers are clickable to expand/collapse'],
    ['Open the form while no vessel is selected — verify the system prompts vessel selection or shows an error.', 'Open the form on a mobile device — verify the form is usable with smaller screen.']
  );

  if (n === 15) return fmt(id, scenario,
    'Verify that a new component can be created successfully when all mandatory fields are filled in correctly.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Click the Edit Components (pencil) button to open the Add/Edit Component form.'],
    ['In the component tree on the left, click a parent component (e.g., "702 - Fuel Oil System") to set it as the parent.', 'Fill in mandatory fields:', '  - Component Name: "Test Component ABC"', '  - Equipment/System Department: Select "Engine" from dropdown', '  - Criticality: Select "Yes" or "No"'],
    ['Fill optional fields as desired (Maker, Model, Serial No, etc.).'],
    ['Click the "Save" button at the bottom of the form.'],
    [['Auto-Generated Code', 'Component Code is auto-generated based on parent (e.g., "702.006")'],
     ['Success Message', 'Green success toast notification appears ("Component saved successfully")'],
     ['Tree Update', 'New component appears in the tree under the selected parent'],
     ['Form State', 'Form either clears for next entry or shows the saved component in edit mode']],
    ['All mandatory fields are validated before save', 'Auto-generated code follows hierarchical format', 'No duplicate codes are created', 'Success toast auto-dismisses after a few seconds'],
    ['Try saving with all fields at their minimum valid values.', 'Try saving with extremely long component name (200+ chars) — verify it saves.', 'Try rapid double-click on Save — verify no duplicate component is created.']
  );

  if (n === 16) return fmt(id, scenario,
    'Verify that form validation prevents saving when mandatory fields are left empty.',
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open the Add/Edit Component form.'],
    ['Select a parent component in the tree.', 'Leave the Component Name field empty.', 'Leave the Equipment/System Department as "Select" (no selection).'],
    [],
    ['Click the "Save" button.'],
    [['Validation Errors', 'Red border/text appears around each empty required field'],
     ['Error Messages', '"This field is required" message appears next to each missing mandatory field'],
     ['Save Blocked', 'Form does NOT save — no success message appears'],
     ['Focus', 'Focus may jump to the first invalid field']],
    ['All mandatory fields show validation errors simultaneously', 'Error messages are descriptive and clear', 'Form data entered in optional fields is preserved (not cleared)'],
    ['Fill one mandatory field but leave others empty — verify per-field validation works.', 'Fill all fields, clear one, then save — verify only the cleared field shows error.']
  );

  if (n >= 17 && n <= 19) {
    const validationScenarios = {
      17: { goal: 'Verify that the component code field enforces the correct hierarchical format.', action: 'Try to manually type an invalid code format (e.g., "ABC" or "1.2.3.4.5.6").', checks: [['Invalid Code Input', 'System prevents invalid input, shows validation error, or code field is read-only/auto-generated'], ['Valid Format', 'Codes follow hierarchical format (e.g., "X01", "X01.001", "X01.001.01")']], edge: 'If the code field is read-only (auto-generated), document this behavior in Comments.' },
      18: { goal: 'Verify that the system prevents duplicate component codes from being created.', action: 'Manually change the component code to match an existing component\'s code (e.g., "702.005.01").', checks: [['Duplicate Error', 'System shows error message indicating the component code already exists'], ['Save Blocked', 'Form does NOT save with a duplicate code']], edge: 'Try creating two new components simultaneously (two browser tabs) with the same code — verify at least one fails.' },
      19: { goal: 'Verify that component name field enforces proper length constraints (minimum and maximum).', action: 'Type a very short name (1 character "A"), then a very long name (200+ characters).', checks: [['Min Length', 'If minimum length validation exists, an error appears for 1-char names'], ['Max Length', 'If max length exists, an error appears for 200+ char names; otherwise saves correctly']], edge: 'Try pasting a name with only whitespace — verify it is rejected or trimmed.' },
    };
    const v = validationScenarios[n];
    return fmt(id, scenario, v.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open the Add/Edit Component form.', 'Select a parent component.'],
      [v.action, 'Fill in all other required fields.'],
      [],
      ['Click "Save" and observe the result.'],
      v.checks,
      ['Error messages are clear and specific', 'Form does not save with invalid data', 'No backend errors appear'],
      [v.edge]
    );
  }

  if (n >= 20 && n <= 21) {
    const basis = n === 20 ? 'Calendar' : 'Running Hours';
    const freq = n === 20 ? '"3 Months" and a due date' : '"500 RH"';
    return fmt(id, scenario,
      `Verify that a component can be created with ${basis}-based maintenance jobs.`,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open the Add/Edit Component form.', 'Select a parent component and fill all required fields.'],
      ['Save the component.', `Navigate to the Jobs section (Section C) of the saved component.`, `Add a new job with maintenance basis set to "${basis}".`],
      [`Set the frequency to ${freq}.`, 'Fill in job title and assigned rank.'],
      ['Save the job.'],
      [[`Job Created`, `Job is created with ${basis} basis`],
       ['Job Display', `Job appears in the component\'s jobs list showing "${basis}" as the maintenance type`],
       ['Frequency', `Frequency shows "${freq.replace(/"/g, '')}"`]],
      ['Job is correctly linked to the component', `${basis} badge is displayed on the job`, 'No errors during job creation'],
      [`Create a job with ${basis} basis and a frequency of 0 — verify validation prevents this.`, `Create multiple jobs on the same component with different ${basis} frequencies — verify all save correctly.`]
    );
  }

  if (n >= 22 && n <= 24) {
    const fields = {
      22: { field: 'Class Item', values: 'Yes/No', check: [['Set to Yes', 'Class Item field shows "Yes" when viewing the saved component'], ['Set to No', 'Class Item field correctly shows "No"'], ['Persistence', 'Selection persists after save and reload']] },
      23: { field: 'Equipment / System Department', values: 'Engine, Deck, Electrical, Galley, LSA, FFA', check: [['Dropdown Options', 'Shows all options: Engine, Deck, Electrical, Galley, LSA, FFA'], ['Selection', 'Selected value is highlighted/displayed in the dropdown'], ['Persistence', 'Department selection persists after save and reload']] },
      24: { field: 'Criticality', values: 'Yes/No', check: [['Critical (Yes)', 'Component shows criticality indicator (red badge or "Yes" label)'], ['Non-Critical (No)', 'Criticality indicator shows "No" or gray badge'], ['Persistence', 'Criticality selection persists after save and reload']] },
    };
    const f = fields[n];
    return fmt(id, scenario,
      `Verify that the "${f.field}" dropdown works correctly and persists selections after save.`,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open the Add/Edit Component form.', 'Select a parent component.'],
      [`Locate the "${f.field}" dropdown in the form.`, `Click the dropdown and verify it shows options: ${f.values}.`, 'Select one option.'],
      ['Fill in remaining required fields.'],
      ['Click "Save".', 'Reopen the component and verify the selection persisted.'],
      f.check,
      ['Dropdown opens and closes smoothly', 'Selected value is visually confirmed', 'No unexpected resets of the field'],
      [`Change the ${f.field} value, save, then change it again — verify each change persists correctly.`, `Open two components side-by-side (if possible) and set different ${f.field} values — verify no cross-contamination.`]
    );
  }

  if (n >= 25 && n <= 28) {
    const scenarios = {
      25: { goal: 'Verify the Save button works correctly — shows loading state, triggers success toast, and persists data.', action: ['Fill in all required fields for a new component.', 'Click the "Save" button.'], checks: [['Loading State', 'Button shows a spinner/loading indicator while saving'], ['Success Toast', 'Green success toast appears after save completes'], ['Data Persistence', 'Reopening the component shows all saved values'], ['Idempotent', 'Clicking Save again with no changes still succeeds']], edge: 'Click Save rapidly multiple times — verify no duplicate components are created.' },
      26: { goal: 'Verify the Back/Cancel button discards unsaved changes and returns to the component tree.', action: ['Begin filling in fields (type a name, select a department).', 'Click the "Back" arrow button (top-left of the form).'], checks: [['Navigation', 'Form closes and user returns to the main Components tree view'], ['Data Discarded', 'Partially entered data is NOT saved — form shows blank when reopened'], ['No Errors', 'No error messages appear during cancellation']], edge: 'Fill in all fields, press browser Back button instead — verify the same behavior.' },
      27: { goal: 'Verify that a success notification appears after saving a component.', action: ['Fill in all required fields and click "Save".'], checks: [['Toast Appears', 'Green success toast notification appears at the screen edge'], ['Toast Text', 'Message reads "Component saved successfully" or similar'], ['Auto-Dismiss', 'Toast auto-dismisses after a few seconds or can be manually closed']], edge: 'Save multiple components in quick succession — verify each shows its own toast.' },
      28: { goal: 'Verify correct post-save navigation — user can find the newly created component.', action: ['Create and save a new component.', 'After save, observe navigation behavior.'], checks: [['Redirect', 'User is either redirected to component tree or stays in edit mode showing saved component'], ['Visibility', 'Newly created component is visible in the component tree'], ['Clickable', 'Clicking the new component in the tree shows its details']], edge: 'Create a component, navigate away, then return to Components — verify the new component is still there.' },
    };
    const s = scenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open the Add/Edit Component form.', 'Select a parent component.'],
      s.action, [], [],
      s.checks,
      ['No UI errors or console errors', 'Smooth user experience', 'Data integrity maintained'],
      [s.edge]
    );
  }

  if (n >= 29 && n <= 33) {
    const editScenarios = {
      29: { goal: 'Verify that clicking on an existing component opens it in editing mode with all data pre-loaded.', setup: ['Select a vessel and click on a component in the tree (e.g., "702.005.01 - FO Separators No.01").'], action: ['Look for the Edit Components (pencil) button or "+ Add / Edit Component" button.', 'Click it to open the component in editing mode.'], checks: [['Form Opens', 'Add/Edit Component form opens with the selected component pre-loaded'], ['Fields Populated', 'All fields show the component\'s existing data'], ['Tree Highlight', 'Component tree on the left highlights the component being edited']], edge: 'Open edit mode for a component, then click a different component in the tree — verify the form updates to the newly selected component.' },
      30: { goal: 'Verify that all component fields display their correct saved values when opened in edit mode.', setup: ['Select a vessel and open an existing component in edit mode.'], action: ['Examine each field in the form and compare with the expected saved values.'], checks: [['Component Code', 'Matches saved code (e.g., "702.005.01")'], ['Component Name', 'Matches saved name (e.g., "FO Separators No.01")'], ['Department', 'Dropdown shows saved department (Engine/Deck/etc.)'], ['Criticality', 'Shows saved value (Yes/No)'], ['Maker/Model/Serial', 'Show saved values or blank if not set'], ['Running Hours', 'Shows current RH value for RH-tracked components']], edge: 'Open a component with all optional fields empty — verify no "undefined" or "null" appears.' },
      31: { goal: 'Verify that the component name can be modified and the change persists after save.', setup: ['Select a vessel and open an existing component in edit mode.'], action: ['Locate the Component Name field.', 'Change the name (e.g., append " - Updated").', 'Click "Save".'], checks: [['Success Toast', 'Success toast appears'], ['Tree Update', 'Component tree updates to show the new name'], ['Persistence', 'Reopening the component shows the updated name']], edge: 'Change the name to be identical to another component\'s name — verify whether duplicates are allowed for names.' },
      32: { goal: 'Verify that modifications to component fields (maker, model, etc.) persist after save.', setup: ['Select a vessel and open an existing component in edit mode.'], action: ['Modify one or more fields (e.g., change the maker, update the model).', 'Click "Save".'], checks: [['Success Message', 'Success toast appears'], ['Changes Persisted', 'Close and reopen — modified fields show new values'], ['Other Fields', 'Unmodified fields retain their original values']], edge: 'Modify a field, save, immediately modify another field, save again — verify both changes persist.' },
      33: { goal: 'Verify that clicking Back/Cancel without saving discards all unsaved edits.', setup: ['Select a vessel and open an existing component in edit mode.'], action: ['Modify some fields (change name, maker, etc.).', 'Click the "Back" arrow button instead of Save.'], checks: [['Return', 'User returns to the Components tree view'], ['Data Unchanged', 'Clicking the same component shows original values — edits NOT saved'], ['No Partial Save', 'No partial data was persisted']], edge: 'Modify fields, navigate away using sidebar menu instead of Back button — verify changes are discarded.' },
    };
    const s = editScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, ...s.setup],
      s.action, [], [],
      s.checks,
      ['No UI errors during edit operations', 'Form is responsive and interactive', 'No unexpected field resets'],
      [s.edge]
    );
  }

  if (n >= 34 && n <= 40) {
    const miscScenarios = {
      34: { goal: 'Verify that the component code cannot be changed when the component has associated jobs/work orders.', action: 'Try to modify the Component Code field in the edit form.', checks: [['Code Field', 'Component Code field is read-only (grayed out) or shows a warning when jobs exist'], ['Save Blocked', 'If code is changed, save is blocked with error message']], edge: 'Try changing code on a component with only completed (historical) WOs.' },
      35: { goal: 'Verify that a clear confirmation/success message appears after updating a component.', action: 'Make a change and click "Save".', checks: [['Message Appears', 'Confirmation/success message is displayed'], ['Message Text', 'Text is clear (e.g., "Component updated successfully")'], ['Auto-Dismiss', 'Toast auto-dismisses after a few seconds']], edge: 'Save two different components quickly — verify each gets its own success message.' },
      36: { goal: 'Verify that a component with no associated jobs can be deleted successfully.', action: 'Create a test component with no jobs, then click Delete button.', checks: [['Confirmation', 'Confirmation dialog appears asking "Are you sure?"'], ['Deletion', 'Component is removed from the tree after confirming'], ['Success Message', 'Success message confirms deletion']], edge: 'Delete the component, then immediately try to search for it — verify it no longer appears.' },
      37: { goal: 'Verify that the system prevents deletion of components with active work orders.', action: 'Select a component with active/planned work orders and try to delete.', checks: [['Error Message', 'System prevents deletion with clear message (e.g., "Cannot delete: component has active work orders")'], ['Component Retained', 'Component remains in the tree — NOT deleted']], edge: 'Try deleting a parent component whose children have active WOs.' },
      38: { goal: 'Verify the system behavior when deleting a component with only completed (historical) work orders.', action: 'Select a component with only completed WOs and try to delete.', checks: [['System Behavior', 'System either allows deletion (with warning) or prevents it (to preserve records)'], ['History Handling', 'Historical records are handled appropriately']], edge: 'Document the actual behavior — does the system allow or prevent deletion when only completed jobs exist?' },
      39: { goal: 'Verify that a confirmation dialog appears before component deletion.', action: 'Click the Delete button on a component.', checks: [['Dialog Appears', 'Confirmation dialog/modal appears before deletion'], ['Dialog Content', 'Dialog states what will be deleted (component name/code)'], ['Two Buttons', 'Both "Confirm" and "Cancel" buttons are present']], edge: 'Press Escape key when the dialog is open — verify it closes without deleting.' },
      40: { goal: 'Verify that clicking Cancel on the delete confirmation preserves the component.', action: 'Click Delete, then click "Cancel" on the confirmation dialog.', checks: [['Dialog Closes', 'Confirmation dialog closes'], ['Component Intact', 'Component is still present in the tree — NOT deleted'], ['Data Intact', 'All component data is unchanged']], edge: 'Click Delete, Cancel, then Delete again, Cancel again — verify component survives multiple cancel cycles.' },
    };
    const s = miscScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel and identify a target component.'],
      [s.action], [], [],
      s.checks,
      ['No UI errors or console errors', 'Correct dialog behavior', 'Data integrity maintained'],
      [s.edge]
    );
  }

  if (n >= 41 && n <= 50) {
    const detailScenarios = {
      41: { goal: 'Verify that clicking a component in the tree displays its detail information in the right panel.', checks: [['Detail Panel', 'Right panel updates with Component Information section'], ['Highlighting', 'Selected component is highlighted in the tree'], ['Smooth Load', 'Details load without errors or delays']] },
      42: { goal: 'Verify that the component detail view displays all expected fields with correct data.', checks: [['Component Code/Name', 'Displayed correctly'], ['Maker/Model/Serial', 'Show saved values'], ['Criticality', 'Colored badge — red for Yes, gray for No'], ['Department', 'Shows Equipment/System Department'], ['Running Hours', 'Current RH value displayed for tracked components']] },
      43: { goal: 'Verify that associated jobs are displayed for a component with linked maintenance jobs.', checks: [['Jobs List', 'Jobs section shows all associated jobs'], ['Job Details', 'Each job shows title, maintenance basis, frequency, status'], ['Empty State', 'If no jobs exist, an appropriate empty message appears']] },
      44: { goal: 'Verify that maintenance history records are displayed for a component.', checks: [['History List', 'Previous work orders and maintenance activities are listed'], ['Entry Details', 'Each entry shows: WO number, job title, completion date, status'], ['Sort Order', 'History sorted by date (most recent first)']] },
      45: { goal: 'Verify that filters and search state are preserved when navigating back from component details.', checks: [['Search Preserved', 'Search text is still in the search bar'], ['Filters Active', 'Any active filters are still applied'], ['Vessel Selected', 'Same vessel is still selected']] },
      46: { goal: 'Verify that a new job can be added to a component from the component detail view.', checks: [['Add Job Form', 'Job creation form opens with fields for title, basis, frequency, rank'], ['Job Created', 'New job appears in the component\'s jobs list'], ['WO Template', 'Corresponding work order template is created']] },
      47: { goal: 'Verify that all jobs for a component with multiple assigned jobs are displayed correctly.', checks: [['All Jobs Listed', 'All jobs appear in the Jobs section'], ['Job Details', 'Each shows title, maintenance basis, frequency, status'], ['Clickable', 'Individual jobs can be clicked for full details']] },
      48: { goal: 'Verify that different frequency configurations work correctly for component jobs.', checks: [['Calendar 3M', '3-month frequency saves and displays correctly'], ['Calendar 6M/1Y', '6-month and 1-year frequencies work'], ['RH 500/2000', 'Running hours frequencies (500, 2000) save correctly'], ['Due Date Calc', 'Work order due dates recalculate based on new frequency']] },
      49: { goal: 'Verify that long component names (200+ characters) are handled correctly without layout breakage.', checks: [['Saves', 'Component saves successfully with 200+ char name'], ['Tree Truncation', 'Long name is truncated with ellipsis ("...") in the tree'], ['Tooltip', 'Hovering over truncated name shows full name'], ['Detail Panel', 'Full name visible in the detail panel']] },
      50: { goal: 'Verify that component names with special characters (&, <, >, ", #, %) are handled correctly.', checks: [['Saves', 'Component saves without error'], ['Display', 'Special characters preserved — not escaped or garbled'], ['Search', 'Searching for special characters returns the component']] },
    };
    const s = detailScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel with components loaded.'],
      ['Click on a component in the tree to view its details.', 'Navigate to the relevant section (Component Information, Jobs, Maintenance History, etc.).'],
      [], [],
      s.checks,
      ['No "undefined" or "null" values in display', 'No UI errors or layout breakage', 'Data matches what was saved'],
      ['Use browser back button to navigate — verify state preservation.', 'Open the same component in two browser tabs — verify data consistency.']
    );
  }

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function genWO(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('WO-', ''));
  const nav = NAV.workOrders;

  if (n >= 1 && n <= 7) {
    const tabScenarios = {
      1: { goal: 'Verify the Work Orders list page loads correctly with all status tabs and columns.', tab: null, checks: [['Page Load', 'Work Orders page loads with table columns: Component, Work Order No, Job Title, Assigned To, Due Date, Status'], ['Status Tabs', 'Tabs visible: Planned, Due, Overdue, Pending Approval, Completed — each with count badge'], ['Default Tab', '"Planned" tab is selected by default']] },
      2: { goal: 'Verify the "Planned" tab shows only work orders with Active or Postponed status.', tab: 'Planned', checks: [['Status Filter', 'Only work orders with "Active" or "Postponed" status are shown'], ['Count Match', 'Count badge on "Planned" tab matches the number of rows'], ['No Cross-Tab', 'No Due, Overdue, Pending Approval, or Completed items appear']] },
      3: { goal: 'Verify the "Due" tab shows only work orders within the warning window.', tab: 'Due', checks: [['Due Items', 'Work orders within 30 days (Calendar) or 720 RH (Running Hours) of due date'], ['Status Badge', 'Status badges show "Due" or "Due (Grace P)" in yellow/orange'], ['Count Match', 'Tab count badge matches visible rows']] },
      4: { goal: 'Verify the "Overdue" tab shows only work orders past their due date and grace period.', tab: 'Overdue', checks: [['Overdue Items', 'Only work orders that breached due date AND exceeded grace period'], ['Status Badge', 'Status badges show "Overdue" in red'], ['Count Match', 'Tab count matches row count']] },
      5: { goal: 'Verify the "Pending Approval" tab shows only work orders submitted for superintendent review.', tab: 'Pending Approval', checks: [['Pending Items', 'Only work orders submitted for approval but not yet reviewed'], ['Status Badge', 'Status badges show "Pending Approval" in purple'], ['Completion Data', 'Each WO has completion details already filled in']] },
      6: { goal: 'Verify the "Completed" tab shows only approved and closed work orders.', tab: 'Completed', checks: [['Completed Items', 'Only approved and closed work orders'], ['Status Badge', 'Status badges show "Completed" in green'], ['Approval Info', 'Work orders show both completion data and approval information']] },
      7: { goal: 'Verify that each status tab displays an accurate count badge.', tab: null, checks: [['Count Badges', 'Each tab has a numeric count badge next to its label'], ['Non-Negative', 'All counts are non-negative numbers'], ['Dynamic Update', 'Counts update when WO status changes (e.g., after approval)']] },
    };
    const s = tabScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel from the vessel dropdown.'],
      s.tab ? [`Click the "${s.tab}" tab at the top of the work orders table.`, 'Observe the displayed work orders.'] : ['Observe all status tabs and their count badges.', 'Click through each tab to verify content.'],
      [], [],
      s.checks,
      ['Tab switching is instant with no loading delay', 'No data from other tabs "bleeds" into the active tab', 'Counts are consistent'],
      ['Switch rapidly between tabs — verify no race condition or mixed data.', 'Apply a filter, then switch tabs — verify the filter applies consistently.']
    );
  }

  if (n >= 8 && n <= 13) {
    const filterScenarios = {
      8: { goal: 'Verify the vessel filter correctly scopes work orders to the selected vessel.', action: 'Select different vessels from the vessel dropdown.', checks: [['Vessel Switch', 'Work orders refresh for the newly selected vessel'], ['Data Isolation', 'No cross-vessel data appears'], ['Count Update', 'Tab counts update to reflect the selected vessel']] },
      9: { goal: 'Verify the Period filter correctly narrows work orders by time/RH range.', action: 'Select different period options (e.g., "Due in next 7 days", "Due in next 30 days", "rh-250", "rh-500").', checks: [['Calendar Period', 'Only WOs within the selected calendar period appear'], ['RH Period', 'Only RH-based WOs within the specified threshold appear when RH filter selected'], ['Clear', 'All work orders return when period filter is cleared']] },
      10: { goal: 'Verify the Rank filter correctly shows only work orders assigned to the selected rank.', action: 'Select a rank from the Rank dropdown (e.g., "Chief Engineer").', checks: [['Rank Filter', 'Only work orders assigned to the selected rank appear'], ['Options', 'Dropdown lists all ranks found in existing work orders'], ['Clear', 'All work orders return when rank filter is cleared']] },
      11: { goal: 'Verify the Criticality filter correctly shows only critical or non-critical work orders.', action: 'Select "Critical" from the Criticality dropdown, then "Non-Critical".', checks: [['Critical', 'Only work orders marked as critical (criticality = "Yes") are shown'], ['Non-Critical', 'Only non-critical work orders appear'], ['Clear', 'All work orders return when filter is cleared']] },
      12: { goal: 'Verify that multiple filters can be combined with AND logic.', action: 'Apply Period + Rank + Criticality + search text simultaneously.', checks: [['Combined', 'Results reflect ALL filters combined (AND logic)'], ['Count Update', 'Tab counts update to reflect the filtered subset'], ['Progressive', 'Clearing one filter at a time expands results appropriately']] },
      13: { goal: 'Verify that "Clear All" resets all active filters to their default state.', action: 'Apply several filters, then click the "Clear" button.', checks: [['Filters Reset', 'All filters return to default (empty/all) state'], ['Full List', 'Full unfiltered list of work orders reappears'], ['Search Cleared', 'Search bar is cleared']] },
    };
    const s = filterScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      [s.action], [], [],
      s.checks,
      ['Filter state is visually indicated in the dropdown', 'No UI errors during filtering', 'Filter changes are instant'],
      ['Apply filters, refresh the page (F5) — verify filters reset or persist as expected.', 'Apply filters that result in zero matches — verify empty state is shown.']
    );
  }

  if (n >= 14 && n <= 25) {
    const searchSortScenarios = {
      14: { goal: 'Verify search by work order code/number filters the list correctly.', action: 'Type a work order code (e.g., "WO-702") in the search bar.', checks: [['Filter', 'List shows only WOs matching the search term'], ['Partial Match', 'Typing "702" shows all WOs containing "702"'], ['Clear', 'Full list returns when search is cleared']] },
      15: { goal: 'Verify search by component name filters work orders correctly.', action: 'Type a component name (e.g., "Separator" or "Pump") in the search bar.', checks: [['Filter', 'WOs associated with matching components are displayed'], ['Column Match', 'Search matches against the Component column'], ['Clear', 'Full list returns when search is cleared']] },
      16: { goal: 'Verify search by job title filters work orders correctly.', action: 'Type a job title (e.g., "Inspection" or "Overhaul") in the search bar.', checks: [['Filter', 'WOs with matching job titles are displayed'], ['Partial Match', 'Partial title matches work'], ['Clear', 'Full list returns when search is cleared']] },
      17: { goal: 'Verify pagination controls work correctly on the work orders table.', action: 'Look at the bottom of the table for pagination controls.', checks: [['Navigation', 'Page buttons (First, Previous, Next, Last) are functional'], ['Page Size', 'Items-per-page dropdown is available (10, 25, 50, 100)'], ['Indicator', 'Current page indicator shows correct page number']] },
      18: { goal: 'Verify column sorting works on the work orders table.', action: 'Click column headers (Due Date, Work Order No, Status) to sort.', checks: [['Date Sort', 'WOs sort by due date ascending/descending'], ['Code Sort', 'WOs sort alphabetically by work order number'], ['Sort Indicator', 'Arrow icon (▲/▼) appears on the active sort column']] },
      19: { goal: 'Verify Excel export works for Sail Admin users.', action: 'Click the Export button and select "Export to Excel".', checks: [['Download', 'An .xlsx file downloads'], ['Columns', 'File contains columns matching the on-screen table'], ['All Data', 'All work orders (not just current page) are exported']] },
      20: { goal: 'Verify PDF export works for Sail Admin users.', action: 'Click the Export button and select "Export to PDF".', checks: [['Download', 'A PDF file downloads or opens in new tab'], ['Content', 'PDF contains formatted table of work orders'], ['Headers', 'Vessel name, date, and headers are included']] },
      21: { goal: 'Verify "Distributed Jobs" Excel export works correctly.', action: 'Click Export and select Distributed Jobs Excel option.', checks: [['Download', 'File downloads with jobs sorted/grouped by assigned rank'], ['Grouping', 'Jobs are separated by responsible person/rank']] },
      22: { goal: 'Verify "Distributed Jobs" PDF export works correctly.', action: 'Click Export and select Distributed Jobs PDF option.', checks: [['Download', 'PDF downloads with jobs organized by assigned rank'], ['Format', 'PDF is properly formatted for printing/distribution']] },
      23: { goal: 'Verify that the Export button is NOT visible for non-Sail Admin users.', action: 'Log in as a non-Sail Admin user and check for the Export button.', checks: [['Non-Admin', 'Export button is NOT visible for Client Admin, Vessel User, Head of Dept'], ['Admin', 'Export button IS visible when logged in as Sail Admin']] },
      24: { goal: 'Verify that status badges use correct color coding across all work order statuses.', action: 'Observe the Status column badges across different tabs.', checks: [['Active/Planned', 'Sky blue badge'], ['Due', 'Yellow badge'], ['Overdue', 'Red badge'], ['Pending Approval', 'Purple badge'], ['Completed', 'Green badge'], ['Postponed', 'Blue badge']] },
      25: { goal: 'Verify work order count is displayed and accurate.', action: 'Look for count display (e.g., "Showing 1-10 of 145" or tab counts).', checks: [['Count Visible', 'Total count is displayed and accurate'], ['Filter Update', 'Count updates with filters'], ['Tab Sum', 'Tab counts sum up correctly']] },
    };
    const s = searchSortScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      [s.action], [], [],
      s.checks,
      ['No UI errors during operation', 'Smooth transitions', 'Data accuracy maintained'],
      ['Perform the action with no data loaded — verify graceful empty state.', 'Try the action across different browsers — verify consistent behavior.']
    );
  }

  if (n >= 26 && n <= 31) {
    const createScenarios = {
      26: { goal: 'Verify the Add Work Order form opens correctly.', action: 'Click the "+" (Add Work Order) button.', checks: [['Form Opens', 'New work order creation form opens'], ['Fields', 'Form has fields for Component, Job, Assigned To, Due Date'], ['Auto-populate', 'Some fields may auto-populate based on selections']] },
      27: { goal: 'Verify component selection works in the Add Work Order form.', action: 'Browse and select a component from the dropdown/selector.', checks: [['Selection', 'Component is selected and displayed in the field'], ['Job Filter', 'Available jobs filter to those associated with the selected component']] },
      28: { goal: 'Verify job selection correctly shows only jobs for the selected component.', action: 'Select a component, then look at the Job dropdown.', checks: [['Filtered Jobs', 'Only jobs for the selected component are shown'], ['Job Details', 'Selecting a job populates title, basis, frequency'], ['Component Change', 'Changing component updates the job dropdown']] },
      29: { goal: 'Verify that selecting a component and job auto-populates related fields.', action: 'Select a component and then a job.', checks: [['Title', 'Job Title auto-populates'], ['Basis', 'Maintenance Basis (Calendar/RH) is set'], ['Frequency', 'Frequency value and unit are populated'], ['Assigned To', 'Default rank is populated from job definition']] },
      30: { goal: 'Verify validation prevents saving with missing required fields.', action: 'Leave Component and Job fields empty, click Save.', checks: [['Component Error', 'Validation error appears for empty Component'], ['Job Error', 'Validation error for empty Job'], ['All Fields', 'When all required fields filled, save succeeds']] },
      31: { goal: 'Verify auto-generated work order codes follow the template format.', action: 'Create a new work order and observe the generated code.', checks: [['Format', 'Code follows template format (e.g., "WO-702.005.01-INS-M3")'], ['Unique', 'Each new WO gets a unique code'], ['Consistent', 'Multiple WOs for same component have different codes']] },
    };
    const s = createScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      [s.action], [], [],
      s.checks,
      ['Form is responsive and interactive', 'No errors during creation flow', 'Auto-population is accurate'],
      ['Try creating a WO for a component with no jobs — verify appropriate message appears.']
    );
  }

  if (n >= 32 && n <= 45) {
    const detailScenarios = {
      32: { goal: 'Verify clicking a work order row opens its detail page.', checks: [['Navigation', 'Work order detail page opens'], ['URL', 'URL changes to /pms/work-order/{id}'], ['Content', 'Comprehensive WO information is displayed']] },
      33: { goal: 'Verify Part A (Job Details) displays all expected fields.', checks: [['Component', 'Component name and code are shown'], ['Job Info', 'Job title, WO number, template code displayed'], ['Schedule', 'Maintenance basis, frequency, due date/reading shown'], ['Assignment', 'Assigned to, criticality displayed']] },
      34: { goal: 'Verify Part B (Completion section) displays or allows entry of completion data.', checks: [['Editable', 'For Due/Overdue WOs, Part B fields are editable'], ['Fields', 'Date completed, work done, current reading (RH), attachments section visible'], ['Read-only', 'For Completed WOs, Part B shows saved data in read-only mode']] },
      35: { goal: 'Verify the Work History section shows previous completions.', checks: [['History List', 'Previous completions for the same job/component are listed'], ['Details', 'Each entry shows date, description, who completed it'], ['Sort', 'History sorted by date (most recent first)']] },
      36: { goal: 'Verify that Planned/Active WO fields are editable.', checks: [['Editable', 'Form fields are NOT locked'], ['Modify', 'Fields can be modified and saved'], ['Persist', 'Changes persist after save']] },
      37: { goal: 'Verify that Completed WO fields are locked/read-only.', checks: [['Locked', 'All form fields are read-only (grayed out)'], ['No Edit', 'Modifications are not possible'], ['Indicator', 'Visual indicator shows WO is locked']] },
      38: { goal: 'Verify that Pending Approval WO completion data is read-only.', checks: [['Read-only', 'Part B completion data cannot be modified'], ['Buttons', 'Only Approve/Reject buttons are actionable']] },
      39: { goal: 'Verify start date entry in Part B completion section.', checks: [['Date Picker', 'Date picker allows selecting a valid date'], ['Saves', 'Start date saves correctly']] },
      40: { goal: 'Verify completion date and work done entry in Part B.', checks: [['Date Entry', 'Completion date can be entered via date picker'], ['Date Validation', 'Completion date must be on or after start date'], ['Text Area', 'Work done text area accepts multi-line input']] },
      41: { goal: 'Verify current RH reading entry for Running Hours-based work orders.', checks: [['Numeric Only', 'Only numeric values are accepted'], ['Validation', 'Value must be >= previous reading'], ['Unit', 'Field shows "hrs" or similar indicator']] },
      42: { goal: 'Verify Part B1 and B2 completion sections work together.', checks: [['B1 Fields', 'Part B1 contains basic completion information'], ['B2 Fields', 'Part B2 contains additional completion details'], ['Both Required', 'Both sections are required before submission']] },
      43: { goal: 'Verify the Submit for Approval workflow works correctly.', checks: [['Confirmation', 'Confirmation dialog appears before submission'], ['Status Change', 'WO status changes to "Pending Approval"'], ['Tab Move', 'WO moves from Due/Overdue to Pending Approval tab'], ['Toast', 'Success toast message appears']] },
      44: { goal: 'Verify next due date calculation for Calendar-based WOs after approval.', checks: [['Next Due', 'Next due date = completion date + frequency'], ['Auto-calc', 'Calculation is automatic, not manual'], ['Display', 'Next due date appears in the WO details']] },
      45: { goal: 'Verify next due reading calculation for RH-based WOs after approval.', checks: [['Next Due', 'Next due reading = current reading + frequency'], ['Auto-calc', 'Calculation is automatic'], ['Display', 'Calculated value appears in WO details']] },
    };
    const s = detailScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel and open a work order.'],
      ['Navigate to the relevant section of the work order detail page.'], [], [],
      s.checks,
      ['No "undefined" or blank values for populated fields', 'No UI errors or console errors', 'Data integrity maintained'],
      ['Open the same WO in two browser tabs — verify data consistency.', 'Use browser back button from WO detail — verify return to WO list with filters preserved.']
    );
  }

  if (n >= 46 && n <= 62) {
    return buildGenericWOCompletion(id, n, scenario, steps, testData, expected);
  }

  if (n >= 63 && n <= 69) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 1 — Backdating Detection', steps, expected, 'Backdating',
      'This layer detects when work orders are completed with significantly backdated dates.',
      ['Complete a work order with a date significantly in the past', 'Check for backdating warnings or flags']);
  }

  if (n >= 70 && n <= 82) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 2 — Missed Cycle Detection', steps, expected, 'Missed Cycles',
      'This layer identifies jobs where one or more maintenance cycles were skipped.',
      ['Identify a job with expected regular cycles', 'Check for missed cycle indicators in the anomaly detection panel']);
  }

  if (n >= 83 && n <= 91) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 3 — Work History Validation', steps, expected, 'Work History',
      'This layer validates the completeness and consistency of work order history records.',
      ['Open a work order and view its work history (Section A4)', 'Verify history entries are complete and chronologically ordered']);
  }

  if (n >= 92 && n <= 97) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 4B — CE Remarks', steps, expected, 'CE Remarks',
      'This layer verifies Chief Engineer remarks functionality in work order completion.',
      ['Open a work order in completion mode', 'Locate and interact with the CE Remarks field']);
  }

  if (n >= 98 && n <= 102) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 5 — Superintendent Notifications', steps, expected, 'Superintendent',
      'This layer verifies the superintendent notification and acknowledgment workflow.',
      ['Submit a work order for approval', 'Navigate to PMS > Superintendent page and check for notifications']);
  }

  if (n >= 103 && n <= 114) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 6 — Anomaly Detection Panel', steps, expected, 'Anomaly Detection',
      'This layer verifies the Compliance Anomaly Detection panel on the Dashboard (Sail Admin only).',
      ['Log in as Sail Admin', 'Navigate to PMS > Dashboard and scroll to the Compliance Anomaly Detection panel']);
  }

  if (n >= 115 && n <= 136) {
    return buildGenericWOLayer(id, n, scenario, 'Layer 7 — Running Hours Validation', steps, expected, 'RH Validation',
      'This layer validates running hours input during work order completion.',
      ['Open an RH-based work order', 'Enter various running hours values and observe validation behavior']);
  }

  if (n >= 137 && n <= 144) {
    const approvalScenarios = {
      137: { goal: 'Verify the Approve workflow for pending work orders.', action: 'Click the "Approve" button (green, checkmark icon).', checks: [['Status Change', 'WO status changes to "Completed"'], ['Tab Move', 'WO moves to the Completed tab'], ['Success', 'Success message appears']] },
      138: { goal: 'Verify the Reject workflow for pending work orders.', action: 'Click the "Reject" button (red, X icon).', checks: [['Comments Required', 'Rejection comments field appears (mandatory)'], ['Status Change', 'WO status changes to "Rejected"'], ['Rework', 'WO moves back for rework']] },
      139: { goal: 'Verify whether approver remarks are mandatory or optional during approval.', action: 'Try to approve without entering remarks.', checks: [['Mandatory', 'If remarks required, system requires them before approval'], ['Optional', 'If optional, approval proceeds without remarks']] },
      140: { goal: 'Verify that rejection comments are mandatory when rejecting a WO.', action: 'Try to reject without entering comments.', checks: [['Comments Required', 'Error appears if comments are empty'], ['With Comments', 'Rejection succeeds when comments are provided']] },
      141: { goal: 'Verify that approving a WO automatically generates the next cycle work order.', action: 'Approve a work order.', checks: [['Next Cycle', 'New WO is auto-generated for the next period'], ['Due Date', 'New WO has correct next due date/reading'], ['Planned Tab', 'New WO appears in the Planned tab']] },
      142: { goal: 'Verify the rework flow for rejected work orders.', action: 'Open a rejected WO and modify fields for resubmission.', checks: [['Rejection Reason', 'Rejection reason is displayed'], ['Editable', 'Part B fields are editable for rework'], ['Resubmit', 'Resubmission returns WO to "Pending Approval"']] },
      143: { goal: 'Verify Bulk Approve functionality on the Dashboard.', action: 'Select multiple pending WOs and click "Bulk Approve".', checks: [['Bulk Action', 'All selected WOs are approved simultaneously'], ['Status Update', 'Each WO status changes to "Completed"'], ['Next Cycles', 'Next cycle WOs are generated for each']] },
      144: { goal: 'Verify that only users with approval permissions can see Approve/Reject buttons.', action: 'Log in as different user roles.', checks: [['Non-Admin', 'Approve/Reject buttons NOT visible for Vessel User'], ['Admin', 'Buttons visible for Superintendent/Sail Admin']] },
    };
    const s = approvalScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav} > Pending Approval tab.`, 'Select a vessel.'],
      [s.action], [], [],
      s.checks,
      ['No UI errors during approval flow', 'Status transitions are smooth', 'Data integrity maintained'],
      ['Try approving/rejecting the same WO twice — verify the system prevents double-action.']
    );
  }

  if (n >= 145 && n <= 153) {
    const attachScenarios = {
      145: { goal: 'Verify file upload to a work order works correctly.', checks: [['Upload', 'File uploads with progress indicator'], ['Display', 'File appears in attachments list with name, size, date'], ['Success', 'Upload completes without errors']] },
      146: { goal: 'Verify uploaded attachments can be viewed/downloaded.', checks: [['Download', 'File downloads or opens in new tab'], ['Integrity', 'File content is intact (not corrupted)']] },
      147: { goal: 'Verify file size limit enforcement for attachments.', checks: [['Oversized', 'Error for files exceeding size limit (e.g., > 25MB)'], ['Valid Size', 'Files within limit upload successfully']] },
      148: { goal: 'Verify file type validation for attachments.', checks: [['Invalid Type', 'Error for unsupported types (e.g., .exe)'], ['Valid Types', 'Supported types (PDF, images, Word) upload successfully']] },
      149: { goal: 'Verify attachment deletion with confirmation dialog.', checks: [['Confirmation', 'Delete confirmation dialog appears'], ['Deleted', 'Attachment removed from list after confirmation']] },
      150: { goal: 'Verify multiple file attachments can be uploaded to a single WO.', checks: [['Multiple', 'All files (3+) upload successfully'], ['Individual', 'Each file can be viewed or deleted independently']] },
      151: { goal: 'Verify handling of attachments with very long filenames (100+ chars).', checks: [['Upload', 'File uploads without error'], ['Display', 'Filename truncated with ellipsis, full name on hover']] },
      152: { goal: 'Verify handling of attachments with special characters in filename.', checks: [['Upload', 'File with special chars uploads successfully'], ['Display', 'Filename displays correctly'], ['Download', 'File downloads with original name']] },
      153: { goal: 'Verify attachment behavior on completed/approved work orders.', checks: [['Visible', 'Existing attachments are accessible'], ['Upload Policy', 'New uploads are either allowed or blocked for completed WOs']] },
    };
    const s = attachScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Open a work order detail page.'],
      ['Scroll to the Attachments section.', 'Perform the attachment operation.'], [], [],
      s.checks,
      ['No UI errors during file operations', 'File integrity maintained', 'Consistent behavior across browsers'],
      ['Try uploading during a network slowdown — verify timeout handling.', 'Upload a 0-byte file — verify handling.']
    );
  }

  if (n >= 154 && n <= 168) {
    return buildGenericWOMisc(id, n, scenario, steps, testData, expected);
  }

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function buildGenericWOCompletion(id, n, scenario, steps, testData, expected) {
  return fmt(id, scenario,
    `Verify ${scenario.toLowerCase()} functionality in the work order completion workflow.`,
    ['Log in to RSMS.', `Navigate to ${NAV.workOrders}.`, 'Select a vessel.', 'Open a work order in Due or Overdue status.'],
    ['Navigate to Part B (Completion section) of the work order.', 'Fill in the relevant completion fields as described in the test steps.'],
    ['Verify field validation rules and constraints.'],
    ['Submit the work order for approval (if completing all required fields).'],
    [['Field Input', `${scenario} fields accept valid input`],
     ['Validation', 'Invalid input is rejected with clear error messages'],
     ['Save/Submit', 'Data is persisted correctly when saved or submitted'],
     ['Display', 'Saved data displays correctly when the WO is reopened']],
    ['No UI errors during data entry', 'Fields retain values during the session', 'Validation messages are clear and specific', 'No unexpected field resets'],
    ['Enter boundary values (empty, minimum, maximum) in the fields.', 'Fill fields with special characters — verify they are preserved.', 'Navigate away without saving — verify unsaved changes are warned about or discarded.']
  );
}

function buildGenericWOLayer(id, n, scenario, layerName, steps, expected, category, description, actions) {
  return fmt(id, scenario,
    `Verify ${scenario.toLowerCase()} — ${layerName}.`,
    ['Log in to RSMS.', `Navigate to ${NAV.workOrders} or ${NAV.dashboard} as appropriate.`, 'Select a vessel.'],
    actions,
    ['Verify the detection/validation results.'],
    ['Cross-reference with the anomaly detection panel on the Dashboard (Sail Admin only).'],
    [['Detection', `${category} condition is correctly identified by the system`],
     ['Display', `${category} information is clearly displayed to the user`],
     ['Accuracy', 'No false positives — normal operations are NOT flagged'],
     ['Severity', 'Severity level is appropriate for the detected condition']],
    [`${category} detection is accurate`, 'Visual indicators are clear and distinct', 'No UI errors during detection/display', 'Data is consistent across views'],
    [`Test with a borderline case — verify the system correctly classifies it.`, 'Test with a clearly normal case — verify no false flags appear.', `Verify ${category.toLowerCase()} data is visible to Sail Admin only (if role-restricted).`]
  );
}

function buildGenericWOMisc(id, n, scenario, steps, testData, expected) {
  const miscScenarios = {
    154: { goal: 'Verify Save Draft preserves partial completion data without changing WO status.', checks: [['Draft Saved', 'Data saved without status change'], ['Persistence', 'Draft data preserved on reopen']] },
    155: { goal: 'Verify draft data persists across browser sessions.', checks: [['Session Persist', 'Draft data survives browser close/reopen'], ['Submit', 'Final submission includes both draft and new data']] },
    156: { goal: 'Verify completed WOs are fully immutable (all fields locked).', checks: [['All Locked', 'All fields are read-only'], ['No Edit', 'No edit buttons available'], ['Indicator', 'Lock icon or "Completed" indicator visible']] },
    157: { goal: 'Verify approval details are locked on completed work orders.', checks: [['Approval Locked', 'Approver name, date, remarks are immutable'], ['Completion Locked', 'Completion data is also locked']] },
    158: { goal: 'Verify character limit enforcement in text fields.', checks: [['Limit Reached', 'System indicates when limit is reached'], ['Indicator', 'Character count or remaining chars shown']] },
    159: { goal: 'Verify text fields accept various character types without corruption.', checks: [['All Chars', 'Letters, numbers, symbols, Unicode accepted'], ['No Corruption', 'Saved text displays exactly as entered']] },
    160: { goal: 'Verify cross-field validation catches conflicting values.', checks: [['Conflict Detection', 'System catches conflicts (e.g., completion before start date)'], ['Error Message', 'Clear message explains the issue']] },
    161: { goal: 'Verify Calendar vs RH conditional field display.', checks: [['Calendar WO', 'Shows due date, hides RH fields'], ['RH WO', 'Shows reading fields, hides calendar date']] },
    162: { goal: 'Verify criticality reflects component criticality setting.', checks: [['Reflection', 'WO criticality matches component\'s setting'], ['Update', 'Criticality changes propagate correctly']] },
    163: { goal: 'Verify AI chatbot is accessible for Sail Admin users.', checks: [['Button Visible', 'Chat button (message icon) visible in bottom-right'], ['Panel Opens', 'Chat panel opens when clicked'], ['Responds', 'AI responds to maintenance questions']] },
    164: { goal: 'Verify chatbot provides accurate WO-specific information.', checks: [['Specific Info', 'Chatbot details match actual WO data'], ['Accuracy', 'Response is factually correct']] },
    165: { goal: 'Verify chatbot understands maritime/PMS context.', checks: [['Context', 'Chatbot provides helpful PMS-related responses'], ['Follow-ups', 'Suggested follow-up prompts appear']] },
    166: { goal: 'Verify chatbot handles irrelevant questions gracefully.', checks: [['No Crash', 'Chatbot responds without errors'], ['Redirect', 'Politely redirects to PMS topics']] },
    167: { goal: 'Verify chatbot is NOT visible for non-Sail Admin users.', checks: [['Non-Admin', 'Chat button NOT visible for non-Sail Admin'], ['Admin', 'Chat button IS visible for Sail Admin']] },
    168: { goal: 'Verify chatbot maintains multi-turn conversation context.', checks: [['Context', 'Follow-up questions relate to previous context'], ['History', 'Conversation history visible in chat panel']] },
  };
  const s = miscScenarios[n] || { goal: `Verify ${scenario.toLowerCase()}.`, checks: [['Result', expected]] };
  return fmt(id, scenario, s.goal,
    ['Log in to RSMS.', `Navigate to ${NAV.workOrders}.`, 'Select a vessel.'],
    ['Perform the actions described for this test scenario.'], [], [],
    s.checks,
    ['No UI errors', 'Consistent behavior', 'Data integrity maintained'],
    ['Test across different user roles to verify role-based behavior.', 'Try the action on different browsers — verify consistent behavior.']
  );
}

function genRH(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('RH-', ''));
  const nav = NAV.runningHrs;

  if (n >= 1 && n <= 8) {
    const mainViewScenarios = {
      1: { goal: 'Verify the Running Hours dashboard loads correctly with all expected columns.', checks: [['Page Load', 'Table loads showing parent components with RH tracking'], ['Columns', 'Shows: Component, Code, Category, Running Hours, Last Updated, Utilization Rate, Period RH'], ['Utilization', 'Utilization rate column has progress bar visualization']] },
      2: { goal: 'Verify utilization rate calculation and visual display.', checks: [['Percentage', 'Each component shows a percentage value'], ['Color Coding', 'Progress bar: green (normal), amber (moderate), red (high)'], ['Period', 'Period selector changes the utilization calculation']] },
      3: { goal: 'Verify "Last Updated" dates are displayed correctly.', checks: [['Format', 'Dates in readable format (e.g., "15 Mar 2026 14:30")'], ['Accuracy', 'Recent updates show recent dates'], ['No Errors', 'No "Invalid Date" or "NaN" values']] },
      4: { goal: 'Verify the search bar filters components correctly.', checks: [['Search', 'Table filters to matching components'], ['Clear', 'All components reappear when search is cleared']] },
      5: { goal: 'Verify vessel filter refreshes data for the selected vessel.', checks: [['Refresh', 'Data refreshes for newly selected vessel'], ['Equipment', 'Component list changes to reflect new vessel']] },
      6: { goal: 'Verify the utilization period selector (Weekly/Monthly/Quarterly/Yearly) works correctly.', checks: [['Weekly', 'Utilization rates reflect weekly data (168 hrs max)'], ['Monthly', 'Rates reflect monthly data (720 hrs max)'], ['Quarterly/Yearly', 'Rates update for each selected period'], ['Column Header', 'Header updates to show selected period']] },
      7: { goal: 'Verify inherited children display for parent components with RH inheritance.', checks: [['Child Count', 'Icon/button shows count of inherited child components'], ['Popup', 'Clicking shows child components with their RH values'], ['Match', 'Child RH values match parent for inherited components']] },
      8: { goal: 'Verify data quality warnings for suspicious RH data.', checks: [['Warning', 'Warning indicator for extremely high utilization (>100%)'], ['Context', 'Warning provides context about the issue'], ['Normal', 'Normal components do NOT show false warnings']] },
    };
    const s = mainViewScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel from the vessel dropdown.'],
      ['Observe the Running Hours table and its columns.', 'Interact with the relevant controls/filters.'], [], [],
      s.checks,
      ['Table loads without errors', 'All data is formatted correctly', 'No "NaN" or "undefined" values'],
      ['Switch vessels rapidly — verify no data mix-up.', 'Test with a vessel that has no RH-tracked components — verify empty state.']
    );
  }

  if (n >= 9 && n <= 17) {
    const updateScenarios = {
      9: { goal: 'Verify the individual RH update dialog works correctly.', checks: [['Dialog Opens', '"Update Running Hours - [Component Name]" dialog opens'], ['Fields', 'Shows current value, new value input, date, comments'], ['Update', 'RH updates in the table after saving'], ['Toast', 'Success toast appears']] },
      10: { goal: 'Verify "Set Total" vs "Add Delta" update modes.', checks: [['Set Total', 'Entering 5500 sets RH to exactly 5500'], ['Add Delta', 'Entering 100 increases RH by 100 (5500→5600)'], ['Mode Toggle', 'RadioGroup switches between modes correctly']] },
      11: { goal: 'Verify validation prevents entering RH less than current reading.', checks: [['Lower Value', 'Validation error or confirmation dialog appears'], ['Zero Entry', 'Entering 0 triggers "Zero RH Renewal Confirmation" dialog with reason required']] },
      12: { goal: 'Verify meter replacement flow in RH update.', checks: [['Checkbox', '"Meter Replaced" checkbox reveals old/new meter fields'], ['Calculation', 'New cumulative RH = old cumulative + new meter reading'], ['History', 'Meter replacement recorded in history']] },
      13: { goal: 'Verify date handling in RH updates.', checks: [['Auto-fill', 'System auto-fills today\'s date or requires date entry'], ['Future Date', 'Future dates may be prevented'], ['Past Date', 'Valid past dates are accepted']] },
      14: { goal: 'Verify comments are saved with RH updates.', checks: [['Accept', 'Comments field accepts text input'], ['Saved', 'Comments appear in RH history entry'], ['Persist', 'Comments persist after page reload']] },
      15: { goal: 'Verify cascading RH updates to inherited child components.', checks: [['Parent Update', 'Parent RH updates correctly'], ['Children Update', 'All inherited children auto-update to match parent'], ['Cascade', 'Cascade works for all child levels']] },
      16: { goal: 'Verify the Bulk Update dialog for updating multiple components simultaneously.', checks: [['Dialog Opens', '"Bulk Update Running Hours" dialog opens with all RH components listed'], ['Multi-Entry', 'Values can be entered for multiple components'], ['Save All', '"Save" button updates all components simultaneously'], ['Success', 'Success message confirms bulk update']] },
      17: { goal: 'Verify error handling in bulk update with mixed valid/invalid values.', checks: [['Valid', 'Components with valid values update successfully'], ['Invalid', 'Components with invalid values show errors'], ['Clear Errors', 'System clearly indicates which updates failed and why']] },
    };
    const s = updateScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      ['Click the Update (pencil) icon for a component, or click "Bulk Update".', 'Fill in the RH update form fields.'],
      [], ['Click "Save" and verify the result.'],
      s.checks,
      ['No data corruption during updates', 'Values are formatted correctly', 'History is updated'],
      ['Try entering non-numeric text — verify only numbers are accepted.', 'Try updating while another user is updating the same component — verify no conflict.']
    );
  }

  if (n >= 18 && n <= 35) {
    const historyExportScenarios = {
      18: { goal: 'Verify the RH History tab displays update history correctly.', c: [['History Tab', 'Opens showing RH update history'], ['Entry Details', 'Each entry shows: date, old value, new value, source, updated by']] },
      19: { goal: 'Verify RH history sort order (most recent first by default).', c: [['Default Sort', 'Most recent entries appear first'], ['Toggle', 'Clicking sort toggle changes to ascending order']] },
      20: { goal: 'Verify date filtering in RH history.', c: [['Date Range', 'Only entries within selected range shown'], ['Clear', 'All entries reappear when filters cleared']] },
      21: { goal: 'Verify search functionality in RH history.', c: [['Search', 'History entries filter by search term'], ['Matching', 'Matching entries are shown or highlighted']] },
      22: { goal: 'Verify pagination in RH history.', c: [['Pagination', 'Page navigation works (Next, Previous)'], ['Page Size', 'Items per page can be changed'], ['Count', 'Total entry count is accurate']] },
      23: { goal: 'Verify RH timeline visualization (if available).', c: [['Timeline', 'Shows RH progression over time'], ['Data Points', 'Correspond to actual RH update events']] },
      24: { goal: 'Verify meter replacement events in RH timeline.', c: [['Distinct', 'Meter replacements visually distinct on timeline'], ['Cumulative', 'Total line shows correct progression across meter changes']] },
      25: { goal: 'Verify RH integration with maintenance schedule.', c: [['Due Reading', 'As RH increases, jobs approach due readings'], ['Calculation', 'Due readings = last completion reading + frequency']] },
      26: { goal: 'Verify RH-based WO status changes when RH exceeds due reading.', c: [['Status Change', 'WO status changes to "Due" or "Overdue" when RH exceeds threshold'], ['Dashboard', 'Dashboard overdue count updates']] },
      27: { goal: 'Verify weekly utilization period calculation.', c: [['Weekly', 'Data reflects last 7 days (168 hrs max)'], ['Label', 'Column header shows "Weekly"']] },
      28: { goal: 'Verify monthly utilization period calculation.', c: [['Monthly', 'Data reflects last 30 days (720 hrs max)'], ['Period RH', 'Shows hours accumulated in last month']] },
      29: { goal: 'Verify quarterly and yearly utilization calculations.', c: [['Quarterly', '90 days (2160 hrs max)'], ['Yearly', '365 days (8760 hrs max)'], ['Recalculate', 'Percentages recalculate for each period']] },
      30: { goal: 'Verify CSV export of running hours data.', c: [['Download', 'CSV file downloads'], ['Content', 'Contains all visible RH data'], ['Columns', 'Vessel, Component, Code, Category, RH, Last Updated, Utilization, Period RH']] },
      31: { goal: 'Verify history export respects filters.', c: [['Filtered', 'Export contains only filtered history data'], ['Respect Filters', 'Applied filters are reflected in export']] },
      32: { goal: 'Verify numeric precision in exported data.', c: [['Precision', 'No loss of numeric precision'], ['Dates', 'Dates in readable format'], ['Names', 'Component names/codes not truncated']] },
      33: { goal: 'Verify export handles large datasets (50+ components).', c: [['Complete', 'All components included in export'], ['Opens', 'File opens without errors in Excel'], ['Performance', 'Export completes in < 30 seconds']] },
      34: { goal: 'Verify handling of 0 running hours.', c: [['Zero to New', '0-to-new-value transition works correctly'], ['No Math Errors', 'No division-by-zero in utilization calculations']] },
      35: { goal: 'Verify handling of extremely large RH values.', c: [['Large Values', 'System accepts or shows reasonable upper limit error'], ['Display', 'Large numbers formatted correctly (commas)'], ['Utilization', 'Calculations remain accurate']] },
    };
    const s = historyExportScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      ['Navigate to the relevant tab or control for this test.'], [], [],
      s.c,
      ['No errors or data corruption', 'Consistent with on-screen data', 'Performance is acceptable'],
      ['Test with edge case data (0 RH, max RH, special characters in comments).', 'Verify behavior across different user roles.']
    );
  }

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function genSP(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('SP-', ''));
  const nav = NAV.spares;

  if (n >= 1 && n <= 11) {
    const listScenarios = {
      1: { goal: 'Verify the Spares list page loads correctly with all expected columns and tabs.', checks: [['Page Load', 'Spares page loads showing table with tabs: Inventory, Location, History'], ['Columns', 'Shows: Part Code, Part Name, Component, Part Number, Critical, ROB, Min, Stock, Location'], ['Buttons', '"+ Add Spare", "Export", "Bulk Update Spares" buttons visible']] },
      2: { goal: 'Verify pagination controls work correctly on the spares table.', checks: [['Navigation', 'Page buttons work (Next, Previous, page numbers)'], ['Page Size', 'Items per page can be changed'], ['Count', 'Total count displayed']] },
      3: { goal: 'Verify search by part number filters spares correctly.', checks: [['Filter', 'Table shows only matching parts'], ['Partial', 'Partial number matches work'], ['Clear', 'Full list returns when search cleared']] },
      4: { goal: 'Verify search by part name filters spares correctly.', checks: [['Filter', 'Matching spare parts displayed'], ['Partial', 'Partial name matches work'], ['Clear', 'Full list returns when search cleared']] },
      5: { goal: 'Verify filter by component works correctly.', checks: [['Component Filter', 'Only spares linked to selected component shown'], ['Clear', 'All spares return when filter cleared']] },
      6: { goal: 'Verify total spares count display and dynamic update.', checks: [['Count Visible', 'Total spares count displayed in the table header or footer area'], ['Accurate', 'Count matches the actual number of rows in the table'], ['Filter Update', 'Count dynamically updates when search or filters are applied'], ['Clear Reset', 'Count returns to original total when filters are cleared']] },
      7: { goal: 'Verify low stock indicator highlighting for spares where ROB <= Min Stock.', checks: [['Flagged', 'Spares where ROB <= Min Stock are highlighted or have a "Low" status badge'], ['Color', 'Low stock indicator uses visible color (red or amber in the Stock column)'], ['Normal', 'Spares with adequate stock show "OK" or green indicator']] },
      8: { goal: 'Verify column sorting works on the spares table.', checks: [['Sort Click', 'Clicking column headers sorts the table'], ['Toggle', 'Ascending/descending toggle works'], ['Indicator', 'Sort indicator arrow appears on active column']] },
      9: { goal: 'Verify vessel filter changes refresh spares data.', checks: [['Refresh', 'Spares list updates for selected vessel'], ['Data Change', 'Counts and data reflect new vessel']] },
      10: { goal: 'Verify the Export button downloads spares data.', checks: [['Download', 'File downloads (Excel or CSV)'], ['Content', 'Exported data matches on-screen data']] },
      11: { goal: 'Verify the Criticality filter shows only critical or non-critical spares.', checks: [['Critical', 'Selecting "Critical" shows only critical spares'], ['Non-critical', 'Selecting "Non-critical" shows only non-critical spares'], ['All', 'Selecting "All" shows all spares']] },
    };
    const s = listScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel from the vessel dropdown.'],
      ['Observe the spares table and interact with the relevant controls.'], [], [],
      s.checks,
      ['Table loads without errors', 'All data is formatted correctly', 'No "undefined" or blank values for populated fields'],
      ['Switch vessel rapidly — verify no mixed data.', 'Apply filters that return zero results — verify empty state message appears.']
    );
  }

  if (n >= 12 && n <= 40) {
    const crudScenarios = {
      12: { goal: 'Verify the Add Spare form opens and creates a spare part successfully.', checks: [['Form', '"+ Add Spare" button opens the add form'], ['Fields', 'Required fields: Part Code, Part Name, Component, UOM, Min Stock, ROB'], ['Save', 'Spare created and appears in list'], ['Toast', 'Success toast message appears']] },
      13: { goal: 'Verify form validation prevents saving with missing required fields.', checks: [['Validation', 'Errors appear for empty required fields'], ['Blocked', 'Form does NOT save until all required fields filled']] },
      14: { goal: 'Verify the system prevents duplicate part numbers.', checks: [['Duplicate Error', 'Error message for duplicate part number'], ['Blocked', 'System prevents creating duplicate']] },
      15: { goal: 'Verify ROB field rejects negative values.', checks: [['Negative', 'System rejects negative ROB values'], ['Zero', 'Zero is accepted (no stock on hand)']] },
      16: { goal: 'Verify the Critical flag saves correctly.', checks: [['Critical Yes', 'Spare marked as critical in the list'], ['Reports', 'Critical spares included in critical stock reports']] },
      17: { goal: 'Verify editing an existing spare part saves changes.', checks: [['Edit', 'Spare details open for editing'], ['Save', 'Changes saved and reflected in list'], ['Toast', 'Success message appears']] },
      18: { goal: 'Verify Min Stock level change updates low stock indicators.', checks: [['Saved', 'New min stock saved'], ['Indicator Update', 'Low stock indicators update based on new threshold']] },
      19: { goal: 'Verify Stock In (Receive) operation increases ROB.', checks: [['ROB Increase', 'ROB increases by entered quantity'], ['History', 'Transaction recorded in stock history']] },
      20: { goal: 'Verify Stock Out (Issue) operation decreases ROB.', checks: [['ROB Decrease', 'ROB decreases by issued quantity'], ['History', 'Transaction recorded in history']] },
      21: { goal: 'Verify system prevents issuing more than available stock.', checks: [['Prevented', 'System blocks issuing more than ROB'], ['Error', '"Insufficient stock" error message appears']] },
      22: { goal: 'Verify stock transaction history records both In and Out operations.', checks: [['In Record', 'Stock In appears with "Received" type'], ['Out Record', 'Stock Out appears with "Consumed" type'], ['Details', 'Both show quantities, dates, and notes']] },
      23: { goal: 'Verify ROB calculations are mathematically correct after multiple transactions.', checks: [['Balance', 'Running ROB balance is correct after each transaction'], ['Audit', 'History shows accurate audit trail']] },
      24: { goal: 'Verify WO-linked spare consumption decreases ROB.', checks: [['ROB Decrease', 'ROB decreases by consumed quantity after WO submission'], ['Source', 'Transaction source shows "Work Order" in history']] },
      25: { goal: 'Verify only component-linked spares are available for WO consumption.', checks: [['Filtered', 'Only spares for the WO\'s component available for selection'], ['ROB Update', 'ROB updates correctly after WO submission']] },
      26: { goal: 'Verify stock transaction history displays all past transactions.', checks: [['Chronological', 'All transactions listed chronologically'], ['Details', 'Each shows: date, type, quantity, balance, source, notes']] },
      27: { goal: 'Verify date filtering in stock history.', checks: [['Date Range', 'Only transactions within range shown'], ['Clear', 'All transactions return when cleared']] },
      28: { goal: 'Verify sort order in stock history (newest first by default).', checks: [['Default', 'Newest first by default'], ['Toggle', 'Oldest first when ascending selected']] },
      29: { goal: 'Verify running balance accuracy across all transaction types.', checks: [['Balance', 'Running balance correct at each point'], ['All Types', 'Manual in, manual out, WO consumption all represented']] },
      30: { goal: 'Verify low stock visual indicator for spares at or below minimum.', checks: [['Indicator', 'Low stock spares have visible badge/icon/highlighting'], ['Color', 'Red or amber color used'], ['Dashboard', 'Dashboard count matches low-stock spares']] },
      31: { goal: 'Verify low stock indicator toggles correctly when ROB crosses Min threshold.', checks: [['Below Min', 'Indicator appears when ROB <= Min'], ['Above Min', 'Indicator removed when ROB > Min']] },
      32: { goal: 'Verify Dashboard low stock tiles match actual spare data.', checks: [['Low Stock Count', 'Matches spares where ROB <= Min'], ['Critical Low Stock', 'Matches critical spares where ROB <= Min'], ['Click Through', 'Clicking tile navigates to filtered spares list']] },
      33: { goal: 'Verify category filtering for spares.', checks: [['Category Filter', 'Only spares in selected category shown'], ['Options', 'Category dropdown shows available categories']] },
      34: { goal: 'Verify spare category assignment and editing.', checks: [['Assign', 'Spare appears under correct category'], ['Change', 'Spare moves to new category when edited']] },
      35: { goal: 'Verify ROB display accuracy and units.', checks: [['Non-negative', 'ROB values are non-negative integers'], ['Unit', 'Unit of measure shown alongside ROB'], ['Accurate', 'ROB reflects all stock transactions']] },
      36: { goal: 'Verify ROB updates immediately and persists after page reload.', checks: [['Immediate', 'ROB updates immediately in the UI'], ['Persist', 'Value persists after page refresh'], ['Accurate', 'Matches expected balance']] },
      37: { goal: 'Verify deletion of a spare with no transaction history.', checks: [['Confirmation', 'Confirmation dialog appears'], ['Deleted', 'Spare removed from list'], ['Success', 'Success message appears']] },
      38: { goal: 'Verify deletion prevention for spares with existing transactions/WO links.', checks: [['Prevented', 'System prevents deletion with error message'], ['Retained', 'Spare remains in the list']] },
      39: { goal: 'Verify Cancel on delete confirmation preserves the spare.', checks: [['Not Deleted', 'Spare NOT deleted after Cancel'], ['Data Intact', 'All data remains unchanged']] },
      40: { goal: 'Verify bulk import of spares (if available).', checks: [['Import', 'Valid spares imported from CSV/Excel file'], ['Validation', 'Invalid entries flagged with specific errors'], ['Summary', 'Import summary shows count imported vs rejected']] },
    };
    const s = crudScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      ['Perform the operation described for this test case.'], [], [],
      s.checks,
      ['No UI errors during operation', 'Data integrity maintained', 'ROB calculations are correct'],
      ['Test with boundary values (0, negative, very large numbers).', 'Test with special characters in names/notes.', 'Verify behavior across different user roles.']
    );
  }

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function genST(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('ST-', ''));
  const nav = NAV.stores;

  const storeScenarios = {
    1: { goal: 'Verify the Stores inventory page loads with category tabs and all expected columns.', checks: [['Page Load', 'Stores page loads with tabs: Stores, Lubes, Chemicals, Others'], ['View Modes', 'View modes available: Inventory, Location, History'], ['Columns', 'Shows: Item Code, Item Name, Category, UOM, ROB, Min, Stock, Location'], ['Buttons', '"+ Add Item", "Export", "Bulk Update" buttons visible']] },
    2: { goal: 'Verify search by item code filters store items correctly.', checks: [['Filter', 'Table shows only matching items'], ['Clear', 'Full list returns when search cleared']] },
    3: { goal: 'Verify search by item name filters store items correctly.', checks: [['Filter', 'Matching items displayed'], ['Partial', 'Partial name matches work']] },
    4: { goal: 'Verify pagination controls work on the stores table.', checks: [['Navigation', 'Pagination works (Next, Previous)'], ['Page Size', 'Items per page can be changed']] },
    5: { goal: 'Verify column sorting works on the stores table.', checks: [['Sort', 'Sorting works for Item Code, Name, ROB'], ['Indicators', 'Sort indicators appear']] },
    6: { goal: 'Verify the Add Item form creates a new store item successfully.', checks: [['Form', '"+ Add Item" opens form with General Info, Stock Levels, Location, etc.'], ['Required Fields', 'Item Code, Item Name, Category, UOM, Min Stock, ROB'], ['Save', 'Item created and appears in list'], ['Toast', 'Success message appears']] },
    7: { goal: 'Verify form validation for required fields when adding store items.', checks: [['Validation', 'Errors appear for empty required fields'], ['Blocked', 'Form does NOT save until all required fields filled']] },
    8: { goal: 'Verify duplicate item code prevention.', checks: [['Duplicate', 'Error message for duplicate item code'], ['Blocked', 'System prevents creating duplicate']] },
    9: { goal: 'Verify store item creation with minimum and maximum data.', checks: [['Minimum', 'Item saves with only required fields'], ['Maximum', 'Item saves with all optional fields filled']] },
    10: { goal: 'Verify stock quantity adjustment (stock in and stock out).', checks: [['Stock In', 'ROB increases with positive adjustment'], ['Stock Out', 'ROB decreases with negative adjustment'], ['History', 'Transactions recorded in history']] },
    11: { goal: 'Verify system prevents stock going below zero.', checks: [['Prevented', 'System blocks going below 0'], ['Error', 'Error message appears']] },
    12: { goal: 'Verify updated quantity persists after page refresh.', checks: [['Immediate', 'Change reflected immediately'], ['Persist', 'Value persists after refresh']] },
    13: { goal: 'Verify category filters/tabs work for stores.', checks: [['Filter', 'Only items in selected category shown'], ['Tabs', 'Stores, Lubes, Chemicals, Others tabs filter correctly']] },
    14: { goal: 'Verify new store item category assignment.', checks: [['Category', 'Item appears under correct category tab'], ['Management', 'Category options are available']] },
    15: { goal: 'Verify store item category change.', checks: [['Move', 'Item moves to new category on edit'], ['Old Category', 'Old category no longer shows item']] },
    16: { goal: 'Verify category management operations.', checks: [['Add', 'New categories can be created'], ['Delete Empty', 'Empty categories can be deleted'], ['Delete Non-Empty', 'System prevents or handles deletion of categories with items']] },
    17: { goal: 'Verify store item transaction history display.', checks: [['History', 'All past quantity changes listed'], ['Details', 'Each shows: date, type, quantity, balance, notes'], ['Sort', 'Sorted by date (newest first)']] },
    18: { goal: 'Verify date filtering in store transaction history.', checks: [['Date Range', 'Only transactions within range shown'], ['Clear', 'All entries return when cleared']] },
    19: { goal: 'Verify running balance accuracy across multiple transactions.', checks: [['Balance', 'Running balance correct at each point'], ['All Accounted', 'All transactions accounted for']] },
    20: { goal: 'Verify editing an existing store item saves changes.', checks: [['Edit', 'Item details open for editing'], ['Save', 'Changes saved and reflected'], ['Toast', 'Success message appears']] },
    21: { goal: 'Verify Min Stock level change updates low stock indicators.', checks: [['Saved', 'New min stock saved'], ['Indicator', 'Low stock warning appears if ROB now below new min']] },
    22: { goal: 'Verify bulk update/import for store items.', checks: [['Upload', 'File with multiple items can be uploaded'], ['Valid', 'Valid items imported/updated'], ['Invalid', 'Invalid entries flagged with errors']] },
    23: { goal: 'Verify deletion of a store item with no transaction history.', checks: [['Confirmation', 'Confirmation dialog appears'], ['Deleted', 'Item removed from list'], ['Toast', 'Success message appears']] },
    24: { goal: 'Verify deletion behavior for items with transaction history.', checks: [['Prevention', 'System prevents deletion or warns about losing history'], ['Document', 'Document actual behavior in Comments']] },
    25: { goal: 'Verify handling of long names (200+ chars) and special characters.', checks: [['Long Name', 'Saves successfully, displays correctly (truncated if needed)'], ['Special Chars', 'Characters preserved correctly']] },
  };
  const s = storeScenarios[n] || { goal: `Verify ${scenario.toLowerCase()}.`, checks: [['Result', expected]] };
  return fmt(id, scenario, s.goal,
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
    ['Navigate to the relevant tab/view and perform the test action.'], [], [],
    s.checks,
    ['No UI errors during operation', 'Data integrity maintained', 'Category tabs work correctly', 'Stock calculations are accurate'],
    ['Test with boundary values (0, negative, very large numbers).', 'Test with special characters in item names/codes.', 'Switch between category tabs rapidly — verify no data mix.']
  );
}

function genRPT(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('RPT-', ''));
  const nav = NAV.reports;

  const reportScenarios = {
    1: { goal: 'Verify the Reports module loads with all report category cards.', checks: [['Page Load', 'Reports page opens with category cards'], ['Categories', 'Cards include: Maintenance Planner, Maintenance & Work Orders, Running Hours & Condition, Inventory - Spares, Inventory - Stores, IHM, Modify PMS, Critical Equipment, LSA/FFA Equipment'], ['Filters', 'Global filters visible: Vessel, Search, Date Range']] },
    2: { goal: 'Verify Work Order Status report generation.', checks: [['WO by Status', 'Report shows WOs grouped by status (Planned, Due, Overdue, Completed)'], ['Counts', 'Counts and percentages are accurate'], ['Data Match', 'Report matches Work Orders page data']] },
    3: { goal: 'Verify Work Order Completion report with date range.', checks: [['Date Filter', 'Only WOs completed within the range included'], ['Details', 'Completion details (date, who, work done) shown']] },
    4: { goal: 'Verify Overdue Work Orders report.', checks: [['All Overdue', 'All overdue WOs listed'], ['Days Overdue', 'Report shows days overdue for each WO'], ['Highlighted', 'Critical overdue items highlighted']] },
    5: { goal: 'Verify Work Order Trend report with monthly data.', checks: [['Trends', 'Monthly trends shown (completions vs due vs overdue)'], ['Chart', 'Chart accurately represents the data'], ['Date Range', 'Date range can be adjusted']] },
    6: { goal: 'Verify Component/Equipment report.', checks: [['Component List', 'Report lists all components with key information'], ['Hierarchy', 'Component hierarchy maintained'], ['Critical', 'Critical components highlighted']] },
    7: { goal: 'Verify Component Maintenance History report.', checks: [['History', 'All maintenance activities listed chronologically'], ['Details', 'WO number, job title, completion date, work done included']] },
    8: { goal: 'Verify Running Hours report.', checks: [['Current RH', 'Current RH for all tracked components listed'], ['Utilization', 'Utilization rates shown'], ['Last Updated', 'Last updated dates accurate']] },
    9: { goal: 'Verify RH History report for a specific component.', checks: [['Events', 'All RH update events listed'], ['Values', 'Old and new values shown for each update'], ['Source', 'Source (manual, cascade, WO) indicated']] },
    10: { goal: 'Verify RH Utilization report.', checks: [['Rates', 'Utilization rates by component shown'], ['Period', 'Selected period reflected'], ['High Usage', 'High-utilization components highlighted']] },
    11: { goal: 'Verify Spares/Inventory report.', checks: [['All Spares', 'All spare parts listed with current ROB'], ['Min Stock', 'Min stock levels shown'], ['Low Stock', 'Low stock items flagged']] },
    12: { goal: 'Verify Spares Consumption report.', checks: [['Consumption', 'All spare consumption listed for date range'], ['Quantities', 'Quantities consumed are accurate'], ['WO Link', 'Report shows which WOs consumed spares']] },
    13: { goal: 'Verify Critical Spares report.', checks: [['Critical Only', 'Only critical spares included'], ['Stock Levels', 'Current stock levels shown'], ['Below Min', 'Items below minimum highlighted']] },
    14: { goal: 'Verify Compliance Summary report.', checks: [['Compliance Rate', 'Overall PMS compliance rate shown'], ['Calculation', 'Rate = completed on-time / total due'], ['Filters', 'Can be filtered by vessel and date range']] },
    15: { goal: 'Verify compliance by department breakdown.', checks: [['Per Department', 'Each department has its own compliance rate'], ['Totals Match', 'Department totals match overall rate']] },
    16: { goal: 'Verify compliance by component category breakdown.', checks: [['Per Category', 'Each category shows compliance rate'], ['Low Compliance', 'Categories with low compliance highlighted']] },
    17: { goal: 'Verify compliance trend over consecutive months.', checks: [['Trend Visible', 'Trend is visible across months'], ['Changes', 'Month-over-month changes are clear']] },
    18: { goal: 'Verify report filter options (Vessel, Date Range, Department, Component).', checks: [['Vessel', 'Data scoped to selected vessel'], ['Date Range', 'Only data within range included'], ['Multiple', 'Multiple filters can be combined']] },
    19: { goal: 'Verify unfiltered reports show all data.', checks: [['All Data', 'Unfiltered report shows all data'], ['Consistency', 'Filtered and unfiltered reports are consistent']] },
    20: { goal: 'Verify invalid filter combination handling.', checks: [['Validation', 'Error for "From" date after "To" date'], ['No Report', 'No report generated with invalid filters']] },
    21: { goal: 'Verify report generation loading state and rendering.', checks: [['Loading', 'Loading indicator appears during generation'], ['Rendered', 'Report renders in preview area'], ['Performance', 'Generation completes in reasonable time']] },
    22: { goal: 'Verify report export to Excel and PDF.', checks: [['Excel', 'Excel file downloads with report data'], ['PDF', 'PDF file downloads with formatted report']] },
    23: { goal: 'Verify PDF export formatting quality.', checks: [['Headers/Footers', 'Proper formatting with headers, footers, page numbers'], ['Tables', 'Tables are readable and not cut off'], ['Charts', 'Charts render correctly in export']] },
    24: { goal: 'Verify report header content.', checks: [['Title', 'Report title included'], ['Vessel', 'Vessel name displayed'], ['Date Range', 'Date range shown'], ['Generation Date', 'Generation timestamp included']] },
    25: { goal: 'Verify report handles large datasets without errors.', checks: [['Volume', 'Report handles high volume without errors'], ['Complete', 'All data included (no truncation)'], ['Performance', 'Generates within 30 seconds']] },
    26: { goal: 'Verify deterministic report generation (same params = same results).', checks: [['Identical', 'Two reports with same parameters produce identical results'], ['No Random', 'No random variations occur']] },
    27: { goal: 'Verify compliance rate calculation accuracy.', checks: [['Match', 'Calculated rates match manual calculation'], ['Percentages', 'Percentages add up correctly']] },
    28: { goal: 'Verify scheduled reports functionality.', checks: [['Schedule', 'If available, schedule is saved and indicates next generation time'], ['Availability', 'If not available, note "Scheduled Reports not implemented"']] },
    29: { goal: 'Verify email delivery of scheduled reports.', checks: [['Email', 'If available, reports sent to configured recipients with attachment'], ['Availability', 'If not available, note "Email delivery not implemented"']] },
    30: { goal: 'Verify schedule editing and deletion.', checks: [['Edit', 'Schedule frequency can be changed'], ['Delete', 'Schedule can be removed']] },
    31: { goal: 'Verify custom report builder (if available).', checks: [['Custom Fields', 'If available, custom fields/columns can be selected'], ['Generate', 'Custom report generates with selected fields only'], ['Availability', 'If not available, note "Custom Reports not implemented"']] },
    32: { goal: 'Verify combined filter behavior on reports.', checks: [['AND Logic', 'Combined filters use AND logic'], ['Clear All', 'Clearing filters shows unfiltered data']] },
    33: { goal: 'Verify exported files reflect applied filters.', checks: [['Filtered Export', 'Export contains only filtered data'], ['Filter Indication', 'Filters noted in export header']] },
    34: { goal: 'Verify multiple report types generate without errors.', checks: [['All Types', 'Each report type loads and generates'], ['Loading State', 'Loading indicators shown during generation'], ['Errors', 'Error messages appear if data unavailable']] },
    35: { goal: 'Verify Excel and PDF exports contain identical data.', checks: [['Same Data', 'Both formats contain same data'], ['Excel Sortable', 'Excel has sortable columns'], ['PDF Formatted', 'PDF has proper page breaks and formatting']] },
  };
  const s = reportScenarios[n] || { goal: `Verify ${scenario.toLowerCase()}.`, checks: [['Result', expected]] };
  return fmt(id, scenario, s.goal,
    ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel if applicable.'],
    ['Select the appropriate report category and type.', 'Apply filters as needed and generate the report.'],
    [], [],
    s.checks,
    ['Report loads without errors', 'Data is accurate and complete', 'Export functions work correctly', 'No UI errors during report generation'],
    ['Generate a report with no data in the selected range — verify empty state message.', 'Export a report while filters are applied — verify export reflects filters.', 'Test report generation across different user roles.']
  );
}

function genDASH(id, section, scenario, steps, testData, expected) {
  const n = parseInt(id.replace('DASH-', ''));
  const nav = NAV.dashboard;

  if (n >= 1 && n <= 4) {
    const layoutScenarios = {
      1: { goal: 'Verify the PMS Dashboard loads with all expected widgets, KPI tiles, and charts.', checks: [['Page Load', 'Dashboard loads with overview tiles, charts, and widgets'], ['KPIs', 'Overdue WOs, Completion Rate, Outstanding Tasks gauges visible'], ['Charts', 'Status Distribution donut chart and 6-Month Trend chart visible'], ['Inventory', 'Inventory Quick Stats (Total Spares, Low Stock, Critical Low Stock, etc.) visible']] },
      2: { goal: 'Verify vessel-specific dashboard data loads when selecting a vessel.', checks: [['Data Update', 'All tiles, charts, and widgets reflect the selected vessel'], ['Vessel Switch', 'Switching to a different vessel refreshes all data']] },
      3: { goal: 'Verify "All Vessels" view shows aggregated fleet data with benchmarking.', checks: [['Aggregated', 'Dashboard shows combined data across all vessels'], ['Fleet Table', 'Fleet Comparison — Vessel Benchmarking table appears on Management tab'], ['Drill Down', 'Clicking vessel name in fleet table drills down']] },
      4: { goal: 'Verify the overall dashboard layout organization.', checks: [['Column 1', 'Work Order KPIs (Overdue, Completion Rate, Outstanding)'], ['Column 2', 'Status Distribution chart, Trend chart, Overdue WOs table'], ['Column 3', 'Inventory stats, Stock Status chart, Vessel Analysis grid']] },
    };
    const s = layoutScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`],
      ['Select a vessel from the dropdown.', 'Observe all dashboard sections.'],
      [], [],
      s.checks,
      ['Dashboard loads without errors', 'All widgets render correctly', 'No blank or "undefined" values', 'Charts are interactive (hover shows tooltips)'],
      ['Refresh the page — verify dashboard reloads correctly.', 'Test on different screen sizes — verify responsive layout.']
    );
  }

  if (n >= 5 && n <= 22) {
    const widgetScenarios = {
      5: { goal: 'Verify the Overdue WOs KPI tile displays accurate count and percentage.', checks: [['Count', 'Shows correct number of overdue work orders'], ['Match', 'Matches Overdue tab count on Work Orders page'], ['Indicator', 'Red color indicator if overdue count > 0']] },
      6: { goal: 'Verify the Completion Rate KPI tile shows accurate percentage.', checks: [['Percentage', 'Shows percentage value'], ['Calculation', 'Rate = completed on time / total due × 100'], ['Gauge', 'Semi-circle gauge reflects the rate']] },
      7: { goal: 'Verify the Outstanding Tasks KPI tile displays accurate count.', checks: [['Count', 'Shows count of open/pending work orders'], ['Consistent', 'Count matches Work Orders page data']] },
      8: { goal: 'Verify the Status Distribution donut chart displays correct proportions.', checks: [['Slices', 'Shows: Overdue, Due, Pending Approval, Completed, Planned'], ['Proportional', 'Slice sizes match actual counts'], ['Legend', 'Legend visible identifying each slice']] },
      9: { goal: 'Verify clicking a pie chart segment navigates to filtered Work Orders page.', checks: [['Navigation', 'Clicking navigates to Work Orders page'], ['Filter', 'Correct status tab is pre-selected']] },
      10: { goal: 'Verify pie chart tooltip shows exact count and percentage on hover.', checks: [['Tooltip', 'Tooltip shows count and percentage'], ['Accurate', 'Values match actual data'], ['Positioned', 'Tooltip positioned correctly']] },
      11: { goal: 'Verify the 6-Month Maintenance Trend chart displays historical data.', checks: [['Lines', 'Shows Completed %, Outstanding %, Overdue % lines'], ['Monthly', 'Each month has a data point'], ['Labels', 'X-axis shows month labels, Y-axis shows percentages']] },
      12: { goal: 'Verify trend chart tooltip shows exact values on hover.', checks: [['Tooltip', 'Shows exact value for the hovered month'], ['Formatted', 'Values formatted correctly (counts as integers, rates as %)'], ['Accurate', 'Matches actual monthly data']] },
      13: { goal: 'Verify the Top Overdue WOs widget lists the most overdue items.', checks: [['Listed', 'Most overdue work orders shown'], ['Details', 'Each shows: WO number, equipment, "Overdue" badge'], ['Sorted', 'Sorted by days/hours overdue (most urgent first)']] },
      14: { goal: 'Verify clicking a WO in the overdue widget navigates to its detail page.', checks: [['Navigation', 'Navigates to Work Order detail page'], ['Correct WO', 'The correct work order is displayed'], ['Back', 'Back button returns to Dashboard']] },
      15: { goal: 'Verify "View All" link in overdue widget navigates to full overdue list.', checks: [['Navigation', 'Navigates to Work Orders page'], ['Overdue Tab', 'Overdue tab is pre-selected']] },
      16: { goal: 'Verify "Total Spares" count tile in Inventory Quick Stats.', checks: [['Count', 'Shows total number of spare parts'], ['Match', 'Matches Spares page total']] },
      17: { goal: 'Verify "Low Stock" count tile.', checks: [['Count', 'Shows spares where ROB <= Min Stock'], ['Match', 'Matches actual low stock count on Spares page'], ['Warning', 'Warning color (amber/red) if low stock items exist']] },
      18: { goal: 'Verify "Critical Low Stock" count tile.', checks: [['Count', 'Shows critical spares that are also below minimum'], ['Subset', 'This is a subset of Low Stock count'], ['Urgent', 'Urgent styling if critical low stock items exist']] },
      19: { goal: 'Verify "Total Components" count tile.', checks: [['Count', 'Shows total components for selected vessel'], ['Match', 'Matches Components page total']] },
      20: { goal: 'Verify "Stores Inventory" count tile.', checks: [['Count', 'Shows total store items'], ['Match', 'Matches Stores page total']] },
      21: { goal: 'Verify the Spares Stock Status donut chart.', checks: [['Segments', 'Shows: Adequate, Low Stock, Critical Low Stock'], ['Colors', 'Distinct colors for each segment'], ['Legend', 'Legend visible']] },
      22: { goal: 'Verify clicking Stock Status chart navigates to filtered Spares page.', checks: [['Navigation', 'Clicking segment navigates to Spares page'], ['Filter', 'Spares filtered by clicked stock status']] },
    };
    const s = widgetScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`, 'Select a vessel.'],
      ['Locate the relevant widget/tile/chart on the Dashboard.', 'Interact with it (hover, click) as needed.'],
      [], [],
      s.checks,
      ['Widget displays accurate data', 'No "NaN" or "undefined" values', 'Interactive elements work smoothly', 'Data matches other module pages'],
      ['Switch vessels — verify widget updates.', 'Verify widget with zero data — check for proper empty/zero state display.']
    );
  }

  if (n >= 23 && n <= 35) {
    const advancedScenarios = {
      23: { goal: 'Verify the Watch List widget displays monitored items.', checks: [['Display', 'Shows items marked for monitoring with Overdue/Critical badges'], ['Visibility', 'Document if not visible — note "Watch List not visible" in Comments']] },
      24: { goal: 'Verify the Superintendent Notifications tile shows pending actions count.', checks: [['Count', 'Shows count of pending superintendent actions'], ['Match', 'Matches Superintendent page data']] },
      25: { goal: 'Verify clicking Superintendent tile navigates to the Superintendent page.', checks: [['Navigation', 'Navigates to Superintendent Notifications page'], ['Pending', 'Pending items displayed']] },
      26: { goal: 'Verify the Compliance Anomaly Detection panel is visible for Sail Admin.', checks: [['Visible', 'Panel visible with categories: Cycle Skip Rate, Backdating Frequency, Bulk Completion Events, Schedule Drift'], ['Severity', 'Each category has count and severity indicator (Good/Warning/Alert)'], ['Expandable', 'Individual anomaly entries can be expanded']] },
      27: { goal: 'Verify the Anomaly Detection panel is NOT visible for non-Sail Admin users.', checks: [['Non-Admin', 'Panel NOT visible for Client Admin, Vessel User, Head of Dept'], ['Admin', 'Panel IS visible for Sail Admin']] },
      28: { goal: 'Verify the "Cycle Skip Rate" anomaly card.', checks: [['Percentage', 'Shows percentage/count of jobs with skipped cycles'], ['Details', 'Clicking shows which jobs/components have skipped cycles'], ['Accuracy', 'Rate is calculated accurately']] },
      29: { goal: 'Verify the "Backdating Frequency" anomaly card.', checks: [['Count', 'Shows count of backdated WOs'], ['Details', 'Each backdated WO listed with backdating amount'], ['Accuracy', 'Count is accurate']] },
      30: { goal: 'Verify the "Bulk Completion Events" anomaly card.', checks: [['Detection', 'Flags dates with unusually high WO completions'], ['Details', 'Shows specific dates and WO counts'], ['Threshold', 'Threshold is reasonable (e.g., 5+ WOs same day)']] },
      31: { goal: 'Verify the "Schedule Drift" anomaly card.', checks: [['Detection', 'Identifies jobs consistently completed early or late'], ['Details', 'Shows average drift amount'], ['Both Directions', 'Both early and late drift detected']] },
      32: { goal: 'Verify the Work Order Anomalies tile with severity badges.', checks: [['Tile', 'Shows total anomaly count'], ['Badges', 'HIGH, MED, LOW severity badges visible'], ['Click', 'Clicking scrolls to or navigates to anomaly panel']] },
      33: { goal: 'Verify anomaly tile is NOT visible for non-Sail Admin users.', checks: [['Non-Admin', 'Anomaly tile NOT visible'], ['Admin', 'Tile IS visible for Sail Admin']] },
      34: { goal: 'Verify severity filter dropdown in Anomaly panel.', checks: [['High', 'Only high-severity anomalies shown'], ['Medium', 'Only medium-severity shown'], ['All', 'All anomalies shown when "All" selected']] },
      35: { goal: 'Verify Refresh button in Anomaly panel.', checks: [['Loading', 'Loading indicator appears during refresh'], ['Updated', 'Data refreshes with new anomalies'], ['No Errors', 'Refresh completes without errors']] },
    };
    const s = advancedScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS (as Sail Admin for anomaly-related tests).', `Navigate to ${nav}.`],
      ['Locate the relevant widget/panel.', 'Interact with it as described.'],
      [], [],
      s.checks,
      ['Data is accurate and consistent', 'Role-based visibility works correctly', 'No UI errors', 'Interactive elements respond properly'],
      ['Log in as different user roles — verify role-based visibility.', 'Test with vessels that have no anomalies — verify clean state.']
    );
  }

  if (n >= 36 && n <= 52) {
    const systemScenarios = {
      36: { goal: 'Verify vessel filter updates all dashboard sections.', checks: [['All Updated', 'All tiles, charts, and widgets update for selected vessel'], ['All Vessels', 'Aggregated data shown for "All Vessels"']] },
      37: { goal: 'Verify "Clear Filters" resets all dashboard filters.', checks: [['Reset', 'All filters reset to defaults'], ['Default View', 'Dashboard shows default view']] },
      38: { goal: 'Verify year selector functionality (if available).', checks: [['Year Change', 'Data updates to reflect selected year'], ['Availability', 'If not available, note "Year selector not present"']] },
      39: { goal: 'Verify notification bell icon and badge in the header.', checks: [['Bell Icon', 'Notification bell visible in header'], ['Badge', 'Unread count badge appears if notifications exist'], ['Availability', 'If no bell, note "Notification bell not implemented"']] },
      40: { goal: 'Verify notification panel opens and displays notifications.', checks: [['Panel Opens', 'Notification dropdown opens on click'], ['Listed', 'Recent notifications listed with title, description, timestamp'], ['Close', 'Panel closes on click outside']] },
      41: { goal: 'Verify different notification types are displayed.', checks: [['Types', 'Different types: WO approvals, overdue alerts, stock warnings'], ['Distinct', 'Each type has distinct icon or color']] },
      42: { goal: 'Verify mark-as-read functionality for notifications.', checks: [['Read', 'Notification visual changes (no longer bold)'], ['Count', 'Unread count badge decreases'], ['Persist', 'Read status persists after refresh']] },
      43: { goal: 'Verify user profile dropdown displays correct user information.', checks: [['Opens', 'Profile dropdown opens on click'], ['Info', 'Shows: user name, role, email'], ['Role', 'Displayed role matches actual role']] },
      44: { goal: 'Verify logout functionality.', checks: [['Redirect', 'Redirected to login page'], ['Protected', 'Cannot access protected pages after logout'], ['Re-login', 'Logging back in works correctly']] },
      45: { goal: 'Verify desktop layout (1920px+) utilizes full width.', checks: [['Full Width', 'Layout uses full width'], ['KPI Row', 'KPI tiles in a row'], ['Charts', 'Charts display at full size']] },
      46: { goal: 'Verify tablet layout (~768px) adapts correctly.', checks: [['Adapt', 'Layout adapts — tiles may stack'], ['Charts', 'Charts resize to fit'], ['No Scroll', 'No horizontal scrolling needed']] },
      47: { goal: 'Verify mobile layout (~375px) is fully functional.', checks: [['Stack', 'Content stacks vertically'], ['Readable', 'All tiles and charts readable'], ['Navigation', 'Sidebar collapses to hamburger menu'], ['Touch', 'Touch targets adequately sized']] },
      48: { goal: 'Verify graceful error handling on network disconnection.', checks: [['Error Message', 'Appropriate error message shown (e.g., "Unable to load data")'], ['No Crash', 'Page does not crash'], ['Recovery', 'Dashboard loads normally after reconnection']] },
      49: { goal: 'Verify session timeout handling.', checks: [['Redirect', 'Redirected to login page on timeout'], ['Message', '"Session expired" message shown']] },
      50: { goal: 'Verify role-based data visibility.', checks: [['Vessel User', 'Sees vessel-specific data only'], ['Client Admin', 'Sees data for assigned company vessels'], ['Sail Admin', 'Sees all data including anomaly detection']] },
      51: { goal: 'Verify AI chatbot is accessible for Sail Admin users.', checks: [['Button', 'Chat button (message icon) visible in bottom-right for Sail Admin'], ['Panel', 'Chat panel opens when clicked'], ['Responds', 'AI responds to queries']] },
      52: { goal: 'Verify chatbot is NOT visible for non-Sail Admin users.', checks: [['Non-Admin', 'Chat button NOT visible'], ['Admin', 'Chat button IS visible for Sail Admin']] },
    };
    const s = systemScenarios[n];
    return fmt(id, scenario, s.goal,
      ['Log in to RSMS.', `Navigate to ${nav}.`],
      ['Perform the actions relevant to this test scenario.'], [], [],
      s.checks,
      ['No UI errors or console errors', 'Correct behavior across user roles', 'Responsive layout works', 'Data is accurate'],
      ['Test across different browsers and screen sizes.', 'Verify behavior with slow network connection.', 'Test role-based features by switching user accounts.']
    );
  }

  return buildGeneric(id, scenario, section, steps, testData, expected);
}

function buildGeneric(id, scenario, section, steps, testData, expected) {
  const stepsArr = (steps || '').split(/\d+\.\s*/).filter(s => s.trim());
  const setupSteps = ['Log in to RSMS.', `Navigate to the ${section || 'relevant'} module from the sidebar.`, 'Select a vessel if applicable.'];
  const actionSteps = stepsArr.length > 0 ? stepsArr.slice(0, 2).map(s => s.trim()) : ['Perform the action described in the test scenario.'];
  const intermediateSteps = stepsArr.length > 2 ? stepsArr.slice(2, 4).map(s => s.trim()) : [];
  const expectedArr = (expected || '').split(/\.\s*/).filter(e => e.trim()).slice(0, 4);
  const checks = expectedArr.length > 0 ? expectedArr.map((e, i) => [`Check ${i+1}`, e.trim()]) : [['Result', expected || 'Expected behavior is observed']];

  return fmt(id, scenario,
    `Verify that ${(scenario || 'the feature').toLowerCase()} works as expected.`,
    setupSteps, actionSteps, intermediateSteps, [],
    checks,
    ['No UI errors or console errors during the test', 'All data displays correctly without "undefined" or "null"', 'Smooth navigation and transitions', 'Changes persist after page refresh'],
    ['Try the action with unexpected input — verify graceful error handling.', 'Test with different user roles to verify access control.', 'Use browser back button — verify state is handled correctly.']
  );
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(INPUT_FILE);

  let totalProcessed = 0;

  for (const ws of wb.worksheets) {
    if (ws.name === 'Summary') continue;

    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = cell.value;
    });

    if (headers.length === 0) continue;

    const headerStyle = JSON.parse(JSON.stringify(headerRow.getCell(1).style));

    const colM = 13;
    const headerCell = headerRow.getCell(colM);
    headerCell.value = 'How to Test';
    headerCell.style = headerStyle;

    const rowCount = ws.rowCount;
    for (let r = 2; r <= rowCount; r++) {
      const row = ws.getRow(r);
      const testCase = {};
      headers.forEach((h, colIdx) => {
        if (h) {
          const cell = row.getCell(colIdx);
          testCase[h] = cell.value != null ? String(cell.value) : '';
        }
      });

      if (!testCase['Test Case ID']) continue;

      const howToTest = generateStructuredHowToTest(testCase);
      const cell = row.getCell(colM);
      cell.value = howToTest;
      cell.alignment = { wrapText: true, vertical: 'top' };
      totalProcessed++;
    }

    ws.getColumn(colM).width = 90;
  }

  await wb.xlsx.writeFile(OUTPUT_FILE);
  console.log(`SUCCESS: Generated structured How-to-Test instructions for ${totalProcessed} test cases.`);
  console.log(`Output file: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
