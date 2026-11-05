import { Routes } from '@angular/router';
import { Escaner } from './shared/components/escaner/escaner';

export const routes: Routes = [
  {
    path: 'escaner',
    component: Escaner,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'escaner',
  },
];
