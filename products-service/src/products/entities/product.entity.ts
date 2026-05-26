import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ProductMaterial } from './product-material.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('int')
  price: number;

  @Column('int')
  stock: number;

  @Column()
  category: string;

  @Column('int')
  height: number;

  @Column('int')
  width: number;

  @Column('int')
  depth: number;

  @Column({ name: 'delivery_time' })
  deliveryTime: string;

  @Column({ name: 'brand_color' })
  brandColor: string;

  @OneToMany(() => ProductMaterial, (material) => material.product, { eager: true })
  materials: ProductMaterial[];
}
