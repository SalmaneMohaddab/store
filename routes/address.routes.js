const express = require('express');
const router = express.Router();
const { authenticate, isOwnerOrAdmin } = require('../middleware/auth.middleware');
const addressController = require('../controllers/address.controller');

/**
 * @route GET /api/addresses
 * @desc Get user's addresses
 * @access Private
 */
router.get('/', authenticate, addressController.getUserAddresses);

/**
 * @route GET /api/addresses/:id
 * @desc Get address details
 * @access Private
 */
router.get('/:id', authenticate, isOwnerOrAdmin('address'), addressController.getAddressById);

/**
 * @route POST /api/addresses
 * @desc Add new address
 * @access Private
 */
router.post('/', authenticate, addressController.createAddress);

module.exports = router; 