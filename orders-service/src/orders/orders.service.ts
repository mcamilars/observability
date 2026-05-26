import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { PinoLogger } from 'nestjs-pino';
import { Counter } from 'prom-client';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

interface ProductView {
  id: number;
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class OrdersService {
  private readonly productsServiceUrl = process.env.PRODUCTS_SERVICE_URL ?? 'http://localhost:3002';

  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepository: Repository<OrderItem>,
    private readonly http: HttpService,
    @InjectMetric('orders_created_total') private readonly ordersCreatedCounter: Counter<string>,
    @InjectMetric('orders_stock_deductions_total') private readonly stockDeductionsCounter: Counter<string>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(OrdersService.name);
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      this.ordersCreatedCounter.inc({ status: 'rejected_empty' });
      this.logger.warn({ event: 'order_creation_failed', reason: 'empty_items' }, 'Orden rechazada: sin productos');
      throw new BadRequestException('La orden debe tener al menos un producto');
    }
    if (createOrderDto.userId == null) {
      this.ordersCreatedCounter.inc({ status: 'rejected_no_user' });
      this.logger.warn({ event: 'order_creation_failed', reason: 'no_userId' }, 'Orden rechazada: sin usuario');
      throw new BadRequestException('La orden debe estar asociada a un usuario');
    }

    const orderItems: OrderItem[] = [];
    let total = 0;
    for (const item of createOrderDto.items) {
      const product = await this.fetchProduct(item.productId);
      if (product.stock < item.quantity) {
        this.ordersCreatedCounter.inc({ status: 'rejected_insufficient_stock' });
        this.logger.warn({ event: 'order_creation_failed', productId: item.productId, productName: product.name, available: product.stock, requested: item.quantity }, 'Orden rechazada: stock insuficiente');
        throw new BadRequestException(`Stock insuficiente para "${product.name}" (disponible: ${product.stock}, solicitado: ${item.quantity})`);
      }

      const orderItem = this.itemsRepository.create({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity
      });

      orderItems.push(orderItem);
      total += product.price * item.quantity;
    }

    for (const item of createOrderDto.items) await this.deductStock(item.productId, item.quantity);

    const order = this.ordersRepository.create({
      userId: createOrderDto.userId,
      customerName: createOrderDto.customerName,
      total,
      status: 'confirmed'
    });

    const savedOrder = await this.ordersRepository.save(order);
    for (const orderItem of orderItems) orderItem.orderId = savedOrder.id;
    savedOrder.items = await this.itemsRepository.save(orderItems);

    this.ordersCreatedCounter.inc({ status: 'success' });
    this.logger.info({ event: 'order_created', orderId: savedOrder.id, userId: createOrderDto.userId, total, itemCount: orderItems.length }, 'Orden creada exitosamente');

    return savedOrder;
  }

  async findAll(): Promise<Order[]> {
    const orders = await this.ordersRepository.find({ order: { createdAt: 'DESC' } });
    this.logger.info({ event: 'orders_queried', count: orders.length }, 'Consulta de órdenes');
    return orders;
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      this.logger.warn({ event: 'order_not_found', orderId: id }, 'Orden no encontrada');
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }
    this.logger.info({ event: 'order_found', orderId: id }, 'Orden recuperada');
    return order;
  }

  private async fetchProduct(productId: number): Promise<ProductView> {
    try {
      const response = await firstValueFrom(this.http.get<ProductView>(`${this.productsServiceUrl}/products/${productId}`));
      return response.data;
    } catch {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado en el servicio de productos`);
    }
  }

  private async deductStock(productId: number, quantity: number): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.productsServiceUrl}/products/${productId}/stock`, { quantity }));
      this.stockDeductionsCounter.inc();
      this.logger.info({ event: 'stock_deducted', productId, quantity }, 'Stock descontado');
    } catch {
      this.logger.warn({ event: 'stock_deduction_failed', productId, quantity }, 'No fue posible descontar stock');
      throw new BadRequestException(`No fue posible descontar el stock del producto ${productId}`);
    }
  }
}
