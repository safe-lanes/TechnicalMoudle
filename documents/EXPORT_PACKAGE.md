# Element Crew Appraisals System - Export Package

## Overview
This is a complete export package for the Element Crew Appraisals System, ready for integration with your existing application and deployment on your own server.

## System Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom color scheme
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend (Express.js + TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: MySQL with Drizzle ORM
- **Fallback**: In-memory storage for development/testing
- **API**: RESTful API with full CRUD operations

## Database Requirements

### MySQL Setup
The application requires MySQL 5.7+ or MariaDB 10.2+

**Required Environment Variables:**
```bash
# Database Configuration
DATABASE_URL="mysql://username:password@host:port/database_name"

# Alternative MySQL Configuration
MYSQL_HOST="localhost"
MYSQL_PORT="3306"
MYSQL_USER="your_username"
MYSQL_PASSWORD="your_password"
MYSQL_DATABASE="crew_appraisals"
```

### Database Schema
The system automatically creates the following tables:
- `users` - User authentication
- `forms` - Form configurations
- `available_ranks` - Maritime rank definitions
- `rank_groups` - Configurable rank groupings
- `crew_members` - Crew member profiles
- `appraisal_results` - Completed appraisals

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
- Create a MySQL database
- Configure environment variables (see `.env.example`)
- Run database migration:
```bash
npm run db:push
```

### 3. Development Mode
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
npm start
```

## API Endpoints

### Core Endpoints
- `GET/POST /api/crew-members` - Crew member management
- `GET/POST /api/appraisals` - Appraisal results
- `GET/POST /api/forms` - Form configurations
- `GET/POST /api/available-ranks` - Rank management
- `GET/POST /api/rank-groups` - Rank group configuration

### Authentication
Currently uses session-based authentication. Integration points:
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Data access layer
- `shared/schema.ts` - Database schema and types

## Integration Points

### 1. Authentication Integration
Replace the current session system in `server/routes.ts`:
```typescript
// Current: Simple session-based auth
// Replace with your authentication middleware
app.use(yourAuthMiddleware);
```

### 2. Database Integration
The system uses Drizzle ORM with MySQL. Integration options:
- **Option A**: Use existing MySQL database
- **Option B**: Modify `server/database.ts` for your database system
- **Option C**: Use the storage interface in `server/storage.ts`

### 3. UI Integration
The frontend is modular and can be integrated as:
- **Standalone App**: Deploy as separate application
- **Micro Frontend**: Use existing module federation config
- **Component Library**: Extract components from `client/src/components`

## Key Features

### 1. Crew Appraisals Management
- Complete appraisal form with Parts A-G
- Dynamic rating system with color-coded displays
- Configurable assessment criteria
- Training needs tracking

### 2. Admin Configuration
- Form editor with version control
- Configurable rank groups
- Dynamic field visibility
- Custom dropdown options

### 3. Responsive Design
- Mobile-friendly interface
- Consistent form popup spacing
- Accessible UI components

## File Structure

```
├── client/src/           # Frontend React application
│   ├── components/       # Reusable UI components
│   ├── pages/           # Main application pages
│   ├── lib/             # Utility functions
│   └── hooks/           # Custom React hooks
├── server/              # Backend Express application
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Data access interface
│   └── database.ts      # Database implementation
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database schema definitions
└── scripts/             # Database setup scripts
```

## Deployment Considerations

### 1. Environment Variables
Create production `.env` file with:
- Database connection strings
- Session secrets
- API keys (if needed)

### 2. Build Process
```bash
# Build frontend
npm run build

# Build backend
npm run build:server

# Start production server
npm start
```

### 3. Reverse Proxy
Configure your web server (nginx/Apache) to proxy:
- Static files: `dist/public/`
- API routes: `/api/*` → Express server
- SPA routing: All other routes → `index.html`

### 4. SSL/Security
- Configure HTTPS
- Set secure session cookies
- Implement rate limiting
- Add CORS configuration

## Color Scheme
The application uses a custom color scheme for rating displays:
- **High Rating (4.0+)**: Light green (#c3f2cb) with dark green text
- **Medium Rating (3.0-3.9)**: Yellow (#ffeaa7) with dark yellow text  
- **Low Rating (2.0-2.9)**: Light pink (#f9ecef) with dark red text
- **Very Low Rating (<2.0)**: Dark red background with white text

## Support Files Included
- `package.json` - All dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `vite.config.ts` - Build configuration
- `drizzle.config.ts` - Database configuration
- `.env.example` - Environment variables template

## Next Steps
1. Set up MySQL database on your server
2. Configure environment variables
3. Run `npm install` to install dependencies
4. Run `npm run db:push` to create database tables
5. Start the application with `npm start`
6. Integrate with your existing authentication system
7. Configure reverse proxy/web server

The system is production-ready with MySQL integration, comprehensive error handling, and fallback mechanisms.