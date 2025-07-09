import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { Trip } from './trip.interface';

@Controller('trips')
export class TripsController {
    constructor (private readonly tripsService: TripsService) {}

    @Get()
    async getAll(): Promise<Trip []> {
        return this.tripsService.findAll();
    }

    @Get(':id')
    async getOne(@Param('id', ParseIntPipe) id: number): Promise<Trip> {
        const trip = await this.tripsService.findOne(id);
        if (!trip) {
            throw new NotFoundException(`El viaje con id ${id} no se encuentra`);
        }
        
        return trip;
    }

    @Post()
    async create(@Body() body: Omit<Trip, 'id' | 'createdAt'>): Promise<{id: number}> {
        const id = await this.tripsService.create(body);
        return {id};
    }
    
    @Put(':id')
    async update( @Param('id', ParseIntPipe) id: number, @Body() body: Partial<Omit<Trip, 'id' | 'createdAt'>>) {
        return this.tripsService.update(id, body);
    }
    
    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.tripsService.remove(id);
    }
}
