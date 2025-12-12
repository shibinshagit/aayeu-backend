// controllers/admin/bestSellerController.js
const catchAsync = require('../../errorHandling/catchAsync');
const dbPool = require('../../db/dbConnection');
const AppError = require('../../errorHandling/AppError');
const sendResponse = require('../../utils/sendResponse');
const BestSellerService = require('../../services/bestSellerService');

module.exports.createBestSeller = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const { product_id, vendor_id, rank, meta, active = true, start_at, end_at } = req.body;
        const adminId = req.user?.id || null;

        if (!product_id) {
            client.release();
            return next(new AppError('product_id is required', 400));
        }

        await client.query('BEGIN');

        // ensure product exists
        const { rows: prod } = await client.query('SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL', [product_id]);
        if (prod.length === 0) {
            await client.query('ROLLBACK');
            return next(new AppError('Product not found', 404));
        }

        // ensure unique on product: you can check exists
        const exists = await BestSellerService.existsForProduct(product_id, client);
        if (exists) {
            await client.query('ROLLBACK');
            return next(new AppError('This product is already marked as best seller', 409));
        }

        const created = await BestSellerService.addBestSeller({
            product_id, vendor_id, rank, meta, active, start_at, end_at, created_by: adminId
        }, client);

        await client.query('COMMIT');
        return sendResponse(res, 201, true, 'Best seller created', created);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        return next(new AppError(err.message || 'Failed to create best seller', 500));
    } finally {
        client.release();
    }
});

module.exports.updateBestSeller = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const { id } = req.body;
        if (!id) {
            client.release();
            return next(new AppError('id is required to update best seller', 400));
        }
        const updates = req.body;
        await client.query('BEGIN');

        const updated = await BestSellerService.updateBestSeller(id, updates, client);
        if (!updated) {
            await client.query('ROLLBACK');
            return next(new AppError('Best seller not found or no valid fields to update', 404));
        }

        await client.query('COMMIT');
        return sendResponse(res, 200, true, 'Best seller updated', updated);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        return next(new AppError(err.message || 'Failed to update best seller', 500));
    } finally {
        client.release();
    }
});

module.exports.deleteBestSeller = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const { id } = req.query;
        if (!id) {
            client.release();
            return next(new AppError('id is required to remove best seller', 400));
        }
        await client.query('BEGIN');

        const removed = await BestSellerService.removeBestSeller(id, client);
        if (!removed) {
            await client.query('ROLLBACK');
            return next(new AppError('Best seller not found', 404));
        }

        await client.query('COMMIT');
        return sendResponse(res, 200, true, 'Best seller removed', removed);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        return next(new AppError(err.message || 'Failed to remove best seller', 500));
    } finally {
        client.release();
    }
});

module.exports.listBestSellersAdmin = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const { page = 1, limit = 50, include_inactive = 'false' } = req.query;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
        const rows = await BestSellerService.listBestSellers({ limit: parseInt(limit, 10), offset, include_inactive: include_inactive === 'true' }, client);
        return sendResponse(res, 200, true, 'Best sellers fetched', { total: rows.length, items: rows });
    } catch (err) {
        return next(new AppError(err.message || 'Failed to list best sellers', 500));
    } finally {
        client.release();
    }
});

module.exports.getBestSellers = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20', 10)));
        const offset = (page - 1) * limit;

        const rows = await BestSellerService.getActiveBestSellers({ limit, offset }, client);
        const total = rows.length; // if you want full count, add separate count query
        return sendResponse(res, 200, true, 'Best sellers fetched', { total, page, limit, items: rows });
    } catch (err) {
        return next(err);
    } finally {
        client.release();
    }
});
