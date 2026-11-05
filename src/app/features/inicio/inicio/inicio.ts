import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-inicio',
  standalone: true,
  templateUrl: './inicio.html',
  styles: `
    .inicio {
      max-width: 24rem;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    button {
      font-size: 1rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
    }
  `,
})
export class InicioComponent {
  readonly authService = inject(Auth);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}