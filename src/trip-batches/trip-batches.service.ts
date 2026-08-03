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
import { CreateTripBatchDto } from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';

const SQL_ERROR_FK_VIOLATION = 547;

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
    const routeName = data.routeName ?? 'Ceres - Santa Fe';
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
}
