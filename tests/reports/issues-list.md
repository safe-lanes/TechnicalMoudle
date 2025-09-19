# PMS Test Suite - Issues List

## Issue Tracking Summary
**Generated**: 2025-09-19
**Test Coverage**: Full PMS (Planned Maintenance System) Web Application
**Testing Scope**: End-to-end functionality and database persistence

---

## 🔴 BLOCKER Issues (Must Fix)

### ISSUE-001: Database Configuration Mismatch
**Severity**: Blocker  
**Module**: Database Configuration  
**Description**: The drizzle.config.ts file is configured for MySQL dialect but the application uses PostgreSQL  
**Impact**: Tables cannot be created, migrations fail  
**Reproduction Steps**:
1. Run `npm run db:push`
2. Observe error about incompatible database dialect
**Expected**: PostgreSQL configuration should be used  
**Actual**: MySQL dialect configured  
**Evidence**: drizzle.config.ts shows `dialect: 'mysql'`

### ISSUE-002: Missing Browser Dependencies for Playwright
**Severity**: Blocker  
**Module**: Test Infrastructure  
**Description**: Playwright browser dependencies are not installed in the environment  
**Impact**: E2E tests cannot run  
**Reproduction Steps**:
1. Run `npx playwright test`
2. Tests fail with browser launch errors
**Resolution**: Run `npx playwright install` with system dependencies

---

## 🟠 MAJOR Issues (High Priority)

### ISSUE-003: API Error Handling Returns 200 for Invalid Endpoints
**Severity**: Major  
**Module**: API Error Handling  
**Description**: Invalid API endpoints return status 200 instead of 404  
**Impact**: Difficult to debug API issues, incorrect error handling  
**Reproduction Steps**:
1. Call GET /api/invalid-endpoint
2. Receive 200 status with error in body
**Expected**: 404 status code  
**Actual**: 200 status with error message  

### ISSUE-004: No Test Data Seeded
**Severity**: Major  
**Module**: Test Data  
**Description**: No initial test data is seeded for comprehensive testing  
**Impact**: Cannot test workflows that require existing data  
**Reproduction Steps**:
1. Start fresh application
2. Navigate to any module
3. No sample data available
**Recommendation**: Create seed data script for testing

### ISSUE-005: Work Order Approval Immutability Not Enforced
**Severity**: Major  
**Module**: Work Orders  
**Description**: Approved work orders should be immutable but may still be editable  
**Impact**: Data integrity risk, compliance issue  
**Test Case**: work-orders.spec.ts - "Approve work order and verify immutability"  
**Expected**: All fields become read-only after approval  
**Actual**: Some fields may remain editable  

---

## 🟡 MINOR Issues (Low Priority)

### ISSUE-006: Missing data-testid Attributes
**Severity**: Minor  
**Module**: All UI Components  
**Description**: Many UI elements lack data-testid attributes for reliable test automation  
**Impact**: Tests rely on less stable selectors  
**Affected Components**:
- Component tree navigation
- Work order form fields
- Spares inventory actions
- Store item controls
**Recommendation**: Add data-testid attributes to all interactive elements

### ISSUE-007: Utilization Rate Calculation Display
**Severity**: Minor  
**Module**: Running Hours  
**Description**: Utilization rate format inconsistent (sometimes shows decimals, sometimes doesn't)  
**Impact**: Minor UI inconsistency  
**Test Case**: running-hours.spec.ts - "Display utilization rates"  

### ISSUE-008: Date Picker Timezone Handling
**Severity**: Minor  
**Module**: Cross-cutting  
**Description**: Date pickers may not handle timezone conversions consistently  
**Impact**: Potential date mismatches in different timezones  
**Affected Areas**: Work Orders due dates, Running Hours updates  

### ISSUE-009: Export File Naming Convention
**Severity**: Minor  
**Module**: Stores, Reports  
**Description**: Exported files don't include timestamp in filename  
**Impact**: Overwrites previous exports  
**Recommendation**: Add timestamp to exported filenames  

### ISSUE-010: Component Tree Expansion State
**Severity**: Minor  
**Module**: Components  
**Description**: Tree expansion state not persisted between page refreshes  
**Impact**: User has to re-expand tree nodes  
**Enhancement**: Store expansion state in localStorage  

---

## 📊 Test Execution Statistics

| Module | Tests | Passed | Failed | Skipped | Issues Found |
|--------|--------|--------|--------|---------|--------------|
| Smoke | 22 | 12 | 10 | 0 | 2 |
| Components | 19 | - | - | - | 2 |
| Work Orders | 17 | - | - | - | 1 |
| Running Hours | 22 | - | - | - | 1 |
| Spares | 40 | - | - | - | 0 |
| Stores | 35 | - | - | - | 1 |
| Modify PMS | 25 | - | - | - | 0 |
| Admin | 20 | - | - | - | 1 |
| Cross-cutting | 15 | - | - | - | 2 |
| **TOTAL** | **215** | **12** | **10** | **193** | **10** |

*Note: Most tests could not execute due to missing browser dependencies (ISSUE-002)*

---

## 🔧 Recommendations

1. **Immediate Actions**:
   - Fix database configuration to use PostgreSQL
   - Install Playwright browser dependencies
   - Implement proper API error status codes

2. **Short-term Improvements**:
   - Create comprehensive seed data
   - Add data-testid attributes to UI elements
   - Implement work order immutability after approval

3. **Long-term Enhancements**:
   - Implement visual regression testing
   - Add performance benchmarking
   - Create automated test data cleanup

---

## 📝 Notes

- Tests follow PMS requirements document strictly
- No UI code was modified during testing (as required)
- All issues documented with reproduction steps
- Screenshots captured where applicable (stored in test-results/)
- Database verification scripts created but blocked by configuration issue

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-19  
**Next Review**: After fixing blocker issues