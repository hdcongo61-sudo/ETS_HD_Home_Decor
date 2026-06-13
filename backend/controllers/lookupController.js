const Category = require('../models/categoryModel');
const ExpenseCategory = require('../models/expenseCategoryModel');
const Container = require('../models/containerModel');
const Warehouse = require('../models/warehouseModel');
const Supplier = require('../models/supplierModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

// Factory: generic CRUD generators — all tenant-scoped
const getAll = (Model) => async (req, res) => {
  try {
    const items = await Model.find(tenantFilter(req)).sort({ name: 1 }).lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const create = (Model) => async (req, res) => {
  try {
    const item = await Model.create({ ...applyTenant(req, req.body) });
    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce nom existe déjà' });
    }
    res.status(400).json({ message: error.message });
  }
};

const update = (Model) => async (req, res) => {
  try {
    // Verify ownership before update
    const existing = await Model.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) {
      return res.status(404).json({ message: 'Élément non trouvé' });
    }
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce nom existe déjà' });
    }
    res.status(400).json({ message: error.message });
  }
};

const remove = (Model) => async (req, res) => {
  try {
    const item = await Model.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
    if (!item) {
      return res.status(404).json({ message: 'Élément non trouvé' });
    }
    res.json({ message: 'Supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCategories: getAll(Category),
  createCategory: create(Category),
  updateCategory: update(Category),
  deleteCategory: remove(Category),

  getExpenseCategories: getAll(ExpenseCategory),
  createExpenseCategory: create(ExpenseCategory),
  updateExpenseCategory: update(ExpenseCategory),
  deleteExpenseCategory: remove(ExpenseCategory),

  getContainers: getAll(Container),
  createContainer: create(Container),
  updateContainer: update(Container),
  deleteContainer: remove(Container),

  getWarehouses: getAll(Warehouse),
  createWarehouse: create(Warehouse),
  updateWarehouse: update(Warehouse),
  deleteWarehouse: remove(Warehouse),

  getSuppliers: getAll(Supplier),
  createSupplier: create(Supplier),
  updateSupplier: update(Supplier),
  deleteSupplier: remove(Supplier),
};
