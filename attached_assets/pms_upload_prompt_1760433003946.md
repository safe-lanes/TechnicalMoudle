# PMS Machinery Component Upload Functionality - Testing Requirements

## Objective
Test the file upload functionality in **PMS → Admin → Machinery Component** module to ensure accurate data mapping and reflection in the **PMS → Components** module.

## Functional Requirements

### Upload Specification
- **Module Path**: PMS → Admin → Machinery Component
- **Supported File Formats**: 
  - `.csv` (Comma-Separated Values)
  - `.xls` (Excel 97-2003)
  - `.xlsx` (Excel 2007 and later)

### Data Flow
1. Upload file via Admin interface
2. Parse and validate data from uploaded file
3. Map fields to corresponding database schema
4. Display imported data in PMS → Components module

## Task Requirements

### 1. Sample File Creation
Create sample data files (CSV, XLS, XLSX) with the following considerations:

#### Required Fields Analysis
Reference the existing **PMS → Components** module to identify:
- **Required Fields** (mandatory for successful import)
- **Optional Fields** (can be null/empty)
- **Field Data Types** (text, number, date, dropdown values, etc.)
- **Field Constraints** (min/max length, valid value ranges, format requirements)

#### Field Extraction from PMS → Components Module

**IMPORTANT**: Do NOT use assumed or typical fields. Follow this process:

1. **Navigate to PMS → Components Module**
   - Open the existing Components module in the application
   - Inspect the data table/grid view
   - Check the "Add New Component" or "Edit Component" form

2. **Extract Exact Field Names**
   - Document ALL visible column headers in the Components listing
   - Document ALL form fields in the Add/Edit interface
   - Note the exact spelling, case, and format of each field name
   - Identify which fields have asterisks (*) or "required" indicators

3. **Capture Field Properties**
   For each field, document:
   - **Field Label/Name** (exact text as shown in UI)
   - **Data Type** (text, number, date, dropdown, checkbox, etc.)
   - **Required/Optional** status
   - **Dropdown Options** (if applicable, list all valid values)
   - **Format Requirements** (e.g., date format: DD/MM/YYYY or MM/DD/YYYY)
   - **Validation Rules** (max length, numeric ranges, patterns)
   - **Default Values** (if any)

4. **Database Field Mapping**
   - Check the database schema or API endpoints if accessible
   - Map UI field labels to actual database column names
   - Note if there are hidden fields (IDs, timestamps, created_by, etc.)

5. **Create Field Reference Table**
   
   | UI Field Label | Database Column | Data Type | Required | Format/Options | Example Value |
   |---|---|---|---|---|---|
   | (Extract from actual module) | (from DB/API) | (text/number/date) | (Yes/No) | (constraints) | (sample) |

### 2. Field Mapping Verification
Ensure accurate field binding between:
- **Source File Headers** ↔ **PMS Components Database Fields**
- Header names should match exactly or follow the expected naming convention
- Data formats should align with system requirements

### 3. Test Scenarios
Create sample files that test:
- ✅ **Valid data** - Complete records with all required fields
- ⚠️ **Partial data** - Records with only required fields (optional fields empty)
- ❌ **Invalid data** - Records with format errors, missing required fields, or constraint violations
- 🔄 **Edge cases** - Special characters, maximum field lengths, date formats, numeric ranges

### 4. Validation Checklist
After upload, verify:
- [ ] All records imported successfully (or appropriate error messages shown)
- [ ] Data displays correctly in PMS → Components module
- [ ] Field mappings are accurate (no data in wrong columns)
- [ ] Data types preserved (dates as dates, numbers as numbers)
- [ ] Dropdown/enum values match predefined options
- [ ] Duplicate handling works as expected
- [ ] Special characters and unicode text handled properly

## Deliverables

1. **Sample CSV file** with 10-15 sample records
2. **Sample XLS file** with the same data structure
3. **Sample XLSX file** with the same data structure
4. **Documentation** explaining:
   - Field mapping table (File Header → Database Field)
   - Data format requirements for each field
   - Any assumptions made about the schema

## Implementation Notes

```
- Check existing PMS → Components UI for exact field names and formats
- Use consistent column headers across all file formats
- Include sample data that represents real-world scenarios
- Test with both small and large datasets if possible
- Document any import errors or validation messages encountered
```

## Expected Outcome
A functional file upload system where machinery component data can be bulk imported via CSV/Excel files and accurately reflected in the PMS Components module with proper field binding and data validation.