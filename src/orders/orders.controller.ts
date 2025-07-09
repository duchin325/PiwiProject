import { Controller, Get, Body, Delete, Param, ParseIntPipe, Post, Put, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.interface';


@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) {}

    @Get()
    async getAll(): Promise<Order []> {
        return this.ordersService.findAll();
    }

    @Get(':id')
    async getOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
        const order = await this.ordersService.findOne(id);
        if (!order) {
            throw new NotFoundException(`La orden con el id ${id} no se encuentra`);
        }

        return order;
    }

    @Post()
    async create(@Body() body: Omit<Order, 'id' | 'createdAt'>): Promise<{id: number}> {
        const id = await this.ordersService.create(body);
        return {id};
    }

    @Put(':id')
    async update( @Param('id', ParseIntPipe) id: number, @Body() body: Partial<Omit<Order, 'id' | 'createdAt'>>) {
        return this.ordersService.update(id, body);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.remove(id);
    }
}
