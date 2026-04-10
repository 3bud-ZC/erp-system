'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import { DollarSign, TrendingUp, Package, Calculator } from 'lucide-react';
import Link from 'next/link';

export default function CostStudyPage() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [costAnalysis, setCostAnalysis] = useState({
    materialCost: 0,
    laborCost: 0,
    overheadCost: 0,
    totalCost: 0,
    sellingPrice: 0,
    profit: 0,
    profitMargin: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const productsRes = await fetch('/api/products');
    const productsData = await productsRes.json();
    setProducts(productsData.filter((p: any) => p.type === 'finished_product'));
  };

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    // Mock cost calculation
    const materialCost = product.cost * 1.2;
    const laborCost = product.cost * 0.3;
    const overheadCost = product.cost * 0.15;
    const totalCost = materialCost + laborCost + overheadCost;
    const sellingPrice = product.price;
    const profit = sellingPrice - totalCost;
    const profitMargin = (profit / sellingPrice) * 100;

    setCostAnalysis({
      materialCost,
      laborCost,
      overheadCost,
      totalCost,
      sellingPrice,
      profit,
      profitMargin,
    });
  };

  const statsCards = [
    {
      title: 'material cost',
      value: `${costAnalysis.materialCost.toFixed(2)} EGP`,
      icon: <Package className="w-6 h-6" />,
      color: 'blue' as const,
    },
    {
      title: 'labor cost',
      value: `${costAnalysis.laborCost.toFixed(2)} EGP`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green' as const,
    },
    {
      title: 'overhead cost',
      value: `${costAnalysis.overheadCost.toFixed(2)} EGP`,
      icon: <Calculator className="w-6 h-6" />,
      color: 'yellow' as const,
    },
    {
      title: 'total cost',
      value: `${costAnalysis.totalCost.toFixed(2)} EGP`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'red' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">cost study</h1>
          <p className="text-gray-600 mt-1">analyze product costs and profitability</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/manufacturing/production-orders"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            production orders
          </Link>
          <Link
            href="/manufacturing/operations"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            operations
          </Link>
        </div>
      </div>

      {/* Product Selection */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">select product for analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => (
            <button
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={`p-4 rounded-xl border text-right transition-all duration-200 ${
                selectedProduct?.id === product.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-gray-900">{product.nameAr}</div>
              <div className="text-sm text-gray-600 mt-1">code: {product.code}</div>
              <div className="text-sm text-gray-600">price: {product.price} EGP</div>
            </button>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <>
          {/* Cost Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((card, index) => (
              <EnhancedCard
                key={index}
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
              />
            ))}
          </div>

          {/* Profit Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">profit analysis</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">selling price</span>
                  <span className="font-semibold text-gray-900">{costAnalysis.sellingPrice.toFixed(2)} EGP</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">total cost</span>
                  <span className="font-semibold text-red-600">{costAnalysis.totalCost.toFixed(2)} EGP</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">profit</span>
                    <span className={`font-bold text-lg ${costAnalysis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {costAnalysis.profit.toFixed(2)} EGP
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">profit margin</span>
                    <span className={`font-semibold ${costAnalysis.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {costAnalysis.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">cost breakdown</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">materials</span>
                    <span className="font-semibold">{costAnalysis.materialCost.toFixed(2)} EGP</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(costAnalysis.materialCost / costAnalysis.totalCost) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">labor</span>
                    <span className="font-semibold">{costAnalysis.laborCost.toFixed(2)} EGP</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(costAnalysis.laborCost / costAnalysis.totalCost) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">overhead</span>
                    <span className="font-semibold">{costAnalysis.overheadCost.toFixed(2)} EGP</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{ width: `${(costAnalysis.overheadCost / costAnalysis.totalCost) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
