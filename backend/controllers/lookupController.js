const Category = require('../models/categoryModel');
const ExpenseCategory = require('../models/expenseCategoryModel');
const Container = require('../models/containerModel');
const Warehouse = require('../models/warehouseModel');
const Supplier = require('../models/supplierModel');
const Product = require('../models/productModel');
const slugify = require('../utils/slugify');
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

const syncSupplierProducts = async (req, previousName, supplier) => {
  const escapedPreviousName = String(previousName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escapedPreviousName) return;

  await Product.updateMany(
    {
      ...tenantFilter(req),
      supplierName: { $regex: `^${escapedPreviousName}$`, $options: 'i' },
    },
    {
      $set: {
        supplierName: supplier.name,
        supplierPhone: supplier.phone || '',
      },
    }
  );
};

const createSupplier = async (req, res) => {
  try {
    const item = await Supplier.create({ ...applyTenant(req, req.body) });
    await syncSupplierProducts(req, item.name, item);
    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce nom existe déjà' });
    }
    res.status(400).json({ message: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const existing = await Supplier.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) {
      return res.status(404).json({ message: 'Élément non trouvé' });
    }

    const previousName = existing.name || '';
    const nextName = typeof req.body.name === 'string' ? req.body.name.trim() : previousName;
    const nextPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : existing.phone || '';

    existing.name = nextName;
    existing.phone = nextPhone;
    const item = await existing.save();

    await syncSupplierProducts(req, previousName, item);

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

// ── Catégories hiérarchiques (Phase 3) ──

// Vérifie que `possibleAncestorId` n'est pas un descendant de `nodeId` (anti-cycle).
const isDescendantOf = async (tenantId, nodeId, possibleAncestorId) => {
  const target = String(nodeId);
  let current = await Category.findOne({ tenantId, _id: possibleAncestorId }).select('parentId').lean();
  while (current && current.parentId) {
    if (String(current.parentId) === target) return true;
    current = await Category.findOne({ tenantId, _id: current.parentId }).select('parentId').lean();
  }
  return false;
};

// Recalcule path/depth des descendants d'une catégorie (largeur d'abord).
const recomputeDescendants = async (tenantId, rootId, rootPath, rootDepth) => {
  const all = await Category.find({ tenantId }).select('_id parentId slug').lean();
  const byParent = new Map();
  for (const c of all) {
    const pid = c.parentId ? String(c.parentId) : 'root';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(c);
  }
  const queue = [{ id: String(rootId), path: rootPath, depth: rootDepth }];
  while (queue.length) {
    const { id, path: parentPath, depth: parentDepth } = queue.shift();
    for (const child of byParent.get(id) || []) {
      const childPath = `${parentPath}/${child.slug}`;
      await Category.updateOne(
        { _id: child._id },
        { $set: { path: childPath, depth: parentDepth + 1 } }
      );
      queue.push({ id: String(child._id), path: childPath, depth: parentDepth + 1 });
    }
  }
};

const getCategoriesTree = async (req, res) => {
  try {
    const items = await Category.find(tenantFilter(req)).sort({ sortOrder: 1, name: 1 }).lean();
    const byParent = new Map();
    for (const c of items) {
      const pid = c.parentId ? String(c.parentId) : 'root';
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(c);
    }
    const attach = (list) => list.map((c) => ({
      ...c,
      children: attach(byParent.get(String(c._id)) || []),
    }));
    res.json(attach(byParent.get('root') || []));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, parentId, sortOrder, image, isActive } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Le nom de la catégorie est requis.' });
    }
    let parent = null;
    if (parentId) {
      parent = await Category.findOne({ ...tenantFilter(req), _id: parentId }).lean();
      if (!parent) return res.status(404).json({ message: 'Catégorie parente introuvable.' });
    }
    const slug = slugify(name);
    const category = await Category.create({
      tenantId: req.tenantId,
      name: name.trim(),
      normalizedName: name.trim().toLowerCase(),
      slug,
      parentId: parent ? parent._id : null,
      path: parent ? `${parent.path}/${slug}` : `/${slug}`,
      depth: parent ? parent.depth + 1 : 0,
      sortOrder: Number(sortOrder) || 0,
      image: typeof image === 'string' ? image : '',
      isActive: isActive !== false,
    });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà à ce niveau.' });
    }
    res.status(400).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const existing = await Category.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) return res.status(404).json({ message: 'Catégorie introuvable.' });

    const { name, parentId, sortOrder, image, isActive } = req.body || {};

    // Changement de parent : anti-cycle + validation.
    if (parentId !== undefined) {
      const nextParentRaw = parentId === null || parentId === '' ? null : parentId;
      const currentParent = existing.parentId ? String(existing.parentId) : null;
      const nextParent = nextParentRaw ? String(nextParentRaw) : null;
      if (nextParent !== currentParent) {
        if (nextParent === null) {
          existing.parentId = null;
        } else {
          if (nextParent === String(existing._id)) {
            return res.status(400).json({ message: 'Une catégorie ne peut pas être sa propre parente.' });
          }
          const parent = await Category.findOne({ ...tenantFilter(req), _id: nextParent }).lean();
          if (!parent) return res.status(404).json({ message: 'Catégorie parente introuvable.' });
          if (await isDescendantOf(req.tenantId, existing._id, parent._id)) {
            return res.status(400).json({ message: 'Déplacement impossible : cycle détecté.' });
          }
          existing.parentId = parent._id;
        }
      }
    }
    if (name !== undefined) existing.name = String(name).trim();
    if (sortOrder !== undefined) existing.sortOrder = Number(sortOrder) || 0;
    if (image !== undefined) existing.image = String(image);
    if (isActive !== undefined) existing.isActive = Boolean(isActive);

    await existing.save();

    // Recalcul du chemin/depth (le slug peut changer si le nom change).
    const parent = existing.parentId
      ? await Category.findOne({ tenantId: req.tenantId, _id: existing.parentId }).select('path depth').lean()
      : null;
    const newPath = parent ? `${parent.path}/${existing.slug}` : `/${existing.slug}`;
    const newDepth = parent ? parent.depth + 1 : 0;
    await Category.updateOne({ _id: existing._id }, { $set: { path: newPath, depth: newDepth } });
    await recomputeDescendants(req.tenantId, existing._id, newPath, newDepth);

    res.json(await Category.findById(existing._id).lean());
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà à ce niveau.' });
    }
    res.status(400).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const existing = await Category.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) return res.status(404).json({ message: 'Catégorie introuvable.' });
    const childCount = await Category.countDocuments({ tenantId: req.tenantId, parentId: existing._id });
    if (childCount > 0) {
      return res.status(400).json({ message: 'Supprimez ou déplacez d’abord les sous-catégories.' });
    }
    await Category.deleteOne({ _id: existing._id });
    res.json({ message: 'Supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCategories: getAll(Category),
  getCategoriesTree,
  createCategory,
  updateCategory,
  deleteCategory,

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
  createSupplier,
  updateSupplier,
  deleteSupplier: remove(Supplier),
};
