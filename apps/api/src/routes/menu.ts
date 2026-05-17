import { Router } from "express";
import { getMenuItems, getMenuItemsByCategory } from "../services/menuService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    res.json(await getMenuItems());
  } catch (err) {
    next(err);
  }
});

router.get("/:category", async (req, res, next) => {
  try {
    res.json(await getMenuItemsByCategory(req.params.category));
  } catch (err) {
    next(err);
  }
});

export default router;
