-- Function to count product variants with low stock
CREATE OR REPLACE FUNCTION count_low_stock_variants()
RETURNS integer
LANGUAGE sql
AS $$
  SELECT COUNT(DISTINCT pv.id)
  FROM product_variants AS pv
  WHERE 
    (pv.quantity < pv.warning_threshold OR pv.quantity < pv.critical_threshold)
    AND pv.is_archived = false;
$$;
