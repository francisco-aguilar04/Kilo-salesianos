export class QrInvalidoError extends Error {
  constructor(
    readonly codigo: string,
    readonly motivo: 'no-existe' | 'inactiva',
  ) {
      //El constructor por el que se lapasa el mensaje como en Java! 
    super('QR no válido, avisa al coordinador');
    this.name = 'QrInvalidoError';
  }
}
