import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { ROLES } from '../../../core/constants/roles';

interface NavItem {
  ruta: string;
  etiqueta: string;
  icono: string; // nombre del icono de Bootstrap Icons (sin el prefijo "bi-")
  destacado?: boolean; // botón central de escanear
}

const ITEMS_VOLUNTARIO: NavItem[] = [
  { ruta: '/cajas', etiqueta: 'Mis bolsas', icono: 'box-seam' },
  { ruta: '/escanear', etiqueta: 'Escanear', icono: 'camera', destacado: true },
  { ruta: '/perfil', etiqueta: 'Perfil', icono: 'person' },
];

const ITEMS_COORDINADOR: NavItem[] = [
  { ruta: '/coordinador', etiqueta: 'Resumen', icono: 'bar-chart' },
  { ruta: '/cajas', etiqueta: 'Bolsas', icono: 'bag' },
  { ruta: '/escanear', etiqueta: 'Escanear', icono: 'camera', destacado: true },
  { ruta: '/asociaciones', etiqueta: 'Entidades', icono: 'people' },
  { ruta: '/perfil', etiqueta: 'Usuarios', icono: 'person' },
];

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {
  private readonly authService = inject(Auth);

  // Se recalcula solo cuando cambia el rol
  readonly items = computed<NavItem[]>(() => {
    const rol = this.authService.rol();
    if (rol === ROLES.COORDINADOR) {
      return ITEMS_COORDINADOR;
    }
    if (rol === ROLES.VOLUNTARIO) {
      return ITEMS_VOLUNTARIO;
    }
    return []; // sin rol (aún cargando): no se muestra nada
  });
}
