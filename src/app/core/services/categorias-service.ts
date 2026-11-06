import { inject, Service } from '@angular/core';

@Service()
export class CategoriasService {
  private readonly firestore = inject(Firestore);
}
