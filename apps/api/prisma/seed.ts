import { PrismaClient } from "@prisma/client";
import menu from "../src/data/menu.json";
import { MenuItemSchema } from "../src/schemas/menu";

const prisma = new PrismaClient();
const menuItems = MenuItemSchema.array().parse(menu);

async function main() {
  const categoryNames = [...new Set(menuItems.map((item) => item.category))];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

  for (const item of menuItems) {
    const categoryId = categoryByName.get(item.category);
    if (!categoryId) {
      throw new Error(`Missing category for ${item.name}`);
    }

    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        tags: item.tags,
        available: item.available,
        categoryId,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        tags: item.tags,
        available: item.available,
        categoryId,
      },
    });
  }

  console.log(`Seeded ${categoryNames.length} categories and ${menuItems.length} menu items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
