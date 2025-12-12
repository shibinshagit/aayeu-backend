// migrationFiles.js
var migrationFiles = [
  `-- Admins
CREATE TABLE IF NOT EXISTS admins(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'superadmin',
    is_active BOOLEAN DEFAULT true,
    magic_token TEXT,
    magic_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
`,

  `-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(150),
  password_hash TEXT,
  full_name VARCHAR(120),
  magic_token TEXT,
  magic_token_expires TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
`,

  `-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60),
  street TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  postal_code VARCHAR(30),
  country VARCHAR(80),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  mobile VARCHAR(30),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses(is_default);
`,

  `-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  contact_email VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_vendors_slug ON vendors(slug);
`,

  `-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pid BIGSERIAL, -- optional short numeric id
  vendor_id UUID REFERENCES vendors(id),
  productid VARCHAR(255), -- external product id
  product_sku VARCHAR(255) UNIQUE, -- product level SKU (may be same as variant sku or a master sku)
  productpartnersku VARCHAR(255), -- partner/vendor SKU
  name VARCHAR(512) NOT NULL,
  title VARCHAR(512),
  short_description TEXT,
  description TEXT,
  brand_name VARCHAR(255),
  gender VARCHAR(50),
  default_category_id UUID,
  attributes JSONB, -- flexible attributes
  product_meta JSONB,
  sizechart_text TEXT,
  sizechart_image VARCHAR(1024),
  shipping_returns_payments JSONB,
  environmental_impact JSONB,
  product_img VARCHAR(1024),
  product_img1 VARCHAR(1024),
  product_img2 VARCHAR(1024),
  product_img3 VARCHAR(1024),
  product_img4 VARCHAR(1024),
  product_img5 VARCHAR(1024),
  videos JSONB, -- array of video URLs
  delivery_time VARCHAR(128),
  cod_available BOOLEAN DEFAULT false,
  supplier VARCHAR(255),
  country_of_origin VARCHAR(128),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_name);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_productid ON products(productid);
`,

  `-- Product variants
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pid BIGSERIAL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(255) NOT NULL UNIQUE,
  barcode VARCHAR(128),
  vendor_product_id VARCHAR(255),
  productpartnersku VARCHAR(255),
  price NUMERIC(12,2) NOT NULL,
  mrp NUMERIC(12,2),
  sale_price NUMERIC(12,2),
  stock BIGINT DEFAULT 0,
  weight NUMERIC(10,3),
  dimension JSONB, -- {length, width, height} OR you can keep separate numeric columns
  length NUMERIC(10,3),
  width NUMERIC(10,3),
  height NUMERIC(10,3),
  attributes JSONB,
  images JSONB,
  image_urls JSONB,
  video1 VARCHAR(1024),
  video2 VARCHAR(1024),
  vendormrp NUMERIC(12,2),
  vendorsaleprice NUMERIC(12,2),
  ourmrp NUMERIC(12,2),
  oursaleprice NUMERIC(12,2),
  tax JSONB, -- {tax1:.., tax2:.., tax3:..}
  tax1 NUMERIC(8,2),
  tax2 NUMERIC(8,2),
  tax3 NUMERIC(8,2),
  variant_color VARCHAR(128),
  variant_size VARCHAR(128),
  country_of_origin VARCHAR(128),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_price ON product_variants(price);
CREATE INDEX IF NOT EXISTS idx_variants_stock ON product_variants(stock);
CREATE INDEX IF NOT EXISTS idx_variants_variant_color ON product_variants(variant_color);
CREATE INDEX IF NOT EXISTS idx_variants_variant_size ON product_variants(variant_size);
`,

  `-- Media
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  variant_id UUID REFERENCES product_variants(id),
  url TEXT NOT NULL,
  type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
`,

  `-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  lft INT,
  rgt INT,
  path TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
`,

  `-- Product categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON product_categories(category_id);
`,

  `-- Product dynamic filters
CREATE TABLE IF NOT EXISTS product_dynamic_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  filter_type VARCHAR(100),
  filter_name VARCHAR(255),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_dynamic_filters_product_id ON product_dynamic_filters(product_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_filters_type_name ON product_dynamic_filters(filter_type, filter_name);
`,

  `-- Inventory transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  change BIGINT NOT NULL,
  reason VARCHAR(255),
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON inventory_transactions(variant_id);
`,

  `-- Carts & cart_items
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  qty INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);
`,

  `-- Orders & order_items
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(128) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  vendor_id UUID REFERENCES vendors(id),
  total_amount NUMERIC(12,2),
  payment_status VARCHAR(50),
  order_status VARCHAR(50),
  shipping_address JSONB,
  billing_address JSONB,
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  qty INT NOT NULL,
  price NUMERIC(12,2),
  vendor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
`,

  `-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2),
  method VARCHAR(50),
  provider_response JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
`,

  `-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE,
  description TEXT,
  discount_type VARCHAR(50),
  discount_value NUMERIC(12,2),
  min_order_value NUMERIC(12,2),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  usage_limit INT,
  used_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON coupons(valid_from, valid_to);
`,

  `-- Wallets & wallet_transactions
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  balance NUMERIC(14,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  change NUMERIC(14,2),
  type VARCHAR(100),
  reference JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
`,

  `-- Product import runs
CREATE TABLE IF NOT EXISTS product_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(512),
  vendor_id UUID,
  status VARCHAR(50),
  summary JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_runs_vendor_id ON product_import_runs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON product_import_runs(status);
`,

  `-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255),
  record_id UUID,
  action VARCHAR(50),
  payload JSONB,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON audit_logs(table_name, action);
`,

  `-- Magic links
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_used ON magic_links(expires_at, used);
`,

  `-- 1_create_best_sellers.sql
CREATE TABLE IF NOT EXISTS best_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NULL REFERENCES vendors(id),
  rank INT DEFAULT NULL,                -- optional ordering (1 = top)
  meta JSONB DEFAULT '{}'::jsonb,       -- free-form metadata (promo text, badge, etc)
  active BOOLEAN DEFAULT true,
  start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- when to start showing
  end_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,   -- optional end
  created_by UUID NULL,                 -- admin id who added it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_best_sellers_product ON best_sellers(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_best_sellers_rank ON best_sellers(rank);
CREATE INDEX IF NOT EXISTS idx_best_sellers_active_dates ON best_sellers(active, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_best_sellers_vendor_id ON best_sellers(vendor_id);
`,

  `-- 2025xx_create_brand_spotlights.sql
CREATE TABLE IF NOT EXISTS brand_spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name VARCHAR(255) NOT NULL,      -- canonical brand label (searchable)
  vendor_id UUID NULL,                   -- optional vendor associated with brand
  meta JSONB DEFAULT '{}'::jsonb,        -- e.g. { badge, promo_text, hero_image }
  rank INT DEFAULT NULL,                 -- ordering (lower = higher)
  active BOOLEAN DEFAULT true,
  start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_by UUID NULL,                  -- admin id who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_brand_spotlights_brand ON brand_spotlights(brand_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_spotlights_rank ON brand_spotlights(rank);
CREATE INDEX IF NOT EXISTS idx_brand_spotlights_active_dates ON brand_spotlights(active, start_at, end_at);
`,

  `-- 2025xx_create_new_arrivals.sql
CREATE TABLE IF NOT EXISTS new_arrivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank INT DEFAULT NULL,                -- ordering, lower = earlier in list
  meta JSONB DEFAULT '{}'::jsonb,       -- { badge, promo_text, note }
  active BOOLEAN DEFAULT true,
  start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,  -- scheduling window optional
  end_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_new_arrivals_product_id ON new_arrivals(product_id);
CREATE INDEX IF NOT EXISTS idx_new_arrivals_rank ON new_arrivals(rank);
CREATE INDEX IF NOT EXISTS idx_new_arrivals_active_dates ON new_arrivals(active, start_at, end_at);
`,

  `
CREATE TABLE IF NOT EXISTS home_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,               -- 'brand_spotlight' | 'new_arrivals' | 'best_seller' | 'sale'
  label TEXT,                             -- human friendly label
  active BOOLEAN DEFAULT FALSE,
  meta JSONB DEFAULT '{}'::jsonb,         -- optional UI settings (title, subtitle, layout, limit, etc.)
  rank INT DEFAULT NULL,                  -- ordering for frontend
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_home_sections_key ON home_sections(key);
CREATE INDEX IF NOT EXISTS idx_home_sections_active ON home_sections(active);

-- Seed default rows if not present
INSERT INTO home_sections (key, label, active, meta, rank)
SELECT v.k, v.l, v.a, v.m::jsonb, v.r
FROM (VALUES
  ('brand_spotlight','Brand Spotlights', TRUE, '{"title":"Featured Brands","limit":4}'::text, 1),
  ('new_arrivals','New Arrivals', TRUE, '{"title":"New This Week","limit":12}'::text, 2),
  ('best_seller','Best Sellers', TRUE, '{"title":"Top Selling","limit":8}'::text, 3),
  ('sale','Sale', TRUE, '{"title":"On Sale","limit":12}'::text, 4)
) v(k,l,a,m,r)
WHERE NOT EXISTS (SELECT 1 FROM home_sections s WHERE s.key = v.k);
`,

  `CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank INT DEFAULT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  discount_percent NUMERIC(5,2) DEFAULT 0, -- <== important
  active BOOLEAN DEFAULT true,
  start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
`
];

module.exports = migrationFiles;
