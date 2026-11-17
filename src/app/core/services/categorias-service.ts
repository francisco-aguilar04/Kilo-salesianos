import { inject, Injector, runInInjectionContext, Service } from '@angular/core';
import { Categoria } from '../interfaces/categoria';
import { firstValueFrom, Observable } from 'rxjs';
import {
  addDoc,
  collection,
  collectionData,
  Firestore,
  getDocs,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import { QrInvalidoError } from '../errors/qr-invalid-error';

/** Datos que rellena el admin en el formulario (el id lo pone Firestore) */
export type NuevaCategoria = Omit<Categoria, 'id' | 'activa'>;

/** A6: ya hay otra categoría con ese nombre o con ese código QR */
export class CategoriaDuplicadaError extends Error {
  constructor(readonly campo: 'nombre' | 'codigoQr') {
    super(
      campo === 'nombre'
        ? 'Ya existe una categoría con ese nombre'
        : 'Ese código QR ya lo usa otra categoría',
    );
    this.name = 'CategoriaDuplicadaError';
  }
}

@Service()
export class CategoriasService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  obtenerTodas(): Observable<Categoria[]> {
    const consulta = query(collection(this.firestore, 'categorias'), orderBy('nombre'));
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }

  obtenerActivas(): Observable<Categoria[]> {
    const consulta = query(collection(this.firestore, 'categorias'), where('activa', '==', true));
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }

  async validarCodigo(codigo: string): Promise<Categoria> {
    const consulta = query(
      collection(this.firestore, 'categorias'),
      where('codigoQr', '==', codigo),
    );
    const encontradas = await firstValueFrom(
      collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>,
    );
    const categoria = encontradas[0];

    if (!categoria) throw new QrInvalidoError(codigo, 'no-existe');
    if (!categoria.activa) throw new QrInvalidoError(codigo, 'inactiva');
    return categoria;
  }

  /** A6: crea una categoría nueva (solo admin; las rules lo vuelven a comprobar).
   *  Nombre en minúsculas, código QR en mayúsculas. Nace activa.
   *  Lanza CategoriaDuplicadaError si el nombre o el código ya existen. */
  async crearCategoria(datos: NuevaCategoria): Promise<void> {
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ').toLowerCase();
    const codigoQr = datos.codigoQr.trim().toUpperCase();
    if (!nombre || !codigoQr) throw new Error('Nombre y código son obligatorios');

    return runInInjectionContext(this.injector, async () => {
      const categorias = collection(this.firestore, 'categorias');

      const mismoNombre = await getDocs(query(categorias, where('nombre', '==', nombre)));
      if (!mismoNombre.empty) throw new CategoriaDuplicadaError('nombre');

      const mismoCodigo = await getDocs(query(categorias, where('codigoQr', '==', codigoQr)));
      if (!mismoCodigo.empty) throw new CategoriaDuplicadaError('codigoQr');

      await addDoc(categorias, { nombre, codigoQr, color: datos.color, activa: true });
    });
  }
}
