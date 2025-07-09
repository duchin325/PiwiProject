import { Inject, Injectable } from "@nestjs/common";
import { ConnectionPool } from 'mssql';
import { Client } from "./clients.interface";

@Injectable()
export class ClientsService {
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

  async create(data: Omit<Client, 'id' | 'createdAt'>): Promise<number> {
    const { name, address, phone, email } = data;
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

  async update(id: number, data: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> {
      const sets = Object.keys(data)
          .map((key) => `${key} = @${key}` )
          .join(', ');

      const req = this.pool
          .request()
          .input('id', id);
      for(const [k, v] of Object.entries(data)) {
          req.input(k, v);
      }

      await req.query(`
                      UPDATE Clients
                      SET ${sets}
                      WHERE id = @id
        `);
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
