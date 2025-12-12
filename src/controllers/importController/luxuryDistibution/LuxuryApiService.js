// luxuryImportService.js
const { Pool } = require("pg");
const pino = require("pino");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
// require("dotenv").config({ path: "../../../../.env" });
require("dotenv").config({ path: "../../../../.env" });
const dbPool = require("../../../db/dbConnection");
// const dotenv = require("dotenv");

// dotenv.config();

const { getLuxuryToken, getLuxuryProduct } = require("./luxuryHelper"); // 👈 path adjust karna agar alag ho

const logger = pino({ level: process.env.IMPORT_LOG_LEVEL || "info" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_MAX_CLIENTS || "20", 10),
});

const LUXURY_VENDOR_ID = "65053474-4e40-44ee-941c-ef5253ea9fc9";

/* -------------------------
   Helpers: slugify / toJsonb
   ------------------------- */
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents hatao
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toJsonb(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/* -------------------------
   Price conversion helpers
   ------------------------- */

// vendor price → AED + increment
function convertToAED(value, conversionRate, incrementPercent) {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  const baseAED = num * Number(conversionRate);
  const inc = (baseAED * Number(incrementPercent)) / 100;
  return Number((baseAED + inc).toFixed(2));
}

// vendor price → AED (NO increment)
function convertToAEDWithoutIncrement(value, conversionRate) {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  const baseAED = num * Number(conversionRate);
  return Number(baseAED.toFixed(2));
}

/* -------------------------
   Ensure category path
   (Women > Shoes > Sneakers)
   ------------------------- */
async function ensureCategoryPath(client, categoryPath) {
  if (!categoryPath) return null;
  const parts = String(categoryPath)
    .split(/->|>|\/|>/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  let parentId = null;
  let parentPath = null;

  for (const part of parts) {
    const slug = slugify(part);
    const currentPath = parentPath ? `${parentPath}/${slug}` : slug;

    const found = await client.query(
      `SELECT id FROM categories WHERE path = $1 AND deleted_at IS NULL LIMIT 1`,
      [currentPath]
    );
    if (found.rowCount > 0) {
      parentId = found.rows[0].id;
      parentPath = currentPath;
      continue;
    }

    const id = uuidv4();
    const metadata = { created_via_import: true };

    const insertSql = `
      INSERT INTO categories (
        id, name, slug, parent_id, path, vendor_id, is_active, metadata, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,true,$7, now())
      RETURNING id
    `;
    const insertParams = [
      id,
      part,
      slug,
      parentId,
      currentPath,
      LUXURY_VENDOR_ID,
      JSON.stringify(metadata),
    ];
    const ins = await client.query(insertSql, insertParams);
    parentId = ins.rows[0].id;
    parentPath = currentPath;
  }

  return parentId;
}

/* -------------------------
   Transform Luxury API → { product, variants, category_path }
   ------------------------- */
function transformLuxuryProduct(api) {
  const {
    id,
    brand,
    year,
    variant,
    color_detail,
    color_supplier,
    made_in,
    material,
    name,
    description,
    size_info,
    size_quantity,
    qty,
    supplier,
    original_price,
    product_category_id,
    products_tags,
    brand_model_number,
    hs_code,
    ean,
    images = [],
    sku,
    category_string,
    gender,
    season_one,
    season_two,
    selling_price,
    cost,
  } = api;

  // build size map & variants (C: per-size variants + size map in product_meta)
  const sizeQuantityMap = {};
  const variants = [];

  if (Array.isArray(size_quantity)) {
    for (const entry of size_quantity) {
      if (!entry || typeof entry !== "object") continue;
      const size = Object.keys(entry)[0];
      const rawQty = entry[size];
      const stock = Number(rawQty || 0);
      sizeQuantityMap[size] = stock;

      // we still create variant even if stock = 0
      const variantSku = `${sku}-${size}`;

      variants.push({
        sku: variantSku,
        vendor_product_id: String(id),
        variant_size: size,
        variant_color: color_detail || null,
        stock,
        price: selling_price, // raw vendor selling price (currency from API)
        vendormrp: original_price, // raw vendor MRP
        vendorsaleprice: selling_price, // raw vendor sale price (or cost)
        ourmrp: null,
        oursaleprice: null,
        tax: null,
        tax1: null,
        tax2: null,
        tax3: null,
        country_of_origin: made_in || null,
        is_active: true,
        normalized_size: size,
        normalized_color: color_detail || null,
        size_type: size_info || null,
        images, // same image array per variant
        attributes: {
          size,
          color: color_detail,
          year,
          material,
        },
        dimension: null,
        length: null,
        width: null,
        height: null,
        video1: null,
        video2: null,
      });
    }
  }

  const genderName = gender?.name || null;
  const season1 = season_one?.name || null;
  const season2 = season_two?.name || null;

  const product_meta = {
    year,
    color_detail,
    color_supplier,
    made_in,
    material,
    size_info,
    size_quantity_map: sizeQuantityMap,
    total_qty: qty,
    supplier,
    original_price,
    selling_price,
    cost,
    product_category_id,
    products_tags,
    brand_model_number,
    hs_code,
    ean,
    season_one: season1,
    season_two: season2,
  };

  const attributes = {
    brand,
    gender: genderName,
    category_string,
    color: color_detail,
    season_one: season1,
    season_two: season2,
  };

  const productImages = images || [];
  const [img0, img1, img2, img3, img4, img5] = productImages;

  const product = {
    productid: String(id),
    product_sku: sku,
    name,
    title: `${brand || ""} ${name || ""}`.trim(),
    short_description: null,
    description: description || null,
    brand_name: brand || null,
    gender: genderName,
    attributes,
    product_meta,
    sizechart_text: null,
    sizechart_image: null,
    shipping_returns_payments: null,
    environmental_impact: null,
    product_img: img0 || null,
    product_img1: img1 || null,
    product_img2: img2 || null,
    product_img3: img3 || null,
    product_img4: img4 || null,
    product_img5: img5 || null,
    videos: null,
    delivery_time: null,
    cod_available: true,
    supplier: supplier ? String(supplier) : null,
    country_of_origin: made_in || null,
    is_active: true,
  };

  const category_path = category_string || null;

  return { product, variants, category_path };
}

/* -------------------------
   Upsert product + variants
   opts: { currency, conversion_rate, increment_percent }
   ------------------------- */
async function upsertProductAndVariant(client, transformed, opts = {}) {
  await client.query("BEGIN");
  try {
    const { product, variants = [], category_path } = transformed;

    let defaultCategoryId = null;
    if (category_path) {
      defaultCategoryId = await ensureCategoryPath(client, category_path);
    }

    // find existing product ONLY by product_sku (as you asked)
    let existing = null;
    if (product.product_sku) {
      const res = await client.query(
        "SELECT id FROM products WHERE product_sku = $1 AND deleted_at IS NULL",
        [product.product_sku]
      );
      if (res.rowCount) existing = res.rows[0];
    }

    let productId = existing ? existing.id : uuidv4();

    if (existing) {
      // update important fields (name, desc, brand, images, meta, attributes, category, supplier, etc.)
      await client.query(
        `
        UPDATE products SET
          name = $1,
          title = $2,
          short_description = $3,
          description = $4,
          brand_name = $5,
          gender = $6,
          default_category_id = $7,
          attributes = $8::jsonb,
          product_meta = $9::jsonb,
          product_img = $10,
          product_img1 = $11,
          product_img2 = $12,
          product_img3 = $13,
          product_img4 = $14,
          product_img5 = $15,
          supplier = $16,
          country_of_origin = $17,
          updated_at = now()
        WHERE id = $18
      `,
        [
          product.name,
          product.title,
          product.short_description,
          product.description,
          product.brand_name,
          product.gender,
          defaultCategoryId,
          toJsonb(product.attributes),
          toJsonb(product.product_meta),
          product.product_img,
          product.product_img1,
          product.product_img2,
          product.product_img3,
          product.product_img4,
          product.product_img5,
          product.supplier,
          product.country_of_origin,
          productId,
        ]
      );
    } else {
      // insert new product
      const insertProductSql = `
        INSERT INTO products (
          id, vendor_id, productid, product_sku, productpartnersku, name, title,
          short_description, description, brand_name, gender, default_category_id, attributes,
          product_meta, sizechart_text, sizechart_image, shipping_returns_payments, environmental_impact,
          product_img, videos, delivery_time, cod_available, supplier, country_of_origin, is_active, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13::jsonb,$14::jsonb,$15,$16,$17::jsonb,$18::jsonb,
          $19,$20::jsonb,$21,$22,$23,$24,$25, now(), now()
        ) RETURNING id
      `;
      const vals = [
        productId,
        LUXURY_VENDOR_ID,
        product.productid || null,
        product.product_sku || null,
        null,
        product.name,
        product.title || null,
        product.short_description || null,
        product.description || null,
        product.brand_name || null,
        product.gender || null,
        defaultCategoryId || null,
        toJsonb(product.attributes || null),
        toJsonb(product.product_meta || null),
        product.sizechart_text || null,
        product.sizechart_image || null,
        toJsonb(product.shipping_returns_payments || null),
        toJsonb(product.environmental_impact || null),
        product.product_img || null,
        toJsonb(product.videos || null),
        product.delivery_time || null,
        product.cod_available !== undefined ? product.cod_available : true,
        product.supplier || null,
        product.country_of_origin || null,
        product.is_active !== undefined ? product.is_active : true,
      ];
      const ins = await client.query(insertProductSql, vals);
      productId = ins.rows[0].id;
    }

    // VARIANTS
    const createdVariants = [];

    for (const v of variants) {
      if (!v.sku) {
        v.sku = `${product.product_sku || productId}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
      }

      const rawVendorMrp = v.vendormrp ?? null;
      const rawVendorSale = v.vendorsaleprice ?? v.price ?? null;

      const convertedMrp = convertToAED(
        rawVendorMrp,
        opts.conversion_rate,
        opts.increment_percent
      );
      const convertedSale = convertToAED(
        rawVendorSale,
        opts.conversion_rate,
        opts.increment_percent
      );

      const vmrp_to_aed = convertToAEDWithoutIncrement(
        rawVendorMrp,
        opts.conversion_rate
      );
      const vsale_to_aed = convertToAEDWithoutIncrement(
        rawVendorSale,
        opts.conversion_rate
      );

      const varRes = await client.query(
        "SELECT id FROM product_variants WHERE sku = $1 AND product_id = $2 AND deleted_at IS NULL",
        [v.sku, productId]
      );

      if (varRes.rowCount) {
        const vid = varRes.rows[0].id;
        await client.query(
          `
          UPDATE product_variants SET
            vendor_id        = $1,
            vendormrp        = $2,
            vendorsaleprice  = $3,
            mrp              = $4,
            sale_price       = $5,
            vmrp_to_aed      = $6,
            vsale_to_aed     = $7,
            currency         = COALESCE($8, currency),
            conversion_rate  = COALESCE($9, conversion_rate),
            price            = $10,
            stock            = $11,
            weight           = $12,
            attributes       = $13,
            images           = $14,
            variant_color    = $15,
            variant_size     = $16,
            country_of_origin= $17,
            normalized_size  = $18,
            normalized_color = $19,
            size_type        = $20,
            updated_at       = now()
          WHERE id = $21
        `,
          [
            LUXURY_VENDOR_ID,
            rawVendorMrp || null,
            rawVendorSale || null,
            convertedMrp,
            convertedSale,
            vmrp_to_aed,
            vsale_to_aed,
            opts.currency || null,
            opts.conversion_rate || null,
            v.price || rawVendorSale || null,
            v.stock || 0,
            v.weight || null,
            toJsonb(v.attributes || null),
            toJsonb(v.images || null),
            v.variant_color || null,
            v.variant_size || null,
            v.country_of_origin || null,
            v.normalized_size || v.variant_size || null,
            v.normalized_color || v.variant_color || null,
            v.size_type || null,
            vid,
          ]
        );
        createdVariants.push({ id: vid, sku: v.sku, updated: true });
      } else {
        const variantId = uuidv4();

        const variantInsertText = `
          INSERT INTO product_variants (
            id, vendor_id, product_id, sku, barcode, vendor_product_id, productpartnersku,
            price, mrp, sale_price, stock, weight, dimension,
            length, width, height, attributes, images, image_urls,
            video1, video2, vendormrp, vendorsaleprice, ourmrp, oursaleprice,
            tax, tax1, tax2, tax3, variant_color, variant_size,
            country_of_origin, is_active, normalized_size, normalized_color, size_type,
            currency, conversion_rate, vmrp_to_aed, vsale_to_aed, created_at, updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13::jsonb,
            $14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,
            $20,$21,$22,$23,$24,$25,$26::jsonb,$27,$28,$29,$30,$31,$32,
            $33,$34,$35,$36,$37,$38,$39,$40, now(), now()
          ) RETURNING id
        `;

        const variantVals = [
          variantId, // $1
          LUXURY_VENDOR_ID, // $2
          productId, // $3
          v.sku, // $4
          v.barcode || null, // $5
          v.vendor_product_id || product.productid || null, // $6
          null, // $7 productpartnersku
          v.price || rawVendorSale || null, // $8 price (vendor currency)
          convertedMrp, // $9 mrp (AED + inc)
          convertedSale, // $10 sale_price (AED + inc)
          v.stock || 0, // $11 stock
          v.weight || null, // $12 weight
          toJsonb(v.dimension || null), // $13 dimension
          v.length || null, // $14
          v.width || null, // $15
          v.height || null, // $16
          toJsonb(v.attributes || null), // $17 attributes
          toJsonb(v.images || null), // $18 images
          null, // $19 image_urls
          v.video1 || null, // $20
          v.video2 || null, // $21
          rawVendorMrp || null, // $22 vendormrp
          rawVendorSale || null, // $23 vendorsaleprice
          v.ourmrp || null, // $24 ourmrp
          v.oursaleprice || null, // $25 oursaleprice
          toJsonb(v.tax || null), // $26 tax
          v.tax1 || null, // $27
          v.tax2 || null, // $28
          v.tax3 || null, // $29
          v.variant_color || null, // $30
          v.variant_size || null, // $31
          v.country_of_origin || null, // $32
          v.is_active !== undefined ? v.is_active : true, // $33
          v.normalized_size || v.variant_size || null, // $34
          v.normalized_color || v.variant_color || null, // $35
          v.size_type || null, // $36
          opts.currency || null, // $37
          opts.conversion_rate || null, // $38
          vmrp_to_aed, // $39
          vsale_to_aed, // $40
        ];

        const inVar = await client.query(variantInsertText, variantVals);
        createdVariants.push({
          id: inVar.rows[0].id,
          sku: v.sku,
          created: true,
        });

        if (v.stock && Number(v.stock) > 0) {
          await client.query(
            `
            INSERT INTO inventory_transactions (id, variant_id, change, reason, reference_id, created_at)
            VALUES ($1,$2,$3,$4,$5, now())
          `,
            [uuidv4(), inVar.rows[0].id, v.stock, "initial_import_luxury", null]
          );
        }
      }
    }

    // Product → category link
    if (defaultCategoryId) {
      const exists = await client.query(
        "SELECT id FROM product_categories WHERE product_id = $1 AND category_id = $2 AND deleted_at IS NULL",
        [productId, defaultCategoryId]
      );
      if (exists.rowCount === 0) {
        await client.query(
          "INSERT INTO product_categories (id, product_id, category_id, vendor_id) VALUES ($1,$2,$3,$4)",
          [uuidv4(), productId, defaultCategoryId, LUXURY_VENDOR_ID]
        );
      }
    }

    // Dynamic filters
    const dyns = [];
    if (product.brand_name)
      dyns.push({ filter_type: "brand", filter_name: product.brand_name });

    const firstVar = variants[0] || {};
    if (firstVar.variant_color)
      dyns.push({ filter_type: "color", filter_name: firstVar.variant_color });
    if (firstVar.variant_size)
      dyns.push({ filter_type: "size", filter_name: firstVar.variant_size });

    for (const df of dyns) {
      const ex = await client.query(
        "SELECT id FROM product_dynamic_filters WHERE product_id = $1 AND filter_type = $2 AND filter_name = $3 AND deleted_at IS NULL",
        [productId, df.filter_type, df.filter_name]
      );
      if (ex.rowCount === 0) {
        await client.query(
          "INSERT INTO product_dynamic_filters (id, product_id, filter_type, filter_name, vendor_id) VALUES ($1,$2,$3,$4,$5)",
          [
            uuidv4(),
            productId,
            df.filter_type,
            df.filter_name,
            LUXURY_VENDOR_ID,
          ]
        );
      }
    }

    // MEDIA
    const skuToVariantId = new Map();
    for (const cv of createdVariants) {
      if (cv && cv.id && cv.sku) skuToVariantId.set(cv.sku, cv.id);
    }
    const existingVars = await client.query(
      "SELECT id, sku FROM product_variants WHERE product_id = $1 AND deleted_at IS NULL",
      [productId]
    );
    for (const row of existingVars.rows) {
      if (!skuToVariantId.has(row.sku)) skuToVariantId.set(row.sku, row.id);
    }

    async function upsertMediaRow({
      url,
      variant_id = null,
      type = "image",
      name = null,
      metadata = {},
    }) {
      const { rows: exist } = await client.query(
        `SELECT id FROM media WHERE url = $1 AND (variant_id IS NOT DISTINCT FROM $2) AND deleted_at IS NULL LIMIT 1`,
        [url, variant_id]
      );
      if (exist.length > 0) return exist[0].id;

      const mediaId = uuidv4();
      await client.query(
        `INSERT INTO media (id, name, variant_id, url, type, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())`,
        [
          mediaId,
          name,
          variant_id,
          url,
          type,
          toJsonb(
            Object.assign({ imported: true, product_id: productId }, metadata)
          ),
        ]
      );
      return mediaId;
    }

    // variant-level images
    for (const v of variants) {
      const imageUrls = Array.isArray(v.images)
        ? v.images
        : v.images
        ? typeof v.images === "string"
          ? [v.images]
          : []
        : [];

      if (!imageUrls.length) continue;
      const vid = skuToVariantId.get(v.sku) || null;

      for (const url of imageUrls) {
        if (!url) continue;
        try {
          await upsertMediaRow({
            url,
            variant_id: vid,
            type: "image",
            metadata: { variant_sku: v.sku },
          });
        } catch (e) {
          logger.error(
            { err: e.message || e, url },
            "media insert error (variant)"
          );
        }
      }
    }

    // product-level images
    const productImageUrls = [
      product.product_img,
      product.product_img1,
      product.product_img2,
      product.product_img3,
      product.product_img4,
      product.product_img5,
    ].filter(Boolean);

    for (const url of productImageUrls) {
      if (!url) continue;
      const { rows: already } = await client.query(
        `SELECT id FROM media WHERE url = $1 AND deleted_at IS NULL LIMIT 1`,
        [url]
      );
      if (already.length > 0) continue;

      try {
        await upsertMediaRow({
          url,
          variant_id: null,
          type: "image",
          metadata: {},
        });
      } catch (e) {
        logger.error(
          { err: e.message || e, url },
          "media insert error (product)"
        );
      }
    }

    await client.query("COMMIT");
    return { ok: true, productId, variants: createdVariants };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

/* -------------------------
   MAIN Sync function
   opts: { currency, conversion_rate, increment_percent }
   ------------------------- */
async function syncLuxuryProducts(opts) {
  let page = 1;
  const limit = 100;
  let totalFetched = 0;
  let totalProducts = 0;

  const token = await getLuxuryToken();
  console.log("Luxury token obtained");
  const client = await dbPool.connect();

  try {
    logger.info("🚀 Starting Luxury Distribution product sync...");
    console.log("🚀 Starting Luxury Distribution product sync...");

    while (true) {
      const result = await getLuxuryProduct(page, limit, token);
      const { data, total } = result;

      if (!data || data.length === 0) break;

      totalProducts = total;

      logger.info(
        {
          page,
          count: data.length,
          total,
        },
        "📦 Fetched product page from Luxury"
      );

      for (const item of data) {
        try {
          const transformed = transformLuxuryProduct(item);
          await upsertProductAndVariant(client, transformed, opts);
          totalFetched += 1;
        } catch (e) {
          logger.error(
            { product_id: item.id, sku: item.sku, err: e.message },
            "❌ Insert/Update error"
          );
        }
      }

      page += 1;

      if (totalFetched >= total) break;
    }

    logger.info(
      { totalFetched, totalProducts },
      "✅ Luxury products synced successfully"
    );

    return { totalFetched, totalProducts };
  } finally {
    client.release();
  }
}

module.exports = {
  syncLuxuryProducts,
};
