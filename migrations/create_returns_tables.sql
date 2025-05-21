-- Create customer returns table
CREATE TABLE IF NOT EXISTS customer_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES customer_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  return_date TIMESTAMP WITH TIME ZONE NOT NULL,
  return_reason TEXT,
  return_status TEXT NOT NULL,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  date_created TIMESTAMP WITH TIME ZONE NOT NULL,
  date_last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create customer return items table
CREATE TABLE IF NOT EXISTS customer_return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES customer_returns(id),
  order_item_id UUID NOT NULL REFERENCES customer_order_items(customer_order_item_id),
  quantity INTEGER NOT NULL,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  date_created TIMESTAMP WITH TIME ZONE NOT NULL,
  date_last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_returns_order_id ON customer_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_customer_id ON customer_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_return_id ON customer_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_order_item_id ON customer_return_items(order_item_id);
