import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})

export class LoginComponent {

  private readonly fb = inject(FormBuilder); //para montar el form
  private readonly authService = inject(Auth);
  private readonly router = inject(Router); //para redirigir

  readonly loading = signal(false);
  readonly error = signal<string | null>(null); //para mensaje de error

  readonly form = this.fb.nonNullable.group({ //crea un grupo de formulario

    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],

  });

  async submit(): Promise<void> {

    if (this.form.invalid) {

      this.form.markAllAsTouched();// esto es para que se muestren los errores donde no sea valido
      return;

    }

    this.loading.set(true);
    this.error.set(null);

    try {

      const { email, password } = this.form.getRawValue();

      await this.authService.login(email, password);
      await this.router.navigateByUrl('/');

    } catch {

      this.error.set('Email o contraseña incorrectos');

    } finally {

      this.loading.set(false);

    }
  }
}