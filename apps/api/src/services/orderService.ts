import { prisma } from "../db/prisma";

type CreateOrderItemInput = {
  itemId: string;
  quantity: number;
};

export async function createOrder(items: CreateOrderItemInput[]) {
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map((item) => item.itemId) },
      available: true,
    },
  });

  const menuItemById = new Map(menuItems.map((item) => [item.id, item]));
  const missingItem = items.find((item) => !menuItemById.has(item.itemId));

  if (missingItem) {
    throw new Error(`Menu item is unavailable or does not exist: ${missingItem.itemId}`);
  }

  const total = Math.round(
    items.reduce((sum, item) => {
      const menuItem = menuItemById.get(item.itemId);
      return sum + (menuItem?.price ?? 0) * item.quantity;
    }, 0) * 100
  ) / 100;

  return prisma.order.create({
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
}
