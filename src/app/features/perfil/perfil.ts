import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth, CambioPasswordError } from '../../core/services/auth';
import { ROLES, Rol } from '../../core/constants/roles';
import { ResumenDiaService } from '../../core/services/resumen-dia-service';
import {
  ActualizarUsuarioError,
  CrearUsuarioError,
  EMAIL_PROTEGIDO,
  UsuariosService,
} from '../../core/services/usuarios-service';
import { Usuario } from '../../core/interfaces/usuario';
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

  private readonly usuariosService = inject(UsuariosService);

  protected readonly tab = signal<'perfil' | 'usuarios'>('perfil');

  // Solo se consulta Firestore si el usuario es coordinador.
  protected readonly usuarios = toSignal(
    this.authService.isAdmin$.pipe(
      switchMap((admin) => (admin ? this.usuariosService.usuarios$ : of([] as Usuario[]))),
    ),
    { initialValue: [] as Usuario[] },
  );

  protected cambiarTab(tab: 'perfil' | 'usuarios'): void {
    this.tab.set(tab);
  }

  protected readonly ROLES = ROLES;
  protected readonly formAbierto = signal(false);
  protected readonly nuevoNombre = signal('');
  protected readonly nuevoEmail = signal('');
  protected readonly nuevaPassword = signal('');
  protected readonly nuevoRol = signal<Rol>(ROLES.VOLUNTARIO);
  protected readonly creandoUsuario = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly usuarioCreado = signal<string | null>(null);

  protected readonly formValido = computed(
    () =>
      this.nuevoNombre().trim().length > 0 &&
      /^\S+@\S+\.\S+$/.test(this.nuevoEmail().trim()) &&
      this.nuevaPassword().length >= 6,
  );

  protected abrirForm(): void {
    this.usuarioCreado.set(null);
    this.errorCrear.set(null);
    this.formAbierto.set(true);
  }

  protected cerrarForm(): void {
    if (this.creandoUsuario()) return;
    this.formAbierto.set(false);
    this.errorCrear.set(null);
    this.nuevoNombre.set('');
    this.nuevoEmail.set('');
    this.nuevaPassword.set('');
    this.nuevoRol.set(ROLES.VOLUNTARIO);
  }

  protected async crearUsuario(): Promise<void> {
    if (!this.formValido() || this.creandoUsuario()) return;

    this.errorCrear.set(null);
    this.creandoUsuario.set(true);
    const nombre = this.nuevoNombre().trim();
    try {
      await this.usuariosService.crearUsuario({
        nombre,
        email: this.nuevoEmail().trim(),
        password: this.nuevaPassword(),
        rol: this.nuevoRol(),
      });
      this.creandoUsuario.set(false);
      this.cerrarForm();
      this.usuarioCreado.set(`Usuario ${nombre} creado correctamente`);
    } catch (e) {
      const motivo = e instanceof CrearUsuarioError ? e.motivo : 'desconocido';
      switch (motivo) {
        case 'email-en-uso':
          this.errorCrear.set('Ya existe un usuario con ese email');
          break;
        case 'email-invalido':
          this.errorCrear.set('El email no es válido');
          break;
        case 'password-debil':
          this.errorCrear.set('La contraseña es demasiado débil. Usa al menos 6 caracteres');
          break;
        case 'sin-conexion':
          this.errorCrear.set('Sin conexión. Comprueba tu internet e inténtalo de nuevo');
          break;
        case 'error-guardado':
          this.errorCrear.set('La cuenta se creó, pero no se pudo guardar el rol. Avisa al desarrollador');
          break;
        default:
          this.errorCrear.set('No se ha podido crear el usuario. Inténtalo de nuevo');
      }
    } finally {
      this.creandoUsuario.set(false);
    }
  }

  // ---- Editar usuario (modal) ----
  protected readonly usuarioEditando = signal<Usuario | null>(null);
  protected readonly editNombre = signal('');
  protected readonly editRol = signal<Rol>(ROLES.VOLUNTARIO);
  protected readonly guardandoEdicion = signal(false);
  protected readonly errorEditar = signal<string | null>(null);
  protected readonly confirmandoBaja = signal(false);
  protected readonly confirmandoEliminar = signal(false);

  protected readonly editValido = computed(() => this.editNombre().trim().length > 0);

  // Lista visible: sin el usuario con sesión ni el usuario protegido.
  protected readonly usuariosVisibles = computed(() => {
    const uidActual = this.usuario()?.uid;
    return this.usuarios().filter(
      (u) => u.uid !== uidActual && u.email.toLowerCase() !== EMAIL_PROTEGIDO,
    );
  });

  // No se puede editar a uno mismo ni al usuario protegido.
  protected puedeEditar(u: Usuario): boolean {
    return u.uid !== this.usuario()?.uid && u.email.toLowerCase() !== EMAIL_PROTEGIDO;
  }

  protected abrirEdicion(u: Usuario): void {
    if (!this.puedeEditar(u)) return;
    this.errorEditar.set(null);
    this.usuarioCreado.set(null);
    this.confirmandoBaja.set(false);
    this.confirmandoEliminar.set(false);
    this.editNombre.set(u.nombre);
    this.editRol.set(u.rol);
    this.usuarioEditando.set(u);
  }

  protected cerrarEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.confirmandoBaja.set(false);
    this.confirmandoEliminar.set(false);
    this.usuarioEditando.set(null);
    this.errorEditar.set(null);
  }

  private mensajeErrorEditar(e: unknown): string {
    const motivo = e instanceof ActualizarUsuarioError ? e.motivo : 'desconocido';
    switch (motivo) {
      case 'protegido':
        return 'Este usuario no se puede modificar';
      case 'sin-conexion':
        return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo';
      default:
        return 'No se ha podido guardar. Inténtalo de nuevo';
    }
  }

  protected async guardarEdicion(u: Usuario): Promise<void> {
    const uidActual = this.usuario()?.uid;
    if (!uidActual || !this.editValido() || this.guardandoEdicion()) return;

    this.errorEditar.set(null);
    this.guardandoEdicion.set(true);
    const nombre = this.editNombre().trim();
    try {
      await this.usuariosService.actualizarUsuario(u, uidActual, {
        nombre,
        rol: this.editRol(),
      });
      this.usuarioEditando.set(null);
      this.usuarioCreado.set(`Usuario ${nombre} actualizado correctamente`);
    } catch (e) {
      this.errorEditar.set(this.mensajeErrorEditar(e));
    } finally {
      this.guardandoEdicion.set(false);
    }
  }

  // Dar de baja (activo = false) o reactivar (activo = true).
  protected async cambiarEstado(u: Usuario, activo: boolean): Promise<void> {
    const uidActual = this.usuario()?.uid;
    if (!uidActual || this.guardandoEdicion()) return;

    this.errorEditar.set(null);
    this.guardandoEdicion.set(true);
    try {
      await this.usuariosService.establecerActivo(u, uidActual, activo);
      this.confirmandoBaja.set(false);
      this.usuarioEditando.set(null);
      this.usuarioCreado.set(
        activo ? `Usuario ${u.nombre} reactivado` : `Usuario ${u.nombre} dado de baja`,
      );
    } catch (e) {
      this.errorEditar.set(this.mensajeErrorEditar(e));
    } finally {
      this.guardandoEdicion.set(false);
    }
  }

  // Quita al usuario de sus bolsas y borra su documento.
  protected async eliminar(u: Usuario): Promise<void> {
    const uidActual = this.usuario()?.uid;
    if (!uidActual || this.guardandoEdicion()) return;

    this.errorEditar.set(null);
    this.guardandoEdicion.set(true);
    try {
      await this.usuariosService.eliminarUsuario(u, uidActual);
      this.confirmandoEliminar.set(false);
      this.usuarioEditando.set(null);
      this.usuarioCreado.set(`Usuario ${u.nombre} eliminado`);
    } catch (e) {
      this.errorEditar.set(this.mensajeErrorEditar(e));
    } finally {
      this.guardandoEdicion.set(false);
    }
  }
  // Se usa para redirigir al login tras cerrar sesión.
  private readonly router = inject(Router);

  protected readonly usuario = this.authService.usuario;
  protected readonly esAdmin = this.authService.isAdmin;

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