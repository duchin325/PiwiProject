import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { CreateTripStopDto } from './dto/create-trip-stop.dto';
import { UpdateTripStopDto } from './dto/update-trip-stop.dto';
import { TripStop } from './trip-stop.interface';

@Injectable()
export class TripStopsService {
  private readonly logger = new Logger(TripStopsService.name);

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<TripStop[]> {
    const result = await this.pool
      .request()
      .query('SELECT * FROM TripStops ORDER BY tripId, sequence');
    return result.recordset;
  }

  async findOne(id: number): Promise<TripStop | null> {
    const result = await this.pool
      .request()
      .input('id', id)
      .query('SELECT * FROM TripStops WHERE id = @id');

    return result.recordset[0] || null;
  }

  async findByTrip(tripId: number): Promise<TripStop[]> {
    const result = await this.pool
      .request()
      .input('tripId', tripId)
      .query(
        'SELECT * FROM TripStops WHERE tripId = @tripId ORDER BY sequence',
      );

    return result.recordset;
  }

  async create(data: CreateTripStopDto): Promise<number> {
    const result = await this.pool
      .request()
      .input('tripId', data.tripId)
      .input('orderId', data.orderId ?? null)
      .input('sequence', data.sequence)
      .input('name', data.name)
      .input('stopType', data.stopType)
      .input('city', data.city)
      .input('address', data.address ?? null)
      .input('contactName', data.contactName ?? null)
      .input('contactPhone', data.contactPhone ?? null)
      .input('scheduledTime', data.scheduledTime ?? null)
      .input('notes', data.notes ?? null)
      .input('cashOnDelivery', data.cashOnDelivery ?? false)
      .input('cashAmount', data.cashAmount ?? null)
      .input('completed', data.completed ?? false).query(`
        INSERT INTO TripStops (
          tripId,
          orderId,
          sequence,
          name,
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
        OUTPUT INSERTED.id
        VALUES (
          @tripId,
          @orderId,
          @sequence,
          @name,
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

    return result.recordset[0].id;
  }

  async update(id: number, dto: UpdateTripStopDto): Promise<void> {
    const sets = Object.keys(dto);
    if (sets.length === 0) return;

    const setClause = sets.map((key) => `${key} = @${key}`).join(', ');

    const req = this.pool.request().input('id', id);
    for (const set of sets) {
      req.input(set, dto[set]);
    }

    try {
      const result = await req.query(`
        UPDATE TripStops
        SET ${setClause}
        WHERE id = @id
      `);

      if (result.rowsAffected[0] === 0) {
        throw new NotFoundException(`Trip stop with id ${id} not found`);
      }
    } catch (err) {
      this.logger.error(`Error updating trip stop ${id}`, err.stack);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Unexpected error updating trip stop',
      );
    }
  }

  async remove(id: number): Promise<void> {
    await this.pool
      .request()
      .input('id', id)
      .query('DELETE FROM TripStops WHERE id = @id');
  }
}
