import { prisma } from "../db/prisma";
import { getMenuItems } from "./menuService";
import { validateOrderItems } from "./cartValidation";

type CreateOrderItemInput = {
  itemId: string;
  quantity: number;
};

type OrderWithItems = Awaited<ReturnType<typeof listOrders>>[number];

function mapOrder(order: OrderWithItems) {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      itemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      priceAtOrder: item.priceAtOrder,
      category: item.menuItem.category.name,
    })),
  };
}

export async function listOrders(limit = 25) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      items: {
        include: {
          menuItem: {
            include: {
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export async function listOrdersResponse(limit = 25) {
  const orders = await listOrders(limit);
  return orders.map(mapOrder);
}

export async function createOrder(items: CreateOrderItemInput[]) {
  const menu = await getMenuItems();
  validateOrderItems(items, menu);

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map((item) => item.itemId) },
      available: true,
    },
  });

  const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

  const total = Math.round(
    items.reduce((sum, item) => {
      const menuItem = menuItemById.get(item.itemId);
      return sum + (menuItem?.price ?? 0) * item.quantity;
    }, 0) * 100
  ) / 100;

  const order = await prisma.order.create({
    data: {
      total,
      items: {
        create: items.map((item) => {
          const menuItem = menuItemById.get(item.itemId);
          if (!menuItem) {
            throw new Error(`Menu item is unavailable or does not exist: ${item.itemId}`);
          }
          return {
            menuItemId: item.itemId,
            quantity: item.quantity,
            priceAtOrder: menuItem.price,
          };
        }),
      },
    },
    include: {
      items: {
        include: {
          menuItem: {
            include: {
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return mapOrder(order);
}
