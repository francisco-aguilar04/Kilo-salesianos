import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { ROLES } from '../../core/constants/roles';
import { ResumenDiaService } from '../../core/services/resumen-dia-service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent {
  private readonly authService = inject(Auth);
  private readonly resumenService = inject(ResumenDiaService);
  private readonly router = inject(Router);

  protected readonly usuario = this.authService.usuario;

  protected readonly iniciales = computed(() => {
    const nombre: string = this.usuario()?.nombre ?? '';
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  });

  protected readonly rolTexto = computed(() => {
    const rol = this.authService.rol();
    if (rol === ROLES.COORDINADOR) {
      return 'Coordinador';
    }
    if (rol === ROLES.VOLUNTARIO) {
      return 'Voluntario';
    }
    return '';
  });

  // null = todavía cargando
  private readonly resumen = toSignal(
    this.authService.user$.pipe(
      switchMap((u) => (u ? this.resumenService.resumenDelDia(u.uid) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly cajasCerradas = computed(() => {
    const resumen = this.resumen();
    return resumen ? String(resumen.cajasCerradas) : '–';
  });

  protected readonly kgTexto = computed(() => {
    const resumen = this.resumen();
    if (!resumen) {
      return '–';
    }
    const kg: string = resumen.kgRecogidos.toLocaleString('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return kg + ' kg';
  });

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}