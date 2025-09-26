# Database Schema Documentation - Element Crew Appraisals System

## Overview
The system uses MySQL 5.7+ with Drizzle ORM for type-safe database operations. The schema is designed to support comprehensive crew appraisal management with configurable forms and maritime-specific features.

## Database Configuration

### Connection Settings
```typescript
// drizzle.config.ts
export default {
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "crew_admin",
    password: process.env.MYSQL_PASSWORD || "password",
    database: process.env.MYSQL_DATABASE || "crew_appraisals",
  }
}
```

### Environment Variables
```env
DATABASE_URL="mysql://crew_admin:password@localhost:3306/crew_appraisals"
MYSQL_HOST="localhost"
MYSQL_PORT="3306"
MYSQL_USER="crew_admin"
MYSQL_PASSWORD="secure_password"
MYSQL_DATABASE="crew_appraisals"
```

## Database Tables

### 1. users
User authentication and management.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Drizzle Schema:**
```typescript
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
```

**Sample Data:**
```sql
INSERT INTO users (username, password) VALUES 
('admin', '$2b$10$hashedpassword1'),
('manager', '$2b$10$hashedpassword2');
```

### 2. forms
Form configurations and version control.

```sql
CREATE TABLE forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  version_date DATE NOT NULL,
  rank_group JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Drizzle Schema:**
```typescript
export const forms = mysqlTable("forms", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  versionNo: int("version_no").notNull().default(1),
  versionDate: date("version_date").notNull(),
  rankGroup: json("rank_group").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
```

**Sample Data:**
```sql
INSERT INTO forms (name, version_no, version_date, rank_group) VALUES 
('Crew Appraisal Form', 1, '2025-01-01', '["All Ranks"]'),
('Officer Appraisal Form', 1, '2025-01-01', '["Senior Officers", "Junior Officers"]');
```

### 3. available_ranks
Maritime rank definitions and categories.

```sql
CREATE TABLE available_ranks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category ENUM('Senior Officers', 'Junior Officers', 'Ratings') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Drizzle Schema:**
```typescript
export const availableRanks = mysqlTable("available_ranks", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  category: mysqlEnum("category", ["Senior Officers", "Junior Officers", "Ratings"]).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Sample Data:**
```sql
INSERT INTO available_ranks (name, category) VALUES 
('Master', 'Senior Officers'),
('Chief Officer', 'Senior Officers'),
('Second Officer', 'Junior Officers'),
('Third Officer', 'Junior Officers'),
('Chief Engineer', 'Senior Officers'),
('Second Engineer', 'Junior Officers'),
('Third Engineer', 'Junior Officers'),
('Fourth Engineer', 'Junior Officers'),
('Bosun', 'Ratings'),
('Able Seaman', 'Ratings'),
('Ordinary Seaman', 'Ratings'),
('Oiler', 'Ratings'),
('Wiper', 'Ratings');
```

### 4. rank_groups
Configurable rank groupings per form.

```sql
CREATE TABLE rank_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  ranks JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);
```

**Drizzle Schema:**
```typescript
export const rankGroups = mysqlTable("rank_groups", {
  id: int("id").primaryKey().autoincrement(),
  formId: int("form_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  ranks: json("ranks").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
```

**Sample Data:**
```sql
INSERT INTO rank_groups (form_id, name, ranks) VALUES 
(1, 'Senior Officers', '["Master", "Chief Officer", "Chief Engineer"]'),
(1, 'Junior Officers', '["Second Officer", "Third Officer", "Second Engineer", "Third Engineer"]'),
(1, 'Ratings', '["Bosun", "Able Seaman", "Ordinary Seaman", "Oiler", "Wiper"]');
```

### 5. crew_members
Crew member profiles and information.

```sql
CREATE TABLE crew_members (
  id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50),
  last_name VARCHAR(50) NOT NULL,
  rank VARCHAR(50) NOT NULL,
  nationality VARCHAR(50) NOT NULL,
  vessel_type VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  place_of_birth VARCHAR(100) NOT NULL,
  seaman_book_no VARCHAR(20) NOT NULL,
  passport_no VARCHAR(20) NOT NULL,
  date_of_joining DATE NOT NULL,
  contract_duration VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rank (rank),
  INDEX idx_nationality (nationality),
  INDEX idx_vessel_type (vessel_type)
);
```

**Drizzle Schema:**
```typescript
export const crewMembers = mysqlTable("crew_members", {
  id: varchar("id", { length: 20 }).primaryKey(),
  firstName: varchar("first_name", { length: 50 }).notNull(),
  middleName: varchar("middle_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }).notNull(),
  rank: varchar("rank", { length: 50 }).notNull(),
  nationality: varchar("nationality", { length: 50 }).notNull(),
  vesselType: varchar("vessel_type", { length: 50 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  placeOfBirth: varchar("place_of_birth", { length: 100 }).notNull(),
  seamanBookNo: varchar("seaman_book_no", { length: 20 }).notNull(),
  passportNo: varchar("passport_no", { length: 20 }).notNull(),
  dateOfJoining: date("date_of_joining").notNull(),
  contractDuration: varchar("contract_duration", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
```

**Sample Data:**
```sql
INSERT INTO crew_members (
  id, first_name, middle_name, last_name, rank, nationality, vessel_type,
  date_of_birth, place_of_birth, seaman_book_no, passport_no,
  date_of_joining, contract_duration
) VALUES 
('2025-05-14', 'James', 'Robert', 'Wilson', 'Chief Officer', 'British', 'Container Ship',
 '1985-03-15', 'London, UK', 'UK123456', 'GB987654321', '2024-01-15', '6 months'),
('2025-05-15', 'Maria', 'Elena', 'Rodriguez', 'Second Engineer', 'Spanish', 'Tanker',
 '1988-07-22', 'Barcelona, Spain', 'ES789012', 'ES123456789', '2024-02-01', '4 months'),
('2025-05-16', 'Ahmed', 'Hassan', 'Al-Rashid', 'Bosun', 'Egyptian', 'Bulk Carrier',
 '1982-11-10', 'Alexandria, Egypt', 'EG345678', 'EG987654321', '2024-03-01', '8 months');
```

### 6. appraisal_results
Completed appraisal evaluations and ratings.

```sql
CREATE TABLE appraisal_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crew_member_id VARCHAR(20) NOT NULL,
  form_id INT NOT NULL,
  appraisal_type VARCHAR(50) NOT NULL,
  vessel_type VARCHAR(50) NOT NULL,
  overall_rating DECIMAL(3,2) NOT NULL,
  part_a_data JSON,
  part_b_data JSON,
  part_c_data JSON,
  part_d_data JSON,
  part_e_data JSON,
  part_f_data JSON,
  part_g_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crew_member_id) REFERENCES crew_members(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  INDEX idx_crew_member (crew_member_id),
  INDEX idx_form (form_id),
  INDEX idx_appraisal_type (appraisal_type),
  INDEX idx_overall_rating (overall_rating),
  INDEX idx_created_at (created_at)
);
```

**Drizzle Schema:**
```typescript
export const appraisalResults = mysqlTable("appraisal_results", {
  id: int("id").primaryKey().autoincrement(),
  crewMemberId: varchar("crew_member_id", { length: 20 }).notNull(),
  formId: int("form_id").notNull(),
  appraisalType: varchar("appraisal_type", { length: 50 }).notNull(),
  vesselType: varchar("vessel_type", { length: 50 }).notNull(),
  overallRating: decimal("overall_rating", { precision: 3, scale: 2 }).notNull(),
  partAData: json("part_a_data"),
  partBData: json("part_b_data"),
  partCData: json("part_c_data"),
  partDData: json("part_d_data"),
  partEData: json("part_e_data"),
  partFData: json("part_f_data"),
  partGData: json("part_g_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
```

**Sample Data:**
```sql
INSERT INTO appraisal_results (
  crew_member_id, form_id, appraisal_type, vessel_type, overall_rating,
  part_a_data, part_b_data, part_c_data, part_d_data, part_e_data, part_f_data, part_g_data
) VALUES 
('2025-05-14', 1, 'Annual', 'Container Ship', 3.80,
 '{"personalInfo": {"firstName": "James", "lastName": "Wilson", "rank": "Chief Officer"}}',
 '{"trainingRecords": [{"type": "BRM", "completed": "2024-02-01"}]}',
 '{"competenceAssessment": [{"criterion": "Navigation", "rating": 4, "weight": 25}]}',
 '{"behaviouralAssessment": [{"criterion": "Leadership", "rating": 4, "weight": 20}]}',
 '{"trainingNeeds": [{"type": "Advanced Fire Fighting", "priority": "High"}]}',
 '{"recommendations": [{"type": "Promotion", "description": "Recommend for Master"}]}',
 '{"officeReview": {"reviewedBy": "Fleet Manager", "approved": true}}');
```

## Relationships

### Foreign Key Constraints
```sql
-- rank_groups references forms
ALTER TABLE rank_groups ADD CONSTRAINT fk_rank_groups_form_id 
FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;

-- appraisal_results references crew_members
ALTER TABLE appraisal_results ADD CONSTRAINT fk_appraisal_results_crew_member_id 
FOREIGN KEY (crew_member_id) REFERENCES crew_members(id) ON DELETE CASCADE;

-- appraisal_results references forms
ALTER TABLE appraisal_results ADD CONSTRAINT fk_appraisal_results_form_id 
FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
```

### Drizzle Relations
```typescript
export const formsRelations = relations(forms, ({ many }) => ({
  rankGroups: many(rankGroups),
  appraisalResults: many(appraisalResults),
}));

export const crewMembersRelations = relations(crewMembers, ({ many }) => ({
  appraisalResults: many(appraisalResults),
}));

export const appraisalResultsRelations = relations(appraisalResults, ({ one }) => ({
  crewMember: one(crewMembers, {
    fields: [appraisalResults.crewMemberId],
    references: [crewMembers.id],
  }),
  form: one(forms, {
    fields: [appraisalResults.formId],
    references: [forms.id],
  }),
}));
```

## Indexes for Performance

### Recommended Indexes
```sql
-- Crew Members
CREATE INDEX idx_crew_members_rank ON crew_members(rank);
CREATE INDEX idx_crew_members_nationality ON crew_members(nationality);
CREATE INDEX idx_crew_members_vessel_type ON crew_members(vessel_type);
CREATE INDEX idx_crew_members_date_of_joining ON crew_members(date_of_joining);

-- Appraisal Results
CREATE INDEX idx_appraisal_results_crew_member ON appraisal_results(crew_member_id);
CREATE INDEX idx_appraisal_results_form ON appraisal_results(form_id);
CREATE INDEX idx_appraisal_results_type ON appraisal_results(appraisal_type);
CREATE INDEX idx_appraisal_results_rating ON appraisal_results(overall_rating);
CREATE INDEX idx_appraisal_results_created_at ON appraisal_results(created_at);

-- Composite Indexes for Complex Queries
CREATE INDEX idx_crew_rank_nationality ON crew_members(rank, nationality);
CREATE INDEX idx_appraisal_crew_type ON appraisal_results(crew_member_id, appraisal_type);
```

## JSON Field Structures

### Part A Data (Personal Information)
```json
{
  "personalInfo": {
    "firstName": "James",
    "middleName": "Robert",
    "lastName": "Wilson",
    "rank": "Chief Officer",
    "nationality": "British",
    "dateOfBirth": "1985-03-15",
    "placeOfBirth": "London, UK",
    "seamanBookNo": "UK123456",
    "passportNo": "GB987654321"
  },
  "vesselInfo": {
    "vesselName": "MV Atlantic",
    "vesselType": "Container Ship",
    "imo": "9123456",
    "flag": "Panama",
    "dwt": "75000"
  },
  "contractInfo": {
    "dateOfJoining": "2024-01-15",
    "contractDuration": "6 months",
    "previousContract": "Yes",
    "totalSeaService": "8 years"
  }
}
```

### Part B Data (Start of Appraisal Period)
```json
{
  "startInfo": {
    "dateOfJoining": "2024-01-15",
    "previousExperience": "5 years",
    "familiarityWithVessel": "Previous experience",
    "briefingReceived": "Yes"
  },
  "trainingRecords": [
    {
      "id": "tr1",
      "trainingType": "Bridge Resource Management",
      "dateCompleted": "2024-02-01",
      "institution": "Maritime Academy",
      "grade": "A",
      "validUntil": "2027-02-01"
    }
  ]
}
```

### Part C Data (Competence Assessment)
```json
{
  "competenceAssessment": [
    {
      "id": "ca1",
      "criterion": "Navigation Planning",
      "weight": 25,
      "rating": 4,
      "comments": "Excellent navigation skills demonstrated",
      "evidence": "Route planning, chart corrections"
    },
    {
      "id": "ca2",
      "criterion": "Cargo Operations",
      "weight": 30,
      "rating": 3,
      "comments": "Good understanding of cargo procedures",
      "evidence": "Loading/discharge operations"
    }
  ]
}
```

### Part D Data (Behavioral Assessment)
```json
{
  "behaviouralAssessment": [
    {
      "id": "ba1",
      "criterion": "Leadership",
      "weight": 20,
      "rating": 4,
      "comments": "Strong leadership qualities",
      "evidence": "Team management, decision making"
    },
    {
      "id": "ba2",
      "criterion": "Communication",
      "weight": 15,
      "rating": 4,
      "comments": "Excellent communication skills",
      "evidence": "Bridge communication, reporting"
    }
  ]
}
```

### Part E Data (Training Needs)
```json
{
  "trainingNeeds": [
    {
      "id": "tn1",
      "trainingType": "Advanced Fire Fighting",
      "priority": "High",
      "targetDate": "2025-06-01",
      "reason": "Certification renewal required",
      "cost": "$2500"
    }
  ]
}
```

### Part F Data (Summary & Recommendations)
```json
{
  "recommendations": [
    {
      "id": "r1",
      "type": "Promotion",
      "description": "Recommend for Master position",
      "timeline": "Next contract",
      "conditions": "Complete Master certification"
    },
    {
      "id": "r2",
      "type": "Training",
      "description": "Advanced navigation course",
      "timeline": "6 months",
      "conditions": "Company approval"
    }
  ],
  "overallAssessment": {
    "strengths": ["Leadership", "Technical knowledge"],
    "areasForImprovement": ["Time management"],
    "overallRating": 3.8
  }
}
```

### Part G Data (Office Review)
```json
{
  "officeReview": {
    "reviewedBy": "Fleet Manager",
    "reviewDate": "2025-01-20",
    "approved": true,
    "comments": "Excellent performance, recommend promotion",
    "nextReviewDate": "2025-07-20"
  },
  "trainingFollowup": [
    {
      "id": "tf1",
      "trainingType": "Advanced Fire Fighting",
      "status": "Scheduled",
      "scheduledDate": "2025-06-01",
      "provider": "Maritime Training Institute",
      "cost": "$2500"
    }
  ]
}
```

## Database Maintenance

### Regular Maintenance Tasks
```sql
-- Optimize tables
OPTIMIZE TABLE crew_members, appraisal_results, forms;

-- Update statistics
ANALYZE TABLE crew_members, appraisal_results, forms;

-- Check for fragmentation
SELECT TABLE_NAME, DATA_FREE, DATA_LENGTH 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'crew_appraisals';
```

### Backup Strategy
```bash
# Daily backup
mysqldump --single-transaction --routines --triggers \
  -u crew_admin -p crew_appraisals > crew_appraisals_$(date +%Y%m%d).sql

# Weekly full backup with compression
mysqldump --single-transaction --routines --triggers \
  -u crew_admin -p crew_appraisals | gzip > crew_appraisals_$(date +%Y%m%d).sql.gz
```

### Performance Monitoring
```sql
-- Monitor slow queries
SELECT * FROM mysql.slow_log 
WHERE start_time > DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Check table sizes
SELECT 
  TABLE_NAME,
  ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'SIZE_MB'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'crew_appraisals'
ORDER BY SIZE_MB DESC;
```

This schema provides a robust foundation for the crew appraisal system with proper indexing, relationships, and JSON storage for flexible form data.