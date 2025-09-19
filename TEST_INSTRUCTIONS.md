# Playwright Testing Framework - Instructions

## Overview
A comprehensive Playwright testing framework has been set up for the PMS application with full E2E test coverage for all modules.

## Installation
The Playwright test framework is already installed. To install Playwright browsers (first time only):
```bash
npx playwright install
```

## Running Tests

### Using the Test Runner Script
```bash
# Make the script executable (already done)
chmod +x run-tests.sh

# Run specific test suites
./run-tests.sh smoke          # Smoke tests
./run-tests.sh components     # Components module
./run-tests.sh work-orders    # Work orders module
./run-tests.sh running-hours  # Running hours module
./run-tests.sh spares         # Spares module
./run-tests.sh stores         # Stores module
./run-tests.sh modify-pms     # Modify PMS module
./run-tests.sh admin          # Admin module
./run-tests.sh cross-cutting  # Cross-cutting concerns
./run-tests.sh all            # All tests

# Run tests with UI
./run-tests.sh ui             # Open Playwright UI mode
./run-tests.sh headed         # Run tests in headed mode (visible browser)
./run-tests.sh debug          # Run tests in debug mode
./run-tests.sh report         # View last test report
```

### Using NPM Scripts (To be added to package.json)
Add the following scripts to your package.json:
```json
"scripts": {
  // ... existing scripts ...
  "test": "playwright test",
  "test:smoke": "playwright test tests/e2e/smoke.spec.ts",
  "test:components": "playwright test tests/e2e/components.spec.ts",
  "test:work-orders": "playwright test tests/e2e/work-orders.spec.ts",
  "test:running-hours": "playwright test tests/e2e/running-hours.spec.ts",
  "test:spares": "playwright test tests/e2e/spares.spec.ts",
  "test:stores": "playwright test tests/e2e/stores.spec.ts",
  "test:modify-pms": "playwright test tests/e2e/modify-pms.spec.ts",
  "test:admin": "playwright test tests/e2e/admin.spec.ts",
  "test:cross-cutting": "playwright test tests/e2e/cross-cutting.spec.ts",
  "test:ui": "playwright test --ui",
  "test:headed": "playwright test --headed",
  "test:debug": "playwright test --debug",
  "test:report": "playwright show-report",
  "test:parallel": "playwright test --workers=4",
  "test:db-verify": "tsx tests/db/verification.ts"
}
```

### Using Playwright CLI Directly
```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/smoke.spec.ts

# Run tests in headed mode
npx playwright test --headed

# Run tests in UI mode
npx playwright test --ui

# Run tests in debug mode
npx playwright test --debug

# Run tests in parallel (4 workers)
npx playwright test --workers=4

# Show test report
npx playwright show-report
```

## Test Structure

### Test Files
- **tests/e2e/smoke.spec.ts** - Basic environment and setup verification
- **tests/e2e/components.spec.ts** - Component module functionality
- **tests/e2e/work-orders.spec.ts** - Work order management flows
- **tests/e2e/running-hours.spec.ts** - Running hours tracking
- **tests/e2e/spares.spec.ts** - Spares inventory management
- **tests/e2e/stores.spec.ts** - Stores inventory management
- **tests/e2e/modify-pms.spec.ts** - Change request workflows
- **tests/e2e/admin.spec.ts** - Admin functionality
- **tests/e2e/cross-cutting.spec.ts** - Authentication, validation, RBAC, performance

### Test Helpers
- **tests/helpers/auth.helper.ts** - Authentication and login helpers
- **tests/helpers/navigation.helper.ts** - Navigation between modules
- **tests/helpers/form.helper.ts** - Form filling utilities
- **tests/helpers/table.helper.ts** - Table interaction helpers
- **tests/helpers/modal.helper.ts** - Modal/dialog handling
- **tests/helpers/component-tree.helper.ts** - Component tree navigation
- **tests/helpers/screenshot.helper.ts** - Screenshot capture utilities

### Test Fixtures
- **tests/fixtures/users.ts** - Test user accounts
- **tests/fixtures/test-data.ts** - Test data generators with unique IDs

### Database Verification
- **tests/db/verification.ts** - Database integrity checks and cleanup

## Test Data Management

### Test Users
The framework includes pre-configured test users:
- Admin (admin_test)
- Chief Engineer (chief_eng_test)
- 2nd Engineer (2nd_eng_test)
- Chief Officer (chief_officer_test)

### Unique Test Data
All test data is generated with unique IDs using nanoid to prevent conflicts:
- Work Orders: `WO_xxxxxxxx`
- Spare Parts: `SP_xxxxxxxx`
- Store Items: `ST_xxxxxxxx`
- Components: `COMP_xxxxxxxx`

### Database Cleanup
Test data can be cleaned up using the database verification utility:
```javascript
const dbVerification = new DatabaseVerification();
await dbVerification.cleanupTestData('test_');
await dbVerification.close();
```

## Test Reports

### HTML Report
After running tests, view the HTML report:
```bash
npx playwright show-report
```
Reports are saved in: `test-results/html-report/`

### JUnit Report
JUnit XML reports are saved in: `test-results/junit.xml`

### Screenshots
- Test failures: Automatically captured
- Happy paths: Captured at key points
- Location: `test-results/screenshots/`

## Configuration

### playwright.config.ts
- Base URL: http://localhost:5000
- Browsers: Chromium, Firefox, WebKit
- Retries: 1 (2 in CI)
- Parallel execution: Enabled
- Screenshot on failure: Enabled
- Video on failure: Enabled
- Trace on retry: Enabled

### Timeouts
- Action timeout: 10 seconds
- Navigation timeout: 30 seconds
- Test timeout: Default (30 seconds)

## Best Practices

1. **Test Isolation**: Each test should be independent and use unique test data
2. **Cleanup**: Clean up test data after test runs using the cleanup utilities
3. **Screenshots**: Review screenshots in test-results/screenshots/ for visual verification
4. **Parallel Execution**: Use `--workers` flag to speed up test execution
5. **Debug Mode**: Use UI mode or debug mode to troubleshoot failing tests

## Troubleshooting

### Tests fail with "element not found"
- Check that the application is running (`npm run dev`)
- Verify data-testid attributes are present in the UI
- Increase timeouts if elements load slowly

### Database connection errors
- Ensure DATABASE_URL environment variable is set
- Check PostgreSQL is running
- Verify database permissions

### Screenshot/video not captured
- Check disk space
- Verify test-results directory permissions
- Review playwright.config.ts settings

## CI/CD Integration

To integrate with CI/CD:
1. Install dependencies: `npm ci`
2. Install Playwright browsers: `npx playwright install --with-deps`
3. Run tests: `npm test`
4. Archive test results from `test-results/` directory

## Important Notes

- Tests use the existing development database (not a separate test DB)
- DO NOT modify any UI code - tests only verify functionality
- All test data uses unique IDs to avoid conflicts
- Screenshots are captured for all major user flows
- The framework is designed to catch UI/UX issues and report them without fixing