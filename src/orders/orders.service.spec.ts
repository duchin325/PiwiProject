import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderStatus } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

const build = (currentStatus: string | null) => {
  const calls: string[] = [];
  const events: string[] = [];
  const params: Array<Record<string, unknown>> = [];
  const makeRequest = () => {
    const own: Record<string, unknown> = {};
    const req = {
      input: (name: string, value: unknown) => {
        own[name] = value;
        return req;
      },
      query: (sql: string) => {
        calls.push(sql);
        params.push({ ...own });
        if (sql.includes('INSERT INTO Orders')) {
          return Promise.resolve({
            recordset: [{ id: 77 }],
            rowsAffected: [1],
          });
        }
        if (sql.includes('SELECT status FROM Orders')) {
          return Promise.resolve({
            recordset: currentStatus ? [{ status: currentStatus }] : [],
          });
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
  return { service: new OrdersService(pool as never), calls, events, params };
};

describe('OrdersService.update — cambio manual de estado', () => {
  it.each([
    ['pendiente', OrderStatus.CANCELADO],
    ['cancelado', OrderStatus.PENDIENTE],
    ['asignada', OrderStatus.ASIGNADA], // sin cambio: permitido
  ])('permite %s → %s', async (from, to) => {
    const { service, calls, events } = build(from);
    await service.update(1, { status: to });
    expect(events).toEqual(['begin', 'commit']);
    expect(calls.some((c) => c.includes('UPDATE Orders'))).toBe(true);
  });

  it.each([
    ['pendiente', OrderStatus.ASIGNADA],
    ['pendiente', OrderStatus.EN_TRANSITO],
    ['pendiente', OrderStatus.ENTREGADO],
    ['asignada', OrderStatus.CANCELADO],
    ['asignada', OrderStatus.PENDIENTE],
    ['en tránsito', OrderStatus.CANCELADO],
    ['entregado', OrderStatus.PENDIENTE],
  ])('rechaza %s → %s con 400', async (from, to) => {
    const { service, calls, events } = build(from);
    await expect(service.update(1, { status: to })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(events).toEqual(['begin', 'rollback']);
    expect(calls.some((c) => c.includes('UPDATE Orders'))).toBe(false);
  });

  it('404 si la orden no existe', async () => {
    const { service } = build(null);
    await expect(
      service.update(1, { status: OrderStatus.CANCELADO }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin status, edita otros campos sin consultar el estado', async () => {
    const { service, calls } = build('asignada');
    await service.update(1, { notes: 'x' });
    expect(calls.some((c) => c.includes('SELECT status'))).toBe(false);
    expect(calls.some((c) => c.includes('UPDATE Orders'))).toBe(true);
  });

  it('body vacío no genera SQL', async () => {
    const { service, calls } = build('pendiente');
    await service.update(1, {});
    expect(calls).toHaveLength(0);
  });
});

const validPayload = {
  clientId: 1,
  origin: 'Ceres, Santa Fe',
  destination: 'Rafaela, Santa Fe',
  weight: 3,
  volume: 1,
};

describe('OrdersService.create — siempre nace pendiente', () => {
  it('guarda pendiente aunque llegue otro status, y persiste los campos nuevos', async () => {
    const { service, calls, params } = build(null);

    const id = await service.create({
      ...validPayload,
      status: 'entregado',
      originCity: 'Ceres',
      destinationCity: 'Rafaela',
      originAddress: 'Calle 1',
      destinationAddress: 'Calle 2',
      senderName: 'Ana',
      senderPhone: '1',
      recipientName: 'Luis',
      recipientPhone: '2',
      amountToCollect: 1500.5,
      notes: 'frágil',
    } as never);

    expect(id).toBe(77);
    const i = calls.findIndex((c) => c.includes('INSERT INTO Orders'));
    expect(calls[i]).toContain('originCity, destinationCity');
    expect(params[i]).toMatchObject({
      status: 'pendiente',
      originCity: 'Ceres',
      destinationCity: 'Rafaela',
      originAddress: 'Calle 1',
      destinationAddress: 'Calle 2',
      senderName: 'Ana',
      senderPhone: '1',
      recipientName: 'Luis',
      recipientPhone: '2',
      amountToCollect: 1500.5,
      notes: 'frágil',
    });
  });

  it('los opcionales ausentes se guardan como NULL', async () => {
    const { service, calls, params } = build(null);
    await service.create(validPayload as never);
    const i = calls.findIndex((c) => c.includes('INSERT INTO Orders'));
    expect(params[i]).toMatchObject({
      status: 'pendiente',
      originCity: null,
      destinationCity: null,
      amountToCollect: null,
    });
  });
});

describe('OrdersService.update — campos nuevos', () => {
  it('persiste originCity/destinationCity en el UPDATE', async () => {
    const { service, calls, params } = build('pendiente');
    await service.update(1, {
      originCity: 'Ceres',
      destinationCity: 'Rafaela',
    });
    const i = calls.findIndex((c) => c.includes('UPDATE Orders'));
    expect(calls[i]).toContain('originCity = @originCity');
    expect(calls[i]).toContain('destinationCity = @destinationCity');
    expect(params[i]).toMatchObject({
      originCity: 'Ceres',
      destinationCity: 'Rafaela',
    });
  });
});

describe('DTOs de órdenes (ValidationPipe real)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const post = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateOrderDto });
  const put = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: UpdateOrderDto });

  it('el alta descarta status', async () => {
    const out = (await post({
      ...validPayload,
      status: 'entregado',
    })) as Record<string, unknown>;
    expect(out).not.toHaveProperty('status');
  });

  it('el alta acepta los campos opcionales nuevos', async () => {
    const out = (await post({
      ...validPayload,
      originCity: 'Ceres',
      destinationCity: 'Rafaela',
      amountToCollect: '10.5',
    })) as Record<string, unknown>;
    expect(out.originCity).toBe('Ceres');
    expect(out.amountToCollect).toBe(10.5);
  });

  it.each([
    ['originCity', 101],
    ['destinationCity', 101],
    ['originAddress', 301],
    ['destinationAddress', 301],
    ['senderName', 151],
    ['senderPhone', 51],
    ['recipientName', 151],
    ['recipientPhone', 51],
    ['notes', 501],
  ])('rechaza %s de más de lo que admite la base', async (field, length) => {
    await expect(
      post({ ...validPayload, [field]: 'x'.repeat(length) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      post({ ...validPayload, [field]: 'x'.repeat(length - 1) }),
    ).resolves.toBeDefined();
  });

  it('rechaza amountToCollect negativo', async () => {
    await expect(
      post({ ...validPayload, amountToCollect: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la edición sí acepta status (lo valida el service) y todo es opcional', async () => {
    const out = (await put({ status: 'cancelado' })) as Record<string, unknown>;
    expect(out.status).toBe('cancelado');
    await expect(put({ status: 'inventado' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(put({})).resolves.toBeDefined();
  });
});
