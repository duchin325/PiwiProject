import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionPool, Transaction } from 'mssql';
import {
  ConfirmTripBatchResponse,
  TripBatch,
  TripBatchTrip,
  TripBatchWithDriver,
} from './interfaces/trip-batch.interface';
import { RouteCity } from './interfaces/route-city.interface';
import {
  CandidateOrderRow,
  SkippedOrder,
  SuggestedGroup,
  SuggestedStop,
  TripBatchSuggestion,
} from './interfaces/trip-batch-suggestion.interface';
import {
  CreateTripBatchDto,
  TripBatchDirection,
  TripBatchStatus,
} from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';
import { CreateRouteCityDto } from './dto/create-route-city.dto';
import { UpdateRouteCityDto } from './dto/update-route-city.dto';
import { TripBatchSuggestionDto } from './dto/trip-batch-suggestion.dto';
import { ConfirmTripBatchDto } from './dto/confirm-trip-batch.dto';

const SQL_ERROR_FK_VIOLATION = 547;
const SQL_ERRORS_UNIQUE_VIOLATION = [2601, 2627];

// Transiciones permitidas del ciclo de vida de una salida.
const BATCH_TRANSITIONS: Record<string, TripBatchStatus[]> = {
  [TripBatchStatus.DRAFT]: [
    TripBatchStatus.CONFIRMED,
    TripBatchStatus.CANCELED,
  ],
  [TripBatchStatus.CONFIRMED]: [
    TripBatchStatus.IN_TRANSIT,
    TripBatchStatus.CANCELED,
  ],
  [TripBatchStatus.IN_TRANSIT]: [
    TripBatchStatus.COMPLETED,
    TripBatchStatus.CANCELED,
  ],
};
const DEFAULT_ROUTE_NAME = 'Ceres - Santa Fe';

@Injectable()
export class TripBatchesService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  private async assertDriverExists(driverId: number): Promise<void> {
    const result = await this.pool
      .request()
      .input('driverId', driverId)
      .query('SELECT id FROM dbo.Drivers WHERE id = @driverId');

    if (result.recordset.length === 0) {
      throw new BadRequestException('El conductor seleccionado no existe');
    }
  }

  async findAll(): Promise<TripBatchWithDriver[]> {
    const result = await this.pool.request().query(`
      SELECT
        tb.id,
        tb.tripDate,
        tb.routeName,
        tb.originCity,
        tb.finalDestinationCity,
        tb.direction,
        tb.status,
        tb.driverId,
        tb.notes,
        tb.createdAt,
        tb.updatedAt,
        d.name AS driverName,
        d.truckPlate AS truckPlate
      FROM TripBatches tb
      LEFT JOIN Drivers d ON d.id = tb.driverId
      ORDER BY tb.tripDate DESC, tb.id DESC
    `);

    return result.recordset;
  }

  async findOne(id: number): Promise<TripBatch | null> {
    const result = await this.pool.request().input('id', id).query(`
        SELECT
          id,
          tripDate,
          routeName,
          originCity,
          finalDestinationCity,
          direction,
          status,
          driverId,
          notes,
          createdAt,
          updatedAt
        FROM TripBatches
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  async create(data: CreateTripBatchDto): Promise<TripBatch> {
    const routeName = data.routeName ?? DEFAULT_ROUTE_NAME;
    const status = TripBatchStatus.DRAFT;
    const notes = data.notes ?? null;

    await this.assertDriverExists(data.driverId);

    try {
      const result = await this.pool
        .request()
        .input('tripDate', data.tripDate.slice(0, 10))
        .input('routeName', routeName)
        .input('originCity', data.originCity)
        .input('finalDestinationCity', data.finalDestinationCity)
        .input('direction', data.direction)
        .input('status', status)
        .input('driverId', data.driverId)
        .input('notes', notes).query(`
          INSERT INTO TripBatches (
            tripDate,
            routeName,
            originCity,
            finalDestinationCity,
            direction,
            status,
            driverId,
            notes,
            createdAt,
            updatedAt
          )
          OUTPUT INSERTED.id
          VALUES (
            @tripDate,
            @routeName,
            @originCity,
            @finalDestinationCity,
            @direction,
            @status,
            @driverId,
            @notes,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `);

      const id = result.recordset[0].id;
      return (await this.findOne(id)) as TripBatch;
    } catch (err) {
      const sqlError = err as { number?: number };
      if (sqlError.number === SQL_ERROR_FK_VIOLATION) {
        throw new BadRequestException('El conductor seleccionado no existe');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateTripBatchDto): Promise<TripBatch> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`La salida con id ${id} no se encuentra`);
    }

    const sets: string[] = [];
    const req = this.pool.request().input('id', id);

    if (dto.tripDate !== undefined) {
      sets.push('tripDate = @tripDate');
      req.input('tripDate', dto.tripDate.slice(0, 10));
    }
    if (dto.routeName !== undefined) {
      sets.push('routeName = @routeName');
      req.input('routeName', dto.routeName);
    }
    if (dto.originCity !== undefined) {
      sets.push('originCity = @originCity');
      req.input('originCity', dto.originCity);
    }
    if (dto.finalDestinationCity !== undefined) {
      sets.push('finalDestinationCity = @finalDestinationCity');
      req.input('finalDestinationCity', dto.finalDestinationCity);
    }
    if (dto.direction !== undefined) {
      sets.push('direction = @direction');
      req.input('direction', dto.direction);
    }
    if (dto.driverId !== undefined) {
      await this.assertDriverExists(dto.driverId);
      sets.push('driverId = @driverId');
      req.input('driverId', dto.driverId);
    }
    if (dto.notes !== undefined) {
      sets.push('notes = @notes');
      req.input('notes', dto.notes);
    }

    if (sets.length === 0) {
      return existing;
    }

    sets.push('updatedAt = SYSUTCDATETIME()');

    try {
      await req.query(
        `UPDATE TripBatches SET ${sets.join(', ')} WHERE id = @id`,
      );
    } catch (err) {
      const sqlError = err as { number?: number };
      if (sqlError.number === SQL_ERROR_FK_VIOLATION) {
        throw new BadRequestException('El conductor seleccionado no existe');
      }
      throw err;
    }

    return (await this.findOne(id)) as TripBatch;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`La salida con id ${id} no se encuentra`);
    }

    const countResult = await this.pool
      .request()
      .input('id', id)
      .query('SELECT COUNT(*) AS count FROM Trips WHERE batchId = @id');

    if (countResult.recordset[0].count > 0) {
      throw new BadRequestException(
        `No se puede eliminar la salida ${id}: tiene planillas (Trips) asociadas`,
      );
    }

    await this.pool
      .request()
      .input('id', id)
      .query('DELETE FROM TripBatches WHERE id = @id');
  }

  async findTrips(id: number): Promise<TripBatchTrip[]> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`La salida con id ${id} no se encuentra`);
    }

    const result = await this.pool.request().input('batchId', id).query(`
        SELECT
          id,
          tripDate,
          batchId,
          routeOrder,
          sheetCity,
          origin,
          destination,
          status,
          notes,
          driverId,
          createdAt
        FROM Trips
        WHERE batchId = @batchId
        ORDER BY routeOrder ASC
      `);

    return result.recordset;
  }

  private async findRouteCityById(id: number): Promise<RouteCity | null> {
    const result = await this.pool.request().input('id', id).query(`
        SELECT id, routeName, cityName, sequence, isActive, createdAt
        FROM dbo.RouteCities
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  }

  private async assertNoDuplicateCityName(
    routeName: string,
    cityName: string,
    excludeId?: number,
  ): Promise<void> {
    const req = this.pool
      .request()
      .input('routeName', routeName)
      .input('cityName', cityName);

    let query = `
      SELECT COUNT(*) AS count FROM dbo.RouteCities
      WHERE routeName = @routeName AND cityName = @cityName AND isActive = 1
    `;

    if (excludeId !== undefined) {
      req.input('excludeId', excludeId);
      query += ' AND id <> @excludeId';
    }

    const result = await req.query(query);
    if (result.recordset[0].count > 0) {
      throw new BadRequestException(
        `La ciudad "${cityName}" ya existe en la ruta "${routeName}"`,
      );
    }
  }

  private async assertNoDuplicateSequence(
    routeName: string,
    sequence: number,
    excludeId?: number,
  ): Promise<void> {
    const req = this.pool
      .request()
      .input('routeName', routeName)
      .input('sequence', sequence);

    let query = `
      SELECT COUNT(*) AS count FROM dbo.RouteCities
      WHERE routeName = @routeName AND sequence = @sequence AND isActive = 1
    `;

    if (excludeId !== undefined) {
      req.input('excludeId', excludeId);
      query += ' AND id <> @excludeId';
    }

    const result = await req.query(query);
    if (result.recordset[0].count > 0) {
      throw new BadRequestException(
        `El orden ${sequence} ya está en uso en la ruta "${routeName}"`,
      );
    }
  }

  async findRouteCities(routeName?: string): Promise<RouteCity[]> {
    const effectiveRouteName = routeName ?? DEFAULT_ROUTE_NAME;

    const result = await this.pool
      .request()
      .input('routeName', effectiveRouteName).query(`
        SELECT id, routeName, cityName, sequence, isActive, createdAt
        FROM dbo.RouteCities
        WHERE routeName = @routeName AND isActive = 1
        ORDER BY sequence ASC
      `);

    return result.recordset;
  }

  async createRouteCity(dto: CreateRouteCityDto): Promise<RouteCity> {
    const routeName = dto.routeName ?? DEFAULT_ROUTE_NAME;

    await this.assertNoDuplicateCityName(routeName, dto.cityName);
    await this.assertNoDuplicateSequence(routeName, dto.sequence);

    const result = await this.pool
      .request()
      .input('routeName', routeName)
      .input('cityName', dto.cityName)
      .input('sequence', dto.sequence).query(`
        INSERT INTO dbo.RouteCities (routeName, cityName, sequence, isActive, createdAt)
        OUTPUT INSERTED.id
        VALUES (@routeName, @cityName, @sequence, 1, SYSUTCDATETIME())
      `);

    const id = result.recordset[0].id;
    return (await this.findRouteCityById(id)) as RouteCity;
  }

  async updateRouteCity(
    id: number,
    dto: UpdateRouteCityDto,
  ): Promise<RouteCity> {
    const existing = await this.findRouteCityById(id);
    if (!existing) {
      throw new NotFoundException(
        `La ciudad de ruta con id ${id} no se encuentra`,
      );
    }

    const nextRouteName = dto.routeName ?? existing.routeName;
    const nextCityName = dto.cityName ?? existing.cityName;
    const nextSequence = dto.sequence ?? existing.sequence;

    if (dto.routeName !== undefined || dto.cityName !== undefined) {
      await this.assertNoDuplicateCityName(nextRouteName, nextCityName, id);
    }
    if (dto.routeName !== undefined || dto.sequence !== undefined) {
      await this.assertNoDuplicateSequence(nextRouteName, nextSequence, id);
    }

    const sets: string[] = [];
    const req = this.pool.request().input('id', id);

    if (dto.routeName !== undefined) {
      sets.push('routeName = @routeName');
      req.input('routeName', dto.routeName);
    }
    if (dto.cityName !== undefined) {
      sets.push('cityName = @cityName');
      req.input('cityName', dto.cityName);
    }
    if (dto.sequence !== undefined) {
      sets.push('sequence = @sequence');
      req.input('sequence', dto.sequence);
    }
    if (dto.isActive !== undefined) {
      sets.push('isActive = @isActive');
      req.input('isActive', dto.isActive);
    }

    if (sets.length === 0) {
      return existing;
    }

    await req.query(
      `UPDATE dbo.RouteCities SET ${sets.join(', ')} WHERE id = @id`,
    );

    return (await this.findRouteCityById(id)) as RouteCity;
  }

  async removeRouteCity(id: number): Promise<void> {
    const existing = await this.findRouteCityById(id);
    if (!existing) {
      throw new NotFoundException(
        `La ciudad de ruta con id ${id} no se encuentra`,
      );
    }

    await this.pool
      .request()
      .input('id', id)
      .query('UPDATE dbo.RouteCities SET isActive = 0 WHERE id = @id');
  }

  // Sin acentos, en minusculas, sin espacios sobrantes. Solo se usa para comparar.
  private normalizeCityText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Devuelve la ciudad (texto antes de la primera coma) del primer valor utilizable.
  // Un valor nulo o solo con espacios no impide recurrir al campo alternativo.
  private resolveOrderCity(
    ...candidates: Array<string | null | undefined>
  ): string | null {
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const city = candidate.split(',')[0].replace(/\s+/g, ' ').trim();
      if (city) {
        return city;
      }
    }
    return null;
  }

  private matchOrderCity(
    rawCity: string,
    routeCities: RouteCity[],
  ): { city: RouteCity | null; ambiguous: boolean } {
    const normalized = this.normalizeCityText(rawCity);

    const exact = routeCities.find(
      (rc) => this.normalizeCityText(rc.cityName) === normalized,
    );
    if (exact) {
      return { city: exact, ambiguous: false };
    }

    // Palabras completas: "ceres centro" matchea "ceres", "esperanza" no matchea "per".
    const asWords = (value: string) =>
      ` ${this.normalizeCityText(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()} `;
    const haystack = asWords(rawCity);
    const wordMatches = routeCities.filter((rc) =>
      haystack.includes(asWords(rc.cityName)),
    );

    if (wordMatches.length === 1) {
      return { city: wordMatches[0], ambiguous: false };
    }
    return { city: null, ambiguous: wordMatches.length > 1 };
  }

  private async findCandidateOrders(): Promise<CandidateOrderRow[]> {
    const result = await this.pool.request().query(`
      SELECT
        o.id,
        o.origin,
        o.destination,
        o.originCity,
        o.destinationCity,
        o.originAddress,
        o.destinationAddress,
        o.senderName,
        o.senderPhone,
        o.recipientName,
        o.recipientPhone,
        o.amountToCollect,
        o.notes,
        o.createdAt
      FROM Orders o
      WHERE o.status = 'pendiente'
        AND NOT EXISTS (
          SELECT 1
          FROM Order_Trip ot
          INNER JOIN Trips t ON t.id = ot.tripId
          WHERE ot.orderId = o.id
            AND t.status <> 'canceled'
        )
    `);

    return result.recordset;
  }

  async generateSuggestion(
    dto: TripBatchSuggestionDto,
  ): Promise<TripBatchSuggestion> {
    await this.assertDriverExists(dto.driverId);

    const isIda = dto.direction === TripBatchDirection.IDA;
    const routeName = dto.routeName ?? DEFAULT_ROUTE_NAME;
    const originCity = dto.originCity ?? (isIda ? 'Ceres' : 'Santa Fe');
    const finalDestinationCity =
      dto.finalDestinationCity ?? (isIda ? 'Santa Fe' : 'Ceres');
    const maxStopsPerCity = dto.maxStopsPerCity ?? null;

    const activeRouteCities = await this.findRouteCities(routeName);
    const orderedRouteCities = isIda
      ? activeRouteCities
      : [...activeRouteCities].reverse();

    const candidates = await this.findCandidateOrders();
    const normalizedOriginCity = this.normalizeCityText(originCity);
    const ordersByRouteCityId = new Map<number, CandidateOrderRow[]>();

    const skippedOrders: SkippedOrder[] = [];

    for (const order of candidates) {
      const rawGroupCity = isIda
        ? this.resolveOrderCity(order.destinationCity, order.destination)
        : this.resolveOrderCity(order.originCity, order.origin);

      if (!rawGroupCity) {
        skippedOrders.push({ orderId: order.id, reason: 'city_not_resolved' });
        continue;
      }

      const { city: matched, ambiguous } = this.matchOrderCity(
        rawGroupCity,
        orderedRouteCities,
      );
      if (!matched) {
        skippedOrders.push({
          orderId: order.id,
          reason: ambiguous ? 'ambiguous_city' : 'city_not_in_route',
        });
        continue;
      }

      if (this.normalizeCityText(matched.cityName) === normalizedOriginCity) {
        skippedOrders.push({ orderId: order.id, reason: 'is_origin_city' });
        continue;
      }

      const bucket = ordersByRouteCityId.get(matched.id) ?? [];
      bucket.push(order);
      ordersByRouteCityId.set(matched.id, bucket);
    }

    const groups: SuggestedGroup[] = [];
    let routeOrder = 0;

    for (const routeCity of orderedRouteCities) {
      const bucket = ordersByRouteCityId.get(routeCity.id);
      if (!bucket || bucket.length === 0) {
        continue;
      }

      bucket.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const limitedBucket =
        maxStopsPerCity !== null ? bucket.slice(0, maxStopsPerCity) : bucket;

      const stops: SuggestedStop[] = limitedBucket.map((order, index) => {
        const cashAmount = order.amountToCollect ?? 0;

        return {
          orderId: order.id,
          sequence: index + 1,
          stopType: isIda ? 'delivery' : 'pickup',
          city: routeCity.cityName,
          address:
            (isIda ? order.destinationAddress : order.originAddress) ||
            (isIda ? order.destination : order.origin),
          contactName: (isIda ? order.recipientName : order.senderName) ?? null,
          contactPhone:
            (isIda ? order.recipientPhone : order.senderPhone) ?? null,
          cashOnDelivery: cashAmount > 0,
          cashAmount,
          notes: order.notes ?? null,
        };
      });

      routeOrder += 1;
      groups.push({
        city: routeCity.cityName,
        routeOrder,
        totalOrders: stops.length,
        totalCashAmount: stops.reduce((sum, stop) => sum + stop.cashAmount, 0),
        stops,
      });
    }

    return {
      tripDate: dto.tripDate.slice(0, 10),
      routeName,
      direction: dto.direction,
      originCity,
      finalDestinationCity,
      driverId: dto.driverId,
      groups,
      skippedOrders,
    };
  }

  private async withTransaction<T>(
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    const tx = this.pool.transaction();
    await tx.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // la transaccion ya pudo haber sido abortada por el motor
      }
      throw err;
    }
  }

  // Confirma una sugerencia: crea salida, hojas de ruta, paradas y asigna las
  // encomiendas, todo en una transaccion.
  async confirm(dto: ConfirmTripBatchDto): Promise<ConfirmTripBatchResponse> {
    const orderIds = dto.groups.flatMap((g) => g.stops.map((s) => s.orderId));
    if (new Set(orderIds).size !== orderIds.length) {
      const repeated = [
        ...new Set(orderIds.filter((id, i) => orderIds.indexOf(id) !== i)),
      ];
      throw new BadRequestException(
        `Hay encomiendas repetidas en la salida: ${repeated.join(', ')}`,
      );
    }

    const cities = dto.groups.map((g) => this.normalizeCityText(g.city));
    if (cities.some((c) => !c) || new Set(cities).size !== cities.length) {
      throw new BadRequestException(
        'Cada grupo debe tener una ciudad distinta y no vacía',
      );
    }

    const isIda = dto.direction === TripBatchDirection.IDA;
    const routeName = dto.routeName ?? DEFAULT_ROUTE_NAME;
    const tripDate = dto.tripDate.slice(0, 10);

    try {
      return await this.withTransaction(async (tx) => {
        const driver = await tx
          .request()
          .input('driverId', dto.driverId)
          .query('SELECT id FROM dbo.Drivers WHERE id = @driverId');
        if (driver.recordset.length === 0) {
          throw new BadRequestException('El conductor seleccionado no existe');
        }

        await this.assertOrdersAssignable(tx, orderIds);

        const batchResult = await tx
          .request()
          .input('tripDate', tripDate)
          .input('routeName', routeName)
          .input('originCity', dto.originCity)
          .input('finalDestinationCity', dto.finalDestinationCity)
          .input('direction', dto.direction)
          .input('status', TripBatchStatus.CONFIRMED)
          .input('driverId', dto.driverId)
          .input('notes', dto.notes ?? null).query(`
            INSERT INTO TripBatches (
              tripDate, routeName, originCity, finalDestinationCity,
              direction, status, driverId, notes, createdAt, updatedAt
            )
            OUTPUT INSERTED.id
            VALUES (
              @tripDate, @routeName, @originCity, @finalDestinationCity,
              @direction, @status, @driverId, @notes,
              SYSUTCDATETIME(), SYSUTCDATETIME()
            )
          `);
        const batchId = batchResult.recordset[0].id as number;

        const trips: ConfirmTripBatchResponse['trips'] = [];

        for (const [groupIndex, group] of dto.groups.entries()) {
          const sheetCity = group.city.trim();
          const routeOrder = groupIndex + 1;

          const tripResult = await tx
            .request()
            .input('tripDate', tripDate)
            .input('driverId', dto.driverId)
            .input('origin', isIda ? dto.originCity : sheetCity)
            .input('destination', isIda ? sheetCity : dto.finalDestinationCity)
            .input('status', 'scheduled')
            .input('batchId', batchId)
            .input('routeOrder', routeOrder)
            .input('sheetCity', sheetCity).query(`
              INSERT INTO Trips (
                tripDate, driverId, origin, destination, status,
                batchId, routeOrder, sheetCity
              )
              OUTPUT INSERTED.id
              VALUES (
                @tripDate, @driverId, @origin, @destination, @status,
                @batchId, @routeOrder, @sheetCity
              )
            `);
          const tripId = tripResult.recordset[0].id as number;

          for (const [stopIndex, stop] of group.stops.entries()) {
            await tx
              .request()
              .input('tripId', tripId)
              .input('orderId', stop.orderId)
              .input('sequence', stopIndex + 1)
              .input(
                'name',
                stop.contactName?.trim() || `Encomienda #${stop.orderId}`,
              )
              .input('stopType', stop.stopType)
              .input('city', stop.city)
              .input('address', stop.address ?? null)
              .input('contactName', stop.contactName ?? null)
              .input('contactPhone', stop.contactPhone ?? null)
              .input('notes', stop.notes ?? null)
              .input('cashOnDelivery', stop.cashOnDelivery)
              .input('cashAmount', stop.cashAmount).query(`
                INSERT INTO TripStops (
                  tripId, orderId, sequence, name, stopType, city, address,
                  contactName, contactPhone, notes, cashOnDelivery, cashAmount
                )
                VALUES (
                  @tripId, @orderId, @sequence, @name, @stopType, @city, @address,
                  @contactName, @contactPhone, @notes, @cashOnDelivery,
                  @cashAmount
                )
              `);

            await tx
              .request()
              .input('orderId', stop.orderId)
              .input('tripId', tripId)
              .query(
                'INSERT INTO Order_Trip (orderId, tripId) VALUES (@orderId, @tripId)',
              );
          }

          trips.push({
            id: tripId,
            batchId,
            sheetCity,
            routeOrder,
            stopsCreated: group.stops.length,
          });
        }

        const request = tx.request();
        const placeholders = orderIds.map((id, i) => {
          request.input(`o${i}`, id);
          return `@o${i}`;
        });
        const updated = await request.query(`
          UPDATE Orders SET status = N'asignada'
          WHERE id IN (${placeholders.join(', ')}) AND status = N'pendiente'
        `);
        if (updated.rowsAffected[0] !== orderIds.length) {
          throw new ConflictException(
            'No se pudo asignar todas las encomiendas; reintentá la operación',
          );
        }

        return {
          id: batchId,
          tripDate,
          routeName,
          direction: dto.direction,
          originCity: dto.originCity,
          finalDestinationCity: dto.finalDestinationCity,
          status: TripBatchStatus.CONFIRMED,
          driverId: dto.driverId,
          groupsCreated: trips.length,
          ordersAssigned: orderIds.length,
          trips,
        };
      });
    } catch (err) {
      const sqlError = err as { number?: number };
      if (
        sqlError.number &&
        SQL_ERRORS_UNIQUE_VIOLATION.includes(sqlError.number)
      ) {
        throw new ConflictException(
          'La salida tiene datos duplicados (ciudad u orden de parada repetidos)',
        );
      }
      if (sqlError.number === SQL_ERROR_FK_VIOLATION) {
        throw new BadRequestException(
          'La salida referencia datos que no existen (conductor o encomiendas)',
        );
      }
      throw err;
    }
  }

  // Bloquea las filas de las encomiendas y verifica que sigan pendientes y sin
  // un viaje no cancelado. Lanza 409 con los ids afectados si alguna no cumple.
  private async assertOrdersAssignable(
    tx: Transaction,
    orderIds: number[],
  ): Promise<void> {
    const request = tx.request();
    const placeholders = orderIds.map((id, i) => {
      request.input(`o${i}`, id);
      return `@o${i}`;
    });

    const result = await request.query(`
      SELECT
        o.id,
        o.status,
        CASE WHEN EXISTS (
          SELECT 1
          FROM Order_Trip ot
          INNER JOIN Trips t ON t.id = ot.tripId
          WHERE ot.orderId = o.id AND t.status <> 'canceled'
        ) THEN 1 ELSE 0 END AS hasActiveTrip
      FROM Orders o WITH (UPDLOCK, ROWLOCK)
      WHERE o.id IN (${placeholders.join(', ')})
    `);

    const rows = result.recordset as Array<{
      id: number;
      status: string;
      hasActiveTrip: number;
    }>;

    const found = new Set(rows.map((r) => r.id));
    const missing = orderIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Las encomiendas no existen: ${missing.join(', ')}`,
      );
    }

    const conflicting = rows
      .filter((r) => r.status !== 'pendiente' || r.hasActiveTrip === 1)
      .map((r) => r.id);
    if (conflicting.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: `Las encomiendas ${conflicting.join(', ')} ya no están pendientes o ya están asignadas a otra salida`,
        error: 'Conflict',
        orderIds: conflicting,
      });
    }
  }

  // Cambia el estado de una salida y propaga el cambio a sus hojas de ruta
  // y encomiendas en una sola transaccion.
  async updateStatus(
    id: number,
    nextStatus: TripBatchStatus,
  ): Promise<TripBatch> {
    await this.withTransaction(async (tx) => {
      const current = await tx
        .request()
        .input('id', id)
        .query(
          'SELECT status FROM TripBatches WITH (UPDLOCK, ROWLOCK) WHERE id = @id',
        );
      if (current.recordset.length === 0) {
        throw new NotFoundException(`La salida con id ${id} no se encuentra`);
      }

      const currentStatus = current.recordset[0].status as string;
      if (!BATCH_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
        throw new BadRequestException(
          `No se puede pasar la salida de "${currentStatus}" a "${nextStatus}"`,
        );
      }

      const exec = (sql: string) => tx.request().input('id', id).query(sql);

      switch (nextStatus) {
        case TripBatchStatus.IN_TRANSIT:
          await exec(
            `UPDATE Trips SET status = 'in_transit' WHERE batchId = @id AND status = 'scheduled'`,
          );
          await exec(this.orderStatusSql('en tránsito', ['asignada']));
          break;
        case TripBatchStatus.COMPLETED:
          await exec(
            `UPDATE Trips SET status = 'delivered' WHERE batchId = @id AND status = 'in_transit'`,
          );
          await exec(this.orderStatusSql('entregado', ['en tránsito']));
          break;
        case TripBatchStatus.CANCELED:
          await exec(
            `UPDATE Trips SET status = 'canceled' WHERE batchId = @id AND status <> 'canceled'`,
          );
          await exec(
            this.orderStatusSql('pendiente', ['asignada', 'en tránsito']),
          );
          break;
        default:
          break;
      }

      await tx
        .request()
        .input('id', id)
        .input('status', nextStatus)
        .query(
          'UPDATE TripBatches SET status = @status, updatedAt = SYSUTCDATETIME() WHERE id = @id',
        );
    });

    return (await this.findOne(id)) as TripBatch;
  }

  // SQL fijo (sin valores del usuario) que mueve las encomiendas de los viajes de la salida.
  private orderStatusSql(to: string, from: string[]): string {
    const fromList = from.map((f) => `N'${f}'`).join(', ');
    return `
      UPDATE o SET status = N'${to}'
      FROM Orders o
      WHERE o.status IN (${fromList})
        AND EXISTS (
          SELECT 1
          FROM Order_Trip ot
          INNER JOIN Trips t ON t.id = ot.tripId
          WHERE ot.orderId = o.id AND t.batchId = @id
        )
    `;
  }
}
