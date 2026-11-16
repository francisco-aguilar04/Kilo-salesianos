import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth, CambioPasswordError } from '../../core/services/auth';
import { ROLES } from '../../core/constants/roles';
import { ResumenDiaService } from '../../core/services/resumen-dia-service';
import { DatosPassword, ModalPassword } from '../../shared/components/modal-password/modal-password';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ModalPassword],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent {

  private readonly authService = inject(Auth);

  private readonly resumenService = inject(ResumenDiaService);

  // Se usa para redirigir al login tras cerrar sesión.
  private readonly router = inject(Router);

  protected readonly usuario = this.authService.usuario;

  /**
   * Iniciales para el avatar: primera letra de las dos primeras palabras del
   * nombre, en mayúsculas (p. ej. "Luis Miguel" -> "LM").
   * Si no hay nombre, devuelve cadena vacía.
   */
  protected readonly iniciales = computed(() => {
    const nombre: string = this.usuario()?.nombre ?? '';
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  });

  /**
   * Texto legible del rol para mostrar en pantalla.
   * Si el rol no se reconoce o aún no está disponible, devuelve cadena vacía.
   */
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

  /**
   * Resumen del día del usuario con sesión activa.
   * Cada vez que cambia el usuario (login/logout) se vuelve a consultar con su UID;
   * si no hay usuario emite null. Al ser una consulta en tiempo real, se
   * actualiza sola cuando cambian los datos en Firestore.
   */
  // null = todavía cargando
  private readonly resumen = toSignal(
    this.authService.user$.pipe(
      switchMap((u) => (u ? this.resumenService.resumenDelDia(u.uid) : of(null))),
    ),
    { initialValue: null },
  );

  /**
   * Número de cajas cerradas hoy, como texto.
   * Muestra "–" mientras el resumen no ha cargado.
   */
  protected readonly cajasCerradas = computed(() => {
    const resumen = this.resumen();
    return resumen ? String(resumen.cajasCerradas) : '–';
  });

  /**
   * Kilos recogidos hoy, formateados en español con un decimal (p. ej. "5,5 kg").
   * Muestra "–" mientras el resumen no ha cargado.
   */
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

  // ---- B6: cambiar contraseña propia ----
  protected readonly modalPasswordAbierto = signal(false);
  protected readonly cambiandoPassword = signal(false);
  protected readonly errorActual = signal<string | null>(null);
  protected readonly errorGeneral = signal<string | null>(null);

  protected abrirModalPassword(): void {
    this.errorActual.set(null);
    this.errorGeneral.set(null);
    this.modalPasswordAbierto.set(true);
  }

  protected cerrarModalPassword(): void {
    if (this.cambiandoPassword()) return;
    this.modalPasswordAbierto.set(false);
  }

  protected async cambiarPassword(datos: DatosPassword): Promise<void> {
    if (this.cambiandoPassword()) return;

    this.errorActual.set(null);
    this.errorGeneral.set(null);
    this.cambiandoPassword.set(true);

    let cambiada = false;
    try {
      await this.authService.cambiarPassword(datos.actual, datos.nueva);
      cambiada = true;
    } catch (e) {
      const motivo = e instanceof CambioPasswordError ? e.motivo : 'desconocido';
      switch (motivo) {
        case 'actual-incorrecta':
          this.errorActual.set('La contraseña actual no es correcta');
          break;
        case 'password-debil':
          this.errorGeneral.set('La nueva contraseña es demasiado débil. Usa al menos 6 caracteres');
          break;
        case 'demasiados-intentos':
          this.errorGeneral.set('Demasiados intentos. Espera unos minutos e inténtalo de nuevo');
          break;
        case 'sin-conexion':
          this.errorGeneral.set('Sin conexión. Comprueba tu internet e inténtalo de nuevo');
          break;
        case 'sin-sesion':
          this.errorGeneral.set('Tu sesión ha caducado. Vuelve a iniciar sesión');
          break;
        default:
          this.errorGeneral.set('No se ha podido cambiar la contraseña. Inténtalo de nuevo');
      }
    } finally {
      this.cambiandoPassword.set(false);
    }

    // Contraseña cambiada: cerramos el modal, la sesión y volvemos al login.
    if (cambiada) {
      this.modalPasswordAbierto.set(false);
      await this.logout();
    }
  }

  /**
   * Cierra la sesión y redirige a la pantalla de login.
   */
  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}