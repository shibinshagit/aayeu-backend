const catchAsync = require("../../errorHandling/catchAsync");
const sendResponse = require("../../utils/sendResponse");
const AppError = require("../../errorHandling/AppError");
const {VendorService}  = require("../../services/vendorService");
const { isValidUUID } = require("../../utils/basicValidation");
const dbPool = require("../../db/dbConnection");


module.exports.getVendors = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    let {status,page,search} = req.query;
    try {
        const vendors = await VendorService.getAllVendors( client, {status,page,search});
        return sendResponse(res, 200, true, 'Vendors fetched', vendors);
    } catch (err) {
        return next(new AppError(err.message || 'Failed to fetch vendors', 500));
    } finally {
        client.release();
    }
});


module.exports.getVendorById = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const id = req.query.vendorId;
        if (!isValidUUID(id)) return next(new AppError('Invalid vendor ID', 400));
        const vendor = await VendorService.getVendorById(id, client);
        if (!vendor) return next(new AppError('Vendor not found', 404));
        return sendResponse(res, 200, true, 'Vendor fetched', vendor);
    } catch (err) {
        return next(new AppError(err.message || 'Failed to fetch vendor', 500));
    } finally {
        client.release();
    }
});

module.exports.updateVendorStatus = catchAsync(async (req, res, next) => {
    const client = await dbPool.connect();
    try {
        const {id, status} = req.body;
        if (!isValidUUID(id)) return next(new AppError('Invalid vendor ID', 400));
        if (typeof status !== 'string' || !['active', 'inactive'].includes(status)) {
            return next(new AppError('Invalid status value', 400));
        }

        const vendor = await VendorService.getVendorById(id, client);
        if (!vendor) return next(new AppError('Vendor not found', 404));

        const updateQuery = 'UPDATE vendors SET status = $1 WHERE id = $2 RETURNING *';
        const result = await client.query(updateQuery, [status, id]);
        const updatedVendor = result.rows[0];

        return sendResponse(res, 200, true, 'Vendor status updated', updatedVendor);
    } catch (err) {
        return next(new AppError(err.message || 'Failed to update vendor status', 500));
    } finally {
        client.release();
    }
});
