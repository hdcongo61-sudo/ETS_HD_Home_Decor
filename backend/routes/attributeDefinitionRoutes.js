const express = require('express');
const router = express.Router();
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const {
  getAttributeDefinitions,
  createAttributeDefinition,
  updateAttributeDefinition,
  deleteAttributeDefinition,
} = require('../controllers/attributeDefinitionController');

router
  .route('/')
  .get(protect, requireTenant, getAttributeDefinitions)
  .post(protect, requireTenant, admin, createAttributeDefinition);

router
  .route('/:id')
  .put(protect, requireTenant, admin, updateAttributeDefinition)
  .delete(protect, requireTenant, admin, deleteAttributeDefinition);

module.exports = router;
