# Taller de Observabilidad

El objetivo de este taller es implementar un sistema de observabilidad sobre la tienda de muebles de **Taracea**.

## Sujeto de observación: la tienda Taracea

Este repositorio contiene una SPA de un catálogo de muebles con filtros por categoría, búsqueda, detalle de producto, formulario de productos, carrito de compra e inicio de sesión.
El catálogo, las órdenes y los usuarios viven en una base de datos PostgreSQL, expuesta a través de tres APIs en NestJS.

## Arquitectura

El sistema se compone de un frontend, **tres microservicios** y una base de datos compartida. Todo se orquesta con `docker-compose.yaml`.

| Componente                    | Carpeta             | Puerto | Responsabilidad                                                           |
|-------------------------------|---------------------|--------|---------------------------------------------------------------------------|
| **Web app**                   | `web-app/`          | `8080` | SPA en Angular: catálogo, detalle, creación de productos, carrito, login. |
| **Servicio de Autenticación** | `auth-service/`     | `3001` | Registro e inicio de sesión de usuarios.                                  |
| **Servicio de Productos**     | `products-service/` | `3002` | Catálogo de muebles: consulta por categoría y registro de productos.      |
| **Servicio de Órdenes**       | `orders-service/`   | `3003` | Pedidos del carrito: creación y seguimiento de órdenes de compra.         |
| **PostgreSQL**                | —                   | `5432` | Base de datos compartida por los tres microservicios.                     |

```
                    ┌─────────────┐
   navegador ─────▶ │   web-app   │ (nginx, :8080)
                    └──────┬──────┘
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌────────────┐ ┌──────────────┐ ┌──────────────┐
     │auth-service│ │products-svc  │ │orders-service│
     │   :3001    │ │    :3002     │ │    :3003     │
     └─────┬──────┘ └──────┬───────┘ └──────┬───────┘
           │               │   ▲            │
           │               │   └────────────┘  orders consulta y
           ▼               ▼      products      descuenta stock
        ┌───────────────────────────────┐
        │      PostgreSQL  (:5432)      │
        └───────────────────────────────┘
```

### APIs

**Autenticación** (`auth-service`)

| Método | Ruta             | Descripción                                    |
|--------|------------------|------------------------------------------------|
| `POST` | `/auth/register` | Crea un usuario (`{ name, email, password }`). |
| `POST` | `/auth/login`    | Inicia sesión (`{ email, password }`).         |

**Productos** (`products-service`)

| Método  | Ruta                       | Descripción                     |
|---------|----------------------------|---------------------------------|
| `GET`   | `/products`                | Todos los productos.            |
| `GET`   | `/products?category=salas` | Productos de una categoría.     |
| `GET`   | `/products/:id`            | Un producto por su id.          |
| `POST`  | `/products`                | Registra un producto nuevo.     |
| `PATCH` | `/products/:id/stock`      | Descuenta stock de un producto. |

**Órdenes** (`orders-service`)

| Método | Ruta          | Descripción               |
|--------|---------------|---------------------------|
| `GET`  | `/orders`     | Todas las órdenes.        |
| `GET`  | `/orders/:id` | Una orden por su id.      |
| `POST` | `/orders`     | Crea una orden de compra. |

El detalle de cada API está en el `README.md` de su carpeta.

## Cómo levantar el sistema

Con [Docker](https://docs.docker.com/) instalado, desde la raíz del repositorio:

```bash
docker compose up --build
```

Esto levanta todos los contenedores: PostgreSQL, los tres microservicios, la web app y el stack de observabilidad (Prometheus, Loki, Promtail y Grafana). Cuando todo esté arriba:

- Tienda: <http://localhost:8080>
- APIs: <http://localhost:3001>, <http://localhost:3002>, <http://localhost:3003>
- Grafana: <http://localhost:3000>

La primera vez, el servicio de productos carga un catálogo semilla de 9 muebles si la base de datos está vacía. Para detener y limpiar:

```bash
docker compose down        # detiene los contenedores
docker compose down -v     # además borra los datos de PostgreSQL
```

## Instrucciones del Taller

El sistema actual es funcional, pero carece de visibilidad interna. Su tarea es instrumentar el código y la infraestructura para dotar al sistema de métricas y logs centralizados.

> El `auth-service` ya viene instrumentado como **ejemplo de referencia**. La guía paso a paso —dependencias, configuración y conexión a Grafana— está en [`OBSERVABILIDAD.md`](OBSERVABILIDAD.md).

### Requisitos

Se debe elegir y aplicar la observabilidad sobre uno de los microservicios disponibles.

#### Implementación de Métricas:

Se debe modificar el código de los microservicios en NestJS para exponer un endpoint /metrics.

#### Implementación de Logs:

1. Se debe modificar los servicios seleccionados para emitir logs estructurados.
2. Se debe configurar un stack de logging (Loki fue el que se usó en la referencia) para centralizar y visualizar los logs.

#### Visualización en Grafana:

1. Se debe conectar Grafana a Prometheus.
2. Se debe crear un Dashboard que muestre métricas y logs clave del servicio seleccionado.

---

## Informe de Implementación

### Servicio instrumentado: `orders-service`

Se implementó observabilidad completa sobre el `orders-service` siguiendo el patrón del `auth-service`.

#### Métricas expuestas (`GET /metrics`)

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `http_requests_total` | Counter | Peticiones HTTP por método, ruta y código de estado |
| `http_request_duration_seconds` | Histogram | Latencia de peticiones HTTP (p95, p99) |
| `orders_created_total` | Counter | Órdenes creadas, etiquetadas por `status` (success, rejected_empty, rejected_no_user, rejected_insufficient_stock) |
| `orders_stock_deductions_total` | Counter | Operaciones de descuento de stock exitosas |

**Proveedor:** `@willsoto/nestjs-prometheus` + `prom-client`

#### Logs estructurados (JSON → Loki)

El servicio emite logs JSON con `service: "orders-service"`. Eventos registrados:

| Evento | Nivel | Campos |
|--------|-------|--------|
| `order_created` | info | `orderId`, `userId`, `total`, `itemCount` |
| `order_creation_failed` | warn | `reason`, `productId` (según el caso) |
| `orders_queried` | info | `count` |
| `order_found` / `order_not_found` | info/warn | `orderId` |
| `stock_deducted` | info | `productId`, `quantity` |
| `stock_deduction_failed` | warn | `productId`, `quantity` |

**Biblioteca:** `nestjs-pino` + `pino-http`

#### Dashboard de Grafana

`observability/grafana/dashboards/orders-service.json` — 10 paneles:

- 4 stat: órdenes creadas, rechazadas, descuentos de stock, memoria residente
- 4 timeseries: tasa HTTP, latencia p95, errores 5xx, CPU
- 1 timeseries: tasa de creación de órdenes + deducciones de stock
- 1 log panel: logs en vivo del servicio desde Loki

#### Archivos modificados/creados

| Archivo | Cambio |
|---------|--------|
| `orders-service/package.json` | Dependencias añadidas |
| `orders-service/src/observabilidad/metrics.module.ts` | Nuevo — módulo global de métricas |
| `orders-service/src/observabilidad/http-metrics.interceptor.ts` | Nuevo — interceptor HTTP |
| `orders-service/src/app.module.ts` | LoggerModule + MetricsModule |
| `orders-service/src/main.ts` | PinoLogger con bufferLogs |
| `orders-service/src/orders/orders.service.ts` | Métricas y logs de negocio |
| `observability/grafana/dashboards/orders-service.json` | Nuevo — dashboard |

La infraestructura (Prometheus, Loki, Promtail, Grafana) no requirió cambios: todo estaba configurado para descubrir automáticamente el nuevo servicio.
