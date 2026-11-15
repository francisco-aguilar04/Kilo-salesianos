import { Component, HostListener, input, output } from '@angular/core';

@Component({
    selector: 'app-modal-confirmar',
    standalone: true,
    templateUrl: './modal-confirmar.html',
    styleUrl: './modal-confirmar.scss',
})
export class ModalConfirmar {
    readonly titulo = input.required<string>();
    readonly mensaje = input.required<string>();
    readonly textoBoton = input('Confirmar');
    readonly textoProcesando = input('Procesando…');
    readonly peligro = input(false); // botón rojo para acciones destructivas
    readonly procesando = input(false);
    readonly error = input<string | null>(null);

    readonly confirmar = output<void>();
    readonly cancelar = output<void>();

    @HostListener('document:keydown.escape')
    protected cerrar(): void {
        if (!this.procesando()) this.cancelar.emit();
    }

    protected aceptar(): void {
        if (!this.procesando()) this.confirmar.emit();
    }
}