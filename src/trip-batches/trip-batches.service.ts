import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  CreateTripBatchDto,
  TripBatchDirection,
} from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';
import { CreateRouteCityDto } from './dto/create-route-city.dto';
import { UpdateRouteCityDto } from './dto/update-route-city.dto';
import { TripBatchSuggestionDto } from './dto/trip-batch-suggestion.dto';

const SQL_ERROR_FK_VIOLATION = 547;
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
    const normalizedOriginCity = this.normalizeCityText(originCity);
    const ordersByRouteCityId = new Map<number, CandidateOrderRow[]>();

    for (const order of candidates) {
      const rawGroupCity = isIda
        ? (order.destinationCity ?? order.destination)
        : (order.originCity ?? order.origin);

      const matched = this.matchOrderCity(rawGroupCity, orderedRouteCities);
      if (!matched) {
        continue;
      }

      if (this.normalizeCityText(matched.cityName) === normalizedOriginCity) {
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
    };
  }
}
