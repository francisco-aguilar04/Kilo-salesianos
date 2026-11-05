import { Service, inject, Injector, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
    Auth as FirebaseAuth,
    signInWithEmailAndPassword,
    signOut,
    user,
} from '@angular/fire/auth';

@Service()
export class Auth {

    private readonly injector: Injector = inject(Injector); //se usa para las inyecciones en funciones asincronas
    private readonly firebaseAuth: FirebaseAuth = inject(FirebaseAuth);

    // null = sin sesión (o aún cargando)
    readonly user$ = user(this.firebaseAuth); //guarda el estado user incluso al salir y entrar
    readonly user = toSignal(this.user$, { initialValue: null });

    //recibe un correo y contraseña y firebase usa su authenticador para ver que pueda inicar sesion
    async login(email: string, password: string): Promise<void> {
        await runInInjectionContext(this.injector, () =>
            signInWithEmailAndPassword(this.firebaseAuth, email, password),
        );
    }

    async logout(): Promise<void> {
        await runInInjectionContext(this.injector, () => signOut(this.firebaseAuth));
    }

}
