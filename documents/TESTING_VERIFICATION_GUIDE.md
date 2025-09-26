# Testing & Verification Guide - Element Crew Appraisals System

## Overview
This guide provides comprehensive testing procedures to verify all components of the Element Crew Appraisals System are working correctly.

## Prerequisites for Testing
- Node.js 18+ installed
- MySQL 5.7+ running
- System deployed and running locally
- curl or Postman for API testing
- Modern web browser

## 1. Database Connection Testing

### 1.1 MySQL Connection Verification
```bash
# Test MySQL service
sudo service mysql status

# Test database connection
mysql -u crew_admin -p crew_appraisals

# Verify tables exist
SHOW TABLES;

# Expected output:
# +----------------------------+
# | Tables_in_crew_appraisals  |
# +----------------------------+
# | appraisal_results          |
# | available_ranks            |
# | crew_members               |
# | forms                      |
# | rank_groups                |
# | users                      |
# +----------------------------+
```

### 1.2 Database Schema Verification
```sql
-- Check table structures
DESCRIBE crew_members;
DESCRIBE appraisal_results;
DESCRIBE forms;
DESCRIBE available_ranks;
DESCRIBE rank_groups;
DESCRIBE users;

-- Verify foreign key constraints
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'crew_appraisals'
AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### 1.3 Sample Data Verification
```sql
-- Check sample data exists
SELECT COUNT(*) FROM crew_members; -- Should return 3
SELECT COUNT(*) FROM appraisal_results; -- Should return 3
SELECT COUNT(*) FROM available_ranks; -- Should return 12
SELECT COUNT(*) FROM forms; -- Should return 1
SELECT COUNT(*) FROM rank_groups; -- Should return 3

-- Verify data integrity
SELECT 
  cm.id,
  cm.first_name,
  cm.last_name,
  cm.rank,
  ar.overall_rating,
  ar.appraisal_type
FROM crew_members cm
LEFT JOIN appraisal_results ar ON cm.id = ar.crew_member_id;
```

## 2. Backend API Testing

### 2.1 Server Health Check
```bash
# Check if server is running
curl -I http://localhost:5000
# Expected: HTTP/1.1 200 OK

# Check server logs
npm run dev
# Look for: "[express] serving on port 5000"
```

### 2.2 API Endpoints Testing

#### Crew Members API
```bash
# Get all crew members
curl -X GET http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json"
# Expected: Array of 3 crew members

# Get specific crew member
curl -X GET http://localhost:5000/api/crew-members/2025-05-14 \
  -H "Content-Type: application/json"
# Expected: Single crew member object

# Create new crew member
curl -X POST http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -d '{
    "id": "2025-07-11",
    "firstName": "Test",
    "lastName": "User",
    "rank": "Master",
    "nationality": "Test",
    "vesselType": "Test Ship",
    "dateOfBirth": "1980-01-01",
    "placeOfBirth": "Test City",
    "seamanBookNo": "TEST123",
    "passportNo": "TEST456",
    "dateOfJoining": "2025-01-01",
    "contractDuration": "6 months"
  }'
# Expected: Created crew member object

# Update crew member
curl -X PUT http://localhost:5000/api/crew-members/2025-07-11 \
  -H "Content-Type: application/json" \
  -d '{"rank": "Chief Officer"}'
# Expected: Updated crew member object

# Delete crew member
curl -X DELETE http://localhost:5000/api/crew-members/2025-07-11
# Expected: Success message
```

#### Appraisals API
```bash
# Get all appraisals
curl -X GET http://localhost:5000/api/appraisals \
  -H "Content-Type: application/json"
# Expected: Array of 3 appraisal results

# Get appraisals for specific crew member
curl -X GET http://localhost:5000/api/appraisals/crew-member/2025-05-14 \
  -H "Content-Type: application/json"
# Expected: Array of appraisals for crew member

# Create new appraisal
curl -X POST http://localhost:5000/api/appraisals \
  -H "Content-Type: application/json" \
  -d '{
    "crewMemberId": "2025-05-14",
    "formId": 1,
    "appraisalType": "Test",
    "vesselType": "Test Ship",
    "overallRating": "4.0",
    "partAData": {"test": "data"},
    "partBData": {"test": "data"}
  }'
# Expected: Created appraisal object
```

#### Forms API
```bash
# Get all forms
curl -X GET http://localhost:5000/api/forms \
  -H "Content-Type: application/json"
# Expected: Array of forms

# Get available ranks
curl -X GET http://localhost:5000/api/available-ranks \
  -H "Content-Type: application/json"
# Expected: Array of 12 maritime ranks

# Get rank groups
curl -X GET http://localhost:5000/api/rank-groups \
  -H "Content-Type: application/json"
# Expected: Array of rank groups
```

### 2.3 API Error Handling Testing
```bash
# Test 404 errors
curl -X GET http://localhost:5000/api/crew-members/nonexistent
# Expected: 404 Not Found

# Test validation errors
curl -X POST http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Bad Request with validation errors

# Test database connection fallback
# Stop MySQL service temporarily
sudo service mysql stop
curl -X GET http://localhost:5000/api/crew-members
# Expected: Data from in-memory storage
# Restart MySQL
sudo service mysql start
```

## 3. Frontend Testing

### 3.1 Page Load Testing
```bash
# Start the application
npm run dev

# Test main pages in browser:
# http://localhost:5000/ - Main crew appraisals page
# http://localhost:5000/admin - Admin module
```

### 3.2 Crew Appraisals Page Testing

#### Data Loading
- [ ] Crew appraisals table loads with sample data
- [ ] Three crew members displayed: James Wilson, Maria Rodriguez, Ahmed Al-Rashid
- [ ] Ratings display with correct color coding:
  - High ratings (4.0+): Light green background
  - Medium ratings (3.0-3.9): Yellow background
  - Low ratings (2.0-2.9): Light pink background
  - Very low ratings (<2.0): Dark red background with white text

#### Filter Testing
- [ ] Toggle filters button shows/hides filter row
- [ ] Name search filter works correctly
- [ ] Rank dropdown populated with available ranks
- [ ] Vessel type dropdown functional
- [ ] Nationality filter works
- [ ] Appraisal type filter works
- [ ] Rating filter works
- [ ] Clear filters button resets all filters

#### Appraisal Form Testing
- [ ] "New Appraisal" button opens form popup
- [ ] Form popup uses standardized spacing (equal margins)
- [ ] All form sections (Parts A-G) are accessible
- [ ] Form validation works correctly
- [ ] Save functionality works
- [ ] Cancel button closes form without saving

### 3.3 Admin Module Testing

#### Forms Configuration
- [ ] Admin page loads with forms table
- [ ] Forms table displays sample data
- [ ] "Edit" button opens form editor
- [ ] Form editor loads with all sections (Parts A-G)
- [ ] Configuration mode toggle works
- [ ] Save draft functionality works
- [ ] Version control features work

#### Rank Groups Management
- [ ] "+" button opens rank group dialog
- [ ] Rank selection dialog populated with available ranks
- [ ] Rank group creation works
- [ ] Eye icon shows rank group details on hover
- [ ] Delete rank group functionality works

### 3.4 Responsive Design Testing
Test on multiple screen sizes:
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile landscape (667x375)

Check that:
- [ ] Tables are horizontally scrollable on mobile
- [ ] Form popups scale correctly
- [ ] Navigation remains functional
- [ ] Text remains readable
- [ ] Buttons are touch-friendly

## 4. Integration Testing

### 4.1 End-to-End Workflow Testing

#### Complete Appraisal Process
1. **Create Crew Member**
   - [ ] Navigate to crew appraisals page
   - [ ] Click "New Appraisal"
   - [ ] Fill in crew member details in Part A
   - [ ] Save crew member data

2. **Complete Appraisal Form**
   - [ ] Fill in Part B (Start of Appraisal)
   - [ ] Complete Part C (Competence Assessment)
   - [ ] Complete Part D (Behavioral Assessment)
   - [ ] Fill in Part E (Training Needs)
   - [ ] Complete Part F (Recommendations)
   - [ ] Fill in Part G (Office Review)
   - [ ] Save complete appraisal

3. **Verify Data Persistence**
   - [ ] Refresh page and verify data persists
   - [ ] Check database for new records
   - [ ] Verify all form data saved correctly

#### Admin Configuration Workflow
1. **Configure Form**
   - [ ] Navigate to Admin module
   - [ ] Open form editor
   - [ ] Enter configuration mode
   - [ ] Hide/show fields and sections
   - [ ] Add custom assessment criteria
   - [ ] Configure dropdown options
   - [ ] Save configuration

2. **Test Configuration**
   - [ ] Return to crew appraisals page
   - [ ] Create new appraisal
   - [ ] Verify configuration changes applied
   - [ ] Test form with new configuration

### 4.2 Data Consistency Testing
```sql
-- Verify data relationships
SELECT 
  ar.id,
  ar.crew_member_id,
  cm.first_name,
  cm.last_name,
  ar.overall_rating,
  f.name as form_name
FROM appraisal_results ar
JOIN crew_members cm ON ar.crew_member_id = cm.id
JOIN forms f ON ar.form_id = f.id;

-- Check for orphaned records
SELECT * FROM appraisal_results ar
LEFT JOIN crew_members cm ON ar.crew_member_id = cm.id
WHERE cm.id IS NULL;
```

## 5. Performance Testing

### 5.1 Load Testing
```bash
# Install Apache Bench for load testing
sudo apt-get install apache2-utils

# Test API endpoints
ab -n 1000 -c 10 http://localhost:5000/api/crew-members
ab -n 1000 -c 10 http://localhost:5000/api/appraisals

# Expected results:
# - Response time < 100ms for most requests
# - No failed requests
# - Consistent response times
```

### 5.2 Database Performance Testing
```sql
-- Test query performance
EXPLAIN SELECT * FROM crew_members WHERE rank = 'Master';
EXPLAIN SELECT * FROM appraisal_results WHERE crew_member_id = '2025-05-14';

-- Check index usage
SHOW INDEX FROM crew_members;
SHOW INDEX FROM appraisal_results;
```

## 6. Security Testing

### 6.1 Input Validation Testing
```bash
# Test SQL injection attempts
curl -X POST http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -d '{"firstName": "test\"; DROP TABLE crew_members; --"}'
# Expected: Proper error handling, no database damage

# Test XSS attempts
curl -X POST http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -d '{"firstName": "<script>alert(\"XSS\")</script>"}'
# Expected: Input sanitized or rejected
```

### 6.2 Authentication Testing
```bash
# Test protected endpoints without authentication
curl -X GET http://localhost:5000/api/crew-members
# Expected: Either data (if no auth required) or 401 Unauthorized

# Test session management
# Login and verify session persistence
# Logout and verify session termination
```

## 7. Browser Compatibility Testing

### 7.1 Cross-Browser Testing
Test on the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 7.2 Feature Compatibility
- [ ] CSS Grid and Flexbox support
- [ ] JavaScript ES6+ features
- [ ] Local storage functionality
- [ ] Responsive design breakpoints

## 8. Error Handling Testing

### 8.1 Network Error Testing
```bash
# Test with network interruption
# Start application, then disconnect network
# Verify error messages display correctly
# Reconnect and verify recovery
```

### 8.2 Database Error Testing
```bash
# Test database connection loss
sudo service mysql stop
# Verify fallback to in-memory storage
# Verify error handling and user feedback
sudo service mysql start
```

## 9. Accessibility Testing

### 9.1 Screen Reader Testing
- [ ] All images have alt text
- [ ] Form labels properly associated
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG standards

### 9.2 Keyboard Navigation Testing
- [ ] Tab order logical
- [ ] All interactive elements reachable
- [ ] Enter/Space activate buttons
- [ ] Escape closes dialogs
- [ ] Arrow keys navigate tables

## 10. Mobile Testing

### 10.1 Touch Interface Testing
- [ ] Buttons large enough for touch
- [ ] Swipe gestures work on tables
- [ ] Form inputs accessible on mobile keyboards
- [ ] Popup dialogs display correctly

### 10.2 Mobile Performance Testing
- [ ] Page load time under 3 seconds on 3G
- [ ] Images optimized for mobile
- [ ] Smooth scrolling performance
- [ ] Memory usage reasonable

## Test Automation Scripts

### 10.1 Automated API Testing Script
```javascript
// test-api.js
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAPIs() {
  try {
    // Test crew members endpoint
    const crewResponse = await axios.get(`${BASE_URL}/crew-members`);
    console.log('✓ Crew members API working');
    
    // Test appraisals endpoint
    const appraisalsResponse = await axios.get(`${BASE_URL}/appraisals`);
    console.log('✓ Appraisals API working');
    
    // Test forms endpoint
    const formsResponse = await axios.get(`${BASE_URL}/forms`);
    console.log('✓ Forms API working');
    
    console.log('All API tests passed!');
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testAPIs();
```

### 10.2 Database Testing Script
```javascript
// test-database.js
const mysql = require('mysql2/promise');

async function testDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'crew_admin',
      password: 'password',
      database: 'crew_appraisals'
    });
    
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM crew_members');
    console.log(`✓ Database connected, ${rows[0].count} crew members found`);
    
    await connection.end();
  } catch (error) {
    console.error('Database test failed:', error.message);
  }
}

testDatabase();
```

## Troubleshooting Common Issues

### Issue: Database Connection Failed
**Solution:**
1. Check MySQL service: `sudo service mysql status`
2. Verify credentials in `.env` file
3. Test manual connection: `mysql -u crew_admin -p`

### Issue: API Endpoints Not Working
**Solution:**
1. Check server logs for errors
2. Verify port 5000 is not in use: `lsof -i :5000`
3. Check firewall settings

### Issue: Frontend Not Loading
**Solution:**
1. Check browser console for errors
2. Verify Vite development server running
3. Check for TypeScript compilation errors

### Issue: Colors Not Displaying Correctly
**Solution:**
1. Check Tailwind CSS compilation
2. Verify color values in source code
3. Clear browser cache

This comprehensive testing guide ensures all aspects of the Element Crew Appraisals System are thoroughly verified and working correctly.