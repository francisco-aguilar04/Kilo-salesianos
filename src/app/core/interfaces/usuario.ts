import { Rol } from '../constants/roles';

export interface Usuario {

    uid: string;
    nombre: string;
    email: string;
    rol: Rol;

}