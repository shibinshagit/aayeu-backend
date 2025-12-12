const {
  getLuxuryToken,
  getLuxuryProduct,
  insertProducts,
} = require("./luxuryHelper");
const dbPool = require("../../../db/dbConnection");
const catchAsync = require("../../../errorHandling/catchAsync");
const sendResponse = require("../../../utils/sendResponse");
const AppError = require("../../../errorHandling/AppError");
const luxuryImportService = require("./LuxuryApiService");

/* module.exports.fetchAllLuxuryProducts = catchAsync(async (req, res, next) => {
const limit = 100; // ek call me 100 products
  let offset = 1;
  let totalFetched = 0;
  let totalProducts = 0;

  const token = await getLuxuryToken();
  const client = await dbPool.connect();

  try {
    console.log("🚀 Starting product sync from Luxury Distribution...");

    while (true) {
      const result = await getLuxuryProduct(offset, limit, token);
      console.log(result, "result");
      const { data, total } = result;

      if (!data || data.length === 0) break;

      totalProducts = total;
      console.log(`📦 Fetched: ${offset} - ${offset + limit - 1} / ${total}`);

      // await insertProducts(data, client);

      totalFetched += data.length;
      offset += limit;

      if (totalFetched >= total) break;
    }

    console.log("✅ All products fetched and inserted successfully!");
    return sendResponse(res, 200, true, "Luxury products synced successfully", {
      totalFetched,
      totalProducts,
    });
  } catch (err) {
    console.error("❌ Error syncing products:", err.message);
    return next(new AppError(err.message || "Failed to fetch luxury products", 500));
  } finally {
    client.release();
  }
}); */

module.exports.fetchAllLuxuryProducts = catchAsync(async (req, res, next) => {
  // currency, conversion_rate, increment_percent from frontend
  const { currency, conversion_rate, increment_percent } = req.body;

  if (!currency || typeof currency !== "string") {
    return next(new AppError("currency is required (e.g. EUR)", 400));
  }
  if (!conversion_rate || isNaN(conversion_rate)) {
    return next(new AppError("valid conversion_rate is required", 400));
  }
  if (!increment_percent || isNaN(increment_percent)) {
    return next(new AppError("valid increment_percent is required", 400));
  }

  const opts = {
    currency: currency.toUpperCase(),
    conversion_rate: parseFloat(conversion_rate),
    increment_percent: parseFloat(increment_percent),
  };

  // Background me sync run hoga – request turant return ho jayega
  setImmediate(async () => {
    try {
      await luxuryImportService.syncLuxuryProducts(opts);
    } catch (err) {
      console.error("❌ Luxury background sync error:", err.message || err);
    }
  });

  return sendResponse(
    res,
    202,
    true,
    "Luxury products sync started in background",
    {
      note: "Processing will continue in background. Check logs or DB for progress.",
    }
  );
});
