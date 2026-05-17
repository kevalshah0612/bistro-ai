import { prisma } from "../db/prisma";
import { MenuItem } from "../schemas/menu";

type MenuItemWithCategory = Awaited<ReturnType<typeof prisma.menuItem.findMany>>[number] & {
  category: { name: string };
};

function toMenuItem(item: MenuItemWithCategory): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category.name,
    tags: item.tags as MenuItem["tags"],
    available: item.available,
  };
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const items = await prisma.menuItem.findMany({
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return items.map(toMenuItem);
}

export async function getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      category: {
        name: {
          equals: category,
          mode: "insensitive",
        },
      },
    },
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return items.map(toMenuItem);
}
