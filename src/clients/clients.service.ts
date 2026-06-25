import { Inject, Injectable, NotFoundException, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConnectionPool } from 'mssql';
import { Client } from "./clients.interface";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly pool: ConnectionPool,
  ) {}

  async findAll(): Promise<Client[]> {
    const result = await this.pool
        .request()
        .query('SELECT * FROM Clients');
    return result.recordset;
  }

  async findOne(id: number): Promise<Client | null> {
    const result = await this.pool
        .request()
        .input('id', id)
        .query(`
              SELECT * FROM Clients WHERE id = @id          
          `);

    return result.recordset[0] || null;
  }

  async create(data: CreateClientDto): Promise<number> {
    const { name, address, email } = data;
    const phone = data.phone ?? null;
    const result = await this.pool
        .request()
        .input('name', name)
        .input('address', address)
        .input('phone', phone)
        .input('email', email)
        .query(`
              INSERT INTO Clients (name, address, phone, email)
              OUTPUT INSERTED.id
              VALUES (@name, @address, @phone, @email)
          `);
    
    return result.recordset[0].id;
  }

  async update(id: number, dto: UpdateClientDto): Promise<void> {

      this.logger.warn(`Called update() with id ${id} dto =${JSON.stringify(dto)} `);

      const sets = Object.keys(dto)
      if (sets.length == 0) return;


      const setClause = sets.map((key) => `${key} = @${key}` )
          .join(', ');

      const req = this.pool
          .request()
          .input('id', id);


      for(const set of sets) {
          const value = (dto as any)[set];
          req.input(set, value);
      }

      try {
          const result = await req.query(`
                      UPDATE Clients
                      SET ${setClause}
                      WHERE id = @id
        `);

          if (result.rowsAffected[0] === 0) {
              throw new NotFoundException(`Client with id ${id} not found`);
          }
      } catch (err){
          this.logger.error(`Error updating client ${id}`, err.stack);
          if (err instanceof NotFoundException) throw err;
          throw new InternalServerErrorException('Unexpected error updating client');
      }

      
  } 

  async remove(id: number): Promise<void> {
      await this.pool
          .request()
          .input('id', id)
          .query(`
                  DELETE FROM Clients WHERE id = @id
            `);
  }
  
}
