import { counterService } from '../services/counter.service.js';

/**
 * Atomically generates the next unique sequential Staff ID formatted as KKV-STAFF-000001 or KKV-RS-000001
 */
export async function generateStaffId(prefix: string = 'KKV-STAFF'): Promise<{ staffId: string; sequenceNumber: number }> {
  const counterKey = prefix === 'KKV-RS' ? 'rental_staff_id_sequence' : 'staff_id_sequence';
  const sequenceNumber = await counterService.getNextSequence(counterKey);
  const formattedId = `${prefix}-${String(sequenceNumber).padStart(6, '0')}`;
  return { staffId: formattedId, sequenceNumber };
}

export default generateStaffId;
