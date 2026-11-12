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
    readonly crearNueva = output<string>(); // HU-10: nombre de la asociación nueva
    readonly cancelar = output<void>();

    protected readonly paso = signal<'elegir' | 'confirmar' | 'nueva'>('elegir');
    private readonly seleccionadaId = signal<string | null>(null);
    protected readonly seleccionada = computed(
        () => this.asociaciones().find((a) => a.id === this.seleccionadaId()) ?? null,
    );

    // ---- HU-10: nueva asociación ----
    protected readonly nombreNuevo = signal('');
    private readonly intentado = signal(false);

    private static normalizar(texto: string): string {
        return texto.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    // RN-05: obligatorio y sin repetir (sin mayúsculas ni espacios de más)
    protected readonly errorNombre = computed<string | null>(() => {
        const normalizado = HojaAsignarCaja.normalizar(this.nombreNuevo());
        if (!normalizado) return this.intentado() ? 'El nombre es obligatorio' : null;
        const repetido = this.asociaciones().some(
            (a) => HojaAsignarCaja.normalizar(a.nombre) === normalizado,
        );
        return repetido ? 'Ya existe una asociación con ese nombre' : null;
    });

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
        if (this.guardando()) return;
        this.paso.set('elegir');
        this.nombreNuevo.set('');
        this.intentado.set(false);
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

    // ---- HU-10 ----
    protected abrirNueva(): void {
        this.nombreNuevo.set('');
        this.intentado.set(false);
        this.paso.set('nueva');
    }
    protected escribir(valor: string): void {
        this.nombreNuevo.set(valor);
    }
    protected crear(): void {
        if (this.guardando()) return;
        this.intentado.set(true);
        const normalizado = HojaAsignarCaja.normalizar(this.nombreNuevo());
        if (!normalizado || this.errorNombre()) return;
        this.crearNueva.emit(this.nombreNuevo().trim().replace(/\s+/g, ' '));
    }

    protected alPulsarCapa(): void {
        if (this.paso() === 'elegir') this.cerrar();
        else this.volver();
    }
}