import mongoose from 'mongoose';
import { Counter } from './customerIdGenerator.js';

/**
 * Atomically generates the next unique sequential Staff ID formatted as KKV-STAFF-000001 or KKV-RS-000001
 */
export async function generateStaffId(prefix: string = 'KKV-STAFF'): Promise<{ staffId: string; sequenceNumber: number }> {
  const counterKey = prefix === 'KKV-RS' ? 'rental_staff_id_sequence' : 'staff_id_sequence';
  if (mongoose.connection.readyState === 1) {
    try {
      const counterDoc = await Counter.findByIdAndUpdate(
        counterKey,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      if (counterDoc && counterDoc.seq) {
        const sequenceNumber = counterDoc.seq;
        const formattedId = `${prefix}-${String(sequenceNumber).padStart(6, '0')}`;
        return { staffId: formattedId, sequenceNumber };
      }
    } catch (err) {
      console.warn('[StaffIdGenerator] Counter query notice:', err);
    }
  }

  // Fallback timestamp-based sequence
  const fallbackSeq = Math.floor((Date.now() % 1000000) + Math.random() * 100);
  const fallbackId = `${prefix}-${String(fallbackSeq).padStart(6, '0')}`;
  return { staffId: fallbackId, sequenceNumber: fallbackSeq };
}

export default generateStaffId;
