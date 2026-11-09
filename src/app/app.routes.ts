import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './features/inicio/inicio/inicio';
import { PanelComponent } from './features/panel/panel';
import { MisCajasComponent } from './features/cajas/mis-cajas';
import { AsociacionesComponent } from './features/asociaciones/asociaciones';
import { PerfilComponent } from './features/perfil/perfil';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth-guard';
import { ROLES } from './core/constants/roles';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] }, // dice que antes de ir a 'x' pase por el guard
  { path: '', component: InicioComponent, canActivate: [authGuard] }, // HU-12
  { path: 'escanear', component: InicioComponent, canActivate: [authGuard] }, // la cámara
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] }, // HU-13
  // Solo coordinador
  {
    path: 'coordinador',
    component: PanelComponent, // HU-14 (Resumen)
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  {
    path: 'cajas',
    component: MisCajasComponent, // provisional: cuando exista la pantalla de cajas del coordinador, se cambia
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  {
    path: 'asociaciones',
    component: AsociacionesComponent,
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  { path: '**', redirectTo: '' },
];
