import { Observable, of } from 'rxjs';
of(1).subscribe();
export class B {
  constructor(private readonly a$: Observable<number>) { this.a$.subscribe(); }
  porRequisicao(): void { this.a$.subscribe(); }
}
