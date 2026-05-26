import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductMaterial } from './entities/product-material.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductMaterial])],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
