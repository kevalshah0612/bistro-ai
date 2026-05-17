import { Router } from "express";
import menu from "../data/menu.json";
import { MenuItemSchema } from "../schemas/menu";

const router = Router();
const menuItems = MenuItemSchema.array().parse(menu);

router.get("/", (_req, res) => {
  res.json(menuItems);
});

router.get("/:category", (req, res) => {
  const category = req.params.category.toLowerCase();
  res.json(menuItems.filter((item) => item.category.toLowerCase() === category));
});

export default router;
