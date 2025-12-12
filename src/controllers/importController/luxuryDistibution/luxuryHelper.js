// luxuryHelper.js
const axios = require("axios");
require("dotenv").config({ path: "../../../../.env" });
const { v4: uuidv4 } = require("uuid");

async function getLuxuryToken() {
  const url = `${process.env.LUXURY_DISTRIBUTION_API_URL}/v1/token`;

  const headers = {
    "key": process.env.LUXURY_DISTRIBUTION_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const body = {
    credentials: {
      username: process.env.LUXURY_DISTRIBUTION_USERNAME,
      identifier: process.env.LUXURY_DISTRIBUTION_IDENTIFIER
    }
  };

  try {
    const response = await axios.post(url, body, { headers });

    const token =
      response.data?.token ||
      response.data?.access_token ||
      response.data?.data?.token;

    if (!token) {
      throw new Error("Token not found in API response");
    }

    console.log("🔑 Luxury Distribution Token:", token);
    return token;
  } catch (err) {
    throw err;
  }
}

const getLuxuryProduct = async (offset, limit, token) => {
  const url = process.env.LUXURY_DISTRIBUTION_API_URL;
  const endpoint = `${url}/v2/stocks?offset=${offset}&limit=${limit}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await axios.get(endpoint, { headers });
  // Destructure karlo for clean use
  const { data, total } = res.data.data;

  return { data, total };
};




// async function insertProducts(products , client) {
//   if (!Array.isArray(products) || products.length === 0) {
//     console.log("⚠️ No products to insert");
//     return;
//   }

//   try {
//     await client.query("BEGIN");

//     for (const p of products) {
//       const id = uuidv4();

//       // check duplicate by supplier_product_id
//       const existsCheck = await client.query(
//         `SELECT id FROM luxury_products WHERE supplier_product_id = $1`,
//         [p.id]
//       );

//       if (existsCheck.rowCount > 0) {
//         console.log(`🔁 Product ${p.id} already exists, skipping`);
//         continue;
//       }

//       const query = `
//         INSERT INTO luxury_products (
//           id, supplier_product_id, brand, year, variant, color_detail, color_supplier, 
//           made_in, material, name, description, size_info, bag_length, bag_height, 
//           bag_weight, handle_height, shoulder_bag_length, belt_length, belt_height, 
//           accessory_length, accessory_height, accessory_weight, heel_height, 
//           plateau_height, insole_length, size_and_fit, ean, qty, supplier, 
//           original_price, product_category_id, brand_model_number, hs_code, sku, 
//           category_string, selling_price, cost, images, size_quantity, products_tags, 
//           gender, season_one, season_two, created_at, updated_at
//         )
//         VALUES (
//           $1, $2, $3, $4, $5, $6, $7,
//           $8, $9, $10, $11, $12, $13, $14,
//           $15, $16, $17, $18, $19, $20,
//           $21, $22, $23, $24, $25, $26,
//           $27, $28, $29, $30, $31, $32,
//           $33, $34, $35, $36, $37, $38,
//           $39, $40, $41, $42, $43, $44
//         )
//       `;

//       const values = [
//         id,                              // our UUID
//         p.id,                            // supplier product id
//         p.brand,
//         p.year,
//         p.variant,
//         p.color_detail,
//         p.color_supplier,
//         p.made_in,
//         p.material,
//         p.name,
//         p.description,
//         p.size_info,
//         p.bag_length || 0,
//         p.bag_height || 0,
//         p.bag_weight || 0,
//         p.handle_height || 0,
//         p.shoulder_bag_length || 0,
//         p.belt_length || 0,
//         p.belt_height || 0,
//         p.accessory_length || 0,
//         p.accessory_height || 0,
//         p.accessory_weight || 0,
//         p.heel_height || 0,
//         p.plateau_height || 0,
//         p.insole_length || 0,
//         p.size_and_fit,
//         p.ean,
//         p.qty,
//         p.supplier,
//         p.original_price,
//         p.product_category_id,
//         p.brand_model_number,
//         p.hs_code,
//         p.sku,
//         p.category_string,
//         p.selling_price,
//         p.cost,
//         JSON.stringify(p.images || []),
//         JSON.stringify(p.size_quantity || []),
//         JSON.stringify(p.products_tags || []),
//         JSON.stringify(p.gender || {}),
//         JSON.stringify(p.season_one || {}),
//         JSON.stringify(p.season_two || {}),
//         new Date(),
//         new Date()
//       ];

//       await client.query(query, values);
//       console.log(`✅ Inserted product: ${p.name}`);
//     }

//     await client.query("COMMIT");
//     console.log("🎯 All new products inserted successfully");
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("❌ Error inserting products:", err.message);
//   } 
// }



async function insertProducts(products, client) {
  if (!Array.isArray(products) || products.length === 0) {
    console.log("⚠️ No products to insert");
    return;
  }

  try {
    await client.query("BEGIN");

    for (const p of products) {
      const id = uuidv4();

      // check duplicate
      const exists = await client.query(
        `SELECT id FROM luxury_products WHERE supplier_product_id = $1`,
        [p.id]
      );
      if (exists.rowCount > 0) {
        console.log(`🔁 Product ${p.id} already exists, skipping`);
        continue;
      }

      const query = `
        INSERT INTO luxury_products (
          supplier_product_id, brand, year, variant, color_detail, color_supplier, 
          made_in, material, name, description, size_info, bag_length, bag_height, 
          bag_weight, handle_height, shoulder_bag_length, belt_length, belt_height, 
          accessory_length, accessory_height, accessory_weight, heel_height, 
          plateau_height, insole_length, size_and_fit, ean, qty, supplier, 
          original_price, product_category_id, brand_model_number, hs_code, sku, 
          category_string, selling_price, cost, images, size_quantity, products_tags, 
          gender, season_one, season_two, created_at, updated_at, id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32,
          $33, $34, $35, $36, $37, $38,
          $39, $40, $41, $42, $43, $44, $45
        )
      `;

      const values = [
        p.id, // supplier_product_id
        p.brand,
        p.year,
        p.variant,
        p.color_detail,
        p.color_supplier,
        p.made_in,
        p.material,
        p.name,
        p.description,
        p.size_info,
        p.bag_length || 0,
        p.bag_height || 0,
        p.bag_weight || 0,
        p.handle_height || 0,
        p.shoulder_bag_length || 0,
        p.belt_length || 0,
        p.belt_height || 0,
        p.accessory_length || 0,
        p.accessory_height || 0,
        p.accessory_weight || 0,
        p.heel_height || 0,
        p.plateau_height || 0,
        p.insole_length || 0,
        p.size_and_fit,
        p.ean,
        p.qty,
        p.supplier,
        p.original_price,
        p.product_category_id,
        p.brand_model_number,
        p.hs_code,
        p.sku,
        p.category_string,
        p.selling_price,
        p.cost,
        JSON.stringify(p.images || []),
        JSON.stringify(p.size_quantity || []),
        JSON.stringify(p.products_tags || []),
        JSON.stringify(p.gender || {}),
        JSON.stringify(p.season_one || {}),
        JSON.stringify(p.season_two || {}),
        new Date(),
        new Date(),
        id, // our UUID last
      ];

      await client.query(query, values);
      console.log(`✅ Inserted product: ${p.name}`);
    }

    await client.query("COMMIT");
    console.log("🎯 All new products inserted successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error inserting products:", err.message);
  }
}


module.exports = {
  getLuxuryToken,
  getLuxuryProduct,
  insertProducts
}; 