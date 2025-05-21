export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          logo_url: string | null
          email_sender: string | null
          pdf_header_text: string | null
          date_created: string
          date_last_updated: string
          created_by_user_id: string | null
          updated_by_user_id: string | null
          storefront_image: string | null
          email_header_image: string | null
        }
        Insert: {
          id?: string
          logo_url?: string | null
          email_sender?: string | null
          pdf_header_text?: string | null
          date_created?: string
          date_last_updated?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          storefront_image?: string | null
          email_header_image?: string | null
        }
        Update: {
          id?: string
          logo_url?: string | null
          email_sender?: string | null
          pdf_header_text?: string | null
          date_created?: string
          date_last_updated?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          storefront_image?: string | null
          email_header_image?: string | null
        }
      }
      customer_contacts: {
        Row: {
          id: string
          last_name: string
          created_by_user_id: string | null
          updated_by_user_id: string | null
          email: string
          phone_number: string
          first_name: string
          is_archived: boolean | null
          date_last_updated: string
          date_created: string
          customer_id: string
        }
        Insert: {
          id?: string
          last_name: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          email: string
          phone_number: string
          first_name: string
          is_archived?: boolean | null
          date_last_updated?: string
          date_created?: string
          customer_id: string
        }
        Update: {
          id?: string
          last_name?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          email?: string
          phone_number?: string
          first_name?: string
          is_archived?: boolean | null
          date_last_updated?: string
          date_created?: string
          customer_id?: string
        }
      }
      customer_order_items: {
        Row: {
          product_id: string | null
          customer_order_item_id: string
          layers: number | null
          pallets: number | null
          total_order_item_value: number | null
          discount_percentage: number | null
          is_pallet: boolean | null
          is_returned: boolean | null
          date_last_updated: string | null
          date_created: string | null
          created_by_user_id: string | null
          updated_by_user_id: string | null
          is_archived: boolean | null
          customer_order_id: string
          discount: number | null
          unit_price: number | null
          quantity: number | null
          variant_id: string | null
        }
        Insert: {
          product_id?: string | null
          customer_order_item_id?: string
          layers?: number | null
          pallets?: number | null
          total_order_item_value?: number | null
          discount_percentage?: number | null
          is_pallet?: boolean | null
          is_returned?: boolean | null
          date_last_updated?: string | null
          date_created?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          is_archived?: boolean | null
          customer_order_id: string
          discount?: number | null
          unit_price?: number | null
          quantity?: number | null
          variant_id?: string | null
        }
        Update: {
          product_id?: string | null
          customer_order_item_id?: string
          layers?: number | null
          pallets?: number | null
          total_order_item_value?: number | null
          discount_percentage?: number | null
          is_pallet?: boolean | null
          is_returned?: boolean | null
          date_last_updated?: string | null
          date_created?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          is_archived?: boolean | null
          customer_order_id?: string
          discount?: number | null
          unit_price?: number | null
          quantity?: number | null
          variant_id?: string | null
        }
      }
      customer_orders: {
        Row: {
          subtotal_order_value: number | null
          tax_rate: number | null
          updated_by_user_id: string | null
          created_by_user_id: string | null
          delivery_method: string
          payment_status: string | null
          send_email: boolean | null
          notes: string | null
          delivery_date: string
          order_name: string
          amount_paid: number | null
          id: string
          date_created: string
          date_last_updated: string
          is_archived: boolean | null
          total_order_value: number | null
          delivery_time: string
          delivery_address: string | null
          delivery_instructions: string | null
          status: string
          customer_id: string
        }
        Insert: {
          subtotal_order_value?: number | null
          tax_rate?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          delivery_method: string
          payment_status?: string | null
          send_email?: boolean | null
          notes?: string | null
          delivery_date: string
          order_name: string
          amount_paid?: number | null
          id?: string
          date_created?: string
          date_last_updated?: string
          is_archived?: boolean | null
          total_order_value?: number | null
          delivery_time: string
          delivery_address?: string | null
          delivery_instructions?: string | null
          status: string
          customer_id: string
        }
        Update: {
          subtotal_order_value?: number | null
          tax_rate?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          delivery_method?: string
          payment_status?: string | null
          send_email?: boolean | null
          notes?: string | null
          delivery_date?: string
          order_name?: string
          amount_paid?: number | null
          id?: string
          date_created?: string
          date_last_updated?: string
          is_archived?: boolean | null
          total_order_value?: number | null
          delivery_time?: string
          delivery_address?: string | null
          delivery_instructions?: string | null
          status?: string
          customer_id?: string
        }
      }
      customers: {
        Row: {
          is_archived: boolean | null
          id: string
          date_created: string
          date_last_updated: string
          customer_name: string
          customer_type: string
          email: string | null
          phone_number: string | null
          address: string
          updated_by_user_id: string | null
          created_by_user_id: string | null
        }
        Insert: {
          is_archived?: boolean | null
          id?: string
          date_created?: string
          date_last_updated?: string
          customer_name: string
          customer_type: string
          email?: string | null
          phone_number?: string | null
          address: string
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
        }
        Update: {
          is_archived?: boolean | null
          id?: string
          date_created?: string
          date_last_updated?: string
          customer_name?: string
          customer_type?: string
          email?: string | null
          phone_number?: string | null
          address?: string
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
        }
      }
      manufacturer_contacts: {
        Row: {
          updated_by_employee_id: string | null
          email: string | null
          date_last_updated: string | null
          first_name: string | null
          phone_number: string | null
          manufacturer_id: string
          id: string
          date_created: string | null
          last_name: string | null
          is_archived: boolean | null
          created_by_user_id: string | null
          updated_by_user_id: string | null
        }
        Insert: {
          updated_by_employee_id?: string | null
          email?: string | null
          date_last_updated?: string | null
          first_name?: string | null
          phone_number?: string | null
          manufacturer_id: string
          id?: string
          date_created?: string | null
          last_name?: string | null
          is_archived?: boolean | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
        }
        Update: {
          updated_by_employee_id?: string | null
          email?: string | null
          date_last_updated?: string | null
          first_name?: string | null
          phone_number?: string | null
          manufacturer_id?: string
          id?: string
          date_created?: string | null
          last_name?: string | null
          is_archived?: boolean | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
        }
      }
      manufacturers: {
        Row: {
          date_last_updated: string
          updated_by_user_id: string | null
          date_created: string
          phone_number: string | null
          address: string | null
          manufacturer_id: string | null
          created_by_user_id: string | null
          id: string
          updated_by_employee_id: string | null
          cost_per_pallet: number | null
          manufacturer_name: string
          email: string | null
          is_archived: boolean | null
        }
        Insert: {
          date_last_updated?: string
          updated_by_user_id?: string | null
          date_created?: string
          phone_number?: string | null
          address?: string | null
          manufacturer_id?: string | null
          created_by_user_id?: string | null
          id?: string
          updated_by_employee_id?: string | null
          cost_per_pallet?: number | null
          manufacturer_name: string
          email?: string | null
          is_archived?: boolean | null
        }
        Update: {
          date_last_updated?: string
          updated_by_user_id?: string | null
          date_created?: string
          phone_number?: string | null
          address?: string | null
          manufacturer_id?: string | null
          created_by_user_id?: string | null
          id?: string
          updated_by_employee_id?: string | null
          cost_per_pallet?: number | null
          manufacturer_name?: string
          email?: string | null
          is_archived?: boolean | null
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          pallets: number | null
          layers: number | null
          unit_price: number | null
          quantity: number | null
          warning_threshold: number | null
          critical_threshold: number | null
          max_quantity: number | null
          date_created: string
          date_last_updated: string
          updated_by_employee_id: string | null
          is_archived: boolean | null
          unit_margin: number | null
          updated_by_user_id: string | null
          created_by_user_id: string | null
          is_pallet: boolean | null
          product_variant_sku: string
          product_variant_name: string
          product_variant_image: string | null
          colour: string | null
        }
        Insert: {
          id?: string
          product_id: string
          pallets?: number | null
          layers?: number | null
          unit_price?: number | null
          quantity?: number | null
          warning_threshold?: number | null
          critical_threshold?: number | null
          max_quantity?: number | null
          date_created?: string
          date_last_updated?: string
          updated_by_employee_id?: string | null
          is_archived?: boolean | null
          unit_margin?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          is_pallet?: boolean | null
          product_variant_sku: string
          product_variant_name: string
          product_variant_image?: string | null
          colour?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          pallets?: number | null
          layers?: number | null
          unit_price?: number | null
          quantity?: number | null
          warning_threshold?: number | null
          critical_threshold?: number | null
          max_quantity?: number | null
          date_created?: string
          date_last_updated?: string
          updated_by_employee_id?: string | null
          is_archived?: boolean | null
          unit_margin?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          is_pallet?: boolean | null
          product_variant_sku?: string
          product_variant_name?: string
          product_variant_image?: string | null
          colour?: string | null
        }
      }
      products: {
        Row: {
          date_created: string
          created_by_user_id: string | null
          updated_by_user_id: string | null
          upload_index: number | null
          weight_cubed: number | null
          weight_per_unit: number | null
          total_product_value: number | null
          product_name: string
          id: string
          unit: string | null
          product_category: string
          manufacturer_id: string
          updated_by_employee_id: string | null
          feet_per_layer: number | null
          layers_per_pallet: number | null
          is_archived: boolean | null
          date_last_updated: string
        }
        Insert: {
          date_created?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          upload_index?: number | null
          weight_cubed?: number | null
          weight_per_unit?: number | null
          total_product_value?: number | null
          product_name: string
          id?: string
          unit?: string | null
          product_category: string
          manufacturer_id: string
          updated_by_employee_id?: string | null
          feet_per_layer?: number | null
          layers_per_pallet?: number | null
          is_archived?: boolean | null
          date_last_updated?: string
        }
        Update: {
          date_created?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          upload_index?: number | null
          weight_cubed?: number | null
          weight_per_unit?: number | null
          total_product_value?: number | null
          product_name?: string
          id?: string
          unit?: string | null
          product_category?: string
          manufacturer_id?: string
          updated_by_employee_id?: string | null
          feet_per_layer?: number | null
          layers_per_pallet?: number | null
          is_archived?: boolean | null
          date_last_updated?: string
        }
      }
      purchase_order_items: {
        Row: {
          created_by_user_id: string | null
          purchase_order_item_id: string
          updated_by_user_id: string | null
          is_archived: boolean | null
          discount_percentage: number | null
          discount: number | null
          is_returned: string | null
          purchase_order_id: string
          date_last_updated: string | null
          layers: number | null
          date_created: string | null
          pallets: number | null
          total_order_item_value: number | null
          unit_price: number | null
          quantity: number | null
          variant_id: string
          product_id: string
        }
        Insert: {
          created_by_user_id?: string | null
          purchase_order_item_id?: string
          updated_by_user_id?: string | null
          is_archived?: boolean | null
          discount_percentage?: number | null
          discount?: number | null
          is_returned?: string | null
          purchase_order_id: string
          date_last_updated?: string | null
          layers?: number | null
          date_created?: string | null
          pallets?: number | null
          total_order_item_value?: number | null
          unit_price?: number | null
          quantity?: number | null
          variant_id: string
          product_id: string
        }
        Update: {
          created_by_user_id?: string | null
          purchase_order_item_id?: string
          updated_by_user_id?: string | null
          is_archived?: boolean | null
          discount_percentage?: number | null
          discount?: number | null
          is_returned?: string | null
          purchase_order_id?: string
          date_last_updated?: string | null
          layers?: number | null
          date_created?: string | null
          pallets?: number | null
          total_order_item_value?: number | null
          unit_price?: number | null
          quantity?: number | null
          variant_id?: string
          product_id?: string
        }
      }
      purchase_orders: {
        Row: {
          amount_paid: number | null
          send_email: boolean | null
          date_created: string
          date_last_updated: string
          is_archived: boolean | null
          total_order_value: number | null
          updated_by_user_id: string | null
          created_by_user_id: string | null
          manufacturer_id: string | null
          subtotal_order_value: number | null
          tax_rate: number | null
          order_name: string
          payment_status: string | null
          delivery_method: string | null
          delivery_time: string | null
          delivery_address: string | null
          delivery_instructions: string | null
          status: string
          notes: string | null
          id: string
          delivery_date: string
        }
        Insert: {
          amount_paid?: number | null
          send_email?: boolean | null
          date_created?: string
          date_last_updated?: string
          is_archived?: boolean | null
          total_order_value?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          manufacturer_id?: string | null
          subtotal_order_value?: number | null
          tax_rate?: number | null
          order_name: string
          payment_status?: string | null
          delivery_method?: string | null
          delivery_time?: string | null
          delivery_address?: string | null
          delivery_instructions?: string | null
          status: string
          notes?: string | null
          id?: string
          delivery_date: string
        }
        Update: {
          amount_paid?: number | null
          send_email?: boolean | null
          date_created?: string
          date_last_updated?: string
          is_archived?: boolean | null
          total_order_value?: number | null
          updated_by_user_id?: string | null
          created_by_user_id?: string | null
          manufacturer_id?: string | null
          subtotal_order_value?: number | null
          tax_rate?: number | null
          order_name?: string
          payment_status?: string | null
          delivery_method?: string | null
          delivery_time?: string | null
          delivery_address?: string | null
          delivery_instructions?: string | null
          status?: string
          notes?: string | null
          id?: string
          delivery_date?: string
        }
      }
      employees: {
        Row: {
          date_last_updated: string | null
          date_created: string
          id: string
          employee_name: string | null
          email: string | null
          department: string | null
          role: string | null
          hire_date: string | null
          is_active: boolean | null
          user_id: string | null
          updated_by_user_id: string | null
        }
        Insert: {
          date_last_updated?: string | null
          date_created?: string
          id?: string
          employee_name?: string | null
          email?: string | null
          department?: string | null
          role?: string | null
          hire_date?: string | null
          is_active?: boolean | null
          user_id?: string | null
          updated_by_user_id?: string | null
        }
        Update: {
          date_last_updated?: string | null
          date_created: string
          id?: string
          employee_name?: string | null
          email?: string | null
          department?: string | null
          role?: string | null
          hire_date?: string | null
          is_active?: boolean | null
          user_id?: string | null
          updated_by_user_id?: string | null
        }
      }
    }
  }
}
