#!/bin/bash

echo "================================"
echo "PMS API Smoke Tests"
echo "================================"
echo "Test Run: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:5000"

# Test results array
declare -a test_results=()

# Function to test an endpoint
test_endpoint() {
    local path=$1
    local expected_status=$2
    local description=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
    
    if [[ "$response" == "$expected_status" ]]; then
        echo -e "${GREEN}✅ PASS${NC} - ${description}"
        echo "   Endpoint: ${path}"
        echo "   Status: ${response}"
        test_results+=("PASS:${description}:${path}:${response}")
    else
        echo -e "${RED}❌ FAIL${NC} - ${description}"
        echo "   Endpoint: ${path}"
        echo "   Expected: ${expected_status}, Got: ${response}"
        test_results+=("FAIL:${description}:${path}:${response}")
    fi
    echo ""
}

# Function to test endpoint with data
test_endpoint_with_data() {
    local path=$1
    local description=$2
    
    response=$(curl -s "${BASE_URL}${path}" -w "\n%{http_code}")
    status_code=$(echo "$response" | tail -n 1)
    data=$(echo "$response" | head -n -1)
    
    if [[ "$status_code" == "200" ]] || [[ "$status_code" == "201" ]]; then
        echo -e "${GREEN}✅ PASS${NC} - ${description}"
        echo "   Endpoint: ${path}"
        echo "   Status: ${status_code}"
        
        # Check if response is JSON
        if echo "$data" | jq . >/dev/null 2>&1; then
            echo "   Data Type: Valid JSON"
            data_length=$(echo "$data" | jq '. | length' 2>/dev/null || echo "N/A")
            echo "   Records: ${data_length}"
        else
            echo "   Data Type: Not JSON or empty"
        fi
        test_results+=("PASS:${description}:${path}:${status_code}")
    else
        echo -e "${RED}❌ FAIL${NC} - ${description}"
        echo "   Endpoint: ${path}"
        echo "   Status: ${status_code}"
        test_results+=("FAIL:${description}:${path}:${status_code}")
    fi
    echo ""
}

echo "1. CORE ENDPOINT TESTS"
echo "======================"

# Test main application
test_endpoint "/" "200" "Main Application"

# Test API endpoints
test_endpoint_with_data "/api/components/V001" "Components API"
test_endpoint_with_data "/api/work-orders" "Work Orders API"
test_endpoint_with_data "/api/spares/V001" "Spares API"
test_endpoint_with_data "/api/stores/V001" "Stores API"
test_endpoint_with_data "/api/running-hours/V001" "Running Hours API"

echo "2. MODULE NAVIGATION TESTS"
echo "=========================="

# Test module routes (should redirect to login or show pages)
test_endpoint "/pms" "200" "PMS Module"
test_endpoint "/spares" "200" "Spares Module"
test_endpoint "/stores" "200" "Stores Module"
test_endpoint "/modify-pms" "200" "Modify PMS Module"
test_endpoint "/login" "200" "Login Page"

echo "3. ERROR HANDLING TESTS"
echo "======================="

# Test invalid endpoints
test_endpoint "/api/invalid-endpoint" "404" "Invalid API Endpoint"
test_endpoint "/api/components/INVALID" "404" "Invalid Vessel ID"

echo "4. STATIC ASSETS TEST"
echo "====================="

# Test if assets are being served
test_endpoint "/figmaAssets/frame.svg" "200" "Static Assets"

echo ""
echo "================================"
echo "TEST SUMMARY"
echo "================================"

pass_count=0
fail_count=0

for result in "${test_results[@]}"; do
    if [[ $result == PASS:* ]]; then
        ((pass_count++))
    else
        ((fail_count++))
    fi
done

total_tests=$((pass_count + fail_count))

echo "Total Tests: ${total_tests}"
echo -e "${GREEN}Passed: ${pass_count}${NC}"
echo -e "${RED}Failed: ${fail_count}${NC}"

if [[ $fail_count -eq 0 ]]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo ""
    echo "Failed Tests:"
    for result in "${test_results[@]}"; do
        if [[ $result == FAIL:* ]]; then
            IFS=':' read -r status desc path code <<< "$result"
            echo "  - ${desc} (${path}): ${code}"
        fi
    done
    exit 1
fi
