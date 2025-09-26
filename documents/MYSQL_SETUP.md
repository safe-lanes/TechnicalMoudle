# MySQL Database Setup Guide

## Prerequisites
- MySQL 5.7+ or MariaDB 10.2+
- Node.js 18+ with npm

## Database Setup Steps

### 1. Create MySQL Database
```sql
-- Connect to MySQL as root or admin user
CREATE DATABASE crew_appraisals CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user (recommended)
CREATE USER 'crew_admin'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON crew_appraisals.* TO 'crew_admin'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configure Environment Variables
Copy `environment.example` to `.env` and update:
```bash
cp environment.example .env
```

Edit `.env`:
```env
DATABASE_URL="mysql://crew_admin:secure_password_here@localhost:3306/crew_appraisals"
SESSION_SECRET="your-unique-session-secret"
NODE_ENV="production"
PORT="5000"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database Schema
```bash
# Push schema to database (creates tables)
npm run db:push

# Alternative: Generate and run migrations
npm run db:generate
npm run db:migrate
```

### 5. Seed Database (Optional)
The application automatically seeds with sample data on first run.

### 6. Test Database Connection
```bash
npm run dev
```

Check console for:
- ✅ "Database connected successfully"
- ⚠️ "Falling back to in-memory storage" (indicates connection issue)

## Database Schema Overview

### Tables Created
1. **users** - User authentication
   - id (auto-increment)
   - username (unique)
   - password (hashed)

2. **forms** - Form configurations
   - id (auto-increment)
   - name (form name)
   - versionNo (version number)
   - versionDate (version date)
   - rankGroup (JSON array of rank groups)

3. **available_ranks** - Maritime rank definitions
   - id (auto-increment)
   - name (rank name)
   - category (Senior Officers, Junior Officers, Ratings)

4. **rank_groups** - Configurable rank groupings
   - id (auto-increment)
   - formId (foreign key to forms)
   - name (group name)
   - ranks (JSON array of rank names)

5. **crew_members** - Crew member profiles
   - id (string, format: YYYY-MM-DD)
   - firstName, middleName, lastName
   - rank, nationality, vesselType
   - dateOfBirth, placeOfBirth
   - seamanBookNo, passportNo
   - dateOfJoining, contractDuration

6. **appraisal_results** - Completed appraisals
   - id (auto-increment)
   - crewMemberId (foreign key to crew_members)
   - formId (foreign key to forms)
   - appraisalType, vesselType, overallRating
   - partAData, partBData, partCData, partDData, partEData, partFData, partGData (JSON)
   - createdAt, updatedAt

## Troubleshooting

### Connection Issues
1. **Check MySQL service status:**
   ```bash
   sudo service mysql status
   # or
   sudo systemctl status mysql
   ```

2. **Test connection manually:**
   ```bash
   mysql -u crew_admin -p crew_appraisals
   ```

3. **Common connection errors:**
   - `ECONNREFUSED`: MySQL service not running
   - `Access denied`: Wrong username/password
   - `Unknown database`: Database doesn't exist
   - `ETIMEDOUT`: Network/firewall issues

### Schema Issues
1. **Reset database:**
   ```bash
   npm run db:drop
   npm run db:push
   ```

2. **Check table structure:**
   ```sql
   USE crew_appraisals;
   SHOW TABLES;
   DESCRIBE crew_members;
   ```

### Performance Optimization
1. **Add indexes for frequently queried columns:**
   ```sql
   ALTER TABLE crew_members ADD INDEX idx_rank (rank);
   ALTER TABLE appraisal_results ADD INDEX idx_crew_member (crewMemberId);
   ALTER TABLE appraisal_results ADD INDEX idx_created_at (createdAt);
   ```

2. **Configure MySQL for production:**
   ```sql
   -- In my.cnf or my.ini
   [mysqld]
   innodb_buffer_pool_size = 1G
   query_cache_size = 64M
   max_connections = 200
   ```

## Security Considerations

1. **Use strong passwords for database users**
2. **Limit database user privileges to necessary tables only**
3. **Configure firewall to restrict database access**
4. **Use SSL/TLS for database connections in production**
5. **Regular database backups**

## Backup Strategy
```bash
# Create backup
mysqldump -u crew_admin -p crew_appraisals > crew_appraisals_backup.sql

# Restore from backup
mysql -u crew_admin -p crew_appraisals < crew_appraisals_backup.sql
```

## Integration with Existing Systems

### Using Existing MySQL Database
1. Update `shared/schema.ts` to match your table structure
2. Modify `server/database.ts` connection settings
3. Update API routes in `server/routes.ts` as needed

### Using Different Database
1. Install appropriate database driver
2. Update `drizzle.config.ts` with new database dialect
3. Modify `server/database.ts` implementation
4. Update connection configuration

The system is designed to be flexible and can be adapted to various database configurations.