const Category = require('../models/categoryModel');
const ExpenseCategory = require('../models/expenseCategoryModel');
const Container = require('../models/containerModel');
const Warehouse = require('../models/warehouseModel');
const Supplier = require('../models/supplierModel');

// Factory: generic CRUD generators
const getAll = (Model) => async (_req, res) => {
  try {
    const items = await Model.find({}).sort({ name: 1 }).lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const create = (Model) => async (req, res) => {
  try {
    const item = await Model.create(req.body);
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
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ message: 'Élément non trouvé' });
    }
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
    const item = await Model.findByIdAndDelete(req.params.id);
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
