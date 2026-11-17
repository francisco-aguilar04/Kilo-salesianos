import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '../../core/services/auth';
import { Categoria } from '../../core/interfaces/categoria';
import {
  CategoriaDuplicadaError,
  CategoriasService,
  NuevaCategoria,
} from '../../core/services/categorias-service';
import { ModalCategoria } from '../../shared/components/modal-categoria/modal-categoria';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [ModalCategoria],
  templateUrl: './categorias.html',
  styleUrl: './categorias.scss',
})
export class CategoriasComponent {
  protected readonly auth = inject(Auth);
  private readonly categoriasService = inject(CategoriasService);

  // null = todavía cargando
  protected readonly categorias = toSignal<Categoria[] | null>(
    this.categoriasService.obtenerTodas(),
    { initialValue: null },
  );

  // ---- A6: nueva categoría (solo admin) ----
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

  protected async crear(datos: NuevaCategoria): Promise<void> {
    if (!this.auth.isAdmin() || this.guardando()) return;

    this.errorModal.set(null);
    this.guardando.set(true);
    try {
      await this.categoriasService.crearCategoria(datos);
      this.modalAbierto.set(false); // la tarjeta nueva aparece sola (tiempo real)
    } catch (e) {
      if (e instanceof CategoriaDuplicadaError) {
        this.errorModal.set(e.message);
      } else {
        console.error(e);
        this.errorModal.set('No se ha podido crear la categoría. Inténtalo de nuevo');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
