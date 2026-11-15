import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { AsociacionDuplicadaError, CajasService } from '../../core/services/caja-service';
import { Auth } from '../../core/services/auth';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';

@Component({
  selector: 'app-asociaciones',
  standalone: true,
  imports: [RouterLink],
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

  // ---- B2: registrar entidad en un modal (solo admin) ----
  protected readonly modalAbierto = signal(false);
  protected readonly nombreNuevo = signal('');
  protected readonly contactoNuevo = signal('');
  protected readonly guardando = signal(false);
  private readonly intentado = signal(false);
  private readonly errorServidor = signal<string | null>(null);

  private static normalizar(texto: string): string {
    return texto.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  // RN-05: obligatorio y sin repetir (sin mayúsculas ni espacios de más)
  private readonly errorNombre = computed<string | null>(() => {
    const normalizado = AsociacionesComponent.normalizar(this.nombreNuevo());
    if (!normalizado) return this.intentado() ? 'El nombre es obligatorio' : null;
    const repetido = (this.asociacionesBase() ?? []).some(
      (a) => AsociacionesComponent.normalizar(a.nombre) === normalizado,
    );
    return repetido ? 'Ya existe una asociación con ese nombre' : null;
  });

  protected readonly mensajeError = computed<string | null>(
    () => this.errorNombre() ?? this.errorServidor(),
  );

  protected abrirModal(): void {
    if (!this.auth.isAdmin()) return;
    this.nombreNuevo.set('');
    this.contactoNuevo.set('');
    this.intentado.set(false);
    this.errorServidor.set(null);
    this.modalAbierto.set(true);
  }

  @HostListener('document:keydown.escape')
  protected cerrarModal(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
  }

  protected escribirNombre(valor: string): void {
    this.nombreNuevo.set(valor);
    this.errorServidor.set(null);
  }

  protected escribirContacto(valor: string): void {
    this.contactoNuevo.set(valor);
  }

  protected async registrar(): Promise<void> {
    if (!this.auth.isAdmin() || this.guardando()) return;

    this.intentado.set(true);
    if (this.errorNombre()) return;

    this.guardando.set(true);
    try {
      await this.asociacionesService.crearAsociacion(this.nombreNuevo(), this.contactoNuevo());
      this.modalAbierto.set(false); // la tarjeta nueva aparece sola (tiempo real)
    } catch (e) {
      if (e instanceof AsociacionDuplicadaError) {
        this.errorServidor.set('Ya existe una asociación con ese nombre');
      } else {
        console.error(e);
        this.errorServidor.set('No se ha podido registrar la entidad. Inténtalo de nuevo');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}