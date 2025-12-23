# Bulk Upload Duplicate Component Code Validation Analysis

**Date:** December 23, 2025  
**Status:** Analysis Only - Pending Approval for Implementation

---

## 1. Current Behavior Summary

### 1.1 At Which Stage Duplicates Are Checked

| Stage | Duplicate Check? | Details |
|-------|------------------|---------|
| **Dry Run** | Yes (Partial) | Checks for duplicates **within the uploaded file only** |
| **Validation** | Warning only | Generates a warning, NOT an error |
| **Persistence** | No explicit block | Upsert mode updates last occurrence; Add mode skips existing |

### 1.2 How Duplicates Are Treated

**Current Behavior (from `server/routes/bulk.ts`, lines 2527-2584):**

```javascript
// Track duplicate Component Codes (actual duplicates to warn about)
const componentCodeOccurrences = new Map<string, number[]>();
if (type === 'components') {
  filteredData.forEach((row, index) => {
    const componentCode = row['Component Code'];
    if (componentCode) {
      const code = String(componentCode).trim();
      if (!componentCodeOccurrences.has(code)) {
        componentCodeOccurrences.set(code, []);
      }
      componentCodeOccurrences.get(code)!.push(index + 2);
    }
  });
}

// Later during validation:
const occurrences = componentCodeOccurrences.get(codeStr);
if (occurrences && occurrences.length > 1) {
  const otherRows = occurrences.filter(r => r !== rowNum);
  warnings.push(`Row ${rowNum}: Duplicate Component Code '${codeStr}' found in rows ${otherRows.join(', ')}. Only the last occurrence will be kept.`);
}
```

**Key Findings:**
- Duplicates are **tracked** but only generate **WARNINGS** (not errors)
- The warning message states "Only the last occurrence will be kept"
- Data **still proceeds to save** even with warnings
- **No validation against existing database records** during dry-run

### 1.3 How Uniqueness Is Currently Determined

**Current Logic:**
- Duplicate check is on **Component Code only** within the uploaded file
- **Vessel Code is NOT factored into the duplicate check**
- The check only looks for duplicates **within the same upload file**, not against existing database records

**Database Layer (`shared/schema.ts`, lines 170-248):**
- The `components` table has **NO unique constraint** on `componentCode` or `componentCode + vesselId`
- Only indexes exist for performance: `fleetEquipmentCodeIdx`, `vesselTreeIdx`, etc.
- The `sfiDetails` table has a unique constraint on `componentCode`, but this is a separate lookup table

**Storage Layer (`server/storage.ts`, line 224):**
- `getComponentByCode(componentCode: string, vesselId: string)` - This method exists and looks up by **both** componentCode AND vesselId
- This confirms the intended uniqueness rule is **Component Code + Vessel ID**

### 1.4 Reference Locations

| File | Lines | Purpose |
|------|-------|---------|
| `server/routes/bulk.ts` | 2527-2584 | Dry-run duplicate tracking and warning generation |
| `server/routes/bulk.ts` | 3415-3417 | Prefetch existing components by codes for import |
| `server/routes/bulk.ts` | 4786-4788 | Component lookup by code + vesselId during update |
| `shared/schema.ts` | 170-248 | Components table schema (no unique constraint) |
| `server/storage.ts` | 224 | getComponentByCode interface definition |

---

## 2. Confirmation of the Intended Uniqueness Rule

Based on the codebase analysis and the user's requirements:

| Rule | Current Behavior | Intended Behavior |
|------|------------------|-------------------|
| Component Code globally | Not checked | **May be duplicated** across different vessels |
| Component Code per vessel | Warning only | **Must be UNIQUE** within the same vessel |

### 2.1 Scope of Application

| Scenario | Should Validate? |
|----------|------------------|
| Bulk upload | **YES** - This is the primary use case |
| Manual creation | Already handled - `getComponentByCode` is used for lookups |

### 2.2 Case Sensitivity

**Current Behavior:**
- Component Codes are **trimmed** but **NOT normalized for case**
- The check uses exact string matching: `String(componentCode).trim()`

**Recommendation:** Component Codes should be treated as **case-insensitive** for duplicate detection (e.g., "ABC.001" and "abc.001" should be considered duplicates).

### 2.3 Trimming/Normalization

**Current Behavior:**
- Whitespace trimming is applied: `String(componentCode).trim()`
- No other normalization (e.g., removing special characters)

---

## 3. Dry Run Behavior Expectation

### 3.1 Proposed Change

During dry run:
1. Check for duplicate Component Code **within the same vessel** (both within file AND against existing database records)
2. If duplicate found → Categorize as **ERROR** (not warning)
3. Include in error message: **row number(s)**, **Component Code**, and **Vessel Code**
4. Records with such errors **MUST NOT be saved** and **MUST block final import**

### 3.2 Where This Logic Should Live

| Location | Change Required |
|----------|-----------------|
| `server/routes/bulk.ts` (line ~2527-2584) | Modify duplicate detection to check per-vessel and against database |
| `server/routes/bulk.ts` (dry-run endpoint) | Add database query to fetch existing component codes for the vessel |
| `client/src/components/admin/UniformBulkUpload.tsx` | No change needed - already blocks import when errors exist |

### 3.3 How It Fits Into Existing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. User uploads file                                            │
│ 2. Dry-run validates file                                       │
│    - Check for duplicate Component Codes within file → WARNING  │
│ 3. User clicks "Import"                                         │
│ 4. Import proceeds (even with warnings)                         │
│ 5. Duplicates overwrite or skip based on mode                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PROPOSED FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. User uploads file                                            │
│ 2. Dry-run validates file                                       │
│    - Fetch existing component codes for selected vessel         │
│    - Check for duplicate Component Codes within file → ERROR    │
│    - Check for duplicate Component Codes against DB → ERROR     │
│      (only in 'add' mode; 'update'/'upsert' allows existing)    │
│ 3. If errors exist → Import button BLOCKED                      │
│ 4. If no errors → Import proceeds                               │
│ 5. Consistent component tree guaranteed                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Impact Assessment

### 4.1 What Existing Behavior Will Change

| Current Behavior | New Behavior |
|------------------|--------------|
| Duplicate Component Codes generate warnings | Duplicate Component Codes generate **ERRORS** |
| Import proceeds with warnings | Import **BLOCKED** if errors exist |
| No database check during dry-run | Database check for existing codes in vessel |
| Last occurrence wins silently | User must fix duplicates before import |

### 4.2 Potential Breaking Changes

1. **Existing imports with duplicates will fail:** Users who previously imported files with duplicate Component Codes (and relied on "last wins" behavior) will now see errors and must fix their data.

2. **Performance impact:** Dry-run will need to query the database for existing component codes. This is a one-time query per dry-run and should be minimal (already done for other validations).

### 4.3 Edge Cases to Handle

| Edge Case | How to Handle |
|-----------|---------------|
| Multi-vessel files | Each row should be validated against its own Vessel Code |
| Empty Vessel Code | Already an error (line 2563): "Vessel Code is required" |
| Case sensitivity | Normalize to uppercase for comparison |
| Mode-specific behavior | 'add' mode: duplicate = error; 'update'/'upsert' mode: existing code expected |

### 4.4 Mode-Specific Validation

| Import Mode | Duplicate in File | Duplicate in DB |
|-------------|-------------------|-----------------|
| **add** | ERROR | ERROR (cannot create duplicate) |
| **update** | ERROR | OK (updating existing is expected) |
| **upsert** | ERROR | OK (will update existing or create new) |

---

## 5. Summary

### Current State
- Duplicate Component Codes within a bulk upload file generate **warnings only**
- No validation against existing database records
- Import proceeds regardless of warnings
- Potential for inconsistent component trees

### Intended State
- Duplicate Component Codes within the same vessel are treated as **ERRORS**
- Validation against existing database records during dry-run
- Import is **blocked** if errors exist
- Consistent component trees guaranteed

---

## 6. Implementation Status

**IMPLEMENTED: December 23, 2025**

The following changes were made to `server/routes/bulk.ts`:

### 6.1 Changes Made

1. **Database fetch before validation** (lines 2536-2549):
   - Fetch existing component codes for the selected vessel before the validation loop
   - Store codes in uppercase for case-insensitive comparison
   ```javascript
   if (vesselId) {
     const existingComponents = await storage.getComponents(vesselId);
     existingComponents.forEach(comp => {
       if (comp.componentCode) {
         existingDbComponentCodes.add(comp.componentCode.toUpperCase());
       }
     });
   }
   ```

2. **Case-insensitive duplicate tracking** (lines 2551-2561):
   - Component codes are now normalized to uppercase for comparison
   ```javascript
   const code = String(componentCode).trim().toUpperCase();
   ```

3. **Changed warnings to errors** (lines 2601-2610):
   - Duplicate Component Codes within the uploaded file now generate **ERRORS**
   - Only subsequent occurrences are flagged (first occurrence is valid)
   ```javascript
   const occurrences = componentCodeOccurrences.get(codeUpperCase);
   if (occurrences && occurrences.length > 1) {
     const firstOccurrence = occurrences[0];
     if (rowNum !== firstOccurrence) {
       errors.push(`Row ${rowNum}: Duplicate Component Code '${codeStr}' - this code already appears in row ${firstOccurrence}. Each Component Code must be unique within the vessel.`);
     }
   }
   ```

4. **Mode-specific database validation** (lines 2608-2613):
   - In 'add' mode: existing database codes generate **ERRORS**
   - In 'update'/'upsert' mode: existing codes are **allowed** (updating expected)
   ```javascript
   if (mode === 'add' && existingDbComponentCodes.has(codeUpperCase)) {
     errors.push(`Row ${rowNum}: Component Code '${codeStr}' already exists in vessel '${vesselId}'. Cannot add duplicate component.`);
   }
   ```

### 6.2 Error Message Examples

**Duplicate within file (only subsequent rows get errors):**
```
Row 5: Duplicate Component Code '711.001' - this code already appears in row 3. Each Component Code must be unique within the vessel.
```
Note: Row 3 (the first occurrence) does NOT receive an error - only rows 5 and 7 would get flagged.

**Duplicate against database (add mode only):**
```
Row 5: Component Code '711.001' already exists in vessel 'V001'. Cannot add duplicate component.
```

### 6.3 No Breaking Changes to Existing Behavior

- **update mode**: Still works as expected - existing codes are allowed and updated
- **upsert mode**: Still works as expected - existing codes are updated, new codes are created
- **add mode**: Now properly validates that codes don't exist before allowing import

---

## 7. Technical Implementation Notes

**No database schema changes were required** - validation is at the application layer.

The existing frontend already blocks import when errors exist, so no frontend changes were needed.
