// src/wishlist/AddSavingsSheet.tsx: Add savings on the goal card: an amount, kept as one more row of the tally.
import { addSaving } from '../data/repositories';
import { MoneySheet } from './MoneySheet';

export function AddSavingsSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  return (
    <MoneySheet
      title="Add savings"
      label="Amount (US dollars)"
      keepLabel="Add to savings"
      onClose={onClose}
      onKeep={async (amount) => {
        await addSaving(itemId, amount);
        onClose();
      }}
    />
  );
}
