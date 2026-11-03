const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/productModel');

test('treats a blank product barcode as absent', () => {
  const product = new Product({ barcode: '   ' });

  assert.equal(product.barcode, undefined);
});

test('trims a provided product barcode', () => {
  const product = new Product({ barcode: '  0123456789012  ' });

  assert.equal(product.barcode, '0123456789012');
});
