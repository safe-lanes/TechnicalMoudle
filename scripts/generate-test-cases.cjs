const ExcelJS = require('exceljs');
const path = require('path');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
const DATA_FONT = { name: 'Arial', size: 10 };
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
};

const COLUMNS = [
  { header: 'TEST CASE ID', key: 'id', width: 15 },
  { header: 'MODULE/SECTION', key: 'section', width: 20 },
  { header: 'TEST SCENARIO', key: 'scenario', width: 35 },
  { header: 'PRIORITY', key: 'priority', width: 10 },
  { header: 'TEST STEPS', key: 'steps', width: 50 },
  { header: 'TEST DATA', key: 'testData', width: 30 },
  { header: 'EXPECTED RESULT', key: 'expected', width: 40 },
  { header: 'ACTUAL RESULT', key: 'actual', width: 40 },
  { header: 'PASS/FAIL', key: 'passFail', width: 10 },
  { header: 'COMMENTS/ISSUES', key: 'comments', width: 30 },
  { header: 'TESTER NAME', key: 'tester', width: 15 },
  { header: 'TEST DATE', key: 'testDate', width: 12 },
];

function tc(id, section, scenario, priority, steps, testData, expected) {
  return { id, section, scenario, priority, steps, testData, expected, actual: '', passFail: '', comments: '', tester: '', testDate: '' };
}

// ── COMPONENTS MODULE ──
const componentsData = [
  tc('COMP-001','Component List','View all components list','High','1. Navigate to Components module from sidebar\n2. Verify the component list page loads\n3. Check that components are displayed in a table format\n4. Verify column headers are visible','Navigate to /components','Component list page loads with all components displayed in table format with columns: Code, Name, Department, Maintenance Basis, Criticality, Status'),
  tc('COMP-002','Component List','Pagination - 10 items per page','Medium','1. Navigate to Components list\n2. Select "10" from items per page dropdown\n3. Verify only 10 items are displayed\n4. Navigate to next page','Items per page: 10','Only 10 components displayed per page. Pagination controls show correct page count. Next/Previous buttons work correctly'),
  tc('COMP-003','Component List','Pagination - 25 items per page','Medium','1. Navigate to Components list\n2. Select "25" from items per page dropdown\n3. Verify 25 items displayed','Items per page: 25','25 components displayed per page'),
  tc('COMP-004','Component List','Pagination - 50 items per page','Low','1. Navigate to Components list\n2. Select "50" from items per page dropdown','Items per page: 50','50 components displayed per page'),
  tc('COMP-005','Component List','Pagination - 100 items per page','Low','1. Navigate to Components list\n2. Select "100" from items per page dropdown','Items per page: 100','100 components displayed per page'),
  tc('COMP-006','Component List','Sorting by component code','Medium','1. Navigate to Components list\n2. Click on "Code" column header\n3. Verify ascending sort\n4. Click again for descending sort','Click Code column header','Components sort alphabetically by code ascending, then descending on second click'),
  tc('COMP-007','Component List','Sorting by component name','Medium','1. Navigate to Components list\n2. Click "Name" column header\n3. Verify ascending/descending toggle','Click Name column header','Components sort by name ascending/descending'),
  tc('COMP-008','Component List','Search by component code','High','1. Navigate to Components list\n2. Enter a known component code in search field\n3. Verify filtered results','Search: "ME" or known code','Only components matching the search term are displayed. Results update as user types'),
  tc('COMP-009','Component List','Search by component name','High','1. Navigate to Components list\n2. Enter component name in search\n3. Verify results filter','Search: "Main Engine" or known name','Only matching components displayed'),
  tc('COMP-010','Component List','Filter by vessel','High','1. Navigate to Components list\n2. Select a vessel from vessel dropdown\n3. Verify components filter by selected vessel','Select: Vessel 3','Only components for selected vessel are shown. Component count updates'),
  tc('COMP-011','Component List','Filter by maintenance basis','Medium','1. Navigate to Components list\n2. Filter by Calendar maintenance basis\n3. Then filter by Running Hours','Filter: Calendar, then Running Hours','Components filter correctly by maintenance basis type'),
  tc('COMP-012','Component List','Component count display','Medium','1. Navigate to Components list\n2. Verify total component count is displayed\n3. Apply filters and verify count updates','N/A','Total component count displayed and updates when filters are applied'),
  tc('COMP-013','Component List','Responsive layout','Low','1. View Components list on desktop (1920px)\n2. Resize browser to tablet (768px)\n3. Resize to mobile (375px)','Various screen sizes','Layout adjusts appropriately. Table scrolls horizontally on small screens. No overlapping elements'),
  tc('COMP-014','Add Component','Navigate to Add Component page','High','1. Click "Add Component" button from Components list\n2. Verify Add Component form opens','Click Add Component button','Add Component form opens with all fields empty and ready for input'),
  tc('COMP-015','Add Component','Submit with all mandatory fields','High','1. Fill in Component Code\n2. Fill in Component Name\n3. Select Maintenance Basis\n4. Select Department\n5. Select Criticality\n6. Click Save','Code: TEST-COMP-001\nName: Test Component\nBasis: Calendar\nDept: Engine\nCriticality: High','Component created successfully. Success toast message displayed. Redirected to components list. New component visible in list'),
  tc('COMP-016','Add Component','Submit with empty mandatory fields','High','1. Leave all fields empty\n2. Click Save button','All fields empty','Error messages shown for each mandatory field. Form does not submit. Fields highlighted in red'),
  tc('COMP-017','Add Component','Component code format validation','High','1. Enter code with special characters (!@#$%)\n2. Try to save','Code: "TEST!@#$"','Error: Component code cannot contain special characters'),
  tc('COMP-018','Add Component','Duplicate component code','High','1. Enter a component code that already exists\n2. Fill other required fields\n3. Click Save','Code: [existing code]','Error: "Component code already exists" or similar duplicate prevention message'),
  tc('COMP-019','Add Component','Component name min/max length','Medium','1. Enter name with 1 character\n2. Try to save\n3. Enter name with 500+ characters\n4. Try to save','Name: "A" (too short)\nName: [500+ chars] (too long)','Validation error for names that are too short or too long'),
  tc('COMP-020','Add Component','Maintenance basis - Calendar','High','1. Select "Calendar" radio button\n2. Verify Calendar-specific fields appear\n3. Verify Running Hours fields are hidden','Select: Calendar','Calendar maintenance basis selected. Running hours initial value field is hidden or disabled'),
  tc('COMP-021','Add Component','Maintenance basis - Running Hours','High','1. Select "Running Hours" radio button\n2. Verify RH-specific fields appear\n3. Enter initial running hours value','Select: Running Hours\nInitial RH: 500','Running Hours basis selected. Initial RH value field becomes visible and mandatory'),
  tc('COMP-022','Add Component','Class related checkbox','Medium','1. Check "Class Related" checkbox\n2. Save component\n3. Verify class related flag is saved','Check: Class Related','Component saved with class related flag set to true'),
  tc('COMP-023','Add Component','Department selection','Medium','1. Click Department dropdown\n2. Verify all departments listed\n3. Select a department','Select: Engine Department','Department dropdown shows all available departments. Selected department is saved correctly'),
  tc('COMP-024','Add Component','Criticality level selection','Medium','1. Click Criticality dropdown\n2. Verify levels: High, Medium, Low\n3. Select each level','Select: High, Medium, Low','All criticality levels available. Selected level saved correctly'),
  tc('COMP-025','Add Component','Save button functionality','High','1. Fill all required fields with valid data\n2. Click Save button\n3. Verify loading state during save','Valid component data','Save button shows loading state. Component is created. Success message displayed'),
  tc('COMP-026','Add Component','Cancel button functionality','Medium','1. Fill in some fields\n2. Click Cancel button\n3. Verify redirect without saving','Partial data entered','Form closed without saving. Redirected to components list. No new component created'),
  tc('COMP-027','Add Component','Success message display','Medium','1. Create a valid component\n2. Observe success notification','Valid component data','Green success toast/notification appears confirming component creation'),
  tc('COMP-028','Add Component','Redirect after save','Medium','1. Successfully save a new component\n2. Observe redirect behavior','Valid component data','After successful save, user is redirected to components list page'),
  tc('COMP-029','Edit Component','Open existing component for editing','High','1. Navigate to Components list\n2. Click Edit icon/button on a component\n3. Verify edit form opens','Select any existing component','Edit form opens with all fields pre-populated with current component data'),
  tc('COMP-030','Edit Component','Pre-populated form fields','High','1. Open a component for editing\n2. Verify all fields show current values','Existing component','All fields display the current component data: code, name, department, basis, criticality, class related status'),
  tc('COMP-031','Edit Component','Modify component name','Medium','1. Open component for editing\n2. Change the component name\n3. Save changes','New name: "Updated Component Name"','Component name updated successfully. Success message shown. Updated name visible in list'),
  tc('COMP-032','Edit Component','Save changes','High','1. Modify one or more fields\n2. Click Save\n3. Verify changes persist','Modified fields','Changes saved successfully. Toast confirmation displayed. Changes reflected in component list'),
  tc('COMP-033','Edit Component','Cancel changes','Medium','1. Modify fields\n2. Click Cancel\n3. Verify no changes saved','Modified fields, then cancel','Changes discarded. Original data remains unchanged in the list'),
  tc('COMP-034','Edit Component','Cannot change code if jobs exist','High','1. Open a component that has associated jobs\n2. Try to modify the component code\n3. Verify code field is disabled/read-only','Component with existing jobs','Component code field is disabled or read-only. Tooltip explains why code cannot be changed'),
  tc('COMP-035','Edit Component','Update confirmation message','Medium','1. Edit a component and save\n2. Observe confirmation message','Valid changes','Confirmation toast: "Component updated successfully" or similar'),
  tc('COMP-036','Delete Component','Delete component with no jobs','High','1. Find a component with no associated jobs\n2. Click Delete button\n3. Confirm deletion','Component with 0 jobs','Component deleted. Success message shown. Component removed from list'),
  tc('COMP-037','Delete Component','Delete component with active jobs','High','1. Find component with active work orders\n2. Click Delete\n3. Verify error','Component with active WOs','Error: "Cannot delete component with active jobs" or similar prevention message'),
  tc('COMP-038','Delete Component','Delete component with completed jobs','Medium','1. Find component with completed WOs\n2. Click Delete\n3. Verify behavior','Component with completed WOs','Error message preventing deletion OR warning about associated history'),
  tc('COMP-039','Delete Component','Delete confirmation dialog','Medium','1. Click Delete on any component\n2. Verify confirmation dialog appears\n3. Click Cancel','Any component','Confirmation dialog: "Are you sure you want to delete this component?" with Cancel and Confirm buttons'),
  tc('COMP-040','Delete Component','Cancel delete action','Medium','1. Click Delete on a component\n2. In confirmation dialog, click Cancel','Any component','Deletion cancelled. Component remains in the list unchanged'),
  tc('COMP-041','View Details','Click component to view details','High','1. Click on a component code/name link\n2. Verify detail page opens','Any component','Component detail page opens showing all component information'),
  tc('COMP-042','View Details','Display all component information','High','1. Open component detail page\n2. Verify all fields displayed','Any component','Shows: Code, Name, Department, Maintenance Basis, Criticality, Class Related, Associated Jobs, Status'),
  tc('COMP-043','View Details','Show associated jobs list','High','1. Open component detail page\n2. Scroll to jobs section','Component with jobs','All associated jobs displayed with Job Code, Title, Frequency, Next Due Date'),
  tc('COMP-044','View Details','Show maintenance history','Medium','1. Open component detail page\n2. View maintenance history section','Component with WO history','Maintenance history shows completed work orders with dates, performed by, and status'),
  tc('COMP-045','View Details','Navigation back to list','Medium','1. Open component detail page\n2. Click Back/breadcrumb to return to list','N/A','User navigated back to components list. List state preserved (filters, page)'),
  tc('COMP-046','Component-Job','Add job to component','High','1. Open component detail page\n2. Click Add Job button\n3. Fill job details\n4. Save','Job Title: Test Job\nFrequency: Monthly','Job added to component successfully. Job appears in associated jobs list'),
  tc('COMP-047','Component-Job','View all jobs for component','Medium','1. Open component with multiple jobs\n2. View jobs section','Component with 3+ jobs','All associated jobs listed with details: Code, Title, Frequency, Next Due Date'),
  tc('COMP-048','Component-Job','Job frequency configuration','High','1. Add or edit a job\n2. Set frequency type and value\n3. Save','Frequency: 3 Months\nBasis: Calendar','Frequency saved correctly. Next due date calculated based on frequency'),
  tc('COMP-049','Edge Cases','Very long component name','Low','1. Create component with 200+ character name\n2. Save and view in list','Name: [200+ characters]','Name saved. Displayed with ellipsis/truncation in list view. Full name shown on hover or detail page'),
  tc('COMP-050','Edge Cases','Special characters in name','Low','1. Create component with special chars in name\n2. Save and verify','Name: "ME 1/2 (Port) — Main"','Component saved with special characters intact. Displayed correctly'),
];

// ── WORK ORDERS MODULE ──
const workOrdersData = [
  tc('WO-001','WO List & Filtering','View all work orders','High','1. Navigate to Work Orders from sidebar\n2. Verify WO list page loads\n3. Check table columns visible','Navigate to /pms/work-orders','Work Orders page loads. Table displays: Component, Work Order No, Job Title, Assigned to, Due Date, Status, Actions'),
  tc('WO-002','WO List & Filtering','Filter by Planned status tab','High','1. Click "Planned" status tab\n2. Verify count badge\n3. Verify filtered results','Click: Planned tab','Only Planned work orders displayed. Count badge matches number of results. Blue status badges shown'),
  tc('WO-003','WO List & Filtering','Filter by Due status tab','High','1. Click "Due" status tab\n2. Verify count and results','Click: Due tab','Only Due work orders shown. Orange status badges. Count matches results'),
  tc('WO-004','WO List & Filtering','Filter by Overdue status tab','High','1. Click "Overdue" status tab\n2. Verify count and results','Click: Overdue tab','Only Overdue work orders shown. Red status badges. Count matches results'),
  tc('WO-005','WO List & Filtering','Filter by Pending Approval tab','High','1. Click "Pending Approval" tab\n2. Verify count and results','Click: Pending Approval tab','Only Pending Approval work orders shown. Count matches'),
  tc('WO-006','WO List & Filtering','Filter by Completed tab','High','1. Click "Completed" tab\n2. Verify count and results','Click: Completed tab','Only Completed work orders shown with completion dates'),
  tc('WO-007','WO List & Filtering','Count badges on tabs','High','1. View all status tabs\n2. Verify each has a count badge\n3. Sum of all counts = total WOs','N/A','Each tab shows accurate count badge. Counts reflect actual number of WOs in each status'),
  tc('WO-008','WO List & Filtering','Vessel filter dropdown','High','1. Select vessel from dropdown\n2. Verify WO list filters by vessel','Select: Vessel 3','Only work orders for selected vessel shown. All counts and tabs update'),
  tc('WO-009','WO List & Filtering','Period filter','Medium','1. Select "This Month" from Period dropdown\n2. Then select "Last Month"\n3. Then "This Quarter"','Period: This Month, Last Month, This Quarter','Work orders filtered by selected period. Results show only WOs with due dates in selected range'),
  tc('WO-010','WO List & Filtering','Rank filter','Medium','1. Select "All Ranks" from rank filter\n2. Then select "3rd Engineer"\n3. Then "Chief Engineer"','Rank: 3rd Engineer','Work orders filtered by assigned rank'),
  tc('WO-011','WO List & Filtering','Criticality filter','Medium','1. Select a criticality level from filter\n2. Verify filtered results','Criticality: High','Only work orders with selected criticality shown'),
  tc('WO-012','WO List & Filtering','Combine multiple filters','High','1. Select Vessel + Period + Rank filters together\n2. Verify combined filtering','Vessel: Vessel 3\nPeriod: This Month\nRank: Chief Engineer','Filters combine correctly. Only WOs matching ALL criteria shown'),
  tc('WO-013','WO List & Filtering','Clear all filters button','Medium','1. Apply multiple filters\n2. Click "Clear" button\n3. Verify all filters reset','Click: Clear button','All filters reset to defaults. Full unfiltered WO list shown'),
  tc('WO-014','WO List & Filtering','Search by work order code','High','1. Enter WO code in search field\n2. Verify results','Search: "MKR-OV-00025"','Only matching work orders displayed. Search is case-insensitive'),
  tc('WO-015','WO List & Filtering','Search by component name','High','1. Enter component name in search\n2. Verify results','Search: "pistons"','Work orders for matching components displayed'),
  tc('WO-016','WO List & Filtering','Search by job title','Medium','1. Enter job title keywords in search\n2. Verify results','Search: "Overhaul"','Work orders with matching job titles displayed'),
  tc('WO-017','WO List & Filtering','Pagination','Medium','1. Navigate through pages using Next/Previous\n2. Verify page numbers update\n3. Go to last page','Click: Next, Previous, page numbers','Pagination works correctly. Page numbers update. Items per page respected'),
  tc('WO-018','WO List & Filtering','Sorting by columns','Medium','1. Click Component column header\n2. Click Due Date column header\n3. Verify sort direction toggles','Click column headers','Columns sort ascending on first click, descending on second. Sort indicator shown'),
  tc('WO-019','WO List & Filtering','Export to Excel (Sail Admin only)','High','1. Login as Sail Admin\n2. Click Export button\n3. Select "Export All Work Orders"\n4. Click Excel button','Click: Export > Excel','Excel file downloads with all work orders data. File contains correct columns and data'),
  tc('WO-020','WO List & Filtering','Export to PDF (Sail Admin only)','High','1. Login as Sail Admin\n2. Click Export button\n3. Select "Export All Work Orders"\n4. Click PDF button','Click: Export > PDF','PDF file downloads with formatted work orders report'),
  tc('WO-021','WO List & Filtering','Export Distributed Jobs Excel','Medium','1. Click Export button\n2. Select "Export All Distributed Jobs"\n3. Click Excel','Click: Export > Distributed Jobs > Excel','Excel file with crew workload distribution data downloads'),
  tc('WO-022','WO List & Filtering','Export Distributed Jobs PDF','Medium','1. Click Export button\n2. Select "Export All Distributed Jobs"\n3. Click PDF','Click: Export > Distributed Jobs > PDF','PDF file with distributed jobs report downloads'),
  tc('WO-023','WO List & Filtering','Export button hidden for non-Sail Admin','High','1. Login as Client Admin or other non-Sail Admin role\n2. Navigate to Work Orders\n3. Look for Export button','Login as: Client Admin','Export button is NOT visible. No way to access export functionality'),
  tc('WO-024','WO List & Filtering','Status badge colors','Medium','1. View WO list with mixed statuses\n2. Verify color coding','N/A','Overdue: Red badge, Due: Orange badge, Planned: Blue badge, Completed: Green badge, Pending Approval: Yellow badge'),
  tc('WO-025','WO List & Filtering','Work order count display','Medium','1. View total count at bottom of list\n2. Apply filters and verify count updates','N/A','Shows "Showing X of Y work orders". Count updates with filters'),
  tc('WO-026','Create Work Order','Navigate to Create WO page','High','1. Click "+ Unplanned W.O" button\n2. Verify create form opens','Click: + Unplanned W.O','Create Work Order form opens with empty fields'),
  tc('WO-027','Create Work Order','Select component','High','1. Open Create WO form\n2. Click component dropdown\n3. Select a component','Select: "ME 1 AE crankcase doors"','Component selected. Related fields may auto-populate'),
  tc('WO-028','Create Work Order','Select job filtered by component','High','1. Select a component\n2. Click job dropdown\n3. Verify jobs filtered for selected component','Component: [selected]\nJob: [from dropdown]','Only jobs associated with selected component shown in dropdown'),
  tc('WO-029','Create Work Order','Auto-population of fields','Medium','1. Select component and job\n2. Verify auto-populated fields','Select component and job','Frequency, maintenance basis, criticality auto-populate from job/component configuration'),
  tc('WO-030','Create Work Order','Validation of required fields','High','1. Leave all fields empty\n2. Click Save/Create\n3. Verify error messages','All fields empty','Validation errors shown for required fields. Form does not submit'),
  tc('WO-031','Create Work Order','Work order code generation','Medium','1. Create a valid work order\n2. Verify auto-generated WO code','Valid WO data','Work order code auto-generated in format MKR-XX-XXXXX-XXX.XXX.XX-YYYY-XXX'),
  tc('WO-032','View WO Details','Click work order to view','High','1. Click on a work order code link\n2. Verify detail page opens','Click any WO code','Work Order detail page opens showing Part A (Job Details) and Part B (Completion) sections'),
  tc('WO-033','View WO Details','Display Part A - Job Details','High','1. Open work order detail page\n2. Verify Part A section','Any work order','Part A shows: Component, Job Title, Frequency, Due Date, Assigned To, Maintenance Basis, Work Order No'),
  tc('WO-034','View WO Details','Display Part B - Completion','High','1. Open active work order\n2. Verify Part B completion section','Active work order','Part B shows: B1 (Safety), B2 (Work Details), B3 (Running Hours if RH-based), B4 (Spare Parts)'),
  tc('WO-035','View WO Details','Display work history (A4)','Medium','1. Open work order\n2. Scroll to Work History section (A4)\n3. Verify previous completions shown','WO with history','Previous work completions shown with dates, performed by. Last 2 entries shown by default, expandable'),
  tc('WO-036','Edit WO','Edit planned work order','High','1. Open a Planned status WO\n2. Modify editable fields\n3. Save changes','Planned WO','Fields can be edited. Changes saved successfully'),
  tc('WO-037','Edit WO','Cannot modify completed WO','High','1. Open a Completed work order\n2. Try to edit Part B fields','Completed WO','All Part B fields are disabled/read-only. Cannot modify completed work orders'),
  tc('WO-038','Edit WO','Cannot modify Pending Approval WO','High','1. Open a Pending Approval work order\n2. Try to edit Part B fields','Pending Approval WO','All Part B fields disabled. Must be rejected before re-editing'),
  tc('WO-039','Completion - Part B2','Fill start date','High','1. Open active WO for completion\n2. Enter start date in B2 section\n3. Verify date validation','Start Date: 10-Mar-2026','Start date accepted. Cannot be future date. Cannot be before WO creation date'),
  tc('WO-040','Completion - Part B2','Fill start time','High','1. Enter start time in HH:MM format\n2. Verify format validation','Start Time: 08:30','Time accepted in 24-hour HH:MM format. Invalid formats rejected'),
  tc('WO-041','Completion - Part B2','Fill completion date','High','1. Enter completion date\n2. Verify >= start date\n3. Verify not future date','Completion Date: 11-Mar-2026','Completion date accepted. Must be >= start date. Cannot be future date'),
  tc('WO-042','Completion - Part B2','Fill completion time','High','1. Enter completion time\n2. If same day as start, must be >= start time','Completion Time: 14:00','Time accepted. If same day, must be after start time'),
  tc('WO-043','Completion - Part B2','Performed by rank selection','High','1. Select rank from Performed By dropdown','Select: 4th Engineer','Rank selected from dropdown. Field is mandatory'),
  tc('WO-044','Completion - Part B2','Number of persons in team','High','1. Enter number of persons\n2. Verify must be positive integer >= 1\n3. Try decimal/negative','Persons: 3\nInvalid: 0, -1, 2.5','Accepts positive integers 1-50. Rejects 0, negatives, decimals'),
  tc('WO-045','Completion - Part B2','Auto-calculate total time','Medium','1. Enter start date/time and completion date/time\n2. Verify total time calculated','Start: 10-Mar 08:00\nEnd: 11-Mar 14:00','Total time auto-calculated: 30 hours'),
  tc('WO-046','Completion - Part B2','Auto-calculate manhours','Medium','1. Enter total time and number of persons\n2. Verify manhours = time × persons','Total Time: 10 hrs\nPersons: 3','Manhours auto-calculated: 30. Field is read-only'),
  tc('WO-047','Completion - Part B2','Work carried out - mandatory','High','1. Leave "Work Carried Out" empty\n2. Try to save\n3. Enter text with < 20 chars','Empty / "short text"','Error: minimum 20 characters required. Cannot save with empty or short description'),
  tc('WO-048','Completion - Part B2','Work carried out - max 2000 chars','Medium','1. Enter text exceeding 2000 characters\n2. Verify character counter\n3. Verify limit enforced','2001+ character text','Character counter shows current/max count. Text truncated at 2000 characters'),
  tc('WO-049','Completion - Part B2','Character counter display','Medium','1. Type in Work Carried Out field\n2. Observe character counter','Type progressive text','Counter updates in real-time: "245 / 2000"'),
  tc('WO-050','Completion - Part B2','Due date display in B2','Medium','1. Open calendar-based WO\n2. Check B2.1 header area for due date','Calendar-based WO with due date','Read-only due date label visible: "Due Date: DD-MMM-YYYY"'),
  tc('WO-051','Completion - Part B1','Risk assessment - Yes','High','1. Select "Yes" for Risk Assessment\n2. Upload supporting document\n3. Save','Select: Yes\nUpload: test.pdf','Risk assessment marked Yes. Document upload required and accepted'),
  tc('WO-052','Completion - Part B1','Risk assessment - No (block)','High','1. Select "No" for Risk Assessment\n2. Try to save','Select: No','Save blocked. Safety Warning toast: "Risk Assessment must be completed (Yes) or marked NA"'),
  tc('WO-053','Completion - Part B1','Risk assessment - NA','Medium','1. Select "NA" for Risk Assessment\n2. Save without document','Select: NA','Save allowed. No document required for NA selection'),
  tc('WO-054','Completion - Part B1','Yes without document upload','High','1. Select "Yes" for any B1 item\n2. Do NOT upload a document\n3. Try to save','Select: Yes, no upload','Error: "Supporting document required when marked Yes"'),
  tc('WO-055','Completion - Part B1','Safety checklists - Yes with doc','High','1. Select "Yes" for Safety Checklists\n2. Upload document\n3. Save','Select: Yes\nUpload: checklist.pdf','Safety checklist document uploaded successfully'),
  tc('WO-056','Completion - Part B1','Operational forms - Yes with doc','High','1. Select "Yes" for Operational Forms\n2. Upload document','Select: Yes\nUpload: form.pdf','Operational form document uploaded successfully'),
  tc('WO-057','Completion - Part B1','Attachment limit 5 per section','Medium','1. Upload 5 files to one B1 section\n2. Try to upload 6th file','Upload 6 files','First 5 accepted. 6th file rejected with error: "Maximum 5 files per section"'),
  tc('WO-058','Completion - Part B2','Spare parts consumed - add row','High','1. In B4 section, click Add spare part\n2. Search for spare\n3. Enter quantity\n4. Select location','Spare: [autocomplete]\nQty: 2\nLocation: Engine Room','Spare part row added. Autocomplete works. Quantity and location saved'),
  tc('WO-059','Completion - Part B2','Spare part quantity validation','High','1. Enter non-numeric qty\n2. Enter 0 qty\n3. Enter negative qty\n4. Enter decimal qty','Qty: "abc", 0, -1, 2.5','Only positive integers >= 1 accepted. All invalid inputs show error'),
  tc('WO-060','Completion - Part B2','Spare part location mandatory','High','1. Add spare with qty > 0\n2. Leave location empty\n3. Try to save','Spare with qty but no location','Error: "Location is required for spare parts with quantity > 0"'),
  tc('WO-061','Completion - Part B2','Remove spare part row','Medium','1. Add a spare part row\n2. Click remove/delete button on that row','Click remove on spare row','Spare part row removed from list'),
  tc('WO-062','Completion - Part B2','High consumption comment required','Medium','1. Enter qty > 50% of ROB\n2. Leave comments empty\n3. Try to save','Qty: 8 (when ROB is 10)','Error: comment required for high consumption (>50% of ROB)'),
  tc('WO-063','Layer 1 - Backdating','On-time completion - no flag','High','1. Complete WO on or before due date\n2. Enter today as completion date\n3. Save','Completion Date: today\nDue Date: today','No backdating flag. Part A shows normal display. Work order saved normally'),
  tc('WO-064','Layer 1 - Backdating','Complete before due date - no flag','High','1. Complete WO 5 days before due date\n2. Save','Due: 15-Mar\nCompletion: 10-Mar','No backdating flag shown. Normal completion'),
  tc('WO-065','Layer 1 - Backdating','Backdating detected - 3 days','High','1. Complete WO 5 days late\n2. Enter completion date as 3 days ago\n3. Save','Due: 05-Mar\nToday: 10-Mar\nCompletion entered: 07-Mar','Backdating detected. Part A shows "BACKDATED - 3 days". Red flag icon appears'),
  tc('WO-066','Layer 1 - Backdating','Backdating detected - 7 days','High','1. Complete WO 10 days late\n2. Enter completion date 7 days ago','Due: 01-Mar\nToday: 11-Mar\nCompletion: 04-Mar','Part A shows "BACKDATED - 7 days". Red flag icon. Visual indicator'),
  tc('WO-067','Layer 1 - Backdating','High severity backdating - 20 days','High','1. Complete WO 30 days late\n2. Enter completion date 20 days ago','Due: 10-Feb\nToday: 12-Mar\nCompletion: 20-Feb','Part A shows "BACKDATED - 20 days". High severity. Red background on Part A'),
  tc('WO-068','Layer 1 - Backdating','Visual indicators','Medium','1. Open WO with backdating flag\n2. Verify red flag icon\n3. Verify tooltip\n4. Verify background color','WO with backdating','Red flag icon in Part A. Tooltip shows backdating details. Light red background on Part A section'),
  tc('WO-069','Layer 1 - Backdating','Backdating in work history','Medium','1. Complete backdated WO\n2. View work history for that component\n3. Verify backdating flag visible','Backdated WO','Backdating flag appears in work history entry. Count tracked per component'),
  tc('WO-070','Layer 2 - Missed Cycles','Weekly - on time (0 missed)','High','1. Complete weekly job on time (within 7 days)\n2. Save\n3. Verify no missed cycles badge','Frequency: Weekly\nCompleted: within 7 days','0 missed cycles. No badge shown. Normal completion'),
  tc('WO-071','Layer 2 - Missed Cycles','Weekly - 1 missed cycle','High','1. Complete weekly job 8-14 days late\n2. Save\n3. Verify badge','Frequency: 7 days\nCompleted: 12 days late','1 missed cycle. Orange badge: "1 Cycle Skipped"'),
  tc('WO-072','Layer 2 - Missed Cycles','Weekly - 2 missed cycles','High','1. Complete weekly job 15-21 days late\n2. Save','Frequency: 7 days\nCompleted: 18 days late','2 missed cycles. Red badge: "2 Cycles Skipped"'),
  tc('WO-073','Layer 2 - Missed Cycles','Weekly - 3+ missed cycles','High','1. Complete weekly job 22-28 days late\n2. Save','Frequency: 7 days\nCompleted: 25 days late','3 missed cycles. Red badge: "3 Cycles Skipped". High severity'),
  tc('WO-074','Layer 2 - Missed Cycles','Monthly - on time','High','1. Complete monthly job within 30 days\n2. Save','Frequency: 30 days\nCompleted: on time','0 missed cycles. No badge'),
  tc('WO-075','Layer 2 - Missed Cycles','Monthly - 1 missed cycle','High','1. Complete monthly job 31-60 days late\n2. Save','Frequency: 30 days\nCompleted: 45 days late','1 missed cycle. Orange badge'),
  tc('WO-076','Layer 2 - Missed Cycles','Monthly - 2 missed cycles','Medium','1. Complete monthly job 61-90 days late','Frequency: 30 days\nCompleted: 75 days late','2 missed cycles. Red badge'),
  tc('WO-077','Layer 2 - Missed Cycles','Quarterly - missed cycles','Medium','1. Complete quarterly job late\n2. Verify cycle calculation','Frequency: 90 days\nCompleted: 100 days late','Correct missed cycle count based on 90-day frequency'),
  tc('WO-078','Layer 2 - Missed Cycles','Yearly - missed cycles','Medium','1. Complete yearly job significantly late','Frequency: 365 days\nCompleted: 400 days late','Correct missed cycle count based on 365-day frequency'),
  tc('WO-079','Layer 2 - Missed Cycles','RH-based missed cycles','High','1. Complete RH-based job\n2. Due at 1000 RH, completed at 1055 RH\n3. Frequency: 50 RH','Due RH: 1000\nCompleted RH: 1055\nFrequency: 50 RH','1 missed cycle calculated based on RH frequency'),
  tc('WO-080','Layer 2 - Missed Cycles','Badge display in Part B','Medium','1. Open WO with missed cycles\n2. Verify badge in Part B section','WO with missed cycles','Badge appears in Part B section with correct count and color'),
  tc('WO-081','Layer 2 - Missed Cycles','Badge in work order list','Medium','1. View WO list\n2. Identify WOs with missed cycles badges','N/A','Missed cycle badges visible in WO list for affected work orders'),
  tc('WO-082','Layer 2 - Missed Cycles','Next due from completion date','High','1. Complete late WO\n2. Verify next due date calculated from completion date','Completed: 15-Mar\nFrequency: Monthly','Next due date = 15-Apr (completion + frequency), NOT original due + frequency'),
  tc('WO-083','Layer 3 - Work History','Navigate to Work History','High','1. Navigate to Work History from sidebar or component detail\n2. Verify page loads','N/A','Work History page loads with all completed work orders'),
  tc('WO-084','Layer 3 - Work History','Display completed WOs','High','1. View Work History list\n2. Verify columns shown','N/A','Columns: Date, Component, Job, RH, Missed Cycles, Backdating, Performed By'),
  tc('WO-085','Layer 3 - Work History','Filter by component','Medium','1. Filter work history by component\n2. Verify results','Select: specific component','Only history entries for selected component shown'),
  tc('WO-086','Layer 3 - Work History','Filter by date range','Medium','1. Set date range filter\n2. Verify results','From: 01-Jan-2026\nTo: 31-Mar-2026','Only entries within date range shown'),
  tc('WO-087','Layer 3 - Work History','Click entry for details','Medium','1. Click on a work history entry\n2. Verify detail view','Click any entry','Full details shown: completion date/time, duration, missed cycles, backdating, spare parts, performed by'),
  tc('WO-088','Layer 3 - Work History','Shows missed cycles badge','Medium','1. View history entry with missed cycles','Entry with missed cycles','Missed cycles badge visible with correct count'),
  tc('WO-089','Layer 3 - Work History','Shows backdating flag','Medium','1. View history entry with backdating','Entry with backdating','Backdating flag visible with days count'),
  tc('WO-090','Layer 3 - Work History','Export to Excel','Medium','1. Click Export to Excel\n2. Verify file downloads','Click: Export Excel','Excel file downloads with work history data'),
  tc('WO-091','Layer 3 - Work History','Export to PDF','Medium','1. Click Export to PDF\n2. Verify file downloads','Click: Export PDF','PDF file downloads with formatted history report'),
  tc('WO-092','Layer 4B - CE Remarks','Low severity - no CE remarks','High','1. Complete WO 5 days late, 0 missed cycles\n2. Verify CE remarks NOT required\n3. Save successfully','5 days late\n0 missed cycles\nNo backdating','WO saves without CE remarks. CE remarks section not mandatory'),
  tc('WO-093','Layer 4B - CE Remarks','High severity - CE remarks mandatory (21+ days late)','High','1. Complete WO 21+ days late\n2. Try to save without CE remarks\n3. Enter CE remarks (20+ chars)\n4. Save','25 days late','CE remarks section appears and is mandatory. Error if empty. Saves after entering 20+ char remarks'),
  tc('WO-094','Layer 4B - CE Remarks','High severity - 3+ missed cycles','High','1. Complete WO with 3+ missed cycles\n2. Try to save without CE remarks','3+ missed cycles','CE remarks mandatory. Error: "Chief Engineer remarks mandatory for high severity delays"'),
  tc('WO-095','Layer 4B - CE Remarks','High severity - 7+ days backdating','High','1. Complete WO with 7+ days backdating\n2. Try to save without CE remarks','8 days backdated','CE remarks mandatory for high backdating severity'),
  tc('WO-096','Layer 4B - CE Remarks','CE remarks min 20 characters','High','1. Enter CE remarks with < 20 characters\n2. Try to save','Remarks: "short text"','Error: minimum 20 characters required. Character counter shows progress'),
  tc('WO-097','Layer 4B - CE Remarks','CE remarks display','Medium','1. Save WO with CE remarks\n2. View WO detail\n3. Verify remarks display','WO with CE remarks','CE remarks shown in Part B, highlighted yellow background, with author and timestamp'),
  tc('WO-098','Layer 5 - Supt Notif','High severity creates notification','High','1. Complete high-severity WO (21+ days late or 3+ missed cycles)\n2. Save and approve\n3. Check Superintendent notifications','High severity WO','Superintendent notification created automatically. Appears in notification list'),
  tc('WO-099','Layer 5 - Supt Notif','View pending notifications','High','1. Navigate to Superintendent page\n2. View pending notifications list','Navigate to Management tab','Pending notifications listed with: WO Code, Component, Job, Days Late, Missed Cycles, Backdating'),
  tc('WO-100','Layer 5 - Supt Notif','Acknowledge notification','High','1. Click "Acknowledge" on a notification\n2. Verify status change','Click: Acknowledge','Notification status changes to "Acknowledged". Moves to "Acknowledged" section. Badge count updates'),
  tc('WO-101','Layer 5 - Supt Notif','Badge count updates','Medium','1. View pending count badge\n2. Acknowledge a notification\n3. Verify badge decrements','N/A','Pending count badge decreases by 1 after acknowledgment'),
  tc('WO-102','Layer 5 - Supt Notif','Superintendent dashboard tile','Medium','1. View Dashboard\n2. Locate Superintendent Notifications tile\n3. Verify counts displayed','Navigate to Dashboard','Tile shows pending count and acknowledged-this-month count. Clickable to navigate'),
  tc('WO-103','Layer 6 - Anomaly','Compliance Anomaly Detection panel (Sail Admin)','High','1. Login as Sail Admin\n2. Navigate to Dashboard Overview tab\n3. Verify anomaly panel visible','Login as: Sail Admin','Compliance Anomaly Detection panel visible with: Cycle Skip Rate, Backdating Frequency, Bulk Completion Events, Schedule Drift'),
  tc('WO-104','Layer 6 - Anomaly','Anomaly panel hidden for non-Sail Admin','High','1. Login as Client Admin\n2. Navigate to Dashboard Overview\n3. Check for anomaly panel','Login as: Client Admin','Compliance Anomaly Detection panel is NOT visible'),
  tc('WO-105','Layer 6 - Anomaly','Work Order Anomalies tile','High','1. View Dashboard Overview\n2. Locate Work Order Anomalies tile\n3. Verify content','Login as: Sail Admin','Anomalies tile shows: pending count, severity badges (HIGH/MED/LOW), anomaly cards'),
  tc('WO-106','Layer 6 - Anomaly','Anomaly severity - HIGH','High','1. Create WO with: missedCycles >= 3 OR daysLate >= 21 OR backdating >= 7\n2. Verify HIGH severity','21+ days late','Anomaly assigned HIGH severity. Red severity badge'),
  tc('WO-107','Layer 6 - Anomaly','Anomaly severity - MEDIUM','Medium','1. Create WO with: missedCycles >= 2 OR daysLate >= 14 OR backdating >= 3\n2. Verify MEDIUM','14-20 days late','Anomaly assigned MEDIUM severity. Orange severity badge'),
  tc('WO-108','Layer 6 - Anomaly','Anomaly severity - LOW','Medium','1. Create WO with: missedCycles == 1 OR daysLate >= 7 OR backdating >= 1\n2. Verify LOW','7-13 days late','Anomaly assigned LOW severity. Yellow severity badge'),
  tc('WO-109','Layer 6 - Anomaly','Filter by severity','Medium','1. Click severity filter dropdown\n2. Select HIGH\n3. Then MEDIUM\n4. Then ALL','Select: HIGH, MEDIUM, ALL','Anomaly cards filter by selected severity. Counts update'),
  tc('WO-110','Layer 6 - Anomaly','Anomaly card details','Medium','1. View anomaly card\n2. Verify all information displayed','Any anomaly card','Card shows: WO code (clickable), component, job, anomaly type badges, days late, missed cycles, detection timestamp'),
  tc('WO-111','Layer 6 - Anomaly','View anomaly details','Medium','1. Click "View" on anomaly card\n2. Verify navigation','Click: View','Navigates to work order detail page for that anomaly'),
  tc('WO-112','Layer 6 - Anomaly','Acknowledge anomaly','Medium','1. Click "Acknowledge" on anomaly\n2. Verify status change','Click: Acknowledge','Anomaly status changes to ACKNOWLEDGED. Removed from pending count'),
  tc('WO-113','Layer 6 - Anomaly','Empty state - no anomalies','Medium','1. View anomalies tile when no anomalies exist\n2. Verify empty state message','No anomalies in system','Shows green checkmark: "No anomalies detected. All work orders are on track!"'),
  tc('WO-114','Layer 6 - Anomaly','View All Anomalies link','Low','1. Click "View All Anomalies" link at bottom\n2. Verify navigation','Click: View All Anomalies','Navigates to full anomalies page with complete list'),
  tc('WO-115','Layer 7 - RH Valid','Fetch RH button','High','1. Open RH-based WO for completion\n2. Click "Fetch RH" button in B3\n3. Verify RH auto-fills','Click: Fetch RH','Current RH auto-filled from RH Module. Loading indicator during fetch. Success message shown'),
  tc('WO-116','Layer 7 - RH Valid','Fetch RH disabled for calendar jobs','Medium','1. Open Calendar-based WO\n2. Check B3 section','Calendar-based WO','Fetch RH button disabled or hidden for calendar-based components'),
  tc('WO-117','Layer 7 - RH Valid','Valid RH entry - within range','High','1. Previous RH: 500 (01-Mar)\n2. Completion: 11-Mar (10 days)\n3. Enter RH: 560\n4. Verify valid','Previous: 500\nDate: 11-Mar\nEntered: 560','Green border. "Valid entry" message. Average: 6 hrs/day. Save allowed'),
  tc('WO-118','Layer 7 - RH Valid','Invalid backward violation','High','1. Previous RH: 500 (01-Mar)\n2. Completion: 06-Mar (5 days)\n3. Enter RH: 700 (exceeds 24 hrs/day max)\n4. Try to save','Previous: 500\nDate: 06-Mar\nEntered: 700\nMax: 620','Red border. Error modal: "Exceeds maximum increase rate". Valid range shown: 500-620. Cannot save'),
  tc('WO-119','Layer 7 - RH Valid','Invalid forward violation','High','1. Previous RH: 500, Next RH: 620 (11-Mar)\n2. Completion: 09-Mar\n3. Enter RH: 550 (would need 35 hrs/day to reach next)\n4. Try to save','Previous: 500\nNext: 620\nDate: 09-Mar\nEntered: 550','Red border. Error: "Conflicts with future RH entry". Cannot save'),
  tc('WO-120','Layer 7 - RH Valid','RH cannot go backward','High','1. Previous RH: 500\n2. Enter RH: 480 (less than previous)\n3. Try to save','Previous: 500\nEntered: 480','Red border. Error: "Running hours cannot go backward". Must be > 500'),
  tc('WO-121','Layer 7 - RH Valid','RH same as previous (zero increase)','Medium','1. Previous RH: 500\n2. Enter RH: 500\n3. Verify warning','Previous: 500\nEntered: 500','Warning: "Running hours show no increase. Confirm machinery was not operated." Allow save with warning'),
  tc('WO-122','Layer 7 - RH Valid','High utilization warning (>20 hrs/day)','High','1. Previous RH: 500 (01-Mar)\n2. Completion: 03-Mar (2 days)\n3. Enter RH: 545 (22.5 hrs/day)\n4. Verify warning','Previous: 500\nDate: 03-Mar\nEntered: 545','Orange border. Warning: "High utilization detected (22.5 hrs/day)". Justification modal opens'),
  tc('WO-123','Layer 7 - RH Valid','Justification modal - high utilization','High','1. Trigger high utilization warning\n2. Verify modal content\n3. Enter justification (20+ chars)\n4. Check confirmation checkbox\n5. Click Confirm','Justification: "Continuous voyage operations required extended running"\nCheckbox: checked','Modal shows component name, entered RH, usage rate. Requires 20+ char justification AND checkbox. Saves after both provided'),
  tc('WO-124','Layer 7 - RH Valid','Cannot save without justification','High','1. Trigger high utilization\n2. Try to save without justification text','No justification entered','Cannot save. Error: "Justification required for high utilization"'),
  tc('WO-125','Layer 7 - RH Valid','Valid range helper text','Medium','1. Open RH-based WO B3 section\n2. Before typing, check helper text','RH-based WO','Shows: "Valid RH range for [date]: [MIN] to [MAX] hours. Last recorded: [X] hrs on [date]"'),
  tc('WO-126','Layer 7 - RH Valid','Live validation feedback','Medium','1. Type RH values progressively\n2. Observe real-time feedback','Type: 500, 560, 700','Green: "Valid entry (X hrs/day)". Red: "Invalid: exceeds max". Orange: "High utilization"'),
  tc('WO-127','Layer 7 - RH Valid','Input border color coding','Medium','1. Observe input border changes\n2. Verify colors','Various RH values','Gray: no value. Green: valid. Orange: high utilization. Red: invalid'),
  tc('WO-128','Layer 7 - RH Valid','Date change re-validation','Medium','1. Enter valid RH for date A\n2. Change completion date to date B\n3. Verify RH re-validates','Date A valid RH: 560\nChange to Date B','RH re-validates automatically. May become invalid for new date. Helper text updates'),
  tc('WO-129','Layer 7 - RH Isolation','RH isolation - no write back','High','1. Check component RH in RH Module: 620\n2. Complete WO with RH: 560\n3. Save and approve\n4. Check RH Module again','Component RH: 620\nWO RH: 560','RH Module still shows 620 (UNCHANGED). WO stores completionRH: 560 as snapshot only'),
  tc('WO-130','Layer 7 - RH Isolation','Multiple WOs - RH isolation','High','1. Complete 3 WOs for same component with different RH values\n2. Check RH Module after each','WO1: 560, WO2: 570, WO3: 580','RH Module value NEVER changes from work order submissions'),
  tc('WO-131','Layer 7 - RH Timeline','View RH Timeline','Medium','1. Click "View RH Timeline" in B3\n2. Verify modal/dialog opens\n3. Check table and chart','Click: View RH Timeline','Timeline shows: Date, RH Value, Change, Hrs/Day, Source, Status. Line chart visualization'),
  tc('WO-132','Layer 7 - RH Timeline','Timeline data sources','Medium','1. View timeline entries\n2. Check Source column','N/A','Shows entries from RH_MODULE and WORK_ORDER sources. Color-coded by source'),
  tc('WO-133','Layer 7 - RH Timeline','Timeline filters','Low','1. Filter timeline by date range\n2. Filter by source','Filter: Last 30 days\nSource: RH Module only','Timeline filters correctly. Results update immediately'),
  tc('WO-134','Layer 7 - RH Display','Completed WO - RH metadata','Medium','1. Open completed WO with RH data\n2. Verify RH info displayed','Completed RH-based WO','Shows: completionRH, Previous RH, Average usage, RH Source, Validation timestamp'),
  tc('WO-135','Layer 7 - Error Modal','Error modal backward violation','Medium','1. Trigger backward RH violation\n2. Verify error modal content','RH exceeds max rate','Modal shows: Previous RH, Your entry, Days between, Max possible, Valid range, "Correct Entry" button'),
  tc('WO-136','Layer 7 - Error Modal','Error modal forward violation','Medium','1. Trigger forward RH violation\n2. Verify error modal','RH conflicts with future','Modal shows forward conflict details. Cannot save until corrected'),
  tc('WO-137','Approval','Submit for approval','High','1. Complete all WO sections\n2. Click "Submit for Approval"\n3. Verify status change','Complete WO','Status changes to "Pending Approval". WO appears in Pending Approval tab. Timestamp recorded'),
  tc('WO-138','Approval','Approve work order','High','1. Login as Chief Engineer\n2. Navigate to Pending Approval tab\n3. Click Approve on a WO\n4. Confirm','Login: Chief Engineer\nClick: Approve','Status changes to "Completed". WO moves to Completed tab. Next due date generated. Approval timestamp recorded'),
  tc('WO-139','Approval','Reject work order','High','1. Login as approver\n2. Click Reject\n3. Enter rejection reason (min 10 chars)\n4. Confirm','Rejection reason: "Insufficient documentation provided for this maintenance task"','Status reverts to "Active". Submitter can re-edit. Rejection reason visible'),
  tc('WO-140','Approval','Reject without reason','High','1. Click Reject\n2. Leave reason empty or < 10 chars\n3. Try to confirm','Empty reason','Error: rejection reason is mandatory. Minimum 10 characters'),
  tc('WO-141','Approval','3rd Engineer cannot approve','High','1. Login as 3rd Engineer\n2. View Pending Approval WO\n3. Check for Approve button','Login: 3rd Engineer','No Approve/Reject buttons visible. Read-only view of the work order'),
  tc('WO-142','Approval','Chief Engineer can approve','High','1. Login as Chief Engineer\n2. View Pending Approval WO','Login: Chief Engineer','Approve and Reject buttons visible and functional'),
  tc('WO-143','Approval','New WO created after approval (recurring)','Medium','1. Approve a recurring WO\n2. Check for newly generated planned WO','Approve recurring WO','New planned work order created with next due date based on frequency'),
  tc('WO-144','Approval','HOD check - approver ≠ performer','High','1. Set Performed By to Chief Engineer\n2. Try to submit for approval by same person','Performed By: Chief Engineer\nApprover: Chief Engineer','Error: "Head of Department ranks cannot both perform and approve the same work"'),
  tc('WO-145','Attachments','Upload valid file types','High','1. Upload .jpg file\n2. Upload .png file\n3. Upload .pdf file','Files: test.jpg, test.png, test.pdf','All three file types accepted and displayed in attachments list'),
  tc('WO-146','Attachments','Reject invalid file type - .exe','High','1. Try to upload .exe file','File: malware.exe','Error: "Invalid file type. Only images and PDFs allowed"'),
  tc('WO-147','Attachments','Reject invalid file type - .doc','Medium','1. Try to upload .doc file','File: document.doc','Error: "Only PDF, JPG, JPEG, PNG files accepted"'),
  tc('WO-148','Attachments','File size limit - exceed 5MB','High','1. Try to upload file > 5MB','File: large_image.jpg (10MB)','Error: "File size exceeds 5 MB limit". Shows actual file size'),
  tc('WO-149','Attachments','File size - under 5MB','Medium','1. Upload file under 5MB','File: small.pdf (4.9MB)','File uploaded successfully. File size displayed'),
  tc('WO-150','Attachments','Multiple file upload','Medium','1. Select multiple files (Ctrl+Click)\n2. Upload all at once','3 files selected','All valid files uploaded. Invalid files skipped with individual error messages'),
  tc('WO-151','Attachments','Remove attachment','Medium','1. Upload a file\n2. Click remove/delete icon\n3. Confirm removal','Click: remove icon','File removed from list. File count decreases'),
  tc('WO-152','Attachments','View/Preview attachment','Medium','1. Click on uploaded file name or icon\n2. Verify preview','Click on file','Image opens in modal/lightbox. PDF opens in viewer or new tab'),
  tc('WO-153','Attachments','Attachments persist after save','Medium','1. Upload files and save WO\n2. Close WO\n3. Reopen WO','Upload, save, reopen','All attachments still visible after reopening. Can add more (if under limit)'),
  tc('WO-154','Draft Save','Partial save as draft','High','1. Fill some Part B fields but not all mandatory\n2. Click Save\n3. Verify draft save behavior','Partial completion data','Saves as draft without status change. "Draft Saved" toast with list of missing fields'),
  tc('WO-155','Draft Save','Draft with only spare consumption','Medium','1. Only add spare parts consumed (no other B fields)\n2. Click Save','Spare parts only','Saves as draft. Spare consumption recorded'),
  tc('WO-156','Immutability','Completed WO is read-only','High','1. Open Completed WO\n2. Verify all Part B fields disabled','Completed WO','All B1 radios, B2 inputs, B3 RH, B4 spare controls are disabled/read-only'),
  tc('WO-157','Immutability','Pending Approval WO is read-only','High','1. Open Pending Approval WO\n2. Verify Part B fields disabled','Pending Approval WO','All Part B fields disabled. Cannot modify until rejected'),
  tc('WO-158','Character Limits','Work Carried Out max 2000 chars','Medium','1. Type text in Work Carried Out\n2. Verify maxLength=2000\n3. Verify counter','Type 2001+ chars','Text truncated at 2000. Counter shows "2000 / 2000"'),
  tc('WO-159','Character Limits','Rejection comments max 500 chars','Medium','1. Reject WO\n2. Type 500+ chars in rejection reason\n3. Verify limit','Type 501+ chars','Text truncated at 500. Counter shows "500 / 500"'),
  tc('WO-160','Cross-Field','Completion date vs next due date warning','Medium','1. Complete WO after original due date\n2. Verify overdue completion warning','Completion after due date','Informational toast: "Overdue Completion". Save NOT blocked. WO flagged'),
  tc('WO-161','Cross-Field','Start date vs WO creation date','High','1. Enter start date earlier than WO creation date\n2. Try to save','Start before creation date','Error: "Start date cannot be earlier than Work Order creation date"'),
  tc('WO-162','Cross-Field','Frequency integrity - auto recalculate','Medium','1. Complete calendar job\n2. Verify next due date = completion + frequency','Completion: 15-Mar\nFrequency: Monthly','Next due date auto-calculated as 15-Apr (completion + frequency)'),
  tc('WO-163','Chatbot','Chatbot visible for Sail Admin','High','1. Login as Sail Admin\n2. Navigate to any page\n3. Look for chat button bottom-right','Login as: Sail Admin','Floating chat button (message icon) visible in bottom-right corner'),
  tc('WO-164','Chatbot','Chatbot hidden for non-Sail Admin','High','1. Login as Client Admin\n2. Navigate to any page\n3. Look for chat button','Login as: Client Admin','Chat button is NOT visible anywhere on the page'),
  tc('WO-165','Chatbot','Open chat panel','Medium','1. As Sail Admin, click chat button\n2. Verify chat panel opens','Click: chat button','Chat panel slides in from right. Shows "PMS Assistant" header'),
  tc('WO-166','Chatbot','Send message in chat','Medium','1. Open chat panel\n2. Type a question\n3. Send message','Message: "What work orders are overdue?"','Message sent. AI response received. Chat history maintained'),
  tc('WO-167','Chatbot','Close chat panel','Low','1. Open chat panel\n2. Click close button','Click: close button','Chat panel closes. Floating button reappears'),
  tc('WO-168','Chatbot','Clear chat messages','Low','1. Open chat with messages\n2. Click clear/reset button','Click: clear','Chat history cleared. Fresh conversation started'),
];

// ── RUNNING HOURS MODULE ──
const runningHoursData = [
  tc('RH-001','RH Dashboard','View RH dashboard','High','1. Navigate to Running Hours from sidebar\n2. Verify page loads\n3. Check table columns','Navigate to Running Hrs','RH page loads with columns: Component Code, Component Name, Current RH, Last Updated, Last Updated By, Utilization Rate'),
  tc('RH-002','RH Dashboard','Vessel filter','High','1. Select vessel from dropdown\n2. Verify components filter','Select: Vessel 3','Only components for selected vessel shown'),
  tc('RH-003','RH Dashboard','Search by component','High','1. Enter component name/code in search\n2. Verify results','Search: "Main Engine"','Only matching components displayed'),
  tc('RH-004','RH Dashboard','Sort by each column','Medium','1. Click each column header\n2. Verify ascending/descending','Click: column headers','Columns sort correctly. Sort indicator shown'),
  tc('RH-005','RH Dashboard','Pagination','Medium','1. Navigate through pages\n2. Change items per page','Click: page numbers','Pagination works. Items per page changes'),
  tc('RH-006','RH Dashboard','Utilization rate display','High','1. View utilization rate column\n2. Verify color coding','N/A','Green: 0-50%, Yellow: 51-75%, Orange: 76-90%, Red: 91-100%'),
  tc('RH-007','RH Dashboard','Utilization rate tooltip','Medium','1. Hover over utilization percentage\n2. Verify tooltip details','Hover on rate','Tooltip shows calculation details and period'),
  tc('RH-008','RH Dashboard','Last Updated By column','Medium','1. View Last Updated By column\n2. Verify shows user name','N/A','Column shows the name of the user who last updated RH for each component'),
  tc('RH-009','Update RH','Manual RH update','High','1. Click Update/Edit for a component\n2. Enter new RH value\n3. Enter update date\n4. Save','New RH: 1500\nDate: 13-Mar-2026','RH value updated. Success message. Timestamp and Last Updated By updated'),
  tc('RH-010','Update RH','RH cannot decrease','High','1. Enter RH lower than current value\n2. Try to save','Current: 1500\nNew: 1400','Error: "Running hours cannot decrease". Save blocked'),
  tc('RH-011','Update RH','Non-numeric value','High','1. Enter non-numeric value in RH field\n2. Try to save','Enter: "abc"','Error: "Enter valid number". Field rejects non-numeric input'),
  tc('RH-012','Update RH','Negative value','Medium','1. Enter negative RH value\n2. Try to save','Enter: -100','Error: "RH must be positive". Save blocked'),
  tc('RH-013','Update RH','Very large number','Medium','1. Enter RH > 999999\n2. Try to save','Enter: 9999999','Validation error or warning for unrealistic value'),
  tc('RH-014','Update RH','Future date rejected','Medium','1. Enter update date in the future\n2. Try to save','Date: tomorrow','Error: "Cannot use future date"'),
  tc('RH-015','Update RH','Large jump warning','Medium','1. Enter RH that exceeds previous by > 2000 hrs\n2. Verify warning','Current: 500\nNew: 3000','Warning: "Large Reading Jump - 2500 hrs increase". First save shows warning, second save accepts'),
  tc('RH-016','Bulk Update','Select multiple components','Medium','1. Check checkboxes for multiple components\n2. Click Bulk Update','Select 3 components','Bulk update form opens for selected components'),
  tc('RH-017','Bulk Update','Update all selected','Medium','1. Enter RH values for each\n2. Set common date\n3. Save all','RH values for 3 components\nDate: 13-Mar-2026','All RH values updated. Individual audit entries created'),
  tc('RH-018','RH History','View history for component','High','1. Click on component to view detail\n2. View RH history table','Any RH component','History shows: Date, RH Value, Change, Source (Manual/WO), Updated By'),
  tc('RH-019','RH History','Sort by date','Medium','1. Click Date column header\n2. Verify newest/oldest first','Click Date header','History sorts chronologically. Toggle ascending/descending'),
  tc('RH-020','RH History','Filter by date range','Medium','1. Set date range filter\n2. Verify results','From: 01-Jan\nTo: 31-Mar','Only entries within range shown'),
  tc('RH-021','RH History','Filter by source','Medium','1. Filter by Manual Update\n2. Filter by Work Order','Source: Manual Update','Only entries from selected source shown'),
  tc('RH-022','RH History','Back button to list','Low','1. View component history\n2. Click Back\n3. Verify return to list','Click: Back','Returns to RH list. Filters/page preserved'),
  tc('RH-023','RH Timeline','Line chart visualization','Medium','1. View RH timeline chart\n2. Verify line graph','Any component with history','Line chart shows RH trend. X: dates, Y: hours. Points are hoverable'),
  tc('RH-024','RH Timeline','Hover shows details','Medium','1. Hover over chart data points\n2. Verify tooltip','Hover on data point','Tooltip shows: Date, RH Value, Change from previous'),
  tc('RH-025','RH-Based Jobs','View jobs due by RH','Medium','1. View components with RH-based jobs\n2. Check due dates','RH-based components','Shows: Component, Job, Due at RH, Current RH, RH Remaining'),
  tc('RH-026','RH-Based Jobs','Color coding overdue/due soon','Medium','1. View RH remaining column\n2. Verify color coding','Components at various RH levels','Red: overdue (past due RH). Orange: due soon (<50 RH remaining). Green: upcoming'),
  tc('RH-027','Period Selector','Select period - This Month','Medium','1. Select "This Month" from period dropdown\n2. Verify utilization recalculates','Period: This Month','Utilization rates recalculate for current month. Chart updates'),
  tc('RH-028','Period Selector','Select period - This Quarter','Medium','1. Select "This Quarter"\n2. Verify recalculation','Period: This Quarter','Utilization calculated for quarter. Percentages change accordingly'),
  tc('RH-029','Period Selector','Utilization calculation accuracy','High','1. Check utilization formula\n2. Verify: (RH in period / (Days × 24)) × 100','Known RH values','Calculation matches: e.g., 720 RH in 30 days = 100%'),
  tc('RH-030','Export','Export RH to Excel','High','1. Click Export to Excel button\n2. Verify file downloads','Click: Export Excel','Excel file downloads with all components, current RH, last updated, utilization rates'),
  tc('RH-031','Export','Export RH to PDF','High','1. Click Export to PDF button\n2. Verify file downloads','Click: Export PDF','PDF file downloads with formatted RH report'),
  tc('RH-032','Export','Export includes correct data','Medium','1. Download export\n2. Open and verify content','Open exported file','File contains: all components, current RH, last updated date, utilization. Timestamped filename'),
  tc('RH-033','Export','Export button visibility (Sail Admin)','Medium','1. Login as Sail Admin\n2. Check Export button visibility','Login: Sail Admin','Export button visible in RH module header area'),
  tc('RH-034','Edge Cases','Component with no RH history','Low','1. View component with no previous RH entries\n2. Verify display','New component','Shows 0 or empty RH. No history entries. Can add first RH entry'),
  tc('RH-035','Edge Cases','Rapid successive updates','Low','1. Update RH for same component twice in quick succession\n2. Verify both recorded','Update 1: 500\nUpdate 2: 510','Both updates recorded in history with correct timestamps'),
];

// ── SPARES MODULE ──
const sparesData = [
  tc('SP-001','Spares List','View all spares','High','1. Navigate to Spares module\n2. Verify spares list loads\n3. Check columns','Navigate to /spares','Spares list loads with columns: Part No, Description, Current Stock, Min Stock, Max Stock, Location, Status'),
  tc('SP-002','Spares List','Vessel filter','High','1. Select vessel from dropdown\n2. Verify spares filter','Select: Vessel 3','Only spares for selected vessel shown'),
  tc('SP-003','Spares List','Search by part number','High','1. Enter part number in search\n2. Verify results','Search: known part no','Only matching spares displayed'),
  tc('SP-004','Spares List','Search by description','High','1. Enter description keywords\n2. Verify results','Search: "O-ring"','Matching spares shown'),
  tc('SP-005','Spares List','Pagination','Medium','1. Change items per page\n2. Navigate pages','10, 25, 50, 100 per page','Pagination works correctly'),
  tc('SP-006','Spares List','Total spares count','Medium','1. View total count display\n2. Apply filter and verify update','N/A','Total count shown. Updates with filters'),
  tc('SP-007','Spares List','Stock status - OK badge','High','1. Identify spare with stock > min stock\n2. Verify green "OK" badge','Stock: 10, Min: 5','Green "OK" badge displayed'),
  tc('SP-008','Spares List','Stock status - At Min badge','High','1. Identify spare with stock = min stock\n2. Verify orange "At Min" badge','Stock: 5, Min: 5','Orange "At Min" badge displayed'),
  tc('SP-009','Spares List','Stock status - Low badge','High','1. Identify spare with stock < min stock but > 0\n2. Verify red "Low" badge','Stock: 2, Min: 5','Red "Low" badge displayed'),
  tc('SP-010','Spares List','Stock status - Critical badge','High','1. Identify spare with stock = 0\n2. Verify dark red "Critical" badge','Stock: 0','Dark red "Critical" badge displayed'),
  tc('SP-011','Spares List','Filter by stock status','Medium','1. Filter by OK status\n2. Filter by Low\n3. Filter by Critical','Status: OK, Low, Critical','Filter works. Count badges show number in each status'),
  tc('SP-012','Add Spare','Create spare part','High','1. Click "Add Spare Part"\n2. Fill all required fields\n3. Save','Part No: TEST-001\nDesc: Test Spare\nMin: 5\nMax: 20','Spare created. Success message. Appears in list'),
  tc('SP-013','Add Spare','Duplicate part number','High','1. Enter existing part number\n2. Try to save','Part No: [existing]','Error: "Part number already exists"'),
  tc('SP-014','Add Spare','Max < Min stock validation','Medium','1. Set Max Stock less than Min Stock\n2. Try to save','Min: 20, Max: 10','Error: "Max stock must be greater than min stock"'),
  tc('SP-015','Add Spare','Negative stock values','Medium','1. Enter negative current stock\n2. Try to save','Stock: -5','Error: "Stock cannot be negative"'),
  tc('SP-016','Add Spare','Empty mandatory fields','High','1. Leave required fields empty\n2. Try to save','Empty Part No, Description','Error messages for each empty mandatory field'),
  tc('SP-017','Edit Spare','Update spare details','High','1. Click Edit on a spare\n2. Modify fields\n3. Save','Change description','Changes saved. Confirmation message. List updated'),
  tc('SP-018','Edit Spare','Audit trail created','Medium','1. Edit spare and save\n2. Check for audit entry','Any modification','Edit recorded in audit trail with timestamp and user'),
  tc('SP-019','Stock Transactions','Stock In','High','1. Click "Stock In"\n2. Enter qty to add\n3. Enter date and supplier\n4. Save','Qty: 10\nDate: today\nSupplier: ABC Corp','Current stock increases by 10. Transaction recorded in history'),
  tc('SP-020','Stock Transactions','Stock Out','High','1. Click "Stock Out"\n2. Enter qty to remove\n3. Enter issued to\n4. Save','Qty: 3\nIssued to: Engine Dept','Current stock decreases by 3. Transaction recorded'),
  tc('SP-021','Stock Transactions','Insufficient stock','High','1. Try to remove more than current stock\n2. Verify error','Current: 3, Remove: 5','Error: "Insufficient stock. Current stock: 3"'),
  tc('SP-022','Stock Transactions','Negative quantity removal','Medium','1. Enter negative qty for stock out\n2. Verify error','Qty: -3','Error: quantity must be positive'),
  tc('SP-023','Stock Transactions','Future date transaction','Medium','1. Enter future date for transaction\n2. Verify error','Date: tomorrow','Error: "Cannot use future date"'),
  tc('SP-024','WO Consumption','Spare consumed from work order','High','1. In WO Part B4, add spare\n2. Enter qty and location\n3. Save WO\n4. Check spare stock','Spare: TEST-001\nQty: 2','Spare stock decreases by 2. Transaction source: "Work Order [WO-CODE]"'),
  tc('SP-025','WO Consumption','Insufficient stock warning in WO','Medium','1. In WO, try to consume 5 when stock is 3\n2. Verify warning','Qty: 5, Stock: 3','Warning: "Current stock (3) is less than requested (5)"'),
  tc('SP-026','Stock History','View transaction history','High','1. Click on spare part\n2. View transaction history\n3. Verify columns','Any spare','History shows: Date, Type (In/Out), Quantity, Balance After, Source, User'),
  tc('SP-027','Stock History','Sort by date','Medium','1. Click Date header\n2. Verify sort','Click: Date','History sorts by date ascending/descending'),
  tc('SP-028','Stock History','Filter by transaction type','Medium','1. Filter by Stock In\n2. Filter by Stock Out','Type: Stock In','Only matching transaction types shown'),
  tc('SP-029','Stock History','Export history to Excel','Medium','1. Click Export for spare history\n2. Verify file','Click: Export','Excel file downloads with transaction history'),
  tc('SP-030','Low Stock Alerts','Low stock count on dashboard','High','1. View Dashboard\n2. Check Low Stock count','Navigate to Dashboard','Low Stock count displayed. Matches actual count of spares below min stock'),
  tc('SP-031','Low Stock Alerts','Critical stock count','High','1. View Dashboard\n2. Check Critical Low Stock count','Navigate to Dashboard','Critical count (stock = 0) displayed accurately'),
  tc('SP-032','Low Stock Alerts','Click navigates to filtered list','Medium','1. Click Low Stock count on dashboard\n2. Verify navigation','Click: Low Stock count','Navigates to Spares list filtered by Low stock status'),
  tc('SP-033','Categories','Filter by category','Medium','1. Select category filter\n2. Verify results','Category: Engine','Only spares in selected category shown'),
  tc('SP-034','Categories','Category-wise summary','Low','1. View category summary\n2. Verify counts per category','N/A','Summary shows count of spares per category'),
  tc('SP-035','ROB','Mark spare as ROB','Medium','1. Edit spare\n2. Check ROB checkbox\n3. Save','Check: ROB','Spare marked as ROB. ROB indicator visible in list'),
  tc('SP-036','ROB','Filter ROB items','Medium','1. Filter to show ROB items only\n2. Verify results','Filter: ROB','Only ROB-marked spares shown'),
  tc('SP-037','Delete Spare','Delete unused spare','Medium','1. Find spare with no transaction history\n2. Click Delete\n3. Confirm','Spare with 0 transactions','Spare deleted. Removed from list. Success message'),
  tc('SP-038','Delete Spare','Cannot delete used spare','Medium','1. Try to delete spare with transaction history\n2. Verify error','Spare with transactions','Error: "Cannot delete - spare has transaction history"'),
  tc('SP-039','Delete Spare','Delete confirmation dialog','Medium','1. Click Delete\n2. Verify confirmation appears\n3. Click Cancel','Any spare','Confirmation dialog shown. Cancel cancels deletion'),
  tc('SP-040','Bulk Update','Bulk update spares','Medium','1. Navigate to bulk update page\n2. Update multiple spares\n3. Save','Multiple spares','All spares updated. Individual success confirmations'),
];

// ── STORES MODULE ──
const storesData = [
  tc('ST-001','Stores List','View all stores items','High','1. Navigate to Stores module\n2. Verify inventory list loads\n3. Check columns','Navigate to /stores','Stores page loads with columns: Item Code, Description, Quantity, Unit, Location, Category'),
  tc('ST-002','Stores List','Search functionality','High','1. Enter search term\n2. Verify filtered results','Search: "Lube Oil"','Only matching store items displayed'),
  tc('ST-003','Stores List','Vessel filter','High','1. Select vessel from dropdown\n2. Verify items filter','Select: Vessel 3','Only stores items for selected vessel shown'),
  tc('ST-004','Stores List','Category filter','Medium','1. Select category from dropdown\n2. Verify results','Category: Lube Oil','Only items in selected category shown'),
  tc('ST-005','Stores List','Pagination','Medium','1. Navigate through pages\n2. Change items per page','10, 25, 50 per page','Pagination works correctly'),
  tc('ST-006','Add Store Item','Create store item','High','1. Click "Add Item"\n2. Fill required fields\n3. Save','Code: ST-TEST-001\nDesc: Test Item\nQty: 100\nUnit: Ltrs','Item created. Success message. Appears in list'),
  tc('ST-007','Add Store Item','Duplicate item code','High','1. Enter existing item code\n2. Try to save','Code: [existing]','Error: "Item code already exists"'),
  tc('ST-008','Add Store Item','Empty mandatory fields','High','1. Leave required fields empty\n2. Try to save','Empty fields','Validation error messages shown'),
  tc('ST-009','Add Store Item','Negative quantity','Medium','1. Enter negative quantity\n2. Try to save','Qty: -10','Error: quantity cannot be negative'),
  tc('ST-010','Update Quantity','Stock In transaction','High','1. Click "Stock In" for item\n2. Enter quantity received\n3. Enter date and supplier\n4. Save','Qty: 50\nDate: today\nSupplier: Marine Supplies','Quantity increases by 50. Transaction recorded'),
  tc('ST-011','Update Quantity','Stock Out transaction','High','1. Click "Stock Out" for item\n2. Enter quantity issued\n3. Enter issued to\n4. Save','Qty: 20\nIssued to: Engine Room','Quantity decreases by 20. Transaction recorded'),
  tc('ST-012','Update Quantity','Insufficient stock out','Medium','1. Try to issue more than available\n2. Verify error','Available: 30, Issue: 50','Error: "Insufficient stock" or warning shown'),
  tc('ST-013','Categories','Filter by Lube Oil','Medium','1. Select "Lube Oil" category\n2. Verify filtered items','Category: Lube Oil','Only Lube Oil items shown'),
  tc('ST-014','Categories','Filter by Paint','Medium','1. Select "Paint" category\n2. Verify results','Category: Paint','Only Paint category items shown'),
  tc('ST-015','Categories','Filter by Chemicals','Medium','1. Select "Chemicals" category','Category: Chemicals','Only Chemical items shown'),
  tc('ST-016','Categories','Category-wise summary','Low','1. View category summary/counts','N/A','Summary shows count per category'),
  tc('ST-017','Transaction History','View item history','High','1. Click on store item\n2. View transaction history','Any store item','Shows: Date, Type, Quantity, Balance, User'),
  tc('ST-018','Transaction History','Sort by date','Medium','1. Sort transactions by date','Click: Date header','Transactions sort chronologically'),
  tc('ST-019','Transaction History','Export history','Medium','1. Export transaction history\n2. Verify file','Click: Export','File downloads with transaction data'),
  tc('ST-020','Edit Store Item','Modify item details','Medium','1. Edit store item\n2. Change description/category\n3. Save','Change description','Changes saved. List updated'),
  tc('ST-021','Edit Store Item','Validation on edit','Medium','1. Edit item with invalid data\n2. Verify validation','Invalid data','Validation errors shown. Invalid changes rejected'),
  tc('ST-022','Bulk Update','Bulk update stores','Medium','1. Navigate to bulk update\n2. Update multiple items\n3. Save','Multiple store items','All items updated successfully'),
  tc('ST-023','Delete Store Item','Delete item','Medium','1. Delete store item\n2. Confirm deletion','Item with no history','Item deleted. Removed from list'),
  tc('ST-024','Delete Store Item','Delete confirmation','Medium','1. Click Delete\n2. Verify confirmation dialog','Any item','Confirmation dialog shown with Cancel/Confirm options'),
  tc('ST-025','Edge Cases','Very long item description','Low','1. Create item with very long description\n2. Verify display','Description: 200+ chars','Description truncated in list. Full text visible on detail view'),
];

// ── REPORTS MODULE ──
const reportsData = [
  tc('RPT-001','WO Reports','Completion Report','High','1. Navigate to Reports\n2. Select "Completion Report"\n3. Set date range\n4. Generate','Date: 01-Jan to 31-Mar-2026','Report generates with all completed WOs in range: dates, delays, missed cycles. Export available'),
  tc('RPT-002','WO Reports','Overdue Report','High','1. Select "Overdue Work Orders Report"\n2. Select vessel\n3. Generate','Vessel: Vessel 3','Shows all overdue WOs with days overdue, assigned to, priority. Sorted by most overdue'),
  tc('RPT-003','WO Reports','Pending Approval Report','Medium','1. Generate Pending Approval report\n2. Verify grouping','N/A','Shows WOs pending approval grouped by vessel with submission dates'),
  tc('RPT-004','WO Reports','Export completion report to Excel','High','1. Generate report\n2. Click Export to Excel','Click: Export','Excel file downloads with report data'),
  tc('RPT-005','WO Reports','Export completion report to PDF','High','1. Generate report\n2. Click Export to PDF','Click: Export','PDF file downloads with formatted report'),
  tc('RPT-006','Component Reports','Component maintenance history','Medium','1. Select component\n2. Set date range\n3. Generate','Component: Main Engine\nDate: 2025-2026','Shows all maintenance for component: frequency, avg delay, total RH, spares used'),
  tc('RPT-007','Component Reports','Export component report','Medium','1. Generate component report\n2. Export','Click: Export','File downloads with component maintenance data'),
  tc('RPT-008','RH Reports','Utilization report','Medium','1. Select period and vessels\n2. Generate RH utilization report','Period: This Quarter\nAll vessels','Shows utilization rate per component. Bar chart. Fleet average calculated'),
  tc('RPT-009','RH Reports','RH trend report','Medium','1. Select component and date range\n2. Generate trend','Component: [selected]\nRange: 6 months','Line chart showing RH increase. Identifies abnormal patterns'),
  tc('RPT-010','RH Reports','Export RH report','Medium','1. Generate RH report\n2. Export','Click: Export','File downloads with RH data'),
  tc('RPT-011','Spares Reports','Consumption report','Medium','1. Set date range\n2. Generate spares consumption report','Date: 01-Jan to 31-Mar-2026','Shows: Part No, Desc, Qty Used, Value, WOs. Most consumed ranking'),
  tc('RPT-012','Spares Reports','Low stock report','High','1. Generate low stock report','N/A','Shows all spares below min stock. Critical stock (0) items. Recommended order qty'),
  tc('RPT-013','Spares Reports','Export spares report','Medium','1. Generate and export spares report','Click: Export','File with spares consumption or stock data downloads'),
  tc('RPT-014','Compliance Reports','Backdating report','High','1. Set date range\n2. Generate backdating report','Date: 01-Jan to 31-Mar','Shows all backdated WOs, days per WO, trend analysis, crew-wise frequency'),
  tc('RPT-015','Compliance Reports','Missed cycles report','High','1. Generate missed cycles report','N/A','Shows all WOs with missed cycles. Total per component. High-risk components identified'),
  tc('RPT-016','Compliance Reports','Anomaly summary report','Medium','1. Generate anomaly summary','N/A','Anomalies grouped by severity (HIGH/MEDIUM/LOW) and type. Acknowledged vs Pending'),
  tc('RPT-017','Compliance Reports','Export compliance report','Medium','1. Export any compliance report','Click: Export','Report file downloads with compliance data'),
  tc('RPT-018','Report Filters','Date range filter','High','1. Set custom date range\n2. Verify report scopes correctly','From: 01-Feb\nTo: 28-Feb','Report only includes data within selected range'),
  tc('RPT-019','Report Filters','Vessel filter in reports','Medium','1. Filter report by specific vessel\n2. Verify results','Vessel: Vessel 3','Report data limited to selected vessel'),
  tc('RPT-020','Report Filters','Component filter','Medium','1. Filter by component in report\n2. Verify','Component: [specific]','Report shows data only for selected component'),
  tc('RPT-021','Report Generation','No data scenario','Medium','1. Generate report for period with no data\n2. Verify handling','Date range: future dates','Empty report with message: "No data found for selected criteria"'),
  tc('RPT-022','Report Generation','Large data set','Medium','1. Generate report for all vessels, all time\n2. Verify performance','All data','Report generates without timeout. May show loading indicator'),
  tc('RPT-023','Report Formatting','PDF formatting','Medium','1. Download PDF report\n2. Verify formatting','Any PDF report','Headers, tables, charts formatted professionally. Print-ready'),
  tc('RPT-024','Report Formatting','Excel formatting','Medium','1. Download Excel report\n2. Verify formatting','Any Excel report','Proper column headers, data types, filters. Professional appearance'),
  tc('RPT-025','Report Generation','Multiple format export','Low','1. Export same report as both Excel and PDF\n2. Compare','Same report, both formats','Both files contain same data. Formatting appropriate for each format'),
];

// ── DASHBOARD & NOTIFICATIONS ──
const dashboardData = [
  tc('DASH-001','Dashboard Overview','View main dashboard','High','1. Navigate to Dashboard from sidebar\n2. Verify page loads completely\n3. All tiles/widgets visible','Navigate to /','Dashboard loads. All widgets visible. No loading errors'),
  tc('DASH-002','Dashboard Overview','Overview tab active by default','High','1. Open Dashboard\n2. Verify "Overview" tab is selected','N/A','Overview tab selected by default. Overview content displayed'),
  tc('DASH-003','Dashboard Overview','Management tab','Medium','1. Click "Management" tab\n2. Verify management view loads','Click: Management','Management view loads with superintendent-related content'),
  tc('DASH-004','Dashboard Overview','All Vessel vs My Vessel toggle','High','1. Click "All Vessel" button\n2. Click "My Vessel" button\n3. Verify data changes','Click: All Vessel / My Vessel','Dashboard data updates based on vessel scope selection'),
  tc('DASH-005','WO KPIs','Overdue WOs tile','High','1. View Overdue WOs KPI tile\n2. Verify count and percentage\n3. Click tile','N/A','Shows count of overdue WOs, percentage of total. Circular progress indicator. Clickable to view list'),
  tc('DASH-006','WO KPIs','Completion rate tile','High','1. View Completion Rate tile\n2. Verify calculation','N/A','Shows completion percentage. Total WOs vs completed. Circular progress indicator'),
  tc('DASH-007','WO KPIs','Outstanding tasks tile','Medium','1. View Outstanding Tasks tile\n2. Verify count and trend','N/A','Shows pending tasks count. Trend vs last month shown'),
  tc('DASH-008','Status Distribution','Status pie chart','High','1. View Work Order Status Distribution chart\n2. Verify segments','N/A','Pie chart shows: Overdue, Due, Pending Approval, Completed. Color-coded segments with legend'),
  tc('DASH-009','Status Distribution','Click pie segment filters WOs','Medium','1. Click "Overdue" segment on pie chart\n2. Verify navigation/filtering','Click: Overdue segment','Navigates to WO list filtered by Overdue status'),
  tc('DASH-010','Status Distribution','Hover shows percentage','Medium','1. Hover over pie chart segments\n2. Verify tooltips','Hover on segments','Tooltip shows count and percentage for each status'),
  tc('DASH-011','Maintenance Trends','6-month trend chart','Medium','1. View maintenance trend line chart\n2. Verify data lines','N/A','Shows Completed %, Outstanding %, Overdue % over 6 months. Multiple color-coded lines'),
  tc('DASH-012','Maintenance Trends','Hover shows exact values','Medium','1. Hover over trend chart points\n2. Verify exact values','Hover on data points','Tooltip shows exact percentage for each month'),
  tc('DASH-013','Overdue WOs List','Top overdue WOs widget','High','1. View Overdue Work Orders widget\n2. Verify top entries shown','N/A','Shows top 5 most overdue WOs: WO Code, Equipment, Status. "View All" link'),
  tc('DASH-014','Overdue WOs List','Click WO navigates to detail','Medium','1. Click on a WO code in overdue list\n2. Verify navigation','Click: WO code','Navigates to work order detail page'),
  tc('DASH-015','Overdue WOs List','View All link','Medium','1. Click "View All (X)" link\n2. Verify navigation','Click: View All','Navigates to full overdue WO list'),
  tc('DASH-016','Inventory & Fleet','Total Spares count','High','1. View Total Spares on dashboard\n2. Verify accuracy','N/A','Count matches actual total spares in system'),
  tc('DASH-017','Inventory & Fleet','Low Stock count','High','1. View Low Stock count\n2. Verify red highlighting if > 0','N/A','Low stock count shown. Red highlighting. Clickable to navigate'),
  tc('DASH-018','Inventory & Fleet','Critical Low Stock count','High','1. View Critical Low Stock (zero stock)\n2. Verify dark red highlighting','N/A','Critical count shown. Dark red. Matches zero-stock spares'),
  tc('DASH-019','Inventory & Fleet','Total Components count','Medium','1. View Total Components count\n2. Verify accuracy','N/A','Count matches actual component total'),
  tc('DASH-020','Inventory & Fleet','Stores Inventory count','Medium','1. View Stores Inventory count\n2. Verify accuracy','N/A','Count matches store items total'),
  tc('DASH-021','Spares Stock Chart','Stock status pie chart','Medium','1. View Spares Stock Status chart\n2. Verify: OK, At Min, Low segments','N/A','Pie chart with OK (green), At Min (orange), Low (red). Counts match actual'),
  tc('DASH-022','Spares Stock Chart','Click segment filters spares','Medium','1. Click chart segment\n2. Verify filtering','Click: Low segment','Navigates to spares filtered by that status'),
  tc('DASH-023','Watch List','Watch list widget visibility','Low','1. View dashboard for watch list widget\n2. Verify content','N/A','Watch list shows critical items: overdue WOs, low stock spares'),
  tc('DASH-024','Supt Notifications','Superintendent tile','High','1. View Superintendent Notifications tile\n2. Verify pending count','N/A','Shows pending acknowledgment count badge. Red if > 0. Clickable'),
  tc('DASH-025','Supt Notifications','Click navigates to supt page','Medium','1. Click Superintendent tile\n2. Verify navigation','Click: tile','Navigates to Superintendent/Management page'),
  tc('DASH-026','Anomaly Panel','Compliance Anomaly Detection (Sail Admin)','High','1. Login as Sail Admin\n2. View Dashboard Overview\n3. Verify anomaly panel','Login: Sail Admin','Panel visible with: Cycle Skip Rate, Backdating Frequency, Bulk Completion Events, Schedule Drift'),
  tc('DASH-027','Anomaly Panel','Anomaly panel hidden (non-Sail Admin)','High','1. Login as Client Admin\n2. View Dashboard Overview\n3. Check for anomaly panel','Login: Client Admin','Anomaly panel NOT visible. No empty space where it would be'),
  tc('DASH-028','Anomaly Panel','Cycle Skip Rate card','Medium','1. View Cycle Skip Rate\n2. Verify percentage and details','N/A','Shows percentage, rank with highest skip rate, "View Details" link'),
  tc('DASH-029','Anomaly Panel','Backdating Frequency card','Medium','1. View Backdating Frequency\n2. Verify data','N/A','Shows % of WOs with backdating. "View Details" link'),
  tc('DASH-030','Anomaly Panel','Bulk Completion Events card','Medium','1. View Bulk Completion Events\n2. Verify count and pattern','N/A','Shows event count, period, pattern description. "View Details" link'),
  tc('DASH-031','Anomaly Panel','Schedule Drift card','Medium','1. View Schedule Drift\n2. Verify average lateness','N/A','Shows average lateness in days, trend. "View Details" link'),
  tc('DASH-032','WO Anomalies Tile','Anomaly tile (Sail Admin)','High','1. As Sail Admin, view WO Anomalies tile\n2. Verify content','Login: Sail Admin','Tile shows: pending count badge, severity badges (HIGH/MED/LOW), anomaly cards'),
  tc('DASH-033','WO Anomalies Tile','Anomaly tile hidden (non-Sail Admin)','High','1. As non-Sail Admin, check for WO Anomalies tile','Login: Client Admin','WO Anomalies tile NOT visible'),
  tc('DASH-034','WO Anomalies Tile','Severity filter dropdown','Medium','1. Click severity dropdown\n2. Filter by HIGH\n3. Filter by ALL','Select: HIGH, then ALL','Cards filter by severity. Counts update'),
  tc('DASH-035','WO Anomalies Tile','Refresh anomalies','Medium','1. Click refresh button on anomalies tile\n2. Verify data reloads','Click: Refresh','Loading indicator shown. Data refreshes'),
  tc('DASH-036','Dashboard Filters','Vessel filter on dashboard','High','1. Select vessel from dashboard filter\n2. Verify all widgets update','Select: Vessel 3','All dashboard tiles/charts update to show data for selected vessel only'),
  tc('DASH-037','Dashboard Filters','Clear filters','Medium','1. Apply vessel filter\n2. Click "Clear"\n3. Verify reset','Click: Clear','All filters reset. Dashboard shows default (all vessels) view'),
  tc('DASH-038','Dashboard Filters','Year selector','Medium','1. Change year selector (if available)\n2. Verify trend charts update','Year: 2026','Trend charts and KPIs update for selected year'),
  tc('DASH-039','Notifications','Notification bell icon','Medium','1. Look for bell icon in header\n2. Verify badge with unread count','N/A','Bell icon visible. Badge shows unread notification count'),
  tc('DASH-040','Notifications','Click bell opens panel','Medium','1. Click notification bell\n2. Verify notification panel opens','Click: bell icon','Notifications panel opens showing list of notifications'),
  tc('DASH-041','Notifications','Notification types','Medium','1. View notifications\n2. Verify different types present','N/A','Types: WO overdue, Pending approval, Low stock, Superintendent, Anomaly detected'),
  tc('DASH-042','Notifications','Mark notification as read','Medium','1. Click on unread notification\n2. Verify marked as read','Click: notification','Notification styling changes. Badge count decreases'),
  tc('DASH-043','User Profile','View profile','Medium','1. Click user icon in header\n2. Verify user info displayed','Click: user icon','Shows: Name, Role, Vessel. Profile options'),
  tc('DASH-044','User Profile','Logout','High','1. Click Logout button\n2. Verify session ends','Click: Logout','Session ends. Redirected to login page. Cannot access pages without login'),
  tc('DASH-045','Responsive','Desktop layout','Medium','1. View dashboard at 1920px width\n2. Verify layout','Screen: 1920px','Grid layout. All widgets visible. Charts rendered properly'),
  tc('DASH-046','Responsive','Tablet layout','Low','1. View dashboard at 768px width\n2. Verify responsive','Screen: 768px','Tiles stack. Charts resize. Navigation accessible'),
  tc('DASH-047','Responsive','Mobile layout','Low','1. View dashboard at 375px\n2. Verify mobile layout','Screen: 375px','Single column. Sidebar collapsed to menu. Touch-friendly'),
  tc('DASH-048','Error Handling','Network error','Medium','1. Disconnect network\n2. View dashboard behavior','No network','Error: "Unable to load data". Retry button available'),
  tc('DASH-049','Error Handling','Session timeout','Medium','1. Leave dashboard idle for timeout period\n2. Verify redirect','Idle for timeout','Redirected to login: "Session expired. Please login again."'),
  tc('DASH-050','Error Handling','Permission check','Medium','1. Login with restricted role\n2. Verify protected widgets','Restricted role user','Protected widgets hidden or show "Access Denied". Cannot perform unauthorized actions'),
  tc('DASH-051','Chatbot','Chat button visible (Sail Admin)','High','1. Login as Sail Admin\n2. Check bottom-right corner','Login: Sail Admin','Floating chat button with message icon visible in bottom-right'),
  tc('DASH-052','Chatbot','Chat button hidden (non-Sail Admin)','High','1. Login as Client Admin\n2. Check bottom-right corner','Login: Client Admin','No chat button visible anywhere on dashboard'),
];

// ── BUILD THE WORKBOOK ──
async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PMS UAT Generator';
  wb.created = new Date();

  const modules = [
    { name: 'Summary', data: null, prefix: '' },
    { name: 'Components Module', data: componentsData, prefix: 'COMP' },
    { name: 'Work Orders Module', data: workOrdersData, prefix: 'WO' },
    { name: 'Running Hours Module', data: runningHoursData, prefix: 'RH' },
    { name: 'Spares Module', data: sparesData, prefix: 'SP' },
    { name: 'Stores Module', data: storesData, prefix: 'ST' },
    { name: 'Reports Module', data: reportsData, prefix: 'RPT' },
    { name: 'Dashboard & Notifications', data: dashboardData, prefix: 'DASH' },
  ];

  const moduleCounts = {};

  for (const mod of modules) {
    if (mod.name === 'Summary') continue;
    const ws = wb.addWorksheet(mod.name);

    ws.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = ws.getRow(1);
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell(cell => { cell.border = THIN_BORDER; });

    ws.views = [{ state: 'frozen', ySplit: 1 }];

    ws.autoFilter = { from: 'A1', to: 'L1' };

    for (let i = 0; i < mod.data.length; i++) {
      const row = ws.addRow(mod.data[i]);
      row.font = DATA_FONT;
      row.fill = (i % 2 === 0) ? WHITE_FILL : GRAY_FILL;
      row.alignment = { vertical: 'top', wrapText: false };
      row.height = 25;

      ['steps', 'expected', 'actual'].forEach(key => {
        const cell = row.getCell(key);
        cell.alignment = { vertical: 'top', wrapText: true };
      });

      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = THIN_BORDER;
      });
      for (let col = 1; col <= 12; col++) {
        const cell = row.getCell(col);
        if (!cell.border) cell.border = THIN_BORDER;
      }
    }

    const priorityCol = ws.getColumn('priority');
    for (let r = 2; r <= mod.data.length + 1; r++) {
      ws.getCell(r, 4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"High,Medium,Low"'],
      };
    }

    for (let r = 2; r <= mod.data.length + 1; r++) {
      ws.getCell(r, 9).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Pass,Fail,Blocked,Not Tested"'],
      };
    }

    ws.addConditionalFormatting({
      ref: `I2:I${mod.data.length + 1}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Pass"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF92D050' } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Fail"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Blocked"'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFFF00' } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Not Tested"'], priority: 4, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFFF00' } } } },
      ],
    });

    ws.pageSetup = {
      fitToPage: true,
      fitToWidth: 1,
      orientation: mod.name === 'Work Orders Module' ? 'landscape' : 'portrait',
    };
    ws.headerFooter = { oddHeader: `&C${mod.name} - PMS UAT Test Cases` };

    moduleCounts[mod.name] = mod.data.length;
  }

  // ── SUMMARY SHEET ──
  const summary = wb.addWorksheet('Summary');
  wb.worksheets.forEach((ws, idx) => {
    if (ws.name === 'Summary') {
      const currentPos = wb.worksheets.indexOf(ws);
      if (currentPos > 0) {
        wb.removeWorksheet(ws.id);
        const s = wb.addWorksheet('Summary', { properties: {} });
        buildSummarySheet(s, moduleCounts);
        const sheets = wb.worksheets;
        const summaryWs = sheets[sheets.length - 1];
      }
    }
  });
  buildSummarySheet(summary, moduleCounts);

  const orderedNames = ['Summary', 'Components Module', 'Work Orders Module', 'Running Hours Module', 'Spares Module', 'Stores Module', 'Reports Module', 'Dashboard & Notifications'];

  const outPath = path.join(__dirname, '..', 'PMS_Test_Cases_Comprehensive.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`Generated: ${outPath}`);
  console.log('Module counts:');
  let total = 0;
  for (const [m, c] of Object.entries(moduleCounts)) {
    console.log(`  ${m}: ${c} test cases`);
    total += c;
  }
  console.log(`  TOTAL: ${total} test cases`);
}

function buildSummarySheet(ws, moduleCounts) {
  ws.views = [{ state: 'frozen', ySplit: 0 }];

  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'PMS (Planned Maintenance System) — UAT Test Cases';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1F4E78' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = 'Comprehensive Test Case Document for User Acceptance Testing';
  ws.getCell('A2').font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF666666' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:F3');
  ws.getCell('A3').value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  ws.getCell('A3').font = { name: 'Arial', size: 10, color: { argb: 'FF999999' } };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  const row5 = ws.getRow(5);
  ws.getCell('A5').value = 'MODULE';
  ws.getCell('B5').value = 'SHEET NAME';
  ws.getCell('C5').value = 'TOTAL TEST CASES';
  ws.getCell('D5').value = 'PASSED';
  ws.getCell('E5').value = 'FAILED';
  ws.getCell('F5').value = 'PASS RATE (%)';
  row5.font = HEADER_FONT;
  row5.fill = HEADER_FILL;
  row5.alignment = { horizontal: 'center', vertical: 'middle' };
  row5.height = 28;
  for (let c = 1; c <= 6; c++) ws.getCell(5, c).border = THIN_BORDER;

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 15;

  const moduleList = [
    ['1. Components', 'Components Module'],
    ['2. Work Orders', 'Work Orders Module'],
    ['3. Running Hours', 'Running Hours Module'],
    ['4. Spares', 'Spares Module'],
    ['5. Stores', 'Stores Module'],
    ['6. Reports', 'Reports Module'],
    ['7. Dashboard & Notifications', 'Dashboard & Notifications'],
  ];

  let r = 6;
  let total = 0;
  for (const [label, sheet] of moduleList) {
    const count = moduleCounts[sheet] || 0;
    total += count;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 2).value = sheet;
    ws.getCell(r, 3).value = count;
    ws.getCell(r, 4).value = '';
    ws.getCell(r, 5).value = '';
    ws.getCell(r, 6).value = '';
    const row = ws.getRow(r);
    row.font = DATA_FONT;
    row.fill = (r % 2 === 0) ? GRAY_FILL : WHITE_FILL;
    row.alignment = { vertical: 'middle' };
    row.height = 22;
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = THIN_BORDER;
    r++;
  }

  ws.getCell(r, 1).value = 'TOTAL';
  ws.getCell(r, 1).font = { name: 'Arial', size: 11, bold: true };
  ws.getCell(r, 3).value = total;
  ws.getCell(r, 3).font = { name: 'Arial', size: 11, bold: true };
  const totalRow = ws.getRow(r);
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  totalRow.height = 25;
  for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = THIN_BORDER;

  r += 2;
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = 'TEST ENVIRONMENT DETAILS';
  ws.getCell(`A${r}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  r++;

  const envDetails = [
    ['Application', 'PMS — Planned Maintenance System'],
    ['Version', 'v1.0 (UAT)'],
    ['Environment', 'UAT / Staging'],
    ['URL', '[To be provided]'],
    ['Browser', 'Chrome (latest), Firefox (latest), Edge (latest)'],
    ['Test Period', '[Start Date] to [End Date]'],
    ['Test Lead', '[Name]'],
  ];
  for (const [label, val] of envDetails) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: 'Arial', size: 10, bold: true };
    ws.getCell(r, 2).value = val;
    ws.getCell(r, 2).font = DATA_FONT;
    ws.getRow(r).height = 20;
    r++;
  }

  r += 1;
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = 'TESTING INSTRUCTIONS';
  ws.getCell(`A${r}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  r++;

  const instructions = [
    '1. Navigate to the relevant module sheet for the area being tested.',
    '2. Follow the Test Steps column exactly as described.',
    '3. Use the Test Data provided (or substitute equivalent valid/invalid data).',
    '4. Compare the actual result with the Expected Result.',
    '5. Mark Pass/Fail in column I. Use "Blocked" if a prerequisite prevents testing.',
    '6. Record any issues, bugs, or observations in the Comments column.',
    '7. Enter your name and the test date in columns K and L.',
    '8. Priority guide: High = must pass for go-live, Medium = important, Low = nice-to-have.',
  ];
  for (const instr of instructions) {
    ws.getCell(r, 1).value = instr;
    ws.getCell(r, 1).font = DATA_FONT;
    ws.getRow(r).height = 18;
    r++;
  }

  r += 1;
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = 'KNOWN ISSUES / LIMITATIONS';
  ws.getCell(`A${r}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  r++;
  ws.getCell(r, 1).value = '(To be updated during testing)';
  ws.getCell(r, 1).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF999999' } };
}

buildWorkbook().catch(err => { console.error(err); process.exit(1); });
