# Micro Frontend Integration Guide - Angular 19 + React Components

## Overview
This guide provides step-by-step instructions for integrating the Element Crew Appraisals System (React) with an Angular 19 host application using Module Federation.

## Prerequisites
- Angular 19 host application
- Node.js 18+
- Webpack 5+
- Element Crew Appraisals System running

## Part 1: Configure React Micro Frontend

### 1.1 Install Module Federation Dependencies
```bash
# In the React project root
npm install @module-federation/webpack webpack webpack-cli --save-dev
```

### 1.2 Update Vite Configuration (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'crewAppraisalsApp',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './client/src/App',
        './CrewAppraisalsTable': './client/src/pages/ElementCrewAppraisals',
        './AppraisalForm': './client/src/pages/AppraisalForm',
        './AdminModule': './client/src/pages/AdminModule',
        './CrewAppraisalsComponents': './client/src/components/ui'
      },
      shared: {
        'react': {
          singleton: true,
          requiredVersion: '^18.0.0'
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0'
        },
        '@tanstack/react-query': {
          singleton: true,
          requiredVersion: '^4.0.0'
        }
      }
    })
  ],
  server: {
    port: 5001,
    cors: true
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
});
```

### 1.3 Create Micro Frontend Wrapper Components
Create `client/src/micro-frontend/` directory:

**client/src/micro-frontend/CrewAppraisalsWrapper.tsx**
```typescript
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import ElementCrewAppraisals from '../pages/ElementCrewAppraisals';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

export default function CrewAppraisalsWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="w-full h-full">
          <ElementCrewAppraisals />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

**client/src/micro-frontend/AdminWrapper.tsx**
```typescript
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminModule from '../pages/AdminModule';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
    },
  },
});

export default function AdminWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="w-full h-full">
          <AdminModule />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

### 1.4 Update Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:mf": "vite build --mode production",
    "serve:mf": "vite preview --port 5001",
    "dev:mf": "vite --port 5001"
  }
}
```

## Part 2: Configure Angular 19 Host Application

### 2.1 Install Module Federation in Angular
```bash
# In Angular project root
ng add @angular-architects/module-federation
```

### 2.2 Update webpack.config.js
```javascript
const ModuleFederationPlugin = require("@module-federation/webpack");

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "angular-host",
      remotes: {
        crewAppraisals: "crewAppraisalsApp@http://localhost:5001/remoteEntry.js"
      },
      shared: {
        "@angular/core": { singleton: true, strictVersion: true },
        "@angular/common": { singleton: true, strictVersion: true },
        "@angular/common/http": { singleton: true, strictVersion: true },
        "@angular/router": { singleton: true, strictVersion: true }
      }
    })
  ]
};
```

### 2.3 Update angular.json
```json
{
  "serve": {
    "builder": "@angular-architects/module-federation:dev-server",
    "options": {
      "buildTarget": "host:build",
      "port": 4200
    }
  },
  "build": {
    "builder": "@angular-architects/module-federation:build",
    "options": {
      "extraWebpackConfig": "webpack.config.js"
    }
  }
}
```

### 2.4 Create Angular Wrapper Components

**src/app/crew-appraisals/crew-appraisals.component.ts**
```typescript
import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';

declare const React: any;
declare const ReactDOM: any;

@Component({
  selector: 'app-crew-appraisals',
  template: `
    <div #reactContainer id="crew-appraisals-container" class="w-full h-full"></div>
  `,
  styles: [`
    #crew-appraisals-container {
      width: 100%;
      height: 100%;
      min-height: 600px;
    }
  `]
})
export class CrewAppraisalsComponent implements OnInit, OnDestroy {
  @ViewChild('reactContainer', { static: true }) reactContainer!: ElementRef;
  private reactComponent: any;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    try {
      // Load React component from micro frontend
      const { CrewAppraisalsWrapper } = await import('crewAppraisals/CrewAppraisalsWrapper');
      
      // Mount React component
      this.reactComponent = React.createElement(CrewAppraisalsWrapper, {
        apiBaseUrl: 'http://localhost:5000/api',
        authToken: this.getAuthToken()
      });
      
      ReactDOM.render(
        this.reactComponent,
        this.reactContainer.nativeElement
      );
    } catch (error) {
      console.error('Failed to load crew appraisals micro frontend:', error);
    }
  }

  ngOnDestroy() {
    if (this.reactContainer?.nativeElement) {
      ReactDOM.unmountComponentAtNode(this.reactContainer.nativeElement);
    }
  }

  private getAuthToken(): string {
    // Return your authentication token
    return localStorage.getItem('authToken') || '';
  }
}
```

**src/app/admin/admin.component.ts**
```typescript
import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';

declare const React: any;
declare const ReactDOM: any;

@Component({
  selector: 'app-admin',
  template: `
    <div #reactContainer id="admin-container" class="w-full h-full"></div>
  `,
  styles: [`
    #admin-container {
      width: 100%;
      height: 100%;
      min-height: 600px;
    }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('reactContainer', { static: true }) reactContainer!: ElementRef;
  private reactComponent: any;

  async ngOnInit() {
    try {
      const { AdminWrapper } = await import('crewAppraisals/AdminWrapper');
      
      this.reactComponent = React.createElement(AdminWrapper, {
        apiBaseUrl: 'http://localhost:5000/api',
        authToken: this.getAuthToken()
      });
      
      ReactDOM.render(
        this.reactComponent,
        this.reactContainer.nativeElement
      );
    } catch (error) {
      console.error('Failed to load admin micro frontend:', error);
    }
  }

  ngOnDestroy() {
    if (this.reactContainer?.nativeElement) {
      ReactDOM.unmountComponentAtNode(this.reactContainer.nativeElement);
    }
  }

  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}
```

### 2.5 Update App Module
**src/app/app.module.ts**
```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { CrewAppraisalsComponent } from './crew-appraisals/crew-appraisals.component';
import { AdminComponent } from './admin/admin.component';

@NgModule({
  declarations: [
    AppComponent,
    CrewAppraisalsComponent,
    AdminComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot([
      { path: 'crew-appraisals', component: CrewAppraisalsComponent },
      { path: 'admin', component: AdminComponent },
      { path: '', redirectTo: '/crew-appraisals', pathMatch: 'full' }
    ])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## Part 3: Authentication Integration

### 3.1 Angular Auth Service
**src/app/services/auth.service.ts**
```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('authToken');
    if (token) {
      this.tokenSubject.next(token);
    }
  }

  login(credentials: any): Observable<any> {
    return this.http.post('/api/auth/login', credentials);
  }

  setToken(token: string): void {
    localStorage.setItem('authToken', token);
    this.tokenSubject.next(token);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  logout(): void {
    localStorage.removeItem('authToken');
    this.tokenSubject.next(null);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
```

### 3.2 HTTP Interceptor for API Calls
**src/app/interceptors/auth.interceptor.ts**
```typescript
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.authService.getToken();
    
    if (token && req.url.includes('/api/')) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next.handle(authReq);
    }
    
    return next.handle(req);
  }
}
```

## Part 4: State Management Integration

### 4.1 Shared State Service
**src/app/services/crew-state.service.ts**
```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CrewStateService {
  private selectedCrewMemberSubject = new BehaviorSubject<any>(null);
  public selectedCrewMember$ = this.selectedCrewMemberSubject.asObservable();

  private appraisalDataSubject = new BehaviorSubject<any[]>([]);
  public appraisalData$ = this.appraisalDataSubject.asObservable();

  setSelectedCrewMember(crewMember: any): void {
    this.selectedCrewMemberSubject.next(crewMember);
  }

  updateAppraisalData(data: any[]): void {
    this.appraisalDataSubject.next(data);
  }

  getSelectedCrewMember(): any {
    return this.selectedCrewMemberSubject.value;
  }

  getAppraisalData(): any[] {
    return this.appraisalDataSubject.value;
  }
}
```

## Part 5: Build and Deployment

### 5.1 Development Setup
```bash
# Terminal 1: Start React micro frontend
cd crew-appraisals-system
npm run dev:mf

# Terminal 2: Start Angular host
cd angular-host-app
ng serve

# Terminal 3: Start backend API
cd crew-appraisals-system
npm run dev:server
```

### 5.2 Production Build
```bash
# Build React micro frontend
cd crew-appraisals-system
npm run build:mf

# Build Angular host
cd angular-host-app
ng build --prod

# Serve both applications
# React MF: serve dist files on port 5001
# Angular: serve dist files on port 4200
```

### 5.3 Deployment Configuration
**nginx.conf**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Angular host application
    location / {
        root /var/www/angular-host/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # React micro frontend
    location /mf/ {
        root /var/www/crew-appraisals/dist;
        try_files $uri $uri/ =404;
    }
    
    # API backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Part 6: Testing the Integration

### 6.1 Test Checklist
- [ ] React micro frontend loads in Angular host
- [ ] Authentication token passes correctly
- [ ] API calls work from both applications
- [ ] State management synchronizes properly
- [ ] Styling doesn't conflict
- [ ] Navigation works correctly
- [ ] Error handling functions properly

### 6.2 Integration Test Script
```typescript
// src/app/tests/integration.spec.ts
describe('Micro Frontend Integration', () => {
  it('should load crew appraisals component', async () => {
    // Test component loading
  });

  it('should pass authentication correctly', async () => {
    // Test auth integration
  });

  it('should sync state between applications', async () => {
    // Test state management
  });
});
```

## Troubleshooting

### Common Issues
1. **Module Federation Loading Errors**
   - Check CORS configuration
   - Verify remoteEntry.js accessibility
   - Ensure correct ports and URLs

2. **Authentication Issues**
   - Verify token passing mechanism
   - Check HTTP interceptor configuration
   - Validate backend authentication

3. **Styling Conflicts**
   - Use CSS modules or scoped styles
   - Ensure Tailwind CSS doesn't conflict
   - Test responsive design

4. **Build Errors**
   - Check webpack configuration
   - Verify shared dependencies
   - Ensure correct TypeScript setup

This integration allows your Angular 19 application to seamlessly use the React-based crew appraisals system as micro frontend components while maintaining proper authentication, state management, and styling.