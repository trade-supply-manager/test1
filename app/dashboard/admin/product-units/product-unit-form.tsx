"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getSupabaseClient } from "@/lib/supabase-client"

export default function ProductUnitForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<{ success: boolean; message: string; count?: number }[]>([])
  const [pattern, setPattern] = useState("")
  const [unit, setUnit] = useState("Square Feet")
  const [searchType, setSearchType] = useState("name")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults([])

    try {
      const supabase = getSupabaseClient()
      let query = supabase.from("products").update({ unit }).select("id")

      if (searchType === "name" && pattern) {
        query = query.like("product_name", `%${pattern}%`)
      } else if (searchType === "category" && pattern) {
        query = query.eq("product_category", pattern)
      } else if (searchType === "missing") {
        query = query.is("unit", null)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      setResults([
        {
          success: true,
          message: `Successfully updated ${data.length} products to use "${unit}" as their unit.`,
          count: data.length,
        },
      ])

      toast({
        title: "Products Updated",
        description: `${data.length} products have been updated to use "${unit}" as their unit.`,
      })
    } catch (error: any) {
      setResults([
        {
          success: false,
          message: `Error: ${error.message || "An unknown error occurred"}`,
        },
      ])

      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="search-type">Search Type</Label>
          <Select value={searchType} onValueChange={setSearchType}>
            <SelectTrigger id="search-type">
              <SelectValue placeholder="Select search type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Product Name</SelectItem>
              <SelectItem value="category">Product Category</SelectItem>
              <SelectItem value="missing">Missing Units</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {searchType !== "missing" && (
          <div className="space-y-2">
            <Label htmlFor="pattern">{searchType === "name" ? "Name Pattern" : "Category Name"}</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={searchType === "name" ? "e.g. Citadin" : "e.g. Slabs"}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="unit">Unit to Set</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger id="unit">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Square Feet">Square Feet</SelectItem>
              <SelectItem value="Linear Feet">Linear Feet</SelectItem>
              <SelectItem value="Each">Each</SelectItem>
              <SelectItem value="Pound">Pound</SelectItem>
              <SelectItem value="Ton">Ton</SelectItem>
              <SelectItem value="Cubic Yard">Cubic Yard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Updating..." : "Update Products"}
      </Button>

      {results.length > 0 && (
        <div className="mt-4">
          {results.map((result, index) => (
            <Card
              key={index}
              className={`p-4 ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <p className={result.success ? "text-green-800" : "text-red-800"}>{result.message}</p>
            </Card>
          ))}
        </div>
      )}
    </form>
  )
}
