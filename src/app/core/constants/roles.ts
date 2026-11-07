export const ROLES = {
    VOLUNTARIO: 'voluntario',
    COORDINADOR: 'coordinador',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];