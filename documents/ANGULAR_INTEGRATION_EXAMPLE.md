
# Angular 19 Integration Example

## Complete Working Example

### 1. app.module.ts
```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MicroFrontendWrapperComponent } from './micro-frontend-wrapper.component';

@NgModule({
  declarations: [
    AppComponent,
    MicroFrontendWrapperComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### 2. app.component.html
```html
<div class="app-container">
  <header>
    <h1>Maritime Management System</h1>
    <nav>
      <a routerLink="/dashboard">Dashboard</a>
      <a routerLink="/crew">Crew Management</a>
      <a routerLink="/appraisals">Appraisals</a>
    </nav>
  </header>

  <main>
    <router-outlet></router-outlet>
  </main>
</div>
```

### 3. appraisals.component.html (Route Component)
```html
<div class="page-container">
  <h2>Crew Appraisals</h2>
  
  <!-- This will load the React micro frontend -->
  <app-micro-frontend-wrapper 
    remoteName="crewAppraisals"
    remoteUrl="http://0.0.0.0:5000/remoteEntry.js"
    fallbackMessage="Crew Appraisals system is temporarily unavailable">
  </app-micro-frontend-wrapper>
</div>
```

### 4. app-routing.module.ts
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppraisalsComponent } from './appraisals.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'crew', component: CrewComponent },
  { path: 'appraisals', component: AppraisalsComponent },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### 5. appraisals.component.ts
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-appraisals',
  templateUrl: './appraisals.component.html',
  styleUrls: ['./appraisals.component.css']
})
export class AppraisalsComponent {
  constructor() {}
}
```

## Development Commands

```bash
# Setup micro frontend (one-time)
npm run setup-microfrontend

# Start Angular app
ng serve --port 4200

# Start React app (in separate terminal)
cd react-crew-appraisals
npm run dev
```

## Production Build

```bash
# Build Angular app
ng build --prod

# Build React micro frontend  
cd react-crew-appraisals
npm run build:micro-frontend
```

## Testing the Integration

1. **Start Angular Only**
   ```bash
   ng serve
   ```
   - Visit http://localhost:4200/appraisals
   - Should show fallback message
   - Angular app continues working normally

2. **Start Both Applications**
   ```bash
   # Terminal 1
   ng serve
   
   # Terminal 2  
   cd react-crew-appraisals && npm run dev
   ```
   - Visit http://localhost:4200/appraisals
   - Should load React micro frontend
   - Full functionality available

3. **Simulate React App Failure**
   - Stop React app while Angular is running
   - Refresh appraisals page
   - Should automatically show fallback
   - No errors in console
   - Rest of Angular app continues working

## Error Handling Scenarios

The micro frontend wrapper handles all these scenarios automatically:

✅ **React app not started** - Shows fallback message
✅ **React app crashes** - Automatic retry, then fallback
✅ **Network issues** - Graceful degradation
✅ **CORS problems** - Silent fallback
✅ **Module Federation errors** - Error boundaries prevent crashes
✅ **Version conflicts** - Isolated module loading

## Customization Options

```html
<!-- Basic usage -->
<app-micro-frontend-wrapper></app-micro-frontend-wrapper>

<!-- Custom configuration -->
<app-micro-frontend-wrapper 
  remoteName="crewAppraisals"
  remoteUrl="https://your-domain.com/remoteEntry.js"
  fallbackMessage="Custom fallback message">
</app-micro-frontend-wrapper>

<!-- With custom styling -->
<app-micro-frontend-wrapper 
  class="custom-micro-frontend"
  remoteName="crewAppraisals"
  remoteUrl="http://0.0.0.0:5000/remoteEntry.js">
</app-micro-frontend-wrapper>
```

This integration approach ensures your Angular 19 application remains stable and functional whether the React micro frontend is available or not.
