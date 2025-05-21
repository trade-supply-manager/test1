import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const OLD_BUCKET = "product-images"
const NEW_BUCKET = "product-variant-images"

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 1. Get all product variants with images
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id, product_id, product_variant_image")
      .not("product_variant_image", "is", null)

    if (variantsError) {
      throw variantsError
    }

    console.log(`Found ${variants.length} variants with images to migrate`)

    const results = {
      total: variants.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [],
    }

    // 2. Process each variant
    for (const variant of variants) {
      try {
        // Skip if not from the old bucket or already in the new bucket
        if (!variant.product_variant_image.includes(OLD_BUCKET) || variant.product_variant_image.includes(NEW_BUCKET)) {
          results.skipped++
          results.details.push({
            id: variant.id,
            status: "skipped",
            reason: "Not from old bucket or already in new bucket",
          })
          continue
        }

        // Extract the file path from the URL
        const url = new URL(variant.product_variant_image)
        const pathParts = url.pathname.split("/")
        const oldPath = pathParts[pathParts.length - 1]

        // Create new path with product_id as folder
        const newPath = `${variant.product_id}/${oldPath}`

        // Download the file from the old bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(OLD_BUCKET)
          .download(`product-variants/${oldPath}`)

        if (downloadError) {
          throw downloadError
        }

        // Upload to the new bucket
        const { error: uploadError } = await supabase.storage.from(NEW_BUCKET).upload(newPath, fileData, {
          contentType: fileData.type,
          upsert: true,
        })

        if (uploadError) {
          throw uploadError
        }

        // Get the new public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(NEW_BUCKET).getPublicUrl(newPath)

        // Update the variant with the new URL
        const { error: updateError } = await supabase
          .from("product_variants")
          .update({ product_variant_image: publicUrl })
          .eq("id", variant.id)

        if (updateError) {
          throw updateError
        }

        results.success++
        results.details.push({
          id: variant.id,
          status: "success",
          oldUrl: variant.product_variant_image,
          newUrl: publicUrl,
        })
      } catch (error) {
        console.error(`Error migrating image for variant ${variant.id}:`, error)
        results.failed++
        results.details.push({
          id: variant.id,
          status: "failed",
          error: error.message,
        })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({ error: "Failed to migrate images", details: error.message }, { status: 500 })
  }
}
