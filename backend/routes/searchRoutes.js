const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");
const Client = require("../models/clientModel");
const Sale = require("../models/saleModel");
const Employee = require("../models/employeeModel");
const Supplier = require("../models/supplierModel");
const { protect } = require("../middlewares/authMiddleware");
const { tenantFilter } = require("../utils/tenantQuery");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 🔍 Recherche globale (tenant-scoped)
router.get("/", protect, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ results: [] });
    if (q.length > 64) {
      return res.status(400).json({ message: "Recherche trop longue" });
    }

    const regex = new RegExp(escapeRegExp(q), "i");
    const tf = tenantFilter(req);

    const [products, clients, sales, employees, suppliers] = await Promise.all([
      Product.find({ ...tf, name: regex }).select("name _id image slug stock").sort({ stock: -1, name: 1 }).limit(5),
      Client.find({ ...tf, name: regex }).select("name _id slug").limit(5),
      Sale.find({ ...tf, clientName: regex }).select("clientName totalAmount _id").limit(5),
      Employee.find({ ...tf, name: regex }).select("name _id slug").limit(5),
      Supplier.find({ ...tf, name: regex }).select("name _id phone").limit(5),
    ]);

    const results = [
      ...products.map((p) => ({ ...p._doc, type: "product" })),
      ...clients.map((c) => ({ ...c._doc, type: "client" })),
      ...sales.map((s) => ({ ...s._doc, type: "sale" })),
      ...employees.map((e) => ({ ...e._doc, type: "employee" })),
      ...suppliers.map((s) => ({ ...s._doc, type: "supplier" })),
    ];

    res.json({ results });
  } catch (error) {
    console.error("Erreur de recherche globale:", error);
    res.status(500).json({ message: "Erreur du serveur" });
  }
});

module.exports = router;
