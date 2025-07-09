import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { TripsModule } from './trips/trips.module';
import { RoutesModule } from './routes/routes.module';
import { OrderTripModule } from './order-trip/order-trip.module';


@Module({
  imports: [
    DatabaseModule,
    ClientsModule,
    OrdersModule,
    TripsModule,
    RoutesModule,
    OrderTripModule,  
  ],
})
export class AppModule {}