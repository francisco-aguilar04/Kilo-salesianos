import { Component, computed, input, output, signal } from '@angular/core';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';

@Component({
    selector: 'app-hoja-asignar-caja',
    standalone: true,
    templateUrl: './hoja-asignar-caja.html',
    styleUrl: './hoja-asignar-caja.scss',
})
export class HojaAsignarCaja {
    readonly caja = input.required<Caja>();
    readonly asociaciones = input.required<Asociacion[]>();
    readonly guardando = input(false);

    readonly asignar = output<Asociacion>();
    readonly cancelar = output<void>();

    protected readonly paso = signal<'elegir' | 'confirmar'>('elegir');
    private readonly seleccionadaId = signal<string | null>(null);
    protected readonly seleccionada = computed(
        () => this.asociaciones().find((a) => a.id === this.seleccionadaId()) ?? null,
    );

    protected elegir(a: Asociacion): void {
        this.seleccionadaId.set(a.id);
    }
    protected esSeleccionada(a: Asociacion): boolean {
        return a.id === this.seleccionadaId();
    }
    protected continuar(): void {
        if (this.seleccionada()) this.paso.set('confirmar');
    }
    protected volver(): void {
        if (!this.guardando()) this.paso.set('elegir');
    }
    protected confirmar(): void {
        const a = this.seleccionada();
        if (a && !this.guardando()) this.asignar.emit(a);
    }
    protected cerrar(): void {
        if (!this.guardando()) this.cancelar.emit();
    }
    protected kg(n: number): string {
        return `${n.toLocaleString('es-ES')} kg`;
    }

    protected alPulsarCapa(): void {
        if (this.paso() === 'confirmar') this.volver();
        else this.cerrar();
    }

}