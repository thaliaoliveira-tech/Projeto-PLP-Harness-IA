import { EventEmitter } from 'node:events';
import { EventEmitter2 } from '@nestjs/event-emitter';
export const alvo = new EventTarget();
export const usar = [EventEmitter, EventEmitter2];
