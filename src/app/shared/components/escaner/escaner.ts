import { AfterViewInit, Component, OnDestroy, output, signal, viewChild } from '@angular/core';
import {
  NgxScannerQrcodeComponent,
  ScannerQRCodeConfig,
  ScannerQRCodeDevice,
  ScannerQRCodeResult,
  ScannerQRCodeSymbolType,
} from 'ngx-scanner-qrcode';

type EstadoEscaner = 'cargando' | 'escaneando' | 'sin-permiso' | 'sin-camara' | 'error';

@Component({
  imports: [NgxScannerQrcodeComponent],
  selector: 'app-escaner',
  styleUrl: './escaner.scss',
  templateUrl: './escaner.html',
})
export class Escaner implements AfterViewInit, OnDestroy {
  readonly codigoLeido = output<string>();
  protected readonly estado = signal<EstadoEscaner>('cargando');
  private readonly scanner = viewChild.required(NgxScannerQrcodeComponent);

  protected readonly config: ScannerQRCodeConfig = {
    symbolType: [ScannerQRCodeSymbolType.ScannerQRCode_QRCODE], //Esto hace que solo lea codigo QR,  se puede añadir tambien de barras
    isBeep: false, //Elimina el pitido del movil
    isMasked: false,
    vibrate: 200,
    constraints: { audio: false, video: { facingMode: { ideal: 'environment' } } }, //Facing mode es la que dice que use la camara trasera
  };

  //el cooldown entre codigo y codigo para leer
  private static readonly ESPERA_MS = 3000;
  private ultimoCodigo = '';
  private ultimaLectura = 0;

  //Comienza el arranque de la camara

  //No se puede arrancar la camara en el constructor,
  // porque el componente de la librería todavía no existe en pantalla
  // (eso se cumple en ngAfterViewInit), y además tiene que cargar su motor WebAssembly.
  // isReady avisa cuando ese motor está listo.
  ngAfterViewInit(): void {
    this.scanner().isReady.subscribe({
      next: () => this.arrancar(),
      error: () => this.estado.set('error'),
    });
  }

  //Para apagar la camara y que no la pare
  ngOnDestroy(): void {
    this.scanner().stop();
  }

  //Una vez que esta listo arranca la camara
  protected arrancar(): void {
    this.estado.set('cargando');
    this.scanner()
      .start((camaras: ScannerQRCodeDevice[]) => this.elegirCamaraTrasera(camaras))
      .subscribe({
        next: () => this.estado.set('escaneando'),
        error: (err: unknown) => this.estado.set(this.traducirError(err)),
      });
  }

  private async elegirCamaraTrasera(camarasIniciales: ScannerQRCodeDevice[]): Promise<void> {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const camaras = dispositivos.filter((d) => d.kind === 'videoinput');
    const trasera = camaras.find((c) => /back|rear|environment|trasera/i.test(c.label));
    const elegida = trasera ?? camaras.at(-1) ?? camarasIniciales[0];
    this.scanner().playDevice(elegida.deviceId);
  }

  //Aqui termina el arranque de la camara

  //Por param entra un qr y adentro hace la magia
  //La librería por default analiza 30 fps, de esta forma ignoramos que esto suceda
  protected alLeer(resultados: ScannerQRCodeResult[]): void {
    const codigo = resultados[0]?.value?.trim();
    if (!codigo) return;

    const ahora = Date.now();
    const esRepetido =
      codigo === this.ultimoCodigo && ahora - this.ultimaLectura < Escaner.ESPERA_MS;
    if (esRepetido) return;

    this.ultimoCodigo = codigo;
    this.ultimaLectura = ahora;
    console.log('QR leído:', codigo);
    this.codigoLeido.emit(codigo);
  }

  private traducirError(err: unknown): EstadoEscaner {
    const nombre = err instanceof DOMException ? err.name : String(err);
    if (nombre === 'NotAllowedError') return 'sin-permiso';
    if (nombre === 'NotFoundError' || nombre.includes('No camera')) return 'sin-camara';
    return 'error';
  }
}
