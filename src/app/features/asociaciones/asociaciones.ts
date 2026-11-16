import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { AsociacionDuplicadaError, CajasService } from '../../core/services/caja-service';
import { Auth } from '../../core/services/auth';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';
import { DatosEntidad, ModalEntidad } from '../../shared/components/modal-entidad/modal-entidad';

@Component({
  selector: 'app-asociaciones',
  standalone: true,
  imports: [RouterLink, ModalEntidad],
  templateUrl: './asociaciones.html',
  styleUrl: './asociaciones.scss',
})
export class AsociacionesComponent {
  protected readonly auth = inject(Auth);
  private readonly asociacionesService = inject(AsociacionesService);
  private readonly cajasService = inject(CajasService);

  // null = todavía cargando
  private readonly asociacionesBase = toSignal<Asociacion[] | null>(
    this.asociacionesService.obtenerTodas(),
    { initialValue: null },
  );

  private readonly cajasAsignadas = toSignal<Caja[] | null>(
    this.cajasService.obtenerCajasAsignadas(),
    { initialValue: null },
  );

  // Mismas asociaciones, pero con kg y nº de cajas calculados desde las cajas reales
  protected readonly asociaciones = computed<Asociacion[] | null>(() => {
    const lista = this.asociacionesBase();
    const cajas = this.cajasAsignadas();
    if (!lista || !cajas) return null;

    return lista
      .map((a) => {
        const suyas = cajas.filter((c) => c.asociacionId === a.id);
        return {
          ...a,
          numCajas: suyas.length,
          kgRecibidos: suyas.reduce((suma, c) => suma + (c.pesoKg ?? 0), 0),
        };
      })
      .sort((x, y) => x.kgRecibidos - y.kgRecibidos || x.nombre.localeCompare(y.nombre, 'es'));
  });

  // ---- B2: registrar entidad en el modal compartido (solo admin) ----
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

  protected async registrar(datos: DatosEntidad): Promise<void> {
    if (!this.auth.isAdmin() || this.guardando()) return;

    this.errorModal.set(null);
    this.guardando.set(true);
    try {
      await this.asociacionesService.crearAsociacion(datos.nombre, datos.contacto);
      this.modalAbierto.set(false); // la tarjeta nueva aparece sola (tiempo real)
    } catch (e) {
      if (e instanceof AsociacionDuplicadaError) {
        this.errorModal.set('Ya existe una asociación con ese nombre');
      } else {
        console.error(e);
        this.errorModal.set('No se ha podido registrar la entidad. Inténtalo de nuevo');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}