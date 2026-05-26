import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductMaterial } from './entities/product-material.entity';
import { SEED_PRODUCTS } from './seed-data';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@InjectRepository(Product) private productsRepository: Repository<Product>, @InjectRepository(ProductMaterial) private materialsRepository: Repository<ProductMaterial>) {}

  async onModuleInit(): Promise<void> {
    const count = await this.productsRepository.count();
    if (count > 0) return;
    this.logger.log('Catálogo vacío: cargando productos semilla...');

    for (const product of SEED_PRODUCTS) {
      await this.create(product);
    }

    this.logger.log(`Catálogo semilla cargado (${SEED_PRODUCTS.length} productos).`);
  }

  createMaterial(productId: number, description: string, index: number): ProductMaterial {
    return this.materialsRepository.create({
      productId,
      materialId: index + 1,
      description
    });
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { materials, ...productData } = createProductDto;
    const newProduct = this.productsRepository.create(productData);
    const savedProduct = await this.productsRepository.save(newProduct);
    const productMaterials = materials.map((description, index) => this.createMaterial(savedProduct.id, description, index));
    savedProduct.materials = await this.materialsRepository.save(productMaterials);
    return savedProduct;
  }

  async findAll(category?: string): Promise<Product[]> {
    if (category) return this.productsRepository.find({ where: { category } });
    return this.productsRepository.find();
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    return product;
  }

  async updateStock(id: number, quantityToDeduct: number): Promise<Product> {
    const product = await this.findOne(id);
    if (product.stock < quantityToDeduct) throw new BadRequestException(`Stock actual: ${product.stock}, solicitado: ${quantityToDeduct}`);
    product.stock -= quantityToDeduct;
    return this.productsRepository.save(product);
  }
}
