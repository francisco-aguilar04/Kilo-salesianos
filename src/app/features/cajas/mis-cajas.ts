import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { AsociacionDuplicadaError, CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { ResumenService } from '../../core/services/resumen-service';
import { UsuariosService } from '../../core/services/usuarios-service';
import { ROLES } from '../../core/constants/roles';
import { Usuario } from '../../core/interfaces/usuario';
import { ESTADOS_CAJA, EstadoCaja } from '../../core/constants/estados-caja';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';
import { TarjetaCaja } from '../../shared/components/tarjeta-caja/tarjeta-caja';
import { Aviso, TipoAviso } from '../../shared/components/aviso/aviso';
import { HojaAsignarCaja } from '../hoja-asignar-caja/hoja-asignar-caja';

interface AvisoPantalla {
  tipo: TipoAviso;
  titulo: string;
  mensaje: string;
}

// A9: botones del filtro por estado (null = sin filtro)
interface OpcionEstado {
  valor: EstadoCaja | null;
  etiqueta: string;
}

const OPCIONES_ESTADO: OpcionEstado[] = [
  { valor: null, etiqueta: 'Todas' },
  { valor: ESTADOS_CAJA.ABIERTA, etiqueta: 'Abiertas' },
  { valor: ESTADOS_CAJA.CERRADA, etiqueta: 'Sin asignar' },
  { valor: ESTADOS_CAJA.ASIGNADA, etiqueta: 'Asignadas' },
];

/** Las más recientes primero (se ordena en local, igual que obtenerCajasDe). */
function masRecientesPrimero(cajas: Caja[]): Caja[] {
  return [...cajas].sort(
    (a, b) => (b.fechaApertura?.toMillis() ?? 0) - (a.fechaApertura?.toMillis() ?? 0),
  );
}

@Component({
  selector: 'app-mis-cajas',
  standalone: true,
  imports: [TarjetaCaja, Aviso, HojaAsignarCaja],
  templateUrl: './mis-cajas.html',
  styleUrl: './mis-cajas.scss',
})
export class MisCajasComponent {
  private readonly authService = inject(Auth);
  private readonly cajasService = inject(CajasService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly asociacionesService = inject(AsociacionesService);
  private readonly resumenService = inject(ResumenService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly destroyRef = inject(DestroyRef);

  // "miércoles 4 de noviembre"
  protected readonly fechaHoy: string = new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');

  // ---- A9: el admin ve las bolsas de todos; el voluntario, solo las suyas ----
  protected readonly esAdmin = this.authService.isAdmin;
  private readonly uid = computed(() => this.authService.user()?.uid ?? null);

  // null = todavía cargando
  protected readonly cajas = toSignal<Caja[] | null>(
    this.authService.usuario$.pipe(
      // Solo nos importa quién es y si es admin; así no se rehace la consulta
      // cada vez que cambia otro campo de su ficha
      map((u) => (u ? { uid: u.uid, admin: u.rol === ROLES.COORDINADOR } : null)),
      distinctUntilChanged((a, b) => a?.uid === b?.uid && a?.admin === b?.admin),
      switchMap((sesion) => {
        if (!sesion) return of([] as Caja[]);
        return sesion.admin
          ? this.resumenService.obtenerCajas().pipe(map(masRecientesPrimero)) // sin filtro de usuario
          : this.cajasService.obtenerCajasDe(sesion.uid);
      }),
    ),
    { initialValue: null },
  );

  // Usuarios para la columna "creador". Solo el admin puede leerlos (rules),
  // así que el voluntario ni lo intenta: si no, la consulta daría error de permisos.
  private readonly usuarios = toSignal(
    this.authService.isAdmin$.pipe(
      distinctUntilChanged(),
      switchMap((admin) =>
        admin
          ? this.usuariosService.usuarios$.pipe(catchError(() => of([] as Usuario[])))
          : of([] as Usuario[]),
      ),
    ),
    { initialValue: [] as Usuario[] },
  );

  private readonly nombrePorUid = computed(
    () => new Map(this.usuarios().map((u) => [u.uid, u.nombre])),
  );

  protected readonly categorias = toSignal(this.categoriasService.obtenerTodas(), {
    initialValue: [] as Categoria[],
  });

  // Filtros (null = sin filtro). Solo se muestran al admin.
  protected readonly opcionesEstado = OPCIONES_ESTADO;
  protected readonly filtroEstado = signal<EstadoCaja | null>(null);
  protected readonly filtroCategoria = signal<string | null>(null);

  protected readonly cajasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const categoriaId = this.filtroCategoria();
    return (this.cajas() ?? []).filter(
      (caja) =>
        (estado === null || caja.estado === estado) &&
        (categoriaId === null || caja.categoriaId === categoriaId),
    );
  });

  protected cambiarFiltroEstado(estado: EstadoCaja | null): void {
    this.filtroEstado.set(estado);
  }

  // Pulsar la categoría ya elegida la quita (vuelve a "Todas")
  protected cambiarFiltroCategoria(categoriaId: string | null): void {
    this.filtroCategoria.set(this.filtroCategoria() === categoriaId ? null : categoriaId);
  }

  /** undefined = no se muestra (voluntario); null = creador desconocido o eliminado. */
  protected creadorDe(caja: Caja): string | null | undefined {
    if (!this.esAdmin()) return undefined;
    return this.nombrePorUid().get(caja.creadaPor) ?? null;
  }

  /** Las acciones (asignar, reabrir, cambiar, quitar) solo salen en las bolsas propias. */
  protected esMia(caja: Caja): boolean {
    return caja.creadaPor === this.uid();
  }

  private readonly categoriaPorId = computed(
    () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
  );

  protected readonly total = computed(() => this.cajas()?.length ?? 0);
  protected readonly abiertas = computed(() => this.filtrar(ESTADOS_CAJA.ABIERTA));
  protected readonly cerradas = computed(() => this.filtrar(ESTADOS_CAJA.CERRADA));
  protected readonly asignadas = computed(() => this.filtrar(ESTADOS_CAJA.ASIGNADA));

  // ---- HU-09: asignar caja desde aquí ----
  // Con kg y nº de cajas calculados desde las cajas reales
  protected readonly asociaciones = toSignal(this.asociacionesService.obtenerConTotales(), {
    initialValue: [] as Asociacion[],
  });

  private readonly asociacionPorId = computed(
    () => new Map(this.asociaciones().map((a) => [a.id, a])),
  );

  // Caja cerrada que se está asignando. Si no es null, la hoja está abierta.
  protected readonly cajaPorAsignar = signal<Caja | null>(null);
  protected readonly asignandoCaja = signal(false);

  // ---- Avisos ----
  protected readonly aviso = signal<AvisoPantalla | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected categoriaDe(caja: Caja): Categoria | undefined {
    // categoriaId puede ser null si se borró la categoría (A8): entonces no hay categoría
    return caja.categoriaId ? this.categoriaPorId().get(caja.categoriaId) : undefined;
  }

  protected nombreAsociacionDe(caja: Caja): string | null {
    return caja.asociacionId
      ? (this.asociacionPorId().get(caja.asociacionId)?.nombre ?? null)
      : null;
  }

  // ---- A4: quitar asociación ----
  protected async quitarAsociacion(caja: Caja): Promise<void> {
    const nombre = this.nombreAsociacionDe(caja) ?? 'la entidad';
    if (
      !confirm(`¿Quitar ${caja.codigo} de ${nombre}? La bolsa volverá a "Cerrada, falta asignar".`)
    )
      return;

    try {
      await this.cajasService.quitarAsociacion(caja.id);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Asociación quitada',
        mensaje: `${caja.codigo} vuelve a estar sin asignar`,
      });
    } catch (e) {
      console.error(e);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido quitar la asociación',
        mensaje: 'Inténtalo de nuevo',
      });
    }
  }
  // ---- A5: cambiar la entidad de una bolsa asignada ----
  protected readonly cajaPorCambiar = signal<Caja | null>(null);
  protected readonly cambiandoEntidad = signal(false);

  // Evitar duplicados: en la hoja no aparece la entidad en la que ya está
  protected readonly otrasEntidades = computed(() => {
    const actual = this.cajaPorCambiar()?.asociacionId;
    return this.asociaciones().filter((a) => a.id !== actual);
  });

  protected abrirCambio(caja: Caja): void {
    this.cajaPorCambiar.set(caja);
  }

  protected cancelarCambio(): void {
    if (!this.cambiandoEntidad()) this.cajaPorCambiar.set(null);
  }

  protected async confirmarCambio(nueva: Asociacion): Promise<void> {
    const caja = this.cajaPorCambiar();
    if (!caja || this.cambiandoEntidad()) return;

    this.cambiandoEntidad.set(true);
    try {
      await this.cajasService.cambiarAsociacion(caja.id, nueva.id);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Entidad cambiada',
        mensaje: `${caja.codigo} → ${nueva.nombre}`,
      });
    } catch (e) {
      console.error(e);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido cambiar la entidad',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.cambiandoEntidad.set(false);
      this.cajaPorCambiar.set(null);
    }
  }

  protected abrirAsignacion(caja: Caja): void {
    this.cajaPorAsignar.set(caja);
  }

  protected cancelarAsignacion(): void {
    if (!this.asignandoCaja()) this.cajaPorAsignar.set(null);
  }

  protected async confirmarAsignacion(asociacion: Asociacion): Promise<void> {
    const caja = this.cajaPorAsignar();
    if (!caja) return;

    this.asignandoCaja.set(true);
    try {
      await this.cajasService.asignarCaja(caja.id, asociacion.id);
      this.cajaPorAsignar.set(null);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Caja asignada',
        mensaje: `${caja.codigo} → ${asociacion.nombre}`,
      });
    } catch (e) {
      console.error(e);
      this.cajaPorAsignar.set(null);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido asignar la caja',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.asignandoCaja.set(false);
    }
  }

  // ---- HU-10: crear asociación nueva y asignarle la caja ----
  protected async confirmarNuevaAsociacion(nombre: string): Promise<void> {
    const caja = this.cajaPorAsignar();
    if (!caja) return;

    this.asignandoCaja.set(true);
    try {
      await this.cajasService.asignarCajaANuevaAsociacion(caja.id, nombre);
      this.cajaPorAsignar.set(null);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Caja asignada',
        mensaje: `${caja.codigo} → ${nombre}`,
      });
    } catch (e) {
      this.cajaPorAsignar.set(null);
      if (e instanceof AsociacionDuplicadaError) {
        this.mostrarAviso({
          tipo: 'aviso',
          titulo: 'Ya existe esa asociación',
          mensaje: 'Elígela en la lista',
        });
      } else {
        console.error(e);
        this.mostrarAviso({
          tipo: 'error',
          titulo: 'No se ha podido crear la asociación',
          mensaje: 'Inténtalo de nuevo',
        });
      }
    } finally {
      this.asignandoCaja.set(false);
    }
  }

  private mostrarAviso(aviso: AvisoPantalla, ms = 3000): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }

  private filtrar(estado: EstadoCaja): Caja[] {
    return this.cajasFiltradas().filter((caja) => caja.estado === estado);
  }

  protected readonly reabriendo = signal(false);

  protected async reabrir(caja: Caja): Promise<void> {
    // Se mira la lista completa y solo las propias: el admin ve también las de los demás
    const tengoAbierta = (this.cajas() ?? []).some(
      (c) => c.estado === ESTADOS_CAJA.ABIERTA && this.esMia(c),
    );
    if (tengoAbierta) {
      this.mostrarAviso({
        tipo: 'aviso',
        titulo: 'Ya tienes una bolsa abierta',
        mensaje: 'Ciérrala antes de reabrir otra',
      });
      return;
    }
    this.reabriendo.set(true);
    try {
      await this.cajasService.reabrirCaja(caja);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Bolsa reabierta',
        mensaje: `${caja.codigo}: ya puedes seguir añadiendo`,
      });
    } catch (e) {
      console.error(e);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido reabrir',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.reabriendo.set(false);
    }
  }
}
