import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { AsociacionDuplicadaError, CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';
import { DatosEntidad, ModalEntidad } from '../../shared/components/modal-entidad/modal-entidad';
import { ModalConfirmar } from '../../shared/components/modal-confirmar/modal-confirmar';
import { Aviso, TipoAviso } from '../../shared/components/aviso/aviso';
import { HojaAsignarCaja } from '../hoja-asignar-caja/hoja-asignar-caja';
import { EliminadoPipe } from '../../shared/pipes/eliminado-pipe/eliminado-pipe';

/** Una fila del resumen de kilos por categoría. */
interface ResumenCategoria {
  clave: string; // para el track del @for
  nombre: string | null | undefined; // null = Eliminado (pipe), undefined = cargando
  color: string;
  kg: number;
  bolsas: number;
}

@Component({
  selector: 'app-asociacion-detalle',
  standalone: true,
  imports: [
    RouterLink,
    TitleCasePipe,
    ModalEntidad,
    ModalConfirmar,
    Aviso,
    HojaAsignarCaja,
    EliminadoPipe,
  ],
  templateUrl: './asociacion-detalle.html',
  styleUrl: './asociacion-detalle.scss',
})
export class AsociacionDetalleComponent {
  protected readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly asociacionesService = inject(AsociacionesService);
  private readonly cajasService = inject(CajasService);
  private readonly categoriasService = inject(CategoriasService);

  // undefined = cargando, null = no existe
  protected readonly asociacion = toSignal<Asociacion | null | undefined>(
    this.route.paramMap.pipe(
      map((params) => params.get('id')),
      switchMap((id) => (id ? this.asociacionesService.obtenerPorId(id) : of(null))),
    ),
    { initialValue: undefined },
  );

  // Todas las entidades, para comprobar nombres repetidos al editar
  protected readonly todas = toSignal(this.asociacionesService.obtenerTodas(), {
    initialValue: [] as Asociacion[],
  });

  // null = todavía cargando
  private readonly cajasAsignadas = toSignal<Caja[] | null>(
    this.cajasService.obtenerCajasAsignadas(),
    { initialValue: null },
  );

  private readonly categorias = toSignal(this.categoriasService.obtenerTodas(), {
    initialValue: [] as Categoria[],
  });

  private readonly categoriaPorId = computed(
    () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
  );

  // Cajas de esta entidad, ordenadas por código. null = cargando
  protected readonly cajas = computed<Caja[] | null>(() => {
    const todas = this.cajasAsignadas();
    const id = this.asociacion()?.id;
    if (!todas || !id) return null;
    return todas
      .filter((c) => c.asociacionId === id)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  });

  // Totales desde las cajas reales, igual que en la lista
  protected readonly totalCajas = computed(() => this.cajas()?.length ?? 0);
  protected readonly totalKg = computed(() =>
    (this.cajas() ?? []).reduce((suma, c) => suma + (c.pesoKg ?? 0), 0),
  );

  // ---- Kilos y bolsas por categoría ----
  // Agrupa las bolsas de esta entidad por categoría y suma sus kg.
  // Las de categoría borrada (categoriaId null) van juntas en el grupo "Eliminado".
  protected readonly kilosPorCategoria = computed<ResumenCategoria[]>(() => {
    const grupos = new Map<string | null, ResumenCategoria>();

    for (const caja of this.cajas() ?? []) {
      const clave = caja.categoriaId; // null = Eliminado
      let grupo = grupos.get(clave);
      if (!grupo) {
        const categoria = clave === null ? undefined : this.categoriaPorId().get(clave);
        grupo = {
          clave: clave ?? 'eliminado',
          nombre: clave === null ? null : categoria?.nombre,
          color: categoria?.color ?? '#9ca3af', // gris para "Eliminado"
          kg: 0,
          bolsas: 0,
        };
        grupos.set(clave, grupo);
      }
      grupo.kg += caja.pesoKg ?? 0;
      grupo.bolsas++;
    }

    return [...grupos.values()]
      .map((g) => ({ ...g, kg: Math.round(g.kg * 10) / 10 })) // evita 10.4999999
      .sort((a, b) => b.kg - a.kg); // de más a menos kilos
  });

  /** A11: null = categoría borrada ("Eliminado"); undefined = aún cargando. */
  protected nombreCategoriaDe(caja: Caja): string | null | undefined {
    if (caja.categoriaId === null) return null;
    return this.categoriaPorId().get(caja.categoriaId)?.nombre;
  }

  // ---- B4: editar entidad en el modal compartido (solo admin) ----
  protected readonly modalAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorModal = signal<string | null>(null);

  protected abrirModal(): void {
    if (!this.auth.isAdmin()) return;
    this.errorModal.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
  }

  protected async guardar(datos: DatosEntidad): Promise<void> {
    const actual = this.asociacion();
    if (!actual || !this.auth.isAdmin() || this.guardando()) return;

    this.errorModal.set(null);
    this.guardando.set(true);
    try {
      await this.asociacionesService.actualizarAsociacion(actual.id, datos.nombre, datos.contacto);
      this.modalAbierto.set(false); // la ficha se actualiza sola (tiempo real)
    } catch (e) {
      if (e instanceof AsociacionDuplicadaError) {
        this.errorModal.set('Ya existe una asociación con ese nombre');
      } else {
        console.error(e);
        this.errorModal.set('No se han podido guardar los cambios. Inténtalo de nuevo');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  // ---- B5: borrar entidad con confirmación (solo admin) ----
  protected readonly confirmandoBorrado = signal(false);
  protected readonly borrando = signal(false);
  protected readonly errorBorrado = signal<string | null>(null);

  protected readonly mensajeBorrado = computed(() => {
    const a = this.asociacion();
    if (!a) return '';
    const n = this.totalCajas();
    const cajas =
      n === 0
        ? 'No tiene cajas asignadas.'
        : n === 1
          ? 'Su caja asignada volverá a estar cerrada y pendiente de asignar.'
          : `Sus ${n} cajas asignadas volverán a estar cerradas y pendientes de asignar.`;
    return `Vas a borrar «${a.nombre}». ${cajas} Esta acción no se puede deshacer.`;
  });

  protected abrirBorrado(): void {
    if (!this.auth.isAdmin()) return;
    this.errorBorrado.set(null);
    this.confirmandoBorrado.set(true);
  }

  protected cancelarBorrado(): void {
    if (this.borrando()) return;
    this.confirmandoBorrado.set(false);
  }

  protected async borrar(): Promise<void> {
    const actual = this.asociacion();
    if (!actual || !this.auth.isAdmin() || this.borrando()) return;

    this.errorBorrado.set(null);
    this.borrando.set(true);
    try {
      await this.asociacionesService.eliminarAsociacion(actual.id);
      this.confirmandoBorrado.set(false);
      await this.router.navigate(['/asociaciones']);
    } catch (e) {
      console.error(e);
      this.errorBorrado.set('No se ha podido borrar la entidad. Inténtalo de nuevo');
    } finally {
      this.borrando.set(false);
    }
  }
  // ---- A5: cambiar la entidad de una bolsa ----
  protected readonly cajaPorCambiar = signal<Caja | null>(null);
  protected readonly cambiando = signal(false);

  // Evitar duplicados: en la hoja no aparece la entidad en la que ya está
  protected readonly otrasEntidades = computed(() =>
    this.todas().filter((a) => a.id !== this.asociacion()?.id),
  );

  // Mismo criterio que la A4 y que las reglas: el creador de la bolsa o el coordinador
  protected puedeCambiar(caja: Caja): boolean {
    return this.auth.isAdmin() || caja.creadaPor === this.auth.user()?.uid;
  }

  protected abrirCambio(caja: Caja): void {
    this.cajaPorCambiar.set(caja);
  }

  protected cancelarCambio(): void {
    if (!this.cambiando()) this.cajaPorCambiar.set(null);
  }

  protected async confirmarCambio(nueva: Asociacion): Promise<void> {
    const caja = this.cajaPorCambiar();
    if (!caja || this.cambiando()) return;

    this.cambiando.set(true);
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
      this.cambiando.set(false);
      this.cajaPorCambiar.set(null);
    }
  }

  // ---- Avisos (mismo patrón que Mis bolsas) ----
  protected readonly aviso = signal<{ tipo: TipoAviso; titulo: string; mensaje: string } | null>(
    null,
  );
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  private mostrarAviso(
    aviso: { tipo: TipoAviso; titulo: string; mensaje: string },
    ms = 3000,
  ): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }
}
