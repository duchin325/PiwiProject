import { Controller, Param, Body, NotFoundException, ParseIntPipe, Get, Post, Put, Delete } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { Route } from './route.interface';

@Controller('routes')
export class RoutesController {
    constructor (private readonly routesService: RoutesService) {}

     @Get()
        async getAll(): Promise<Route []> {
            return this.routesService.findAll();
        }
    
    @Get(':id')
        async getOne(@Param('id', ParseIntPipe) id: number): Promise<Route> {
            const route = await this.routesService.findOne(id);
            if (!route) {
                throw new NotFoundException(`La ruta con el id ${id} no se encuentra`);
            }
    
            return route;
        }
    
    @Post()
        async create(@Body() body: Omit<Route, 'id' | 'createdAt'>): Promise<{id: number}> {
            const id = await this.routesService.create(body);
            return {id};
        }
    
    @Put(':id')
        async update( @Param('id', ParseIntPipe) id: number, @Body() body: Partial<Omit<Route, 'id' | 'createdAt'>>) {
            return this.routesService.update(id, body);
        }
    
    @Delete(':id')
        async remove(@Param('id', ParseIntPipe) id: number) {
            return this.routesService.remove(id);
        }
}
