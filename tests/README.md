# PMS Test Suite Documentation

## Overview
Comprehensive end-to-end test suite for the Maritime Planned Maintenance System (PMS) web application. The suite includes 215+ test cases covering all modules, database verification, and cross-cutting concerns.

## Test Coverage

### Modules Tested
- ✅ **Environment & Smoke Tests** (22 tests)
- ✅ **Components Module** (19 tests)
- ✅ **Work Orders Module** (17 tests) 
- ✅ **Running Hours Module** (22 tests)
- ✅ **Spares Module** (40 tests)
- ✅ **Stores Module** (35 tests)
- ✅ **Modify PMS Module** (25 tests)
- ✅ **Admin Module** (20 tests)
- ✅ **Cross-cutting Tests** (15 tests)
- ✅ **Database Verification** (5 scripts)

## Prerequisites

### System Requirements
- Node.js 18+ 
- PostgreSQL database (for production testing)
- 4GB RAM minimum
- Chrome/Firefox/Safari browsers

### Installation
```bash
# Install dependencies
npm install

# Install Playwright browsers (required for E2E tests)
npx playwright install --with-deps

# Verify installation
npx playwright --version
```

## Running Tests

### Quick Start
```bash
# Run all tests
./tests/run-all-tests.sh

# Run specific module
./tests/run-all-tests.sh smoke
./tests/run-all-tests.sh components
./tests/run-all-tests.sh work-orders

# Run with Playwright UI (interactive mode)
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/smoke.spec.ts
```

### Test Execution Options

| Command | Description |
|---------|-------------|
| `./tests/run-all-tests.sh all` | Run complete test suite |
| `./tests/run-all-tests.sh smoke` | Run smoke tests only |
| `./tests/run-all-tests.sh components` | Run components module tests |
| `./tests/run-all-tests.sh work-orders` | Run work orders tests |
| `./tests/run-all-tests.sh running-hours` | Run running hours tests |
| `./tests/run-all-tests.sh spares` | Run spares module tests |
| `./tests/run-all-tests.sh stores` | Run stores module tests |
| `./tests/run-all-tests.sh modify-pms` | Run modify PMS tests |
| `./tests/run-all-tests.sh admin` | Run admin module tests |
| `./tests/run-all-tests.sh cross-cutting` | Run cross-cutting tests |
| `./tests/run-all-tests.sh db` | Run database verification only |

### Playwright Commands
```bash
# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run tests with specific number of workers
npx playwright test --workers=4

# Debug mode (runs one test at a time)
npx playwright test --debug

# Generate HTML report after test run
npx playwright show-report
```

## Environment Variables

### Required Variables
```bash
# Database connection (if using PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/pms_test

# Application URL
BASE_URL=http://localhost:5000

# Test user credentials (optional, defaults provided)
TEST_ADMIN_USER=admin
TEST_ADMIN_PASS=admin123
TEST_CHIEF_ENG_USER=chief_engineer
TEST_CHIEF_ENG_PASS=chief123
```

### Optional Variables
```bash
# Test execution settings
PARALLEL_WORKERS=4
TEST_TIMEOUT=30000
SCREENSHOT_ON_FAILURE=true
VIDEO_ON_FAILURE=false

# Report settings
GENERATE_HTML_REPORT=true
GENERATE_JUNIT_REPORT=true
```

## Test Reports

### Report Locations
- **HTML Report**: `playwright-report/index.html`
- **JUnit XML**: `test-results/junit.xml`
- **Screenshots**: `test-results/screenshots/`
- **Issues List**: `tests/reports/issues-list.md`
- **Summary**: `tests/reports/test-summary.md`
- **DB Verification**: `tests/reports/db-verification.html`

### Viewing Reports
```bash
# Open HTML report in browser
npx playwright show-report

# View test summary
cat tests/reports/test-summary.md

# View issues list
cat tests/reports/issues-list.md
```

## Database Verification

### Running DB Verification
```bash
# Run standalone DB verification
npx tsx tests/db/run-verification.ts

# Run with specific checks
npx tsx tests/db/run-verification.ts --invariants
npx tsx tests/db/run-verification.ts --export

# Export database snapshot
npx tsx tests/db/export-snapshot.ts --format=json
npx tsx tests/db/export-snapshot.ts --format=csv
```

### Verification Checks
- Table existence validation
- Data integrity constraints
- No negative ROB values
- Unique code enforcement
- Work order approval integrity
- Orphan record detection
- Audit trail completeness

## Test Data Management

### Test Data Generation
- Uses `nanoid` for unique identifiers
- Automatic cleanup after test runs
- Isolated test data per test case

### Seed Data
```bash
# Create test seed data (if script exists)
npm run seed:test

# Clean test data
npm run clean:test
```

## Troubleshooting

### Common Issues

#### 1. Browser Launch Errors
```bash
# Solution: Install browser dependencies
npx playwright install --with-deps
```

#### 2. Database Connection Errors
```bash
# Check database is running
psql -U postgres -c "SELECT 1"

# Verify DATABASE_URL
echo $DATABASE_URL
```

#### 3. Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

#### 4. Test Timeouts
```bash
# Increase timeout in playwright.config.ts
timeout: 60000  # 60 seconds

# Or per test
test('my test', async ({ page }) => {
  test.setTimeout(60000);
  // test code
});
```

### Debug Mode
```bash
# Run single test in debug mode
npx playwright test tests/e2e/smoke.spec.ts --debug

# Enable verbose logging
DEBUG=pw:api npx playwright test

# Slow down execution (useful for debugging)
npx playwright test --slow-mo=1000
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: ./tests/run-all-tests.sh all
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            playwright-report/
            test-results/
            tests/reports/
```

### Jenkins Pipeline Example
```groovy
pipeline {
  agent any
  stages {
    stage('Setup') {
      steps {
        sh 'npm ci'
        sh 'npx playwright install --with-deps'
      }
    }
    stage('Test') {
      steps {
        sh './tests/run-all-tests.sh all'
      }
    }
    stage('Report') {
      always {
        junit 'test-results/*.xml'
        publishHTML target: [
          reportDir: 'playwright-report',
          reportFiles: 'index.html',
          reportName: 'Playwright Report'
        ]
      }
    }
  }
}
```

## Best Practices

### Writing Tests
1. Use data-testid attributes for reliable element selection
2. Generate unique test data with nanoid
3. Clean up test data after each test
4. Take screenshots for key operations
5. Use Page Object Model for complex pages
6. Keep tests independent and idempotent

### Test Organization
```
tests/
├── e2e/                 # End-to-end test specs
│   ├── smoke.spec.ts
│   ├── components.spec.ts
│   └── ...
├── db/                  # Database verification
│   ├── verification.ts
│   └── invariants.ts
├── fixtures/            # Test data and user fixtures
├── helpers/             # Reusable test utilities
├── reports/             # Generated reports
└── utils/              # Report generators and tools
```

## Test Helpers Available

### Authentication Helper
```typescript
import { AuthHelper } from '../helpers/auth.helper';
const auth = new AuthHelper(page);
await auth.loginAsAdmin();
await auth.loginAsChiefEngineer();
await auth.logout();
```

### Navigation Helper
```typescript
import { NavigationHelper } from '../helpers/navigation.helper';
const nav = new NavigationHelper(page);
await nav.goToComponents();
await nav.goToWorkOrders();
```

### Form Helper
```typescript
import { FormHelper } from '../helpers/form.helper';
const form = new FormHelper(page);
await form.fillField('name', 'Test Component');
await form.selectDropdown('category', 'Engine');
await form.submitForm();
```

### Table Helper
```typescript
import { TableHelper } from '../helpers/table.helper';
const table = new TableHelper(page);
const rowData = await table.getRowData(0);
await table.sortByColumn('Name');
await table.filterBy('Status', 'Active');
```

## Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Use existing helpers and fixtures
3. Follow naming convention: `module-name.spec.ts`
4. Include test in run-all-tests.sh script
5. Document any new test data requirements

### Test Review Checklist
- [ ] Tests are independent and can run in any order
- [ ] Unique test data is generated
- [ ] Screenshots are captured for failures
- [ ] No hardcoded wait times (use proper waits)
- [ ] Test data is cleaned up
- [ ] Tests follow PMS requirements document

## Support

### Resources
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Test Requirements Document](attached_assets/Pasted-Here-s-a-single-copy-paste-Replit-Agent-3-prompt)
- Issue Reports: `tests/reports/issues-list.md`
- Test Summary: `tests/reports/test-summary.md`

### Contact
For questions or issues with the test suite, refer to the issues list or create a new issue in the project repository.

---

**Version**: 1.0.0  
**Last Updated**: September 19, 2025  
**Maintained By**: QA Automation Team