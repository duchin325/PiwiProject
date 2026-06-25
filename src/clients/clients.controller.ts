import {
  Controller,
  Get,
  Body,
  Delete,
  Put,
  Post,
  ParseIntPipe,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './clients.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async getAll(): Promise<Client[]> {
    return this.clientsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    const client = await this.clientsService.findOne(id);

    if (!client) {
      throw new NotFoundException(`El cliente con id ${id} no se encuentra`);
    }

    return client;
  }

  @Post()
  async create(@Body() dto: CreateClientDto): Promise<{ id: number }> {
    const id = await this.clientsService.create(dto);
    return { id };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ): Promise<void> {
    console.log(`[ClientsController] update() called with the id ${id}`);
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}
