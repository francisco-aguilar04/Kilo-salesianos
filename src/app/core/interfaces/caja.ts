import { Timestamp } from '@angular/fire/firestore';
import { EstadoCaja } from '../constants/estados-caja';

export interface Caja {
  id: string;
  codigo: string;
  categoriaId: string | null; // A8: null si se borró la categoría
  unidades: number;
  pesoKg: number | null;
  estado: EstadoCaja;
  creadaPor: string | null; // B9: null si se borró el usuario
  asociacionId: string | null;
  fechaApertura: Timestamp;
  fechaCierre: Timestamp | null;
}
