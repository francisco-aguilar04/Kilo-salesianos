export const ESTADOS_CAJA = {

    ABIERTA: 'abierta',
    CERRADA: 'cerrada',

} as const;

export type EstadoCaja = (typeof ESTADOS_CAJA)[keyof typeof ESTADOS_CAJA];