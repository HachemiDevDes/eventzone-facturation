import React from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { LineItem } from '../../types';

interface SortableItemProps {
  id: string;
  item: LineItem;
  onChange: (id: string, field: keyof LineItem, value: any) => void;
  onRemove: (id: string) => void;
  isLast: boolean;
  onEnterPressed: () => void;
  currency: string;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, item, onChange, onRemove, isLast, onEnterPressed }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const amount = item.quantity * item.rate;

  return (
    <div ref={setNodeRef} style={style} className="line-item-row">
      <div className="drag-handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </div>
      <input
        placeholder="Description du produit ou service..."
        value={item.description}
        onChange={(e) => onChange(id, 'description', e.target.value)}
      />
      <input
        type="number"
        min="0"
        step="1"
        placeholder="Qté"
        value={item.quantity}
        onChange={(e) => onChange(id, 'quantity', parseFloat(e.target.value) || 0)}
        style={{ textAlign: 'right' }}
      />
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="P.U."
        value={item.rate}
        onChange={(e) => onChange(id, 'rate', parseFloat(e.target.value) || 0)}
        style={{ textAlign: 'right' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isLast) {
            e.preventDefault();
            onEnterPressed();
          }
        }}
      />
      <div className="line-item-amount">{amount.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })}</div>
      <button className="btn-icon" onClick={() => onRemove(id)} title="Supprimer cette ligne"
        style={{ justifySelf: 'center' }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const LineItemsEditor: React.FC = () => {
  const { state, dispatch } = useInvoice();
  const items = state.currentDocument.items;
  const currency = state.currentDocument.settings.currency;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      dispatch({ type: 'REORDER_CURRENT_ITEMS', payload: arrayMove(items, oldIndex, newIndex) });
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    dispatch({ type: 'UPDATE_CURRENT_ITEM', payload: { id, item: { [field]: value } } });
  };

  const handleRemoveItem = (id: string) => {
    dispatch({ type: 'REMOVE_CURRENT_ITEM', payload: id });
  };

  const handleAddItem = () => {
    dispatch({ type: 'ADD_CURRENT_ITEM' });
  };

  return (
    <div>
      {/* Header Row */}
      <div className="line-items-header">
        <div></div> {/* For drag handle space */}
        <div>Description</div>
        <div style={{ textAlign: 'right' }}>Qté</div>
        <div style={{ textAlign: 'right' }}>Prix unitaire HT</div>
        <div style={{ textAlign: 'right' }}>Montant HT</div>
        <div></div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--r-sm) var(--r-sm)' }}>
          <p style={{ color: 'var(--text-4)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Aucun article. Ajoutez votre premier article.
          </p>
          <button className="btn btn-primary" onClick={handleAddItem}>
            <Plus size={14} /> Ajouter un article
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                id={item.id}
                item={item}
                onChange={handleItemChange}
                onRemove={handleRemoveItem}
                isLast={index === items.length - 1}
                onEnterPressed={handleAddItem}
                currency={currency}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {items.length > 0 && (
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.82rem' }}
          onClick={handleAddItem}
        >
          <Plus size={14} /> Ajouter une ligne
        </button>
      )}
    </div>
  );
};

export default LineItemsEditor;
