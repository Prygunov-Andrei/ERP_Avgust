import { useState } from 'react';
import { Product } from '@/types/catalog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface MergeProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onMerge: (targetId: number, sourceIds: number[]) => Promise<void>;
}

export function MergeProductsModal({ isOpen, onClose, products, onMerge }: MergeProductsModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(
    products.length > 0 ? products[0].id : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleMerge = async () => {
    if (!selectedTargetId) return;

    const sourceIds = products
      .filter((p) => p.id !== selectedTargetId)
      .map((p) => p.id);

    setIsSubmitting(true);
    try {
      await onMerge(selectedTargetId, sourceIds);
      onClose();
    } catch (error) {
      // Error handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl">Объединение товаров</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Выберите основной товар, в который будут объединены остальные. Названия
              остальных товаров станут синонимами основного.
            </p>

            <div className="space-y-3">
              <Label>Выберите основной товар:</Label>
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    selectedTargetId === product.id
                      ? 'border-blue-500 bg-primary/10'
                      : 'border-border hover:border-border'
                  }`}
                  onClick={() => setSelectedTargetId(product.id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedTargetId === product.id}
                      onChange={() => setSelectedTargetId(product.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div>{product.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Категория: {product.category_name || 'Не указана'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Ед. изм.: {product.default_unit}
                      </div>
                      {product.aliases_count > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Синонимов: {product.aliases_count}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTargetId && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                  <strong>Внимание:</strong> После объединения:
                </p>
                <ul className="list-disc ml-5 mt-2 text-sm text-yellow-800 dark:text-yellow-400">
                  <li>Товары получат статус "Объединён"</li>
                  <li>Их названия станут синонимами основного товара</li>
                  <li>История цен будет сохранена</li>
                  <li>Это действие нельзя отменить</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleMerge}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting || !selectedTargetId}
          >
            {isSubmitting ? 'Объединение...' : 'Объединить товары'}
          </Button>
        </div>
      </div>
    </div>
  );
}
