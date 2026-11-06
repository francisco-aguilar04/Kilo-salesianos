import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './features/inicio/inicio/inicio';
import { PanelComponent } from './features/panel/panel';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth-guard';
import { ROLES } from './core/constants/roles';
import { CategoriasPrueba } from './features/categorias/categorias-prueba/categorias-prueba';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] }, // dice que antes de ir a 'x' pase por el guard
  { path: '', component: InicioComponent, canActivate: [authGuard] },
  {
    path: 'coordinador',
    component: PanelComponent,
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  }, // solo coordinador
  { path: 'categorias-prueba', component: CategoriasPrueba },
  { path: '**', redirectTo: '' },
];
