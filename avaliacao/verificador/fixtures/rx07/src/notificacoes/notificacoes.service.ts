import type { Observable } from 'rxjs';
import { EVENTOS } from '../leiloes/eventos.js';
export class NotificacoesService { constructor(readonly e: Observable<unknown> = EVENTOS) {} }
