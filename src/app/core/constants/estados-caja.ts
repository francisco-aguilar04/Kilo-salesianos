export const ESTADOS_CAJA = {

    ABIERTA: 'abierta',
    CERRADA: 'cerrada',
    ASIGNADA: 'asignada',

} as const;

export type EstadoCaja = (typeof ESTADOS_CAJA)[keyof typeof ESTADOS_CAJA];