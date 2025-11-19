const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');

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
      .select('name slug email phone gender totalPurchases purchaseCount lastPurchaseDate createdAt updatedAt')
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
      gender: req.body.gender || 'other',
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
      client.gender = req.body.gender || client.gender;
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

/**
 * @desc    Obtenir les statistiques clients (pour le header & le graphique)
 * @route   GET /api/clients/stats
 * @access  Private (admin ou sales manager)
 */
const getClientStats = async (req, res) => {
  try {
    // Total de clients
    const totalClients = await Client.countDocuments();

    // Total dépensé et moyenne par client
    const sales = await Sale.aggregate([
      { $group: { _id: '$client', totalSpent: { $sum: '$totalAmount' } } }
    ]);

    const totalSpent = sales.reduce((sum, s) => sum + (s.totalSpent || 0), 0);
    const avgSpent = sales.length ? totalSpent / sales.length : 0;

    // Nouveaux clients du mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonth = await Client.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Top 5 clients pour graphique
    const topClients = await Sale.aggregate([
      {
        $group: {
          _id: '$client',
          totalSpent: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'clientInfo'
        }
      },
      { $unwind: '$clientInfo' },
      {
        $project: {
          name: '$clientInfo.name',
          totalSpent: 1,
          totalSales: 1,
          clientId: '$_id',
          slug: '$clientInfo.slug'
        }
      }
    ]);

    const genderAggregation = await Client.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$gender', 'other'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const genderDistribution = genderAggregation.map((item) => ({
      gender: item._id,
      count: item.count,
      percentage: totalClients ? Number(((item.count / totalClients) * 100).toFixed(1)) : 0,
    }));

    res.status(200).json({
      totalClients,
      totalSpent,
      avgSpent,
      newThisMonth,
      topClients,
      genderDistribution
    });
  } catch (error) {
    console.error('Erreur statistiques clients:', error);
    res.status(500).json({ message: 'Erreur serveur lors du calcul des statistiques' });
  }
};

/**
 * @desc    Obtenir les clients filtrés par date ou dépenses
 * @route   GET /api/clients/filter
 * @access  Private (admin ou sales manager)
 */
const getFilteredClients = async (req, res) => {
  try {
    const { startDate, endDate, minSpent, maxSpent } = req.query;

    // Base du pipeline
    const matchStage = {};

    // Filtrer par date de création
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Regrouper les dépenses par client
    const pipeline = [
      { $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'client',
          as: 'sales'
        }
      },
      { $addFields: {
          totalSpent: { $sum: '$sales.totalAmount' }
        }
      },
      { $match: matchStage }
    ];

    // Filtrer par dépenses
    if (minSpent || maxSpent) {
      const min = parseFloat(minSpent) || 0;
      const max = parseFloat(maxSpent) || Infinity;
      pipeline.push({ $match: { totalSpent: { $gte: min, $lte: max } } });
    }

    pipeline.push({ $sort: { totalSpent: -1 } });

    const filteredClients = await Client.aggregate(pipeline);

    res.status(200).json(filteredClients);
  } catch (error) {
    console.error('Erreur filtre clients:', error);
    res.status(500).json({ message: 'Erreur lors du filtrage des clients' });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  getFilteredClients
};
