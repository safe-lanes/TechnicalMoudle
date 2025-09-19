#!/bin/bash

# PMS Test Suite Runner
# Executes all test modules in the correct order and generates comprehensive reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test directories and configuration
TEST_DIR="tests"
REPORT_DIR="tests/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Function to run a test module
run_test_module() {
    local module=$1
    local name=$2
    
    print_status "Running $name tests..." "$YELLOW"
    
    if [ -f "$TEST_DIR/e2e/$module.spec.ts" ]; then
        npx playwright test "$TEST_DIR/e2e/$module.spec.ts" \
            --reporter=html,junit \
            --output="$REPORT_DIR/${module}_${TIMESTAMP}" || true
        
        if [ $? -eq 0 ]; then
            print_status "✓ $name tests completed" "$GREEN"
        else
            print_status "✗ $name tests failed" "$RED"
        fi
    else
        print_status "⚠ $name test file not found" "$YELLOW"
    fi
    
    echo ""
}

# Function to run database verification
run_db_verification() {
    print_status "Running database verification..." "$YELLOW"
    
    if [ -f "$TEST_DIR/db/run-verification.ts" ]; then
        npx tsx "$TEST_DIR/db/run-verification.ts" > "$REPORT_DIR/db_verification_${TIMESTAMP}.log" 2>&1
        
        if [ $? -eq 0 ]; then
            print_status "✓ Database verification completed" "$GREEN"
        else
            print_status "✗ Database verification failed" "$RED"
        fi
    else
        print_status "⚠ Database verification script not found" "$YELLOW"
    fi
    
    echo ""
}

# Main execution
main() {
    local test_module=$1
    
    print_status "================================================" "$GREEN"
    print_status "     PMS Test Suite Execution Started" "$GREEN"
    print_status "     Timestamp: $TIMESTAMP" "$GREEN"
    print_status "================================================" "$GREEN"
    echo ""
    
    # Create report directory
    mkdir -p "$REPORT_DIR"
    
    if [ -z "$test_module" ] || [ "$test_module" == "all" ]; then
        # Run all tests in order
        run_test_module "smoke" "Smoke"
        run_test_module "components" "Components"
        run_test_module "work-orders" "Work Orders"
        run_test_module "running-hours" "Running Hours"
        run_test_module "spares" "Spares"
        run_test_module "stores" "Stores"
        run_test_module "modify-pms" "Modify PMS"
        run_test_module "admin" "Admin"
        run_test_module "cross-cutting" "Cross-cutting"
        run_db_verification
    elif [ "$test_module" == "smoke" ]; then
        run_test_module "smoke" "Smoke"
    elif [ "$test_module" == "components" ]; then
        run_test_module "components" "Components"
    elif [ "$test_module" == "work-orders" ]; then
        run_test_module "work-orders" "Work Orders"
    elif [ "$test_module" == "running-hours" ]; then
        run_test_module "running-hours" "Running Hours"
    elif [ "$test_module" == "spares" ]; then
        run_test_module "spares" "Spares"
    elif [ "$test_module" == "stores" ]; then
        run_test_module "stores" "Stores"
    elif [ "$test_module" == "modify-pms" ]; then
        run_test_module "modify-pms" "Modify PMS"
    elif [ "$test_module" == "admin" ]; then
        run_test_module "admin" "Admin"
    elif [ "$test_module" == "cross-cutting" ]; then
        run_test_module "cross-cutting" "Cross-cutting"
    elif [ "$test_module" == "db" ]; then
        run_db_verification
    else
        print_status "Invalid module: $test_module" "$RED"
        echo "Usage: $0 [all|smoke|components|work-orders|running-hours|spares|stores|modify-pms|admin|cross-cutting|db]"
        exit 1
    fi
    
    print_status "================================================" "$GREEN"
    print_status "     Test Execution Completed" "$GREEN"
    print_status "     Reports available in: $REPORT_DIR" "$GREEN"
    print_status "================================================" "$GREEN"
}

# Parse command line arguments
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo "PMS Test Suite Runner"
    echo ""
    echo "Usage: $0 [module]"
    echo ""
    echo "Modules:"
    echo "  all           - Run all test modules (default)"
    echo "  smoke         - Run smoke tests only"
    echo "  components    - Run components module tests"
    echo "  work-orders   - Run work orders module tests"
    echo "  running-hours - Run running hours module tests"
    echo "  spares        - Run spares module tests"
    echo "  stores        - Run stores module tests"
    echo "  modify-pms    - Run modify PMS module tests"
    echo "  admin         - Run admin module tests"
    echo "  cross-cutting - Run cross-cutting tests"
    echo "  db            - Run database verification only"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 smoke        # Run smoke tests only"
    echo "  $0 components   # Run components module tests only"
    exit 0
fi

main "$1"