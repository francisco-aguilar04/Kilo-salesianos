import { inject, Service } from '@angular/core';
import { Categoria } from '../interfaces/categoria';
import { Observable } from 'rxjs';
import {
  collection,
  collectionData,
  Firestore,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';

@Service()
export class CategoriasService {
  private readonly firestore = inject(Firestore);

  //Consultas para obtener los atributos del firestore
  obtenerTodas(): Observable<Categoria[]> {
    //Esto es al descripcion de lo que voy a pedir a la firestore
    const consulta = query(collection(this.firestore, 'categorias'), orderBy('nombre'));
    //Esto lo recoge de la firestore y le dice que lo trate como un observable y cuando alguien se subscribe a el es cuando comienza a traer los datos
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }

  obtenerActivas(): Observable<Categoria[]> {
    const consulta = query(collection(this.firestore, 'categorias'), where('activa', '==', true));
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }
}
