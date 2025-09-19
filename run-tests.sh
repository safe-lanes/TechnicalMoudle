#!/bin/bash

# Playwright Test Runner Script
# This script provides various ways to run the Playwright tests

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}PMS Application - Playwright Test Runner${NC}"
echo "========================================"
echo ""

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Parse command line arguments
TEST_SUITE=$1

case "$TEST_SUITE" in
    smoke)
        echo -e "${GREEN}Running Smoke Tests...${NC}"
        npx playwright test tests/e2e/smoke.spec.ts
        ;;
    components)
        echo -e "${GREEN}Running Components Module Tests...${NC}"
        npx playwright test tests/e2e/components.spec.ts
        ;;
    work-orders)
        echo -e "${GREEN}Running Work Orders Module Tests...${NC}"
        npx playwright test tests/e2e/work-orders.spec.ts
        ;;
    running-hours)
        echo -e "${GREEN}Running Running Hours Module Tests...${NC}"
        npx playwright test tests/e2e/running-hours.spec.ts
        ;;
    spares)
        echo -e "${GREEN}Running Spares Module Tests...${NC}"
        npx playwright test tests/e2e/spares.spec.ts
        ;;
    stores)
        echo -e "${GREEN}Running Stores Module Tests...${NC}"
        npx playwright test tests/e2e/stores.spec.ts
        ;;
    modify-pms)
        echo -e "${GREEN}Running Modify PMS Module Tests...${NC}"
        npx playwright test tests/e2e/modify-pms.spec.ts
        ;;
    admin)
        echo -e "${GREEN}Running Admin Module Tests...${NC}"
        npx playwright test tests/e2e/admin.spec.ts
        ;;
    cross-cutting)
        echo -e "${GREEN}Running Cross-Cutting Tests...${NC}"
        npx playwright test tests/e2e/cross-cutting.spec.ts
        ;;
    all)
        echo -e "${GREEN}Running All Tests...${NC}"
        npx playwright test
        ;;
    headed)
        echo -e "${GREEN}Running Tests in Headed Mode...${NC}"
        npx playwright test --headed
        ;;
    debug)
        echo -e "${GREEN}Running Tests in Debug Mode...${NC}"
        npx playwright test --debug
        ;;
    ui)
        echo -e "${GREEN}Opening Playwright UI...${NC}"
        npx playwright test --ui
        ;;
    report)
        echo -e "${GREEN}Opening Last Test Report...${NC}"
        npx playwright show-report
        ;;
    *)
        echo "Usage: ./run-tests.sh [option]"
        echo ""
        echo "Options:"
        echo "  smoke          - Run smoke tests only"
        echo "  components     - Run component module tests"
        echo "  work-orders    - Run work orders module tests"
        echo "  running-hours  - Run running hours module tests"
        echo "  spares         - Run spares module tests"
        echo "  stores         - Run stores module tests"
        echo "  modify-pms     - Run modify PMS module tests"
        echo "  admin          - Run admin module tests"
        echo "  cross-cutting  - Run cross-cutting concern tests"
        echo "  all            - Run all test suites"
        echo "  headed         - Run tests in headed mode (visible browser)"
        echo "  debug          - Run tests in debug mode"
        echo "  ui             - Open Playwright UI mode"
        echo "  report         - Open the last test report"
        echo ""
        echo "Examples:"
        echo "  ./run-tests.sh smoke"
        echo "  ./run-tests.sh all"
        echo "  ./run-tests.sh headed"
        ;;
esac

# Show report location after tests
if [[ "$TEST_SUITE" != "report" && "$TEST_SUITE" != "" && "$TEST_SUITE" != "ui" ]]; then
    echo ""
    echo -e "${BLUE}Test execution complete!${NC}"
    echo "View the HTML report: npx playwright show-report"
    echo "Test results saved in: test-results/"
fi