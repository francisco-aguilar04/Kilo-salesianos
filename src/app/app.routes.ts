import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './features/inicio/inicio/inicio';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: '', component: InicioComponent },
    { path: '**', redirectTo: '' },
];