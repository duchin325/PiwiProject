import { Controller, Get, Body, Delete, Put, Post, ParseIntPipe, Param, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './clients.interface';

@Controller('clients')
export class ClientsController {
    constructor(private readonly clientsService: ClientsService ) {}

    @Get()
    async getAll(): Promise<Client[]> {
        return this.clientsService.findAll();
    }

    @Get(':id')
    async getOne(@Param('id', ParseIntPipe) id: number): Promise<Client> {
        const client = await this.clientsService.findOne(id);

        if(!client) {
            throw new NotFoundException(`El cliente con id ${id} no se encuentra`);
        }

        return client;
    }

    @Post()
    async create(@Body() body: Omit<Client, 'id' | 'createdAt'>): Promise<{id: number}> {
        const id = await this.clientsService.create(body);
        return {id};
    }

    @Put()
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<Omit<Client, 'id' | 'createdAt'>>) {
        return this.clientsService.update(id, body);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.clientsService.remove(id);
    }
}
