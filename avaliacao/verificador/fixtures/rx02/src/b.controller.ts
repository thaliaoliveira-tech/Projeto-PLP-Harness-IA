import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
@Controller('b')
export class BController {
  constructor(private readonly a$: Observable<number>) {}
  @Get() ler(): void { this.a$.subscribe(); }
}
