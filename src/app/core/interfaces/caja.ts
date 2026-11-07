import { Timestamp } from '@angular/fire/firestore';
import { EstadoCaja } from '../constants/estados-caja';

export interface Caja {

    id: string;
    codigo: string;
    categoriaId: string;
    unidades: number;
    pesoKg: number | null;
    estado: EstadoCaja;
    creadaPor: string;
    asociacionId: string | null;
    fechaApertura: Timestamp;
    fechaCierre: Timestamp | null;

} 