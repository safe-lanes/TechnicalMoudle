# API Endpoints Documentation - Element Crew Appraisals System

## Base URL
```
http://localhost:5000/api
```

## Authentication
The API uses session-based authentication. All endpoints require authentication except for login/register.

## Response Format
All API responses follow this format:
```json
{
  "success": true,
  "data": {...},
  "message": "Success message"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "details": {...}
}
```

## Endpoints

### 1. Crew Members

#### GET /api/crew-members
Get all crew members with their basic information.

**Response:**
```json
[
  {
    "id": "2025-05-14",
    "firstName": "James",
    "middleName": "Robert",
    "lastName": "Wilson",
    "rank": "Chief Officer",
    "nationality": "British",
    "vesselType": "Container Ship",
    "dateOfBirth": "1985-03-15",
    "placeOfBirth": "London, UK",
    "seamanBookNo": "UK123456",
    "passportNo": "GB987654321",
    "dateOfJoining": "2024-01-15",
    "contractDuration": "6 months"
  }
]
```

#### GET /api/crew-members/:id
Get specific crew member details.

**Parameters:**
- `id` (string): Crew member ID

**Response:**
```json
{
  "id": "2025-05-14",
  "firstName": "James",
  "middleName": "Robert",
  "lastName": "Wilson",
  "rank": "Chief Officer",
  "nationality": "British",
  "vesselType": "Container Ship",
  "dateOfBirth": "1985-03-15",
  "placeOfBirth": "London, UK",
  "seamanBookNo": "UK123456",
  "passportNo": "GB987654321",
  "dateOfJoining": "2024-01-15",
  "contractDuration": "6 months"
}
```

#### POST /api/crew-members
Create a new crew member.

**Request Body:**
```json
{
  "id": "2025-07-11",
  "firstName": "John",
  "middleName": "David",
  "lastName": "Smith",
  "rank": "Master",
  "nationality": "American",
  "vesselType": "Tanker",
  "dateOfBirth": "1980-05-20",
  "placeOfBirth": "New York, USA",
  "seamanBookNo": "US789012",
  "passportNo": "US123456789",
  "dateOfJoining": "2025-01-01",
  "contractDuration": "12 months"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "2025-07-11",
    "firstName": "John",
    "middleName": "David",
    "lastName": "Smith",
    "rank": "Master",
    "nationality": "American",
    "vesselType": "Tanker",
    "dateOfBirth": "1980-05-20",
    "placeOfBirth": "New York, USA",
    "seamanBookNo": "US789012",
    "passportNo": "US123456789",
    "dateOfJoining": "2025-01-01",
    "contractDuration": "12 months"
  }
}
```

#### PUT /api/crew-members/:id
Update existing crew member.

**Parameters:**
- `id` (string): Crew member ID

**Request Body:** (Partial update supported)
```json
{
  "rank": "Captain",
  "vesselType": "Cruise Ship",
  "contractDuration": "9 months"
}
```

#### DELETE /api/crew-members/:id
Delete crew member.

**Parameters:**
- `id` (string): Crew member ID

**Response:**
```json
{
  "success": true,
  "message": "Crew member deleted successfully"
}
```

### 2. Appraisal Results

#### GET /api/appraisals
Get all appraisal results.

**Response:**
```json
[
  {
    "id": 1,
    "crewMemberId": "2025-05-14",
    "formId": 1,
    "appraisalType": "Annual",
    "vesselType": "Container Ship",
    "overallRating": "3.8",
    "partAData": {
      "personalInfo": {...},
      "vesselInfo": {...}
    },
    "partBData": {
      "startInfo": {...},
      "trainingRecords": [...]
    },
    "partCData": {
      "competenceAssessment": [...]
    },
    "partDData": {
      "behaviouralAssessment": [...]
    },
    "partEData": {
      "trainingNeeds": [...]
    },
    "partFData": {
      "recommendations": [...]
    },
    "partGData": {
      "officeReview": {...},
      "trainingFollowup": [...]
    },
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
]
```

#### GET /api/appraisals/:id
Get specific appraisal result.

**Parameters:**
- `id` (number): Appraisal result ID

#### GET /api/appraisals/crew-member/:crewMemberId
Get all appraisal results for a specific crew member.

**Parameters:**
- `crewMemberId` (string): Crew member ID

#### POST /api/appraisals
Create new appraisal result.

**Request Body:**
```json
{
  "crewMemberId": "2025-05-14",
  "formId": 1,
  "appraisalType": "Annual",
  "vesselType": "Container Ship",
  "overallRating": "3.8",
  "partAData": {
    "personalInfo": {
      "firstName": "James",
      "lastName": "Wilson",
      "rank": "Chief Officer",
      "nationality": "British"
    },
    "vesselInfo": {
      "vesselName": "MV Atlantic",
      "vesselType": "Container Ship",
      "imo": "9123456"
    }
  },
  "partBData": {
    "startInfo": {
      "dateOfJoining": "2024-01-15",
      "previousExperience": "5 years"
    },
    "trainingRecords": [
      {
        "trainingType": "Bridge Resource Management",
        "dateCompleted": "2024-02-01",
        "institution": "Maritime Academy",
        "grade": "A"
      }
    ]
  },
  "partCData": {
    "competenceAssessment": [
      {
        "criterion": "Navigation Planning",
        "weight": 25,
        "rating": 4,
        "comments": "Excellent navigation skills"
      }
    ]
  },
  "partDData": {
    "behaviouralAssessment": [
      {
        "criterion": "Leadership",
        "weight": 20,
        "rating": 4,
        "comments": "Strong leadership qualities"
      }
    ]
  },
  "partEData": {
    "trainingNeeds": [
      {
        "trainingType": "Advanced Fire Fighting",
        "priority": "High",
        "targetDate": "2025-06-01"
      }
    ]
  },
  "partFData": {
    "recommendations": [
      {
        "type": "Promotion",
        "description": "Recommend for Master position",
        "timeline": "Next contract"
      }
    ]
  },
  "partGData": {
    "officeReview": {
      "reviewedBy": "Fleet Manager",
      "reviewDate": "2025-01-20",
      "comments": "Excellent performance"
    },
    "trainingFollowup": [
      {
        "trainingType": "Advanced Fire Fighting",
        "status": "Scheduled",
        "scheduledDate": "2025-06-01"
      }
    ]
  }
}
```

#### PUT /api/appraisals/:id
Update existing appraisal result.

#### DELETE /api/appraisals/:id
Delete appraisal result.

### 3. Forms Configuration

#### GET /api/forms
Get all available forms.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Crew Appraisal Form",
    "versionNo": 1,
    "versionDate": "2025-01-01",
    "rankGroup": ["All Ranks"]
  }
]
```

#### GET /api/forms/:id
Get specific form configuration.

#### POST /api/forms
Create new form configuration.

**Request Body:**
```json
{
  "name": "Officer Appraisal Form",
  "versionNo": 1,
  "versionDate": "2025-07-11",
  "rankGroup": ["Senior Officers", "Junior Officers"]
}
```

#### PUT /api/forms/:id
Update form configuration.

#### DELETE /api/forms/:id
Delete form configuration.

### 4. Available Ranks

#### GET /api/available-ranks
Get all available maritime ranks.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Master",
    "category": "Senior Officers"
  },
  {
    "id": 2,
    "name": "Chief Officer",
    "category": "Senior Officers"
  },
  {
    "id": 3,
    "name": "Second Officer",
    "category": "Junior Officers"
  },
  {
    "id": 4,
    "name": "Third Officer",
    "category": "Junior Officers"
  },
  {
    "id": 5,
    "name": "Chief Engineer",
    "category": "Senior Officers"
  },
  {
    "id": 6,
    "name": "Second Engineer",
    "category": "Junior Officers"
  },
  {
    "id": 7,
    "name": "Third Engineer",
    "category": "Junior Officers"
  },
  {
    "id": 8,
    "name": "Fourth Engineer",
    "category": "Junior Officers"
  },
  {
    "id": 9,
    "name": "Bosun",
    "category": "Ratings"
  },
  {
    "id": 10,
    "name": "Able Seaman",
    "category": "Ratings"
  },
  {
    "id": 11,
    "name": "Ordinary Seaman",
    "category": "Ratings"
  },
  {
    "id": 12,
    "name": "Oiler",
    "category": "Ratings"
  },
  {
    "id": 13,
    "name": "Wiper",
    "category": "Ratings"
  }
]
```

#### POST /api/available-ranks
Create new rank.

**Request Body:**
```json
{
  "name": "Cadet",
  "category": "Ratings"
}
```

### 5. Rank Groups

#### GET /api/rank-groups
Get all rank groups.

**Response:**
```json
[
  {
    "id": 1,
    "formId": 1,
    "name": "Senior Officers",
    "ranks": ["Master", "Chief Officer", "Chief Engineer"]
  },
  {
    "id": 2,
    "formId": 1,
    "name": "Junior Officers",
    "ranks": ["Second Officer", "Third Officer", "Second Engineer", "Third Engineer"]
  }
]
```

#### GET /api/rank-groups/:formId
Get rank groups for specific form.

**Parameters:**
- `formId` (number): Form ID

#### POST /api/rank-groups
Create new rank group.

**Request Body:**
```json
{
  "formId": 1,
  "name": "Deck Officers",
  "ranks": ["Master", "Chief Officer", "Second Officer", "Third Officer"]
}
```

#### PUT /api/rank-groups/:id
Update rank group.

#### DELETE /api/rank-groups/:id
Delete rank group.

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error - Server error |

## Rate Limiting
- **Limit:** 100 requests per minute per IP
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## CORS Configuration
```javascript
{
  origin: ['http://localhost:3000', 'http://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

## Sample cURL Commands

### Get all crew members
```bash
curl -X GET http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create new crew member
```bash
curl -X POST http://localhost:5000/api/crew-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id": "2025-07-11",
    "firstName": "John",
    "lastName": "Smith",
    "rank": "Master",
    "nationality": "American",
    "vesselType": "Tanker"
  }'
```

### Get appraisal results
```bash
curl -X GET http://localhost:5000/api/appraisals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create appraisal result
```bash
curl -X POST http://localhost:5000/api/appraisals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "crewMemberId": "2025-05-14",
    "formId": 1,
    "appraisalType": "Annual",
    "overallRating": "3.8",
    "partAData": {...}
  }'
```

## WebSocket Events (Future Enhancement)
```javascript
// Real-time notifications
socket.on('appraisal_updated', (data) => {
  console.log('Appraisal updated:', data);
});

socket.on('crew_member_added', (data) => {
  console.log('New crew member:', data);
});
```

## API Testing with Postman
Import the following collection for comprehensive API testing:

```json
{
  "info": {
    "name": "Crew Appraisals API",
    "description": "Complete API collection for testing"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api"
    }
  ],
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{auth_token}}"
      }
    ]
  }
}
```

This API provides comprehensive crew appraisal management with full CRUD operations, proper authentication, and detailed error handling.