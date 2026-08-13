import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { ConnectionPool } from 'mssql';
import {
  TripBatch,
  TripBatchTrip,
  TripBatchWithDriver,
} from './interfaces/trip-batch.interface';
import { RouteCity } from './interfaces/route-city.interface';
import {
  CandidateOrderRow,
  SuggestedGroup,
  SuggestedStop,
  TripBatchSuggestion,
} from './interfaces/trip-batch-suggestion.interface';
import {
  ConfirmedTripBatchTripSummary,
  ConfirmTripBatchResult,
} from './interfaces/confirm-trip-batch.interface';
import {
  CreateTripBatchDto,
  TripBatchDirection,
} from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';
import { CreateRouteCityDto } from './dto/create-route-city.dto';
import { UpdateRouteCityDto } from './dto/update-route-city.dto';
import { TripBatchSuggestionDto } from './dto/trip-batch-suggestion.dto';
import { ConfirmTripBatchDto } from './dto/confirm-trip-batch.dto';

const SQL_ERROR_FK_VIOLATION = 547;
const DEFAULT_ROUTE_NAME = 'Ceres - Santa Fe';

@Injectable()
export class TripBatchesService {
  private readonly logger = new Logger(TripBatchesService.name);

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
    const status = data.status ?? 'draft';
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
    if (dto.status !== undefined) {
      sets.push('status = @status');
      req.input('status', dto.status);
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

  private normalizeCityText(value: string): string {
    return value.trim().toLowerCase();
  }

  private matchOrderCity(
    rawCity: string | null | undefined,
    routeCities: RouteCity[],
  ): RouteCity | null {
    if (!rawCity) {
      return null;
    }

    const normalized = this.normalizeCityText(rawCity);

    const exact = routeCities.find(
      (rc) => this.normalizeCityText(rc.cityName) === normalized,
    );
    if (exact) {
      return exact;
    }

    const partialMatches = routeCities
      .filter((rc) => normalized.includes(this.normalizeCityText(rc.cityName)))
      .sort((a, b) => b.cityName.length - a.cityName.length);

    return partialMatches[0] ?? null;
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
    const ordersByRouteCityId = new Map<number, CandidateOrderRow[]>();

    for (const order of candidates) {
      const rawOriginCity = order.originCity ?? order.origin;
      const rawDestinationCity = order.destinationCity ?? order.destination;

      const matchedOrigin = this.matchOrderCity(
        rawOriginCity,
        activeRouteCities,
      );
      const matchedDestination = this.matchOrderCity(
        rawDestinationCity,
        activeRouteCities,
      );

      if (!matchedOrigin || !matchedDestination) {
        continue;
      }

      if (matchedOrigin.sequence === matchedDestination.sequence) {
        continue;
      }

      const isOrderIda = matchedOrigin.sequence < matchedDestination.sequence;
      if (isOrderIda !== isIda) {
        continue;
      }

      const bucket = ordersByRouteCityId.get(matchedDestination.id) ?? [];
      bucket.push(order);
      ordersByRouteCityId.set(matchedDestination.id, bucket);
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
          stopType: 'delivery',
          city: routeCity.cityName,
          address: order.destinationAddress || order.destination,
          contactName: order.recipientName ?? null,
          contactPhone: order.recipientPhone ?? null,
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
    };
  }

  private async assertOrdersConfirmable(orderIds: number[]): Promise<void> {
    this.logger.debug(
      `[confirm] Validando existencia de órdenes: ${orderIds.join(', ')}`,
    );

    const ordersRequest = this.pool.request();
    const orderParamNames = orderIds.map((id, index) => {
      const paramName = `orderId${index}`;
      ordersRequest.input(paramName, id);
      return `@${paramName}`;
    });

    const ordersResult = await ordersRequest.query(`
      SELECT id, status FROM Orders WHERE id IN (${orderParamNames.join(', ')})
    `);

    const statusByOrderId = new Map<number, string>(
      ordersResult.recordset.map((row) => [row.id, row.status]),
    );

    for (const id of orderIds) {
      if (!statusByOrderId.has(id)) {
        throw new NotFoundException(`La orden ${id} no existe`);
      }
    }

    this.logger.debug(
      `[confirm] Validando status 'pendiente' de las órdenes: ${orderIds.join(', ')}`,
    );

    for (const id of orderIds) {
      if (statusByOrderId.get(id) !== 'pendiente') {
        throw new BadRequestException(`La orden ${id} no está pendiente`);
      }
    }

    this.logger.debug(
      `[confirm] Validando que las órdenes no estén en Order_Trip con una planilla activa: ${orderIds.join(', ')}`,
    );

    const activeTripRequest = this.pool.request();
    const activeParamNames = orderIds.map((id, index) => {
      const paramName = `activeOrderId${index}`;
      activeTripRequest.input(paramName, id);
      return `@${paramName}`;
    });

    const activeTripResult = await activeTripRequest.query(`
      SELECT DISTINCT ot.orderId
      FROM Order_Trip ot
      INNER JOIN Trips t ON t.id = ot.tripId
      WHERE ot.orderId IN (${activeParamNames.join(', ')}) AND t.status <> 'canceled'
    `);

    if (activeTripResult.recordset.length > 0) {
      const assignedOrderId = activeTripResult.recordset[0].orderId;
      throw new BadRequestException(
        `La orden ${assignedOrderId} ya está asignada a otra hoja de ruta`,
      );
    }
  }

  async confirm(dto: ConfirmTripBatchDto): Promise<ConfirmTripBatchResult> {
    const routeName = dto.routeName ?? DEFAULT_ROUTE_NAME;
    const tripDate = dto.tripDate.slice(0, 10);

    this.logger.debug(`[confirm] Validando driverId=${dto.driverId}`);
    await this.assertDriverExists(dto.driverId);

    this.logger.debug(
      `[confirm] Validando groups (recibidos: ${dto.groups?.length ?? 0})`,
    );
    if (!dto.groups || dto.groups.length === 0) {
      throw new BadRequestException(
        'La salida no tiene grupos para confirmar',
      );
    }

    const allStops = dto.groups.flatMap((group) => group.stops);
    if (allStops.length === 0) {
      throw new BadRequestException(
        'La salida no tiene grupos para confirmar',
      );
    }

    const orderIds = allStops.map((stop) => stop.orderId);
    this.logger.debug(
      `[confirm] Validando duplicados en orderIds: ${orderIds.join(', ')}`,
    );
    const duplicateOrderIds = [
      ...new Set(
        orderIds.filter((id, index) => orderIds.indexOf(id) !== index),
      ),
    ];
    if (duplicateOrderIds.length > 0) {
      throw new BadRequestException('Hay órdenes duplicadas en la salida');
    }

    await this.assertOrdersConfirmable(orderIds);

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    try {
      this.logger.debug('[confirm] Insertando TripBatch');
      const batchResult = await new sql.Request(transaction)
        .input('tripDate', tripDate)
        .input('routeName', routeName)
        .input('originCity', dto.originCity)
        .input('finalDestinationCity', dto.finalDestinationCity)
        .input('direction', dto.direction)
        .input('status', 'confirmed')
        .input('driverId', dto.driverId)
        .input('notes', dto.notes ?? null).query(`
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

      const batchId = batchResult.recordset[0].id;
      const tripSummaries: ConfirmedTripBatchTripSummary[] = [];
      let ordersAssigned = 0;

      for (const group of dto.groups) {
        this.logger.debug(
          `[confirm] Insertando Trip para grupo/ciudad "${group.city}" (routeOrder=${group.routeOrder})`,
        );
        const tripResult = await new sql.Request(transaction)
          .input('tripDate', tripDate)
          .input('origin', dto.originCity)
          .input('destination', group.city)
          .input('status', 'scheduled')
          .input('driverId', dto.driverId)
          .input(
            'notes',
            `Planilla generada automáticamente para ${group.city}`,
          )
          .input('batchId', batchId)
          .input('routeOrder', group.routeOrder)
          .input('sheetCity', group.city).query(`
            INSERT INTO Trips (
              tripDate,
              vehicle,
              driver,
              driverId,
              origin,
              destination,
              status,
              notes,
              batchId,
              routeOrder,
              sheetCity
            )
            OUTPUT INSERTED.id
            VALUES (
              @tripDate,
              NULL,
              NULL,
              @driverId,
              @origin,
              @destination,
              @status,
              @notes,
              @batchId,
              @routeOrder,
              @sheetCity
            )
          `);

        const tripId = tripResult.recordset[0].id;

        for (const stop of group.stops) {
          const stopCity = stop.city ?? group.city;

          this.logger.debug(
            `[confirm] Insertando TripStop para orderId=${stop.orderId} (tripId=${tripId}, sequence=${stop.sequence})`,
          );
          await new sql.Request(transaction)
            .input('tripId', tripId)
            .input('orderId', stop.orderId)
            .input('sequence', stop.sequence)
            .input('stopType', stop.stopType ?? 'delivery')
            .input('city', stopCity)
            .input('address', stop.address ?? null)
            .input('contactName', stop.contactName ?? null)
            .input('contactPhone', stop.contactPhone ?? null)
            .input('scheduledTime', stop.scheduledTime ?? null)
            .input('notes', stop.notes ?? null)
            .input('cashOnDelivery', stop.cashOnDelivery ?? false)
            .input('cashAmount', stop.cashAmount ?? 0)
            .input('completed', false).query(`
              INSERT INTO TripStops (
                tripId,
                orderId,
                sequence,
                stopType,
                city,
                address,
                contactName,
                contactPhone,
                scheduledTime,
                notes,
                cashOnDelivery,
                cashAmount,
                completed
              )
              VALUES (
                @tripId,
                @orderId,
                @sequence,
                @stopType,
                @city,
                @address,
                @contactName,
                @contactPhone,
                @scheduledTime,
                @notes,
                @cashOnDelivery,
                @cashAmount,
                @completed
              )
            `);

          this.logger.debug(
            `[confirm] Insertando Order_Trip para orderId=${stop.orderId}, tripId=${tripId}`,
          );
          await new sql.Request(transaction)
            .input('orderId', stop.orderId)
            .input('tripId', tripId).query(`
              INSERT INTO Order_Trip (orderId, tripId)
              VALUES (@orderId, @tripId)
            `);

          this.logger.debug(
            `[confirm] Actualizando Orders.status='asignada' para orderId=${stop.orderId}`,
          );
          await new sql.Request(transaction).input('orderId', stop.orderId)
            .query(`
              UPDATE Orders SET status = 'asignada' WHERE id = @orderId
            `);

          ordersAssigned += 1;
        }

        tripSummaries.push({
          id: tripId,
          batchId,
          sheetCity: group.city,
          routeOrder: group.routeOrder,
          stopsCreated: group.stops.length,
        });
      }

      await transaction.commit();

      return {
        id: batchId,
        tripDate,
        routeName,
        direction: dto.direction,
        originCity: dto.originCity,
        finalDestinationCity: dto.finalDestinationCity,
        status: 'confirmed',
        driverId: dto.driverId,
        groupsCreated: dto.groups.length,
        ordersAssigned,
        trips: tripSummaries,
      };
    } catch (err) {
      this.logger.error('[confirm] Error original al confirmar la salida:', err);

      await transaction.rollback();

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ConflictException
      ) {
        throw err;
      }

      const sqlError = err as { number?: number; stack?: string };
      if (sqlError.number === SQL_ERROR_FK_VIOLATION) {
        throw new BadRequestException(
          'No se pudo confirmar la salida: alguno de los datos referenciados no existe',
        );
      }

      throw new BadRequestException(
        'No se pudo confirmar la salida. Verifique los datos e intente nuevamente.',
      );
    }
  }
}
