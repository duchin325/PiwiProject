import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { OrderTripController } from './order-trip.controller';
import { OrderTripService } from './order-trip.service';

const handlers = (proto: object) =>
  Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({
      name,
      method: Reflect.getMetadata(
        'method',
        (proto as Record<string, unknown>)[name] as object,
      ) as RequestMethod | undefined,
    }));

describe('order-trip es de solo lectura', () => {
  it('el controlador solo expone GET', () => {
    const routes = handlers(OrderTripController.prototype);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.method === RequestMethod.GET)).toBe(true);
    expect(routes.map((r) => r.name).sort()).toEqual([
      'getAll',
      'getOneByOrder',
      'getOneByTrip',
    ]);
  });

  it('el servicio no tiene create ni remove', () => {
    const methods = Object.getOwnPropertyNames(OrderTripService.prototype);
    expect(methods).not.toContain('create');
    expect(methods).not.toContain('remove');
  });
});
