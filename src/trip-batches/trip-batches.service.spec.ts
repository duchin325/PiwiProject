import { TripBatchesService } from './trip-batches.service';
import { TripBatchDirection } from './dto/create-trip-batch.dto';
import { CandidateOrderRow } from './interfaces/trip-batch-suggestion.interface';
import { RouteCity } from './interfaces/route-city.interface';

const routeCity = (
  id: number,
  cityName: string,
  sequence: number,
): RouteCity => ({
  id,
  routeName: 'Ceres - Santa Fe',
  cityName,
  sequence,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const ROUTE_CITIES = [
  routeCity(1, 'Ceres', 1),
  routeCity(2, 'Rafaela', 2),
  routeCity(3, 'Esperanza', 3),
  routeCity(4, 'Santa Fe', 4),
];

const order = (
  id: number,
  overrides: Partial<CandidateOrderRow> = {},
): CandidateOrderRow => ({
  id,
  origin: '',
  destination: '',
  originCity: null,
  destinationCity: null,
  originAddress: null,
  destinationAddress: null,
  senderName: null,
  senderPhone: null,
  recipientName: null,
  recipientPhone: null,
  amountToCollect: null,
  notes: null,
  createdAt: `2026-01-0${id}T10:00:00.000Z`,
  ...overrides,
});

describe('TripBatchesService.generateSuggestion', () => {
  let candidateSql = '';

  const build = (
    orders: CandidateOrderRow[],
    routeCities: RouteCity[] = ROUTE_CITIES,
  ) => {
    const req = {
      input: () => req,
      query: (sql: string) => {
        if (sql.includes('dbo.Drivers')) {
          return Promise.resolve({ recordset: [{ id: 1 }] });
        }
        if (sql.includes('RouteCities')) {
          return Promise.resolve({ recordset: routeCities });
        }
        candidateSql = sql;
        return Promise.resolve({ recordset: orders });
      },
    };
    const pool = { request: () => req };
    return new TripBatchesService(pool as never);
  };

  const run = (
    orders: CandidateOrderRow[],
    direction: TripBatchDirection,
    extra: { maxStopsPerCity?: number } = {},
    routeCities?: RouteCity[],
  ) =>
    build(orders, routeCities).generateSuggestion({
      tripDate: '2026-02-01',
      direction,
      driverId: 1,
      ...extra,
    });

  type Suggestion = Awaited<ReturnType<typeof run>>;
  const cityOf = (s: Suggestion, city: string) =>
    s.groups.find((g) => g.city === city);

  it('1. ida: destination "Rafaela, Santa Fe" sin destinationCity se agrupa en Rafaela', async () => {
    const s = await run(
      [order(1, { destination: 'Rafaela, Santa Fe' })],
      TripBatchDirection.IDA,
    );
    expect(s.groups.map((g) => g.city)).toEqual(['Rafaela']);
    expect(cityOf(s, 'Rafaela')?.stops[0].orderId).toBe(1);
  });

  it('2. vuelta: origin "Rafaela, Santa Fe" sin originCity se agrupa en Rafaela', async () => {
    const s = await run(
      [order(1, { origin: 'Rafaela, Santa Fe' })],
      TripBatchDirection.VUELTA,
    );
    expect(s.groups.map((g) => g.city)).toEqual(['Rafaela']);
    expect(cityOf(s, 'Rafaela')?.stops[0].stopType).toBe('pickup');
  });

  it('3. vuelta: origin "Santa Fe" se descarta por ser el origen del viaje', async () => {
    const s = await run(
      [order(1, { origin: 'Santa Fe' })],
      TripBatchDirection.VUELTA,
    );
    expect(s.groups).toEqual([]);
    expect(s.skippedOrders).toEqual([{ orderId: 1, reason: 'is_origin_city' }]);
  });

  it('4. ida: destination "Ceres, Santa Fe" se descarta por ser el origen del viaje', async () => {
    const s = await run(
      [order(1, { destination: 'Ceres, Santa Fe' })],
      TripBatchDirection.IDA,
    );
    expect(s.groups).toEqual([]);
    expect(s.skippedOrders).toEqual([{ orderId: 1, reason: 'is_origin_city' }]);
  });

  it('5. destinationCity "  ESPERANZA " identifica Esperanza', async () => {
    const s = await run(
      [order(1, { destinationCity: '  ESPERANZA ' })],
      TripBatchDirection.IDA,
    );
    expect(s.groups.map((g) => g.city)).toEqual(['Esperanza']);
  });

  it('6. "Santa Fé" y "Santa Fe" son equivalentes', async () => {
    const s = await run(
      [order(1, { destinationCity: 'Santa Fé' })],
      TripBatchDirection.IDA,
    );
    expect(s.groups.map((g) => g.city)).toEqual(['Santa Fe']);

    const accentedRoute = await run(
      [order(2, { destinationCity: 'Santa Fe' })],
      TripBatchDirection.IDA,
      {},
      [routeCity(1, 'Ceres', 1), routeCity(4, 'Santa Fé', 4)],
    );
    expect(accentedRoute.groups.map((g) => g.city)).toEqual(['Santa Fé']);
  });

  it('7. ciudad fuera de la ruta no se asigna a otra ciudad', async () => {
    const s = await run(
      [
        order(1, { destination: 'Rosario, Santa Fe' }),
        order(2, { destinationCity: 'Rosario' }),
      ],
      TripBatchDirection.IDA,
    );
    expect(s.groups).toEqual([]);
    expect(s.skippedOrders).toEqual([
      { orderId: 1, reason: 'city_not_in_route' },
      { orderId: 2, reason: 'city_not_in_route' },
    ]);
  });

  it('7b. "Rafaela, Santa Fe" con Rafaela fuera de la ruta no cae en Santa Fe', async () => {
    const s = await run(
      [order(1, { destination: 'Rafaela, Santa Fe' })],
      TripBatchDirection.IDA,
      {},
      [routeCity(1, 'Ceres', 1), routeCity(4, 'Santa Fe', 4)],
    );
    expect(s.groups).toEqual([]);
    expect(s.skippedOrders).toEqual([
      { orderId: 1, reason: 'city_not_in_route' },
    ]);
  });

  it('8. ciudad vacía usa el campo alternativo; sin ninguno queda sin resolver', async () => {
    const s = await run(
      [
        order(1, {
          destinationCity: '   ',
          destination: 'Esperanza, Santa Fe',
        }),
        order(2, { destinationCity: '', destination: ' ' }),
      ],
      TripBatchDirection.IDA,
    );
    expect(s.groups.map((g) => g.city)).toEqual(['Esperanza']);
    expect(s.skippedOrders).toEqual([
      { orderId: 2, reason: 'city_not_resolved' },
    ]);
  });

  it('una coincidencia parcial ambigua se descarta', async () => {
    const s = await run(
      [order(1, { destinationCity: 'Rafaela Esperanza' })],
      TripBatchDirection.IDA,
    );
    expect(s.groups).toEqual([]);
    expect(s.skippedOrders).toEqual([{ orderId: 1, reason: 'ambiguous_city' }]);
  });

  // La elegibilidad vive en SQL; con un pool simulado solo se puede verificar
  // el texto de la consulta, no su ejecución contra SQL Server.
  describe('elegibilidad (texto de la consulta de candidatas)', () => {
    beforeEach(async () => {
      await run([], TripBatchDirection.IDA);
    });

    it('9. solo estado pendiente', () => {
      expect(candidateSql).toContain("o.status = 'pendiente'");
    });

    it('10. excluye encomiendas vinculadas a viajes activos vía Order_Trip', () => {
      expect(candidateSql).toMatch(
        /NOT EXISTS[\s\S]*Order_Trip[\s\S]*ot\.orderId = o\.id/,
      );
    });

    it('11. solo los viajes cancelados dejan de bloquear (comportamiento actual)', () => {
      expect(candidateSql).toContain("t.status <> 'canceled'");
    });
  });

  it('12. varias encomiendas de distintas ciudades, sin duplicarse', async () => {
    const s = await run(
      [
        order(1, { destinationCity: 'Santa Fe' }),
        order(2, { destination: 'Rafaela, Santa Fe' }),
        order(3, { destinationCity: 'esperanza' }),
        order(4, { destination: 'Rafaela' }),
        order(5, { destinationCity: 'Santa Fé' }),
      ],
      TripBatchDirection.IDA,
    );
    expect(s.groups.map((g) => g.city)).toEqual([
      'Rafaela',
      'Esperanza',
      'Santa Fe',
    ]);
    expect(cityOf(s, 'Rafaela')?.stops.map((x) => x.orderId)).toEqual([2, 4]);
    expect(cityOf(s, 'Esperanza')?.stops.map((x) => x.orderId)).toEqual([3]);
    expect(cityOf(s, 'Santa Fe')?.stops.map((x) => x.orderId)).toEqual([1, 5]);
    const all = s.groups.flatMap((g) => g.stops.map((x) => x.orderId));
    expect(new Set(all).size).toBe(all.length);
    expect(s.skippedOrders).toEqual([]);
  });

  it('respeta maxStopsPerCity', async () => {
    const s = await run(
      [
        order(1, { destinationCity: 'Rafaela' }),
        order(2, { destinationCity: 'Rafaela' }),
        order(3, { destinationCity: 'Rafaela' }),
      ],
      TripBatchDirection.IDA,
      { maxStopsPerCity: 2 },
    );
    expect(cityOf(s, 'Rafaela')?.stops.map((x) => x.orderId)).toEqual([1, 2]);
  });
});
