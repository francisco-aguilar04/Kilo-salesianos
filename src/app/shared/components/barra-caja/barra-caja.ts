import { Component, input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';

@Component({
  selector: 'app-barra-caja',
  imports: [TitleCasePipe],
  templateUrl: './barra-caja.html',
  styleUrl: './barra-caja.scss',
})
export class BarraCaja {
  readonly caja = input.required<Caja>();
  readonly categoria = input<Categoria | null>(null);
}
