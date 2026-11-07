import { Component, signal } from '@angular/core';
import { Escaner } from '../../../shared/components/escaner/escaner';

@Component({
  selector: 'app-escaner-prueba',
  imports: [Escaner],
  templateUrl: './escaner-prueba.html',
  styleUrl: './escaner-prueba.scss',
})
export class EscanerPrueba {
  protected readonly lecturas = signal<string[]>([]);

  protected alLeerCodigo(codigo: string): void {
    this.lecturas.update((anteriores) => [codigo, ...anteriores].slice(0, 5));
  }
}
