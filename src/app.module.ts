import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from './clients/clients.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { TripsModule } from './trips/trips.module';
import { RoutesModule } from './routes/routes.module';
import { OrderTripModule } from './order-trip/order-trip.module';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { TripStopsModule } from './trip-stops/trip-stops.module';


@Module({
  imports: [
    DatabaseModule,
    ClientsModule,
    OrdersModule,
    TripsModule,
    RoutesModule,
    OrderTripModule,
    DriversModule,
    TripStopsModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }) 
  ],
})
export class AppModule {}
