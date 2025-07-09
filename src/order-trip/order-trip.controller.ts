import { Controller, Body, Param, NotFoundException, ParseIntPipe, Get, Post, Put, Delete } from '@nestjs/common';
import { OrderTripService } from './order-trip.service';
import { OrderTrip } from './order-trip.interface';

@Controller('order-trip')
export class OrderTripController {
    constructor (private readonly ordertripService: OrderTripService){}

    @Get()
    async getAll(): Promise<OrderTrip []> {
        return this.ordertripService.findAll();
    }
        
    @Get('order/:orderId')
    getOneByOrder(@Param('orderId', ParseIntPipe) orderId: number): Promise<OrderTrip[]> {
        return this.ordertripService.findOneByOrder(orderId);
    }

    @Get('trip/:tripId')
    async getOneByTrip(@Param('tripId', ParseIntPipe) tripId: number): Promise<OrderTrip[]> {
        const route = await this.ordertripService.findOneByOrder(tripId);
        if (!route) {
            throw new NotFoundException(`La ruta con el id ${tripId} no se encuentra`);
        }
        
        return route;
    }
        
    @Post()
    async create(@Body() body: OrderTrip ): Promise<void> {
        const orderTrip = await this.ordertripService.create(body);
        return orderTrip;
    }
        
    @Put(':id')
    async update( @Param('id', ParseIntPipe) id: number, @Body() body: Partial<Omit<OrderTrip, 'id' | 'createdAt'>>) {
        return this.ordertripService.update(id, body);
    }
        
    @Delete('order/:orderId/trip/:tripId')
    async remove(@Param('orderId', ParseIntPipe) orderID: number, @Param('tripId', ParseIntPipe) tripId: number): Promise<void> {
        return this.ordertripService.remove(orderID, tripId);
    }

}
