import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './features/inicio/inicio/inicio';
import { authGuard, guestGuard } from './core/guards/auth-guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent, canActivate: [guestGuard] }, // dice que antes de ir a 'x' pase por el guard
    { path: '', component: InicioComponent, canActivate: [authGuard] },
    { path: '**', redirectTo: '' },
];