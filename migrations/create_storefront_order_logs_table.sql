-- Check if the table exists before creating it
CREATE TABLE IF NOT EXISTS storefront_order_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES storefront_orders(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_user_id UUID
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_storefront_order_logs_order_id ON storefront_order_logs(order_id);
