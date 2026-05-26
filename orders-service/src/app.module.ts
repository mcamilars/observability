import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { MetricsModule } from './observabilidad/metrics.module';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable de entorno requerida: ${name}`);
  return value;
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        base: { service: 'orders-service' },
        autoLogging: { ignore: (req) => req.url === '/metrics' }
      }
    }),
    MetricsModule,
    OrdersModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: env('DB_HOST'),
      port: parseInt(env('DB_PORT')),
      username: env('DB_USER'),
      password: env('DB_PASSWORD'),
      database: env('DB_NAME'),
      entities: [Order, OrderItem],
      synchronize: true
    })
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
