const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');
const { CFA_PER_POINT, TIERS, pointsForSpend, tierForPoints, nextTierAfter } = require('../config/loyalty');

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

    const query = Client.find(searchQuery)
      .select('name slug email phone address gender createdAt updatedAt')
      .sort({ createdAt: -1 });

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
        options: { sort: { saleDate: -1, createdAt: -1 } }
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
        ? (client.purchases[0].saleDate || client.purchases[0].createdAt)
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
    const client = new Client({ tenantId: req.tenantId,
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
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalClients,
      salesAgg,
      newThisMonth,
      genderAggregation
    ] = await Promise.all([
      Client.countDocuments(),
      Sale.aggregate([
        {
          $match: {
            client: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$client',
            totalSpent: { $sum: '$totalAmount' },
            totalSales: { $sum: 1 }
          }
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalSpent: { $sum: '$totalSpent' },
                  activeClients: { $sum: 1 }
                }
              }
            ],
            topClients: [
              { $sort: { totalSpent: -1, totalSales: -1 } },
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
            ]
          }
        }
      ]),
      Client.countDocuments({
        createdAt: { $gte: startOfMonth }
      }),
      Client.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$gender', 'other'] },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    const totalSpent = Number(salesAgg[0]?.totals?.[0]?.totalSpent) || 0;
    const activeClients = Number(salesAgg[0]?.totals?.[0]?.activeClients) || 0;
    const avgSpent = activeClients ? totalSpent / activeClients : 0;
    const topClients = salesAgg[0]?.topClients || [];

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

// @desc    Loyalty program overview (members, points, tiers, leaderboard)
// @route   GET /api/clients/loyalty
const getLoyaltyOverview = async (req, res) => {
  try {
    const [clients, spendAgg] = await Promise.all([
      Client.find({}).select('name phone email slug loyalty lastPurchaseDate').lean(),
      Sale.aggregate([
        { $match: { client: { $ne: null }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$client',
            totalSpent: { $sum: '$totalAmount' },
            salesCount: { $sum: 1 },
            lastPurchase: { $max: '$saleDate' },
          },
        },
      ]),
    ]);

    const spendMap = {};
    spendAgg.forEach((s) => { spendMap[String(s._id)] = s; });

    const rows = clients
      .map((c) => {
        const agg = spendMap[String(c._id)] || {};
        const totalSpent = Number(agg.totalSpent) || 0;
        const salesCount = Number(agg.salesCount) || 0;
        const earned = pointsForSpend(totalSpent);
        const adjust = Number(c.loyalty?.pointsAdjust) || 0;
        const history = Array.isArray(c.loyalty?.history) ? c.loyalty.history : [];
        const redeemed = history.reduce((sum, h) => sum + (h.delta < 0 ? -h.delta : 0), 0);
        const bonus = history.reduce((sum, h) => sum + (h.delta > 0 ? h.delta : 0), 0);
        const available = Math.max(0, earned + adjust);
        const tier = tierForPoints(earned);
        const next = nextTierAfter(earned);
        return {
          _id: c._id,
          name: c.name,
          phone: c.phone || '',
          slug: c.slug || '',
          totalSpent,
          salesCount,
          lastPurchase: agg.lastPurchase || c.lastPurchaseDate || null,
          earned,
          adjust,
          redeemed,
          bonus,
          available,
          tier: tier.key,
          tierLabel: tier.label,
          tierColor: tier.color,
          nextTier: next ? { key: next.key, label: next.label, minPoints: next.minPoints, remaining: Math.max(0, next.minPoints - earned) } : null,
        };
      })
      .filter((r) => r.salesCount > 0 || r.adjust !== 0)
      .sort((a, b) => b.available - a.available || b.earned - a.earned);

    const tierCounts = TIERS.reduce((acc, t) => { acc[t.key] = 0; return acc; }, {});
    rows.forEach((r) => { tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1; });

    const kpis = {
      members: rows.length,
      pointsEarned: rows.reduce((s, r) => s + r.earned, 0),
      pointsAvailable: rows.reduce((s, r) => s + r.available, 0),
      pointsRedeemed: rows.reduce((s, r) => s + r.redeemed, 0),
      pointsBonus: rows.reduce((s, r) => s + r.bonus, 0),
      tierCounts,
    };

    res.json({ config: { cfaPerPoint: CFA_PER_POINT, tiers: TIERS }, kpis, clients: rows });
  } catch (error) {
    console.error('Erreur loyalty overview:', error);
    res.status(500).json({ message: 'Erreur lors du chargement du programme de fidélité' });
  }
};

// @desc    Apply a loyalty adjustment (redeem points or grant bonus)
// @route   POST /api/clients/:id/loyalty
const adjustLoyaltyPoints = async (req, res) => {
  try {
    const { delta, reason, note } = req.body;
    const d = Math.trunc(Number(delta));
    if (!Number.isFinite(d) || d === 0) {
      return res.status(400).json({ message: 'Nombre de points invalide.' });
    }

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable.' });

    if (!client.loyalty) client.loyalty = { pointsAdjust: 0, history: [] };
    client.loyalty.pointsAdjust = (client.loyalty.pointsAdjust || 0) + d;
    client.loyalty.history.push({
      delta: d,
      reason: reason === 'bonus' ? 'bonus' : 'redeem',
      note: String(note || '').slice(0, 200),
      at: new Date(),
      by: req.user?._id || null,
    });
    await client.save();

    res.json({ _id: client._id, pointsAdjust: client.loyalty.pointsAdjust });
  } catch (error) {
    console.error('Erreur ajustement fidélité:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajustement des points.' });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  getFilteredClients,
  getLoyaltyOverview,
  adjustLoyaltyPoints,
};
