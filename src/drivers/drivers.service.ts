import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionPool } from 'mssql';
import { Driver } from './drivers.interface';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<Driver[]> {
    const result = await this.pool.request().query('SELECT * FROM Drivers');
    return result.recordset;
  }

  async findOne(id: number): Promise<Driver | null> {
    const result = await this.pool
      .request()
      .input('id', id)
      .query('SELECT * FROM Drivers WHERE id = @id');

    return result.recordset[0] || null;
  }

  async create(data: CreateDriverDto): Promise<number> {
    const { name, licenseNumber } = data;
    const phone = data.phone ?? null;
    const truckPlate = data.truckPlate ?? null;
    const notes = data.notes ?? null;
    const isActive = data.isActive ?? true;

    const result = await this.pool
      .request()
      .input('name', name)
      .input('phone', phone)
      .input('licenseNumber', licenseNumber)
      .input('truckPlate', truckPlate)
      .input('notes', notes)
      .input('isActive', isActive).query(`
        INSERT INTO Drivers (name, phone, licenseNumber, truckPlate, notes, isActive)
        OUTPUT INSERTED.id
        VALUES (@name, @phone, @licenseNumber, @truckPlate, @notes, @isActive)
      `);

    return result.recordset[0].id;
  }

  async update(id: number, dto: UpdateDriverDto): Promise<void> {
    const sets = Object.keys(dto);
    if (sets.length === 0) return;

    const setClause = sets.map((key) => `${key} = @${key}`).join(', ');

    const req = this.pool.request().input('id', id);
    for (const set of sets) {
      req.input(set, dto[set]);
    }

    try {
      const result = await req.query(`
        UPDATE Drivers
        SET ${setClause}
        WHERE id = @id
      `);

      if (result.rowsAffected[0] === 0) {
        throw new NotFoundException(`Driver with id ${id} not found`);
      }
    } catch (err) {
      this.logger.error(`Error updating driver ${id}`, err.stack);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Unexpected error updating driver',
      );
    }
  }

  async remove(id: number): Promise<void> {
    await this.pool
      .request()
      .input('id', id)
      .query('DELETE FROM Drivers WHERE id = @id');
  }
}
