import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Escaner } from '../../../shared/components/escaner/escaner';
import { Aviso, TipoAviso } from '../../../shared/components/aviso/aviso';
import { CategoriasService } from '../../../core/services/categorias-service';
import { QrInvalidoError } from '../../../core/errors/qr-invalid-error';

interface AvisoPantalla {
  tipo: TipoAviso;
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [Escaner, Aviso],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class InicioComponent {
  private readonly categorias = inject(CategoriasService);
  private readonly destroyRef = inject(DestroyRef);
  private temporizador?: ReturnType<typeof setTimeout>;

  protected readonly aviso = signal<AvisoPantalla | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected atras(): void {
    // TODO: según el Figma (1.1), esta flecha lleva a "Introducir a mano".
    // Esa pantalla aún no existe; cuando esté, navegar a su ruta aquí.
  }

  protected async alLeerCodigo(codigo: string): Promise<void> {
    try {
      const categoria = await this.categorias.validarCodigo(codigo);
      const nombre = categoria.nombre.charAt(0).toUpperCase() + categoria.nombre.slice(1);
      this.mostrarAviso({ tipo: 'exito', titulo: nombre, mensaje: 'Categoría detectada' });
    } catch (e) {
      if (e instanceof QrInvalidoError) {
        this.mostrarAviso({
          tipo: 'aviso',
          titulo: 'QR no válido',
          mensaje: 'Avisa al coordinador',
        });
      } else {
        console.error(e);
        this.mostrarAviso({
          tipo: 'error',
          titulo: 'Ha ocurrido un error',
          mensaje: 'Inténtalo de nuevo',
        });
      }
    }
  }

  private mostrarAviso(aviso: AvisoPantalla, ms = 3000): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }
}
