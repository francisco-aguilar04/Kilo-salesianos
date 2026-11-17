import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './features/inicio/inicio/inicio';
import { PanelComponent } from './features/panel/panel';
import { MisCajasComponent } from './features/cajas/mis-cajas';
import { AsociacionesComponent } from './features/asociaciones/asociaciones';
import { AsociacionDetalleComponent } from './features/asociaciones/asociacion-detalle';
import { PerfilComponent } from './features/perfil/perfil';
import { authGuard, guestGuard, roleGuard, adminGuard } from './core/guards/auth-guard';
import { ROLES } from './core/constants/roles';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] }, // dice que antes de ir a 'x' pase por el guard
  { path: '', component: InicioComponent, canActivate: [authGuard] }, // HU-12 --> mirar si esto hay que cambiarlo
  { path: 'escanear', component: InicioComponent, canActivate: [authGuard] },
  {
    path: 'a-mano',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/introducir-a-mano/introducir-a-mano').then((m) => m.IntroducirAMano),
  }, // la cámara
  { path: 'cajas', component: MisCajasComponent, canActivate: [authGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] }, // HU-13
  // Solo coordinador
  {
    path: 'coordinador',
    component: PanelComponent, // HU-14 (Resumen)
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  {
    path: 'asociaciones',
    component: AsociacionesComponent,
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  {
    path: 'asociaciones/:id', // B3: detalle de entidad
    component: AsociacionDetalleComponent,
    canActivate: [authGuard, roleGuard(ROLES.COORDINADOR)],
  },
  {
    path: 'categorias', // A6: crear categorías (solo admin)
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/categorias/categorias').then((m) => m.CategoriasComponent),
  },
  { path: '**', redirectTo: '' },
];
