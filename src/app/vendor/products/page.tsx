"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import VendorLayout from "@/components/vendor/VendorLayout";
import BarcodeScannerModal from "@/components/common/BarcodeScannerModal";
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Utensils,
  Layers,
  Barcode,
  Camera,
  Loader2,
  Trash2,
  Upload,
  Scan,
  Edit2,
  Eye,
  EyeOff,
  X,
  ArrowLeft,
  ChevronRight
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category: string;
  basePrice: string | number;
  costPrice?: string | number;
  wholesalePrice?: string | number;
  moq?: number;
  weightKg?: string | number;
  imageUrl?: string;
  stockQuantity: number;
  trackInventory: boolean;
  requiresKitchenPrep: boolean;
  isAvailable: boolean;
}

export default function VendorProductManagerPage() {
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("Mains");
  const [basePrice, setBasePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [moq, setMoq] = useState("1");
  const [weightKg, setWeightKg] = useState("1.0");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("0");
  const [trackInventory, setTrackInventory] = useState(false);
  const [requiresKitchenPrep, setRequiresKitchenPrep] = useState(true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to upload image.");
      }

      setImageUrl(json.url);
      setStatusMsg({ text: "Product image uploaded successfully.", type: "success" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/vendor/products");
      const json = await res.json();
      if (json.success) {
        setProductsList(json.products || []);
        setVendorInfo(json.vendor);
      }
    } catch (err: any) {
      setStatusMsg({ text: "Failed to load product catalog.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openNewModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName("");
    setDescription("");
    setSku(`SKU-${Date.now().toString().slice(-4)}`);
    setBarcode("");
    setCategory("Mains");
    setBasePrice("");
    setCostPrice("");
    setStockQuantity("50");
    setTrackInventory(false);
    setRequiresKitchenPrep(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    setIsEditing(true);
    setCurrentId(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setSku(p.sku || "");
    setBarcode(p.barcode || "");
    setCategory(p.category || "General");
    setBasePrice(String(p.basePrice));
    setCostPrice(String(p.costPrice || "0"));
    setStockQuantity(String(p.stockQuantity));
    setTrackInventory(p.trackInventory);
    setRequiresKitchenPrep(p.requiresKitchenPrep);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !basePrice) {
      setStatusMsg({ text: "Name and Selling Price are required.", type: "error" });
      return;
    }

    try {
      const method = isEditing ? "PUT" : "POST";
      const payload: any = {
        name,
        description,
        sku,
        barcode,
        category,
        basePrice: Number(basePrice),
        costPrice: Number(costPrice) || 0,
        stockQuantity: Number(stockQuantity) || 0,
        trackInventory,
        requiresKitchenPrep,
      };

      if (isEditing) {
        payload.id = currentId;
      }

      const res = await fetch("/api/vendor/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Save failed.");
      }

      setIsModalOpen(false);
      setStatusMsg({
        text: isEditing ? "Product updated successfully." : "New product published.",
        type: "success",
      });
      loadProducts();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const toggleAvailability = async (p: ProductItem) => {
    try {
      const nextStatus = !p.isAvailable;
      const res = await fetch("/api/vendor/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, isAvailable: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setProductsList((prev) =>
          prev.map((item) => (item.id === p.id ? { ...item, isAvailable: nextStatus } : item))
        );
      }
    } catch {
      setStatusMsg({ text: "Could not toggle status.", type: "error" });
    }
  };

  const categories = useMemo(() => {
    const set = new Set(productsList.map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [productsList]);

  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [productsList, selectedCategory, searchQuery]);

  return (
    <VendorLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Catalog & Product Manager
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {vendorInfo?.name || "Active Vendor"}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Set prices, barcodes, margins & kitchen preparation rules
            </p>
          </div>

          <button
            onClick={openNewModal}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold font-mono text-xs text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Overview Analytics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Catalog</div>
            <div className="text-xl font-bold text-white mt-1">{productsList.length} Items</div>
          </div>
          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Active & Live</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {productsList.filter((p) => p.isAvailable).length} Available
            </div>
          </div>
          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Kitchen Tracked</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {productsList.filter((p) => p.requiresKitchenPrep).length} Hot Prep
            </div>
          </div>
          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Inventory Monitored</div>
            <div className="text-xl font-bold text-blue-400 mt-1">
              {productsList.filter((p) => p.trackInventory).length} Stocked
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#121620] border border-slate-700/80 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto font-mono text-xs">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-xl border capitalize transition whitespace-nowrap ${
                  selectedCategory === c
                    ? "bg-slate-800 border-emerald-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Status Toast */}
        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-rose-950/40 text-rose-300 border-rose-800/50"
            }`}
          >
            {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Main Product Table */}
        <div className="bg-[#121620] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#161a26] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">SKU / Barcode</th>
                  <th className="p-3.5">Selling Price</th>
                  <th className="p-3.5">Cost / Margin</th>
                  <th className="p-3.5">Prep / Stock</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No products match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const priceNum = Number(p.basePrice) || 0;
                    const costNum = Number(p.costPrice) || 0;
                    const margin = priceNum > 0 && costNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : null;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5 font-sans font-semibold text-white">
                          <div>{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] font-normal text-slate-500 line-clamp-1 mt-0.5">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">
                          <div>{p.sku || "—"}</div>
                          {p.barcode && (
                            <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <Barcode className="w-3 h-3" /> {p.barcode}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 font-bold text-emerald-400">
                          UGX {priceNum.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          <div>UGX {costNum.toLocaleString()}</div>
                          {margin !== null && (
                            <div className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                              <TrendingUp className="w-3 h-3" /> {margin}% margin
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          {p.requiresKitchenPrep ? (
                            <span className="px-2 py-0.5 rounded-md bg-orange-950/60 text-orange-300 border border-orange-800/50 flex items-center gap-1 w-fit">
                              <Utensils className="w-3 h-3" /> Hot Prep
                            </span>
                          ) : (
                            <span className="text-slate-500">Retail Ready</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => toggleAvailability(p)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                              p.isAvailable
                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/60"
                                : "bg-rose-950/60 text-rose-400 border-rose-800/60 hover:bg-emerald-950/40 hover:text-emerald-400"
                            }`}
                          >
                            {p.isAvailable ? (
                              <>
                                <Eye className="w-3 h-3" /> Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" /> Hidden
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-lg p-6 font-mono space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    {isEditing ? "EDIT PRODUCT RECORD" : "ADD NEW CATALOG PRODUCT"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hawaiian Supreme Pizza (Large)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="Pizzas, Sides, Drinks, Wholesale"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">SKU Code</label>
                    <input
                      type="text"
                      placeholder="PIZ-HAW-L"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white focus:outline-none focus:border-emerald-500 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Retail Price (UGX) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="35000"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Cost of Goods (UGX)</label>
                    <input
                      type="number"
                      placeholder="15000"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-300 focus:outline-none focus:border-emerald-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Wholesale (UGX)</label>
                    <input
                      type="number"
                      placeholder="32000"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-cyan-400 font-semibold focus:outline-none focus:border-cyan-500 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Min Order (MOQ)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white focus:outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Weight (KG)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="1.0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white focus:outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Product Photograph</label>
                  
                  {imageUrl ? (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <label className="p-2.5 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-600 cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow-lg">
                          <Upload className="w-4 h-4 text-emerald-400" />
                          <span>Replace</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setImageUrl("")}
                          className="p-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500 flex items-center gap-1.5 text-xs font-mono font-bold shadow-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-4 bg-slate-900/50 transition-colors text-center relative">
                      {isUploadingImage ? (
                        <div className="flex flex-col items-center justify-center py-4 gap-2 text-emerald-400 font-mono text-xs">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Uploading image...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="flex items-center justify-center gap-2">
                            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-bold cursor-pointer transition shadow-sm active:scale-95">
                              <Upload className="w-4 h-4 text-emerald-400" />
                              <span>Choose Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>

                            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold cursor-pointer transition shadow-sm active:scale-95">
                              <Camera className="w-4 h-4 text-emerald-400" />
                              <span>Take Picture</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            JPEG, PNG, WEBP up to 10MB • Direct upload
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400 font-semibold">Barcode / EAN / QR</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsScannerOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition cursor-pointer relative z-20"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Code</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Scan with camera, laser, or type (e.g. 700105)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Description / Recipe</label>
                  <textarea
                    rows={2}
                    placeholder="Ingredients, toppings, or retail specifications..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresKitchenPrep}
                      onChange={(e) => setRequiresKitchenPrep(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700"
                    />
                    <span>Send to Kitchen Display System (KDS) when ordered</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackInventory}
                      onChange={(e) => setTrackInventory(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700"
                    />
                    <span>Track stock count in POS & Storefront</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-950"
                  >
                    {isEditing ? "Save Changes" : "Publish Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
          <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scannedVal) => {
          setBarcode(scannedVal);
          setIsScannerOpen(false);
          setStatusMsg({ text: `Barcode captured: ${scannedVal}`, type: "success" });
          setTimeout(() => setStatusMsg(null), 3000);
        }}
      />
    </VendorLayout>
  );
}
