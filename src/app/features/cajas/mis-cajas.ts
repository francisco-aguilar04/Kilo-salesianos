import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { AsociacionesService } from '../../core/services/asociaciones-service';
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
  private readonly destroyRef = inject(DestroyRef);

  // "miércoles 4 de noviembre"
  protected readonly fechaHoy: string = new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');

  // null = todavía cargando
  protected readonly cajas = toSignal<Caja[] | null>(
    this.authService.user$.pipe(
      switchMap((u) => (u ? this.cajasService.obtenerCajasDe(u.uid) : of([] as Caja[]))),
    ),
    { initialValue: null },
  );

  private readonly categorias = toSignal(this.categoriasService.obtenerTodas(), {
    initialValue: [] as Categoria[],
  });

  private readonly categoriaPorId = computed(
    () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
  );

  protected readonly total = computed(() => this.cajas()?.length ?? 0);
  protected readonly abiertas = computed(() => this.filtrar(ESTADOS_CAJA.ABIERTA));
  protected readonly cerradas = computed(() => this.filtrar(ESTADOS_CAJA.CERRADA));
  protected readonly asignadas = computed(() => this.filtrar(ESTADOS_CAJA.ASIGNADA));

  // ---- HU-09: asignar caja desde aquí ----
  protected readonly asociaciones = toSignal(this.asociacionesService.obtenerTodas(), {
    initialValue: [] as Asociacion[],
  });
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
    return this.categoriaPorId().get(caja.categoriaId);
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

  private mostrarAviso(aviso: AvisoPantalla, ms = 3000): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }

  private filtrar(estado: EstadoCaja): Caja[] {
    return (this.cajas() ?? []).filter((caja) => caja.estado === estado);
  }
}