'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Settings, Play, Pause, Check } from 'lucide-react';
import Link from 'next/link';

export default function ManufacturingOperationsPage() {
  const [operations, setOperations] = useState([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    operationNumber: '',
    orderId: '',
    status: 'pending',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    notes: '',
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    // Mock data for now
    setOrders([
      { id: '1', orderNumber: 'PO-001', product: 'Product A', quantity: 100 } as any,
      { id: '2', orderNumber: 'PO-002', product: 'Product B', quantity: 200 } as any,
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      startTime: formData.startTime ? new Date(formData.startTime) : null,
      endTime: formData.endTime ? new Date(formData.endTime) : null,
    };

    setIsModalOpen(false);
    resetForm();
    alert('operation created successfully');
  };

  const resetForm = () => {
    setFormData({
      operationNumber: '',
      orderId: '',
      status: 'pending',
      startTime: new Date().toISOString().slice(0, 16),
      endTime: '',
      notes: '',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <Play className="w-4 h-4 text-blue-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-600" />;
      case 'completed': return <Check className="w-4 h-4 text-green-600" />;
      default: return <Settings className="w-4 h-4 text-gray-600" />;
    }
  };

  const columns = [
    { 
      key: 'operationNumber', 
      label: 'operation number',
      render: (val: string) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{val}</span>
        </div>
      )
    },
    { key: 'order', label: 'order' },
    { key: 'status', 
      label: 'status',
      render: (val: string) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(val)}
          <span className="font-medium">{val}</span>
        </div>
      )
    },
    { key: 'startTime', label: 'start time' },
    { key: 'endTime', label: 'end time' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">manufacturing operations</h1>
          <p className="text-gray-600 mt-1">manage production operations</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/manufacturing/production-orders"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            production orders
          </Link>
          <Link
            href="/manufacturing/cost-study"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            cost study
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            add operation
          </button>
        </div>
      </div>

      <EnhancedTable columns={columns} data={operations} />

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="add manufacturing operation"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">operation number</label>
              <input
                type="text"
                required
                value={formData.operationNumber}
                onChange={(e) => setFormData({ ...formData, operationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">production order</label>
              <select
                required
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">select order</option>
                {orders.map((order: any) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} - {order.product}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">status</label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="pending">pending</option>
                <option value="in_progress">in progress</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">start time</label>
              <input
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">end time</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              save
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
