import { counterService } from '../services/counter.service.js';

/**
 * Atomically generates the next unique sequential Customer ID formatted as KKV-2026-000001
 */
export async function generateCustomerId(prefix: string = 'KKV-2026'): Promise<{ customerId: string; sequenceNumber: number }> {
  const sequenceNumber = await counterService.getNextSequence('customerId');
  const formattedId = `${prefix}-${String(sequenceNumber).padStart(6, '0')}`;
  return { customerId: formattedId, sequenceNumber };
}

export default generateCustomerId;
