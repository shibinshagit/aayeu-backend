// controllers/userController/orderController.js
const catchAsync = require("../../errorHandling/catchAsync");
const dbPool = require("../../db/dbConnection");
const OrderService = require("../../services/orderService");
const sendResponse = require("../../utils/sendResponse");
const AppError = require("../../errorHandling/AppError");

module.exports.getUserPaidOrders = catchAsync(async (req, res, next) => {
  const client = await dbPool.connect();
  try {
    const user_id = req.user?.id;
    if (!user_id) return next(new AppError("Unauthorized", 401));

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "20", 10))
    );
    const offset = (page - 1) * limit;

    // optional filters
    const { from_date, to_date, order_status } = req.query;
    // order_status defaults to 'paid' or you can pass 'completed' etc.
    const statusFilter = order_status || "paid";

    const { total, orders } = await OrderService.getUserPaidOrders(
      {
        user_id,
        page,
        limit,
        offset,
        status: statusFilter,
        from_date: from_date || null,
        to_date: to_date || null,
      },
      client
    );

    const total_pages = Math.max(1, Math.ceil(total / limit));

    return sendResponse(res, 200, true, "Paid orders fetched", {
      total,
      page,
      limit,
      total_pages,
      orders,
    });
  } catch (err) {
    return next(err);
  } finally {
    client.release();
  }
});

module.exports.getUserOrderById = catchAsync(async (req, res, next) => {
  const client = await dbPool.connect();
  try {
    const user_id = req.user?.id;
    if (!user_id) return next(new AppError("Unauthorized", 401));

    const id = req.query.orderId;
    if (!id) return next(new AppError("Order id required", 400));

    const order = await OrderService.getUserOrderById(
      { user_id, order_id: id },
      client
    );
    if (!order) return next(new AppError("Order not found", 404));

    return sendResponse(res, 200, true, "Order fetched", order);
  } catch (err) {
    return next(err);
  } finally {
    client.release();
  }
});

module.exports.downloadInvoiceHtml = catchAsync(async (req, res, next) => {
  const client = await dbPool.connect();
  try {
    const user_id = req.user?.id;
    if (!user_id) return next(new AppError("Unauthorized", 401));

    const orderId = req.query.orderId;
    if (!orderId) return next(new AppError("Order ID required", 400));

    let pdfPath = await OrderService.getOrGenerateInvoice(
      { user_id, order_id: orderId },
      client,
      res
    );

    const fileName = `invoice_${orderId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.download(pdfPath, fileName, (err) => {
      if (err) {
        return next(new AppError("Error downloading the invoice", 500));
      }
    });
  } catch (err) {
    return next(err);
  } finally {
    client.release();
  }
});
