import { Component, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';
import { PESO_MAXIMO_KG } from '../../core/constants/peso-cajas';

/** Validador propio: Validators.min(0) dejaría pasar el 0, y aquí tiene que ser > 0. */
function mayorQueCero(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  return valor === null || valor > 0 ? null : { mayorQueCero: true };
}

@Component({
  selector: 'app-hoja-cerrar-caja',
  imports: [ReactiveFormsModule, TitleCasePipe],
  templateUrl: './hoja-cerrar-caja.html',
  styleUrl: './hoja-cerrar-caja.scss',
})
export class HojaCerrarCaja {
  readonly caja = input.required<Caja>();
  readonly categoria = input<Categoria | null>(null);
  readonly guardando = input(false);
  readonly confirmar = output<number>(); // emite el peso en kg
  readonly cancelar = output<void>();

  protected readonly pesoMaximo = PESO_MAXIMO_KG;
  protected readonly peso = new FormControl<number | null>(null, [
    Validators.required,
    mayorQueCero,
    Validators.max(PESO_MAXIMO_KG),
  ]);

  protected mostrarError(): boolean {
    return this.peso.invalid && (this.peso.dirty || this.peso.touched);
  }


  protected enviar(evento: Event): void {
    evento.preventDefault(); // que el formulario no recargue la página
    if (this.peso.invalid) {
      this.peso.markAsTouched(); // así sale el error aunque no haya escrito nada
      return;
    }
    this.confirmar.emit(this.peso.value as number);
  }
}
