import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
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

  constructor(@InjectRepository(Order) private ordersRepository: Repository<Order>, @InjectRepository(OrderItem) private itemsRepository: Repository<OrderItem>, private readonly http: HttpService) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    if (!createOrderDto.items || createOrderDto.items.length === 0) throw new BadRequestException('La orden debe tener al menos un producto');
    if (createOrderDto.userId == null) throw new BadRequestException('La orden debe estar asociada a un usuario');
    const orderItems: OrderItem[] = [];
    let total = 0;
    for (const item of createOrderDto.items) {
      const product = await this.fetchProduct(item.productId);
      if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente para "${product.name}" (disponible: ${product.stock}, solicitado: ${item.quantity})`);

      const orderItem = this.itemsRepository.create({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity
      })

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
    return savedOrder;
  }

  findAll(): Promise<Order[]> {
    return this.ordersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Orden con ID ${id} no encontrada`);
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
    } catch {
      throw new BadRequestException(`No fue posible descontar el stock del producto ${productId}`);
    }
  }
}
