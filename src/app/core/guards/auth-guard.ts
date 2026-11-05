import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { Auth } from '../services/auth';

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