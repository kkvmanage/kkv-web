import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

export const getDashboardSummary = (req: Request, res: Response) => {
  try {
    const user = req.user;
    const requestedBranch = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;

    // Enforce branch scope for non-admin users
    let branchId = requestedBranch;
    if (user && user.role !== 'ADMIN') {
      const userBranch = (user as any).branchId || (user as any).branch || (user as any).department;
      if (userBranch && requestedBranch && requestedBranch !== userBranch) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied to data from other branches.'
        });
      }
      branchId = userBranch;
    }

    const summary = dashboardService.getSummary(user, branchId);
    return res.json({
      success: true,
      message: 'Dashboard summary retrieved',
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[DashboardController] Error retrieving dashboard summary:', err);
    return res.status(500).json({
      success: false,
      error: 'DASHBOARD_ERROR',
      message: 'Failed to retrieve dashboard summary: ' + (err?.message || err)
    });
  }
};

