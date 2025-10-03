const Client = require('../models/clientModel');

const getClients = async (req, res) => {
  try {
    const search = req.query.search || '';

    // Build search query
    const searchQuery = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      searchQuery.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    let query = Client.find(searchQuery)
      .select('name email phone address createdAt updatedAt')
      .sort({ createdAt: -1 });

    if (req.user && req.user.isAdmin) {
      query = query
        .select('+createdBy +updatedBy')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
    }

    const clients = await query.lean();

    res.json({
      clients,
      total: clients.length,
    });

  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
const getClientById = async (req, res) => {
  try {
    let query = Client.findById(req.params.id)
      .populate({
        path: 'purchases',
        options: { sort: { createdAt: -1 } }
      });

    if (req.user && req.user.isAdmin) {
      query = query
        .select('+createdBy +updatedBy')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
    }

    const client = await query;

    if (client) {
      // Calculate metrics from populated purchases
      const totalPurchases = client.purchases.reduce(
        (sum, purchase) => sum + (purchase.totalAmount || 0), 0
      );

      const purchaseCount = client.purchases.length;
      const lastPurchaseDate = purchaseCount > 0
        ? client.purchases[0].createdAt
        : null;

      res.json({
        ...client.toObject(),
        totalPurchases,
        purchaseCount,
        lastPurchaseDate
      });
    } else {
      res.status(404).json({ message: 'Client not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a client
// @route   POST /api/clients
// @access  Private
const createClient = async (req, res) => {
  try {
    const client = new Client({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      createdBy: req.user ? req.user._id : undefined,
      updatedBy: req.user ? req.user._id : undefined
    });

    const createdClient = await client.save();
    res.status(201).json(createdClient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a client
// @route   PUT /api/clients/:id
// @access  Private
const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (client) {
      client.name = req.body.name || client.name;
      client.email = req.body.email || client.email;
      client.phone = req.body.phone || client.phone;
      client.address = req.body.address || client.address;
      client.updatedBy = req.user ? req.user._id : client.updatedBy;

      const updatedClient = await client.save();
      res.json(updatedClient);
    } else {
      res.status(404).json({ message: 'Client not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private/Admin
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (client) {
      await client.deleteOne();
      res.json({ message: 'Client removed' });
    } else {
      res.status(404).json({ message: 'Client not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
