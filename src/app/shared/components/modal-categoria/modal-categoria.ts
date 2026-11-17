import { Component, computed, HostListener, input, output, signal } from '@angular/core';
import { Categoria } from '../../../core/interfaces/categoria';
import { NuevaCategoria } from '../../../core/services/categorias-service';

// 2 a 4 letras o números, como los QR impresos (AC, LE, NP…)
const PATRON_CODIGO = /^[A-Z0-9]{2,4}$/;

function normalizarNombre(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizarCodigo(texto: string): string {
  return texto.trim().toUpperCase();
}

@Component({
  selector: 'app-modal-categoria',
  standalone: true,
  templateUrl: './modal-categoria.html',
  styleUrl: './modal-categoria.scss',
})
export class ModalCategoria {
  readonly categorias = input.required<Categoria[]>(); // para avisar de repetidas antes de enviar
  readonly guardando = input(false);
  readonly errorExterno = input<string | null>(null); // error que devuelve el servicio

  readonly guardar = output<NuevaCategoria>();
  readonly cancelar = output<void>();

  protected readonly nombre = signal('');
  protected readonly codigo = signal('');
  protected readonly color = signal('#1a56db');
  private readonly intentado = signal(false);

  protected readonly errorNombre = computed<string | null>(() => {
    const nombre = normalizarNombre(this.nombre());
    if (!nombre) return this.intentado() ? 'El nombre es obligatorio' : null;
    const repetido = this.categorias().some((c) => normalizarNombre(c.nombre) === nombre);
    return repetido ? 'Ya existe una categoría con ese nombre' : null;
  });

  protected readonly errorCodigo = computed<string | null>(() => {
    const codigo = normalizarCodigo(this.codigo());
    if (!codigo) return this.intentado() ? 'El código es obligatorio' : null;
    if (!PATRON_CODIGO.test(codigo)) return 'De 2 a 4 letras o números, sin espacios';
    const repetido = this.categorias().some((c) => c.codigoQr === codigo);
    return repetido ? 'Ese código ya lo usa otra categoría' : null;
  });

  // Vista previa: así se verá la barra de la bolsa con esta categoría
  protected readonly vistaNombre = computed(() => normalizarNombre(this.nombre()) || 'nombre');
  protected readonly vistaCodigo = computed(() => normalizarCodigo(this.codigo()) || 'QR');

  protected enviar(): void {
    if (this.guardando()) return;

    this.intentado.set(true);
    if (this.errorNombre() || this.errorCodigo()) return;

    this.guardar.emit({
      nombre: normalizarNombre(this.nombre()),
      codigoQr: normalizarCodigo(this.codigo()),
      color: this.color(),
    });
  }

  @HostListener('document:keydown.escape')
  protected cerrar(): void {
    if (!this.guardando()) this.cancelar.emit();
  }
}
