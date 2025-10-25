const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");
const Client = require("../models/clientModel");
const Sale = require("../models/saleModel");
const Employee = require("../models/employeeModel");

// 🔍 Recherche globale
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ results: [] });

    const regex = new RegExp(q, "i");

    const [products, clients, sales, employees] = await Promise.all([
      Product.find({ name: regex }).select("name _id image").limit(5),
      Client.find({ name: regex }).select("name _id").limit(5),
      Sale.find({ clientName: regex }).select("clientName totalAmount _id").limit(5),
      Employee.find({ name: regex }).select("name _id").limit(5),
    ]);

    const results = [
      ...products.map((p) => ({ ...p._doc, type: "product" })),
      ...clients.map((c) => ({ ...c._doc, type: "client" })),
      ...sales.map((s) => ({ ...s._doc, type: "sale" })),
      ...employees.map((e) => ({ ...e._doc, type: "employee" })),
    ];

    res.json({ results });
  } catch (error) {
    console.error("Erreur de recherche globale:", error);
    res.status(500).json({ message: "Erreur du serveur" });
  }
});

module.exports = router;
