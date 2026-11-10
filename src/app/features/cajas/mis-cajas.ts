import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { ESTADOS_CAJA, EstadoCaja } from '../../core/constants/estados-caja';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';
import { TarjetaCaja } from '../../shared/components/tarjeta-caja/tarjeta-caja';

@Component({
  selector: 'app-mis-cajas',
  standalone: true,
  imports: [TarjetaCaja],
  templateUrl: './mis-cajas.html',
  styleUrl: './mis-cajas.scss',
})
export class MisCajasComponent {
  private readonly authService = inject(Auth);
  private readonly cajasService = inject(CajasService);
  private readonly categoriasService = inject(CategoriasService);

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

  protected categoriaDe(caja: Caja): Categoria | undefined {
    return this.categoriaPorId().get(caja.categoriaId);
  }

  protected abrirAsignacion(caja: Caja): void {
    // TODO (HU-09): abrir la hoja "¿A qué asociación va?" para esta caja cerrada.
  }

  private filtrar(estado: EstadoCaja): Caja[] {
    return (this.cajas() ?? []).filter((caja) => caja.estado === estado);
  }
}