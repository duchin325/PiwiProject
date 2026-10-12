import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TripBatchesService } from './trip-batches.service';
import {
  CreateTripBatchDto,
  TripBatchDirection,
  TripBatchStatus,
} from './dto/create-trip-batch.dto';
import { ConfirmTripBatchDto } from './dto/confirm-trip-batch.dto';

type Params = Record<string, unknown>;
type Result = { recordset?: unknown[]; rowsAffected?: number[] };
type Responder = (sql: string, params: Params) => Result | undefined;

// Pool simulado con transaccion: registra cada consulta y deja que cada test
// decida la respuesta segun el texto del SQL.
const makeDb = (responder: Responder) => {
  const calls: Array<{ sql: string; params: Params }> = [];
  const events: string[] = [];

  const makeRequest = () => {
    const params: Params = {};
    const req = {
      input: (name: string, value: unknown) => {
        params[name] = value;
        return req;
      },
      query: (sql: string) => {
        calls.push({ sql, params: { ...params } });
        const custom = responder(sql, params);
        return Promise.resolve({
          recordset: [],
          rowsAffected: [1],
          ...custom,
        });
      },
    };
    return req;
  };

  const tx = {
    begin: () => {
      events.push('begin');
      return Promise.resolve();
    },
    commit: () => {
      events.push('commit');
      return Promise.resolve();
    },
    rollback: () => {
      events.push('rollback');
      return Promise.resolve();
    },
    request: makeRequest,
  };

  const pool = { request: makeRequest, transaction: () => tx };
  return { pool, calls, events };
};

const findCalls = <T extends { sql: string }>(calls: T[], fragment: string) =>
  calls.filter((c) => c.sql.includes(fragment));

const stop = (orderId: number, extra: Record<string, unknown> = {}) => ({
  orderId,
  sequence: 1,
  stopType: 'delivery' as const,
  city: 'Rafaela',
  address: 'Calle 1',
  cashOnDelivery: false,
  cashAmount: 0,
  ...extra,
});

const confirmDto = (
  overrides: Partial<ConfirmTripBatchDto> = {},
): ConfirmTripBatchDto => ({
  tripDate: '2026-11-01',
  routeName: 'Ceres - Santa Fe',
  direction: TripBatchDirection.IDA,
  originCity: 'Ceres',
  finalDestinationCity: 'Santa Fe',
  driverId: 7,
  groups: [
    {
      city: 'Rafaela',
      routeOrder: 1,
      stops: [stop(10), stop(11, { contactName: ' Ana ' })],
    },
    {
      city: 'Esperanza',
      routeOrder: 2,
      stops: [stop(12, { city: 'Esperanza' })],
    },
  ],
  ...overrides,
});

describe('TripBatchesService.confirm', () => {
  const happyResponder: Responder = (sql) => {
    if (sql.includes('FROM dbo.Drivers')) return { recordset: [{ id: 7 }] };
    if (sql.includes('WITH (UPDLOCK, ROWLOCK)')) {
      return {
        recordset: [10, 11, 12].map((id) => ({
          id,
          status: 'pendiente',
          hasActiveTrip: 0,
        })),
      };
    }
    if (sql.includes('INSERT INTO TripBatches')) {
      return { recordset: [{ id: 100 }] };
    }
    if (sql.includes('INSERT INTO Trips')) {
      const n = tripCounter++;
      return { recordset: [{ id: 200 + n }] };
    }
    if (sql.includes("SET status = N'asignada'") || sql.includes('asignada')) {
      return { rowsAffected: [3] };
    }
    return undefined;
  };
  let tripCounter = 0;
  beforeEach(() => {
    tripCounter = 0;
  });

  it('camino feliz: crea salida, hojas, paradas, vínculos y asigna las órdenes', async () => {
    const { pool, calls, events } = makeDb(happyResponder);
    const service = new TripBatchesService(pool as never);

    const result = await service.confirm(confirmDto());

    expect(events).toEqual(['begin', 'commit']);
    expect(result).toEqual({
      id: 100,
      tripDate: '2026-11-01',
      routeName: 'Ceres - Santa Fe',
      direction: 'ida',
      originCity: 'Ceres',
      finalDestinationCity: 'Santa Fe',
      status: 'confirmed',
      driverId: 7,
      groupsCreated: 2,
      ordersAssigned: 3,
      trips: [
        {
          id: 200,
          batchId: 100,
          sheetCity: 'Rafaela',
          routeOrder: 1,
          stopsCreated: 2,
        },
        {
          id: 201,
          batchId: 100,
          sheetCity: 'Esperanza',
          routeOrder: 2,
          stopsCreated: 1,
        },
      ],
    });

    const batchInsert = findCalls(calls, 'INSERT INTO TripBatches')[0];
    expect(batchInsert.params.status).toBe('confirmed');

    const tripInserts = findCalls(calls, 'INSERT INTO Trips');
    expect(tripInserts.map((c) => c.params.status)).toEqual([
      'scheduled',
      'scheduled',
    ]);
    expect(tripInserts.map((c) => c.params.routeOrder)).toEqual([1, 2]);
    // ida: sale del origen de la salida hacia la ciudad de la hoja
    expect(tripInserts[0].params.origin).toBe('Ceres');
    expect(tripInserts[0].params.destination).toBe('Rafaela');

    const stops = findCalls(calls, 'INSERT INTO TripStops');
    expect(stops).toHaveLength(3);
    expect(stops.map((c) => c.params.sequence)).toEqual([1, 2, 1]);
    expect(stops.map((c) => c.params.name)).toEqual([
      'Encomienda #10',
      'Ana',
      'Encomienda #12',
    ]);

    expect(findCalls(calls, 'INSERT INTO Order_Trip')).toHaveLength(3);
    expect(findCalls(calls, "SET status = N'asignada'")).toHaveLength(1);
  });

  it('vuelta: la hoja sale de la ciudad y va al destino final', async () => {
    const { pool, calls } = makeDb(happyResponder);
    const service = new TripBatchesService(pool as never);

    await service.confirm(
      confirmDto({
        direction: TripBatchDirection.VUELTA,
        originCity: 'Santa Fe',
        finalDestinationCity: 'Ceres',
      }),
    );

    const first = findCalls(calls, 'INSERT INTO Trips')[0];
    expect(first.params.origin).toBe('Rafaela');
    expect(first.params.destination).toBe('Ceres');
  });

  it('409 con los ids afectados si una orden ya no está pendiente; hace rollback', async () => {
    const { pool, calls, events } = makeDb((sql, p) => {
      if (sql.includes('FROM dbo.Drivers')) return { recordset: [{ id: 7 }] };
      if (sql.includes('WITH (UPDLOCK, ROWLOCK)')) {
        return {
          recordset: [
            { id: 10, status: 'pendiente', hasActiveTrip: 0 },
            { id: 11, status: 'asignada', hasActiveTrip: 0 },
            { id: 12, status: 'pendiente', hasActiveTrip: 1 },
          ],
        };
      }
      return happyResponder(sql, p);
    });
    const service = new TripBatchesService(pool as never);

    const error = await service.confirm(confirmDto()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      statusCode: 409,
      orderIds: [11, 12],
    });
    expect(
      typeof ((error as ConflictException).getResponse() as { message: string })
        .message,
    ).toBe('string');
    expect(events).toEqual(['begin', 'rollback']);
    expect(findCalls(calls, 'INSERT INTO')).toHaveLength(0);
  });

  it('rollback ante un error intermedio (falla el INSERT de paradas)', async () => {
    const { pool, events } = makeDb((sql, p) => {
      if (sql.includes('INSERT INTO TripStops')) {
        throw new Error('boom');
      }
      return happyResponder(sql, p);
    });
    const service = new TripBatchesService(pool as never);

    await expect(service.confirm(confirmDto())).rejects.toThrow('boom');
    expect(events).toEqual(['begin', 'rollback']);
  });

  it('un índice único violado (2601) se informa como 409 y hace rollback', async () => {
    const { pool, events } = makeDb((sql, p) => {
      if (sql.includes('INSERT INTO Trips')) {
        throw Object.assign(new Error('dup'), { number: 2601 });
      }
      return happyResponder(sql, p);
    });
    const service = new TripBatchesService(pool as never);

    await expect(service.confirm(confirmDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(events).toEqual(['begin', 'rollback']);
  });

  it('400 si el conductor no existe', async () => {
    const { pool, events } = makeDb((sql, p) =>
      sql.includes('FROM dbo.Drivers')
        ? { recordset: [] }
        : happyResponder(sql, p),
    );
    const service = new TripBatchesService(pool as never);

    await expect(service.confirm(confirmDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(events).toEqual(['begin', 'rollback']);
  });

  it('400 si hay órdenes repetidas, sin abrir transacción', async () => {
    const { pool, events } = makeDb(happyResponder);
    const service = new TripBatchesService(pool as never);
    const dto = confirmDto({
      groups: [
        { city: 'Rafaela', routeOrder: 1, stops: [stop(10)] },
        { city: 'Esperanza', routeOrder: 2, stops: [stop(10)] },
      ],
    });

    await expect(service.confirm(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(events).toEqual([]);
  });

  it('400 si hay dos grupos de la misma ciudad (ignora acentos y mayúsculas)', async () => {
    const { pool, events } = makeDb(happyResponder);
    const service = new TripBatchesService(pool as never);
    const dto = confirmDto({
      groups: [
        { city: 'Santa Fe', routeOrder: 1, stops: [stop(10)] },
        { city: ' SANTA FÉ ', routeOrder: 2, stops: [stop(11)] },
      ],
    });

    await expect(service.confirm(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(events).toEqual([]);
  });

  it('el DTO rechaza grupos sin paradas y salidas sin grupos', async () => {
    const emptyGroup = plainToInstance(ConfirmTripBatchDto, {
      ...confirmDto(),
      groups: [{ city: 'Rafaela', routeOrder: 1, stops: [] }],
    });
    expect((await validate(emptyGroup)).length).toBeGreaterThan(0);

    const noGroups = plainToInstance(ConfirmTripBatchDto, {
      ...confirmDto(),
      groups: [],
    });
    expect((await validate(noGroups)).length).toBeGreaterThan(0);

    const valid = plainToInstance(ConfirmTripBatchDto, confirmDto());
    expect(await validate(valid)).toHaveLength(0);
  });
});

describe('TripBatchesService.updateStatus', () => {
  const build = (currentStatus: string | null) => {
    const db = makeDb((sql) => {
      if (sql.includes('SELECT status FROM TripBatches')) {
        return {
          recordset: currentStatus ? [{ status: currentStatus }] : [],
        };
      }
      if (sql.includes('FROM TripBatches') && sql.includes('WHERE id = @id')) {
        return { recordset: [{ id: 5, status: 'whatever' }] };
      }
      return undefined;
    });
    return { ...db, service: new TripBatchesService(db.pool as never) };
  };

  const batchStatusWrite = (calls: Array<{ sql: string; params: Params }>) =>
    findCalls(calls, 'UPDATE TripBatches SET status')[0];

  it.each([
    ['draft', 'confirmed'],
    ['confirmed', 'in_transit'],
    ['in_transit', 'completed'],
    ['draft', 'canceled'],
    ['confirmed', 'canceled'],
    ['in_transit', 'canceled'],
  ])('permite %s → %s', async (from, to) => {
    const { service, calls, events } = build(from);

    await service.updateStatus(5, to as TripBatchStatus);

    expect(events).toEqual(['begin', 'commit']);
    expect(batchStatusWrite(calls).params.status).toBe(to);
  });

  it.each([
    ['draft', 'in_transit'],
    ['draft', 'completed'],
    ['draft', 'draft'],
    ['confirmed', 'completed'],
    ['confirmed', 'draft'],
    ['in_transit', 'confirmed'],
    ['completed', 'canceled'],
    ['completed', 'in_transit'],
    ['canceled', 'confirmed'],
    ['canceled', 'canceled'],
  ])('rechaza %s → %s con 400 y no escribe nada', async (from, to) => {
    const { service, calls, events } = build(from);

    const error = await service
      .updateStatus(5, to as TripBatchStatus)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toContain('No se puede pasar la salida');
    expect(events).toEqual(['begin', 'rollback']);
    expect(findCalls(calls, 'UPDATE')).toHaveLength(0);
  });

  it('404 si la salida no existe', async () => {
    const { service, events } = build(null);

    await expect(
      service.updateStatus(5, TripBatchStatus.CONFIRMED),
    ).rejects.toThrow('no se encuentra');
    expect(events).toEqual(['begin', 'rollback']);
  });

  it('iniciar: hojas scheduled → in_transit y órdenes asignada → en tránsito', async () => {
    const { service, calls } = build('confirmed');
    await service.updateStatus(5, TripBatchStatus.IN_TRANSIT);

    expect(findCalls(calls, "SET status = 'in_transit'")).toHaveLength(1);
    const orders = findCalls(calls, 'UPDATE o SET')[0].sql;
    expect(orders).toContain("SET status = N'en tránsito'");
    expect(orders).toContain("IN (N'asignada')");
  });

  it('completar: hojas → delivered y las órdenes en tránsito → entregado', async () => {
    const { service, calls } = build('in_transit');
    await service.updateStatus(5, TripBatchStatus.COMPLETED);

    expect(findCalls(calls, "SET status = 'delivered'")).toHaveLength(1);
    const orders = findCalls(calls, 'UPDATE o SET')[0].sql;
    expect(orders).toContain("SET status = N'entregado'");
    expect(orders).toContain("IN (N'en tránsito')");
  });

  it('cancelar: hojas → canceled y las órdenes no entregadas vuelven a pendiente, sin borrar vínculos ni paradas', async () => {
    const { service, calls } = build('in_transit');
    await service.updateStatus(5, TripBatchStatus.CANCELED);

    expect(findCalls(calls, "SET status = 'canceled'")).toHaveLength(1);
    const orders = findCalls(calls, 'UPDATE o SET')[0].sql;
    expect(orders).toContain("SET status = N'pendiente'");
    expect(orders).toContain("IN (N'asignada', N'en tránsito')");
    expect(orders).not.toContain('entregado');
    expect(findCalls(calls, 'DELETE')).toHaveLength(0);
  });
});

describe('TripBatchesService.create — siempre nace en draft', () => {
  it('ignora un status recibido y guarda draft', async () => {
    const { pool, calls } = makeDb((sql) => {
      if (sql.includes('FROM dbo.Drivers')) return { recordset: [{ id: 7 }] };
      if (sql.includes('INSERT INTO TripBatches')) {
        return { recordset: [{ id: 55 }] };
      }
      return undefined;
    });
    const service = new TripBatchesService(pool as never);

    await service.create({
      tripDate: '2026-11-01',
      originCity: 'Ceres',
      finalDestinationCity: 'Santa Fe',
      direction: TripBatchDirection.IDA,
      driverId: 7,
      // un cliente viejo podria mandarlo; no debe tener efecto
      status: 'in_transit',
    } as never);

    const insert = findCalls(calls, 'INSERT INTO TripBatches')[0];
    expect(insert.params.status).toBe('draft');
  });

  it('el DTO de alta descarta el status', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const out = (await pipe.transform(
      {
        tripDate: '2026-11-01',
        originCity: 'Ceres',
        finalDestinationCity: 'Santa Fe',
        direction: 'ida',
        driverId: 7,
        status: 'completed',
      },
      { type: 'body', metatype: CreateTripBatchDto },
    )) as Record<string, unknown>;

    expect(out).not.toHaveProperty('status');
  });
});
