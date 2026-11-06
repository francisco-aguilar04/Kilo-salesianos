import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { Auth } from '../services/auth';
import { Rol } from '../constants/roles';

// Sin sesión -> al login
export const authGuard: CanActivateFn = () => {

  const auth = inject(Auth);
  const router = inject(Router);

  /*
    Al devolver el map hay tres opciones:
    true -> redirige al sitio solicitado
    false -> no redirige a nada
    createUrlTree -> te lleva a donde dice

  */

  return auth.user$.pipe(

    take(1),
    map((u) => (u ? true : router.createUrlTree(['/login']))),
    // si hay usuario devuelve true, si no te lleva a /login

  );
};

// Con sesión -> fuera del login
export const guestGuard: CanActivateFn = () => {

  const auth = inject(Auth);
  const router = inject(Router);

  return auth.user$.pipe(

    take(1),
    map((u) => (u ? router.createUrlTree(['/']) : true)),
    //si hay usuario te lleva a / , si no devuelve true y te deja ver el login
  );
};

// Solo entra quien tenga el rol indicado -> el resto, al inicio
export const roleGuard = (rolRequerido: Rol): CanActivateFn => () => {

  const auth = inject(Auth);
  const router = inject(Router);

  // rol$ espera a que Firestore devuelva el rol, así que al refrescar en una ruta protegida no rebota
  return auth.rol$.pipe(

    take(1),
    map((rol) => (rol === rolRequerido ? true : router.createUrlTree(['/']))),
    // si el rol coincide pasa, si no (o no hay rol) te lleva a /

  );
};