import { Component, input, output } from '@angular/core';
import { Categoria } from '../../core/interfaces/categoria';
import { TitleCasePipe } from '@angular/common';

@Component({
  imports: [TitleCasePipe],
  selector: 'app-hoja-nueva-caja',
  styleUrl: './hoja-nueva-caja.scss',
  templateUrl: './hoja-nueva-caja.html',
})
export class HojaNuevaCaja {
  readonly categoria = input.required<Categoria>();
  readonly creando = input(false); // true mientras se guarda en Firestore
  readonly crear = output<void>();
  readonly cancelar = output<void>();
}
