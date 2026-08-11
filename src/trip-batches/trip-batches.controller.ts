import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { TripBatchesService } from './trip-batches.service';
import {
  TripBatch,
  TripBatchTrip,
  TripBatchWithDriver,
} from './interfaces/trip-batch.interface';
import { RouteCity } from './interfaces/route-city.interface';
import { TripBatchSuggestion } from './interfaces/trip-batch-suggestion.interface';
import { CreateTripBatchDto } from './dto/create-trip-batch.dto';
import { UpdateTripBatchDto } from './dto/update-trip-batch.dto';
import { CreateRouteCityDto } from './dto/create-route-city.dto';
import { UpdateRouteCityDto } from './dto/update-route-city.dto';
import { TripBatchSuggestionDto } from './dto/trip-batch-suggestion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trip-batches')
export class TripBatchesController {
  constructor(private readonly tripBatchesService: TripBatchesService) {}

  // Declared before ':id' routes so 'route-cities' is not matched as the :id param.
  @Get('route-cities')
  async getRouteCities(
    @Query('routeName') routeName?: string,
  ): Promise<RouteCity[]> {
    return this.tripBatchesService.findRouteCities(routeName);
  }

  @Post('route-cities')
  async createRouteCity(@Body() body: CreateRouteCityDto): Promise<RouteCity> {
    return this.tripBatchesService.createRouteCity(body);
  }

  @Put('route-cities/:id')
  async updateRouteCity(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRouteCityDto,
  ): Promise<RouteCity> {
    return this.tripBatchesService.updateRouteCity(id, body);
  }

  @Delete('route-cities/:id')
  async removeRouteCity(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tripBatchesService.removeRouteCity(id);
  }

  // Declared before ':id' routes so 'suggestions' is not matched as the :id param.
  @Post('suggestions')
  async generateSuggestion(
    @Body() body: TripBatchSuggestionDto,
  ): Promise<TripBatchSuggestion> {
    return this.tripBatchesService.generateSuggestion(body);
  }

  @Get()
  async getAll(): Promise<TripBatchWithDriver[]> {
    return this.tripBatchesService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<TripBatch> {
    const batch = await this.tripBatchesService.findOne(id);
    if (!batch) {
      throw new NotFoundException(`La salida con id ${id} no se encuentra`);
    }

    return batch;
  }

  @Get(':id/trips')
  async getTrips(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TripBatchTrip[]> {
    return this.tripBatchesService.findTrips(id);
  }

  @Post()
  async create(@Body() body: CreateTripBatchDto): Promise<TripBatch> {
    return this.tripBatchesService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTripBatchDto,
  ): Promise<TripBatch> {
    return this.tripBatchesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tripBatchesService.remove(id);
  }
}
