import { NotFoundException } from '@nestjs/common';
import { TripStopsService } from './trip-stops.service';

const build = (
  stop: {
    stopType: string;
    orderId: number | null;
    completed: boolean;
    wasCompleted: boolean;
  } | null,
) => {
  const calls: string[] = [];
  const events: string[] = [];
  const makeRequest = () => {
    const req = {
      input: () => req,
      query: (sql: string) => {
        calls.push(sql);
        if (sql.includes('UPDATE TripStops')) {
          return Promise.resolve(
            stop
              ? { recordset: [stop], rowsAffected: [1] }
              : { recordset: [], rowsAffected: [0] },
          );
        }
        return Promise.resolve({ recordset: [], rowsAffected: [1] });
      },
    };
    return req;
  };
  const tx = {
    begin: () => Promise.resolve(void events.push('begin')),
    commit: () => Promise.resolve(void events.push('commit')),
    rollback: () => Promise.resolve(void events.push('rollback')),
    request: makeRequest,
  };
  const pool = { request: makeRequest, transaction: () => tx };
  return { service: new TripStopsService(pool as never), calls, events };
};

const deliveredOrder = (calls: string[]) =>
  calls.some((c) => c.includes("SET status = N'entregado'"));

describe('TripStopsService.update — completar parada', () => {
  it('delivery con orderId: pasa la orden en tránsito a entregado en la misma transacción', async () => {
    const { service, calls, events } = build({
      stopType: 'delivery',
      orderId: 10,
      completed: true,
      wasCompleted: false,
    });
    await service.update(1, { completed: true });

    expect(deliveredOrder(calls)).toBe(true);
    expect(calls.join('\n')).toContain("status = N'en tránsito'");
    expect(events).toEqual(['begin', 'commit']);
  });

  it.each([
    [
      'pickup con orderId',
      { stopType: 'pickup', orderId: 10, completed: true, wasCompleted: false },
    ],
    [
      'delivery sin orderId',
      {
        stopType: 'delivery',
        orderId: null,
        completed: true,
        wasCompleted: false,
      },
    ],
    [
      'ya estaba completada',
      {
        stopType: 'delivery',
        orderId: 10,
        completed: true,
        wasCompleted: true,
      },
    ],
    [
      'se desmarca',
      {
        stopType: 'delivery',
        orderId: 10,
        completed: false,
        wasCompleted: true,
      },
    ],
  ])('no toca la orden: %s', async (_name, stop) => {
    const { service, calls } = build(stop);
    await service.update(1, { completed: stop.completed });
    expect(deliveredOrder(calls)).toBe(false);
  });

  it('404 y rollback si la parada no existe', async () => {
    const { service, events } = build(null);
    await expect(service.update(1, { completed: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(events).toEqual(['begin', 'rollback']);
  });
});
