import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent, ROUTES } from './app/app.component';

bootstrapApplication(AppComponent, { providers: [provideRouter(ROUTES)] }).catch((e) => console.error(e));
