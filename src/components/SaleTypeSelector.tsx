import { ShoppingCart, Truck, Percent, Wallet } from 'lucide-react';

interface SaleTypeSelectorProps {
  saleType: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama';
  onSaleTypeChange: (type: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama') => void;
  cartTotal: number;
  depositAmount: number;
  onDepositChange: (amount: number) => void;
}

export function SaleTypeSelector({
  saleType,
  onSaleTypeChange,
  cartTotal,
  depositAmount,
  onDepositChange,
}: SaleTypeSelectorProps) {
  const balanceAmount = Math.max(0, cartTotal - depositAmount);

  const saleTypes = [
    {
      id: 'standard',
      label: 'Standard Retail',
      icon: ShoppingCart,
      description: 'Walking customer - Full payment at checkout',
      color: 'bg-blue-50 border-blue-200',
      activeColor: 'bg-blue-100 border-blue-500',
    },
    {
      id: 'wholesale',
      label: 'Wholesale/Drop-shipping',
      icon: Truck,
      description: 'Bulk orders with wholesale pricing',
      color: 'bg-green-50 border-green-200',
      activeColor: 'bg-green-100 border-green-500',
    },
    {
      id: 'lipa_mdogo',
      label: 'Lipa Mdogo-Mdogo',
      icon: Percent,
      description: 'Goods collected after full payment settled',
      color: 'bg-yellow-50 border-yellow-200',
      activeColor: 'bg-yellow-100 border-yellow-500',
    },
    {
      id: 'kyama',
      label: 'Kyama',
      icon: Wallet,
      description: 'Agreed deposit made, checkout after full amount',
      color: 'bg-purple-50 border-purple-200',
      activeColor: 'bg-purple-100 border-purple-500',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Sale Type</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {saleTypes.map((type) => {
          const IconComponent = type.icon;
          const isActive = saleType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => onSaleTypeChange(type.id as any)}
              className={`p-3 rounded-lg border-2 transition text-left ${
                isActive ? type.activeColor : type.color
              }`}
            >
              <div className="flex items-start gap-2">
                <IconComponent size={18} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-gray-600">{type.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {(saleType === 'lipa_mdogo' || saleType === 'kyama') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-900 mb-3">Payment Terms</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Deposit/Initial Payment (KES)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => onDepositChange(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="0"
                min="0"
                max={cartTotal}
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: KES {cartTotal.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">KES {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Deposit Today:</span>
                <span className="font-medium">KES {depositAmount.toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-200 pt-1 flex justify-between text-amber-600 font-medium">
                <span>Balance Outstanding:</span>
                <span>KES {balanceAmount.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-amber-800 italic">
              {saleType === 'lipa_mdogo' 
                ? 'Goods will be collected after the full amount is paid'
                : 'Goods will be checked out after the full amount is paid'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
