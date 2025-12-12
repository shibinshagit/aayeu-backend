// cron/productImageValidator.js
const cron = require('node-cron');
const axios = require('axios');
const dbPool = require('../db/dbConnection'); // adjust path as per your structure

// 🧠 Helper: check image URL status
async function isImageAccessible(url) {
    try {
        const res = await axios.head(url, { timeout: 7000, validateStatus: () => true });
        if (res.status >= 200 && res.status < 400) {
            return true; // accessible
        }
        console.log(`⚠️ Image not accessible (status ${res.status}) for: ${url}`);
        return false;
    } catch (err) {
        console.log(`❌ Error checking image ${url}: ${err.message}`);
        return false;
    }
}

// 🧠 Core function: check and mark products
async function validateProductImages() {
    console.log('🕒 Cron started: checking product images...');

    const client = await dbPool.connect();
    try {
        // Fetch products that are not deleted and have product_img
        const { rows: products } = await client.query(`
            SELECT id, product_img 
            FROM products 
            WHERE deleted_at IS NULL AND product_img IS NOT NULL
        `);

        console.log(`Found ${products.length} products to check.`);

        for (const product of products) {
            const accessible = await isImageAccessible(product.product_img);
            if (!accessible) {
                await client.query(
                    `UPDATE products SET deleted_at = now() WHERE id = $1`,
                    [product.id]
                );
                console.log(`🗑️ Marked deleted: ${product.id}`);
            }
        }

        console.log('✅ Image validation completed.');
    } catch (err) {
        console.error('❌ Error during cron:', err.message);
    } finally {
        client.release();
    }
}

// 🕓 Schedule cron to run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    // await validateProductImages();
});

// Optionally run once at startup
// validateProductImages();

module.exports = { validateProductImages };
