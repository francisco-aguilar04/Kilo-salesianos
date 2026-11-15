import { Caja } from '../interfaces/caja';
import { Categoria } from '../interfaces/categoria';
import { TipoAviso } from '../../shared/components/aviso/aviso';

export interface AvisoPantalla {
  tipo: TipoAviso;
  titulo: string;
  mensaje: string;
}

/** Qué hacer con un alimento según la caja abierta. Lo usan la cámara y la entrada a mano. */
export type DecisionEntrada =
  { accion: 'abrir' } | { accion: 'sumar'; caja: Caja } | { accion: 'rechazar'; caja: Caja };

export function decidirEntrada(categoria: Categoria, caja: Caja | null): DecisionEntrada {
  if (!caja) return { accion: 'abrir' };
  return categoria.id === caja.categoriaId
    ? { accion: 'sumar', caja }
    : { accion: 'rechazar', caja };
}

/** HU-06 (EX-01): vibra, pausa, vibra. En iPhone no existe la API y no hace nada. */
export function vibrarRechazo(): void {
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

/** HU-06 (EX-01): el mismo aviso rojo en la cámara y a mano. */
export function avisoRechazo(categoria: Categoria, caja: Caja): AvisoPantalla {
  return {
    tipo: 'error',
    titulo: `Este alimento es de ${categoria.nombre}`,
    mensaje: `No va en la caja ${caja.codigo}`,
  };
}
0