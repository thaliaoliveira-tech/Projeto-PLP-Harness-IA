import { Observable, scan } from 'rxjs';
export const impuro = (a$: Observable<number>) => a$.pipe(scan((acc: number[], v) => { acc.push(v); return acc; }, []));
export const impuro2 = (a$: Observable<number>) => a$.pipe(scan((acc: { t: number }, v) => { acc.t += v; return acc; }, { t: 0 }));
export const puro = (a$: Observable<number>) => a$.pipe(scan((acc: number[], v) => [...acc, v], []));
