import { Observable, map } from 'rxjs';
export class A {
  constructor(private readonly a$: Observable<number>, private readonly b$: Observable<number>) {}
  onModuleInit(): void {
    this.a$.subscribe(() => this.b$.subscribe());
    this.a$.pipe(map(() => this.b$.subscribe())).subscribe();
  }
}
