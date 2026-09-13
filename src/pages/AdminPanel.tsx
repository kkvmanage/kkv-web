import React, { useState, useEffect } from 'react';
import { useApp, defaultLoanTypes } from '../context/AppContext';
import { Users, CreditCard, DollarSign, CheckCircle2, PiggyBank, Wallet, Building2, Bell, Database, X, Save, Lock, Plus, Trash2, Search, Eye, Edit3, RotateCcw, AlertTriangle, Clock, Percent, Monitor, Smartphone, Tablet, Laptop, Activity, LogOut, RefreshCw, Shield, Info, Upload } from 'lucide-react';
import { AmountBand, Customer, DeviceSession, OverdueEscalationTier } from '../types';
import { formatRelativeTime, maskIpAddress } from '../utils/deviceUtils';
import { getOverdueEscalationDetails } from '../utils/loanCalculationUtils';

import { KKVLogo } from '../components/common/KKVLogo';
import { WipeAllDataModal } from '../components/admin/WipeAllDataModal';
import { SystemRestoreModal } from '../components/admin/SystemRestoreModal';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { LoanConfigurationSection } from '../components/admin/LoanConfigurationSection';
import { FDConfigurationSection } from '../components/admin/FDConfigurationSection';
import { PurityManagementSection } from '../components/admin/PurityManagementSection';
import { getCanonicalCustomerId, isMatchingCustomerId } from '../utils/customerUtils';
import {
  formatFDDate,
  normalizeDateString,
  getDaysDifference,
  compareFDDates,
  getAllPendingFDInterestPeriods
} from '../utils/fdInterestUtils';
import { rentalApi } from '../modules/rental/services/rentalApi';
import { AdminRentalSummary } from '../modules/rental/types/rental.types';
import { RentalAdminView } from '../modules/rental/components/RentalAdminView';
import { getApiBaseUrl, getStoredAuthToken } from '../services/api';

export const AdminPanel: React.FC = () => {
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const {
    userRole,
    loans,
    customers,
    receipts,
    fixedDeposits,
    dayBookEntries,
    cashInHand,
    cashAtBank,
    masterControlOpen,
    setMasterControlOpen,
    masterControlUnlocked,
    unlockMasterControl,
    changeMasterPassword,
    masterControlSettings,
    updateMasterControlSettings,
    whatsAppTemplates,
    updateWhatsAppTemplates,
    resetAllData,
    reloadAllData,
    bulkUpdateFixedDepositDates,
    deleteCustomer,
    restoreCustomer,
    deleteCustomerPermanently,
    fdInterestPayouts,
    setSelectedProfileCustomerId,
    setCurrentPage,
    startEditCustomer,
    showToast,
    sessions,
    currentSessionId,
    fetchSessions,
    revokeSessionById,
    revokeOtherSessionsExceptCurrent
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'bulk-fd' | 'devices' | 'rental'>('overview');
  const [custSubTab, setCustSubTab] = useState<'active' | 'deleted'>('active');
  const [adminCustSearch, setAdminCustSearch] = useState('');
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Customer | null>(null);
  const [permanentDeleteInput, setPermanentDeleteInput] = useState('');
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [masterSubTab, setMasterSubTab] = useState<'rates' | 'loan-config' | 'fd-config' | 'purity' | 'operations' | 'messaging' | 'security' | 'danger'>('rates');
  // string type so it can hold any loanTypeId (e.g. 'gold-loan', 'silver-loan', 'diamond-loan') OR 'card'/'overdue'/'upi'
  const [ratesSubChip, setRatesSubChip] = useState<string>('gold-loan');

  // ── Rental Management Summary State (Section 28 & 29) ───────────────────────
  const [rentalSummary, setRentalSummary] = useState<AdminRentalSummary | null>(null);
  const [rentalSummaryLoading, setRentalSummaryLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchRentalSummary = async () => {
      setRentalSummaryLoading(true);
      try {
        const token = getStoredAuthToken();
        const res = await fetch(`${getApiBaseUrl()}/admin/rental-summary`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }).then(r => r.json()).catch(() => null);

        if (res?.success && res.data) {
          setRentalSummary(res.data);
        } else {
          // Fallback to rentalApi if direct endpoint is unavailable
          const fallbackRes = await rentalApi.getAdminSummary().catch(() => null);
          if (fallbackRes?.success && fallbackRes.data) {
            setRentalSummary(fallbackRes.data);
          }
        }
      } catch (err) {
        console.warn('Failed to load rental admin summary:', err);
      } finally {
        setRentalSummaryLoading(false);
      }
    };
    fetchRentalSummary();
  }, [activeTab]);

  // ── Devices & Active Sessions State ─────────────────────────────────────────
  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'CURRENT' | 'MOBILE' | 'DESKTOP'>('ALL');
  const [deviceSearch, setDeviceSearch] = useState<string>('');
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<DeviceSession | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<DeviceSession | null>(null);
  const [showRevokeAllOthersModal, setShowRevokeAllOthersModal] = useState<boolean>(false);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === 'devices') {
      fetchSessions();
    }
  }, [activeTab]);

  // ── Rates & Payments — unified per-loan-type config map ─────────────────────
  // Key = loanTypeId, value = editable snapshot of that loan type's config
  const [loanTypeConfigs, setLoanTypeConfigs] = useState<Record<string, Partial<import('../types').LoanTypeConfig>>>({});
  const [loanTypesCardFees, setLoanTypesCardFees] = useState<{ [key: string]: { enabled: boolean; amount: number } }>({});

  // Static non-loan-type rates (overdue, card default, upi, grace)
  const [cardFee, setCardFee] = useState<number | ''>(masterControlSettings?.defaultCardFee ?? 10);
  const [overdueRate, setOverdueRate] = useState<number | ''>(masterControlSettings?.overdueInterestRatePA ?? 24);
  const [overduePenalty, setOverduePenalty] = useState<number | ''>(masterControlSettings?.overduePenaltyPerDayPercent ?? 3.6);
  const [graceDaysVal, setGraceDaysVal] = useState<number | ''>(masterControlSettings?.graceDays ?? 3);
  const [upiIdVal, setUpiIdVal] = useState<string>(masterControlSettings?.upiId || '');
  const [upiPayeeVal, setUpiPayeeVal] = useState<string>(masterControlSettings?.upiPayeeName || '');


  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget || permanentDeleteInput !== 'DELETE') return;
    setIsDeletingPermanently(true);
    try {
      const success = await deleteCustomerPermanently(permanentDeleteTarget.id);
      if (success) {
        setPermanentDeleteTarget(null);
        setPermanentDeleteInput('');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting customer permanently.', 'error');
    } finally {
      setIsDeletingPermanently(false);
    }
  };

  const handleDangerZoneTabClick = () => {
    setMasterSubTab('danger');
  };

  // Overdue calculation method description selection
  const [overdueCalMethod, setOverdueCalMethod] = useState<string>(masterControlSettings?.overdueCalculationMethod || 'Whole months — a part month counts as full (recommended)');

  // Messaging Form State with safe fallbacks
  const [welcomeTpl, setWelcomeTpl] = useState<string>(whatsAppTemplates?.welcomeMessage || '');
  const [dueTpl, setDueTpl] = useState<string>(whatsAppTemplates?.dueReminderMessage || '');
  const [receiptTpl, setReceiptTpl] = useState<string>(whatsAppTemplates?.receiptMessage || '');

  // Security & Unlock Loading State
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isChangingMasterPass, setIsChangingMasterPass] = useState(false);

  // Overdue Escalation State
  const [overdueEscalationOn, setOverdueEscalationOn] = useState<boolean>(
    masterControlSettings?.overdueEscalationEnabled ?? masterControlSettings?.overdueInterest?.enabled ?? false
  );
  const [overdueBaseRateVal, setOverdueBaseRateVal] = useState<number | ''>(
    masterControlSettings?.overdueBaseRateMonthly ?? masterControlSettings?.overdueInterest?.baseRate ?? 2.0
  );
  const [overdueTiersList, setOverdueTiersList] = useState<OverdueEscalationTier[]>(() => {
    const raw = masterControlSettings?.overdueEscalationTiers || masterControlSettings?.overdueInterest?.escalationTiers;
    if (raw && raw.length > 0) {
      return [...raw].sort((a, b) => a.overdueDays - b.overdueDays);
    }
    return [
      { overdueDays: 0, rate: 2.0 },
      { overdueDays: 90, rate: 2.1 },
      { overdueDays: 180, rate: 2.2 },
      { overdueDays: 270, rate: 2.3 },
      { overdueDays: 360, rate: 2.4 }
    ];
  });

  // Overdue Tier Modal / Form State
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null);
  const [tierDaysInput, setTierDaysInput] = useState<string>('');
  const [tierRateInput, setTierRateInput] = useState<string>('');
  const [showTierModal, setShowTierModal] = useState<boolean>(false);
  const [testSimulatorDays, setTestSimulatorDays] = useState<number | ''>(120);

  // Operations Feature Toggles
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(masterControlSettings?.animationsEnabled ?? true);
  const [performanceModeEnabled, setPerformanceModeEnabled] = useState<boolean>(masterControlSettings?.performanceModeEnabled ?? false);
  const [bulkFdDateChangeEnabled, setBulkFdDateChangeEnabled] = useState<boolean>(masterControlSettings?.bulkFdDateChangeEnabled ?? true);
  const [lockersEnabled, setLockersEnabled] = useState<boolean>(masterControlSettings?.lockersEnabled ?? false);

  // Operations lists states
  const [areasVal, setAreasVal] = useState<string[]>(masterControlSettings?.areas || []);
  const [partnersVal, setPartnersVal] = useState<string[]>(masterControlSettings?.partners || []);
  const [vehicleDocsVal, setVehicleDocsVal] = useState<string[]>(masterControlSettings?.vehicleDocuments || []);
  const [vehicleCompaniesVal, setVehicleCompaniesVal] = useState<string[]>(masterControlSettings?.vehicleCompanies || []);
  const [insuranceCompaniesVal, setInsuranceCompaniesVal] = useState<string[]>(masterControlSettings?.insuranceCompanies || []);
  const [showroomsVal, setShowroomsVal] = useState<string[]>(masterControlSettings?.showrooms || []);

  // Sub-tabs navigation states inside master control
  const [operationsSubTab, setOperationsSubTab] = useState<'areas-showrooms' | 'toggles'>('areas-showrooms');
  const [securitySubTab, setSecuritySubTab] = useState<'account' | 'change-pass'>('account');

  // Stored password change states
  const [currentMasterPass, setCurrentMasterPass] = useState('');
  const [newMasterPass, setNewMasterPass] = useState('');

  // Operations inputs state
  const [newAreaInput, setNewAreaInput] = useState('');
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [newDocInput, setNewDocInput] = useState('');
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [newInsCompanyInput, setNewInsCompanyInput] = useState('');
  const [newShowroomInput, setNewShowroomInput] = useState('');

  // Bulk FD Date Change states
  const [selectedFdNos, setSelectedFdNos] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<'shift' | 'set'>('shift');
  const [offsetDaysValue, setOffsetDaysValue] = useState<number | ''>(0);
  const [newDepDateVal, setNewDepDateVal] = useState<string>('');
  const [fdSearchText, setFdSearchText] = useState('');

  useEffect(() => {
    if (masterControlSettings) {
      setAnimationsEnabled(masterControlSettings.animationsEnabled ?? true);
      setPerformanceModeEnabled(masterControlSettings.performanceModeEnabled ?? false);
      setBulkFdDateChangeEnabled(masterControlSettings.bulkFdDateChangeEnabled ?? true);
      setLockersEnabled(masterControlSettings.lockersEnabled ?? false);

      setCardFee(masterControlSettings.defaultCardFee ?? 10);
      setOverdueRate(masterControlSettings.overdueInterestRatePA ?? 24);
      setOverduePenalty(masterControlSettings.overduePenaltyPerDayPercent ?? 3.6);
      setGraceDaysVal(masterControlSettings.graceDays ?? 3);
      setUpiIdVal(masterControlSettings.upiId || '');
      setUpiPayeeVal(masterControlSettings.upiPayeeName || '');

      setOverdueEscalationOn(masterControlSettings.overdueEscalationEnabled ?? masterControlSettings.overdueInterest?.enabled ?? false);
      setOverdueBaseRateVal(masterControlSettings.overdueBaseRateMonthly ?? masterControlSettings.overdueInterest?.baseRate ?? 2.0);
      const rawT = masterControlSettings.overdueEscalationTiers || masterControlSettings.overdueInterest?.escalationTiers;
      if (rawT && rawT.length > 0) {
        setOverdueTiersList([...rawT].sort((a, b) => a.overdueDays - b.overdueDays));
      }

      // Sync per-loan-type config map from masterControlSettings.loanTypes
      const baseLTs = masterControlSettings.loanTypes && masterControlSettings.loanTypes.length > 0
        ? masterControlSettings.loanTypes
        : defaultLoanTypes;

      const configs: Record<string, Partial<import('../types').LoanTypeConfig>> = {};
      const dynamicFees: { [key: string]: { enabled: boolean; amount: number } } = {};

      baseLTs.forEach((lt) => {
        configs[lt.id] = { ...lt };
        dynamicFees[lt.id] = {
          enabled: lt.cardFeeEnabled ?? true,
          amount: lt.cardFee ?? 25
        };
      });

      setLoanTypeConfigs(configs);
      setLoanTypesCardFees(dynamicFees);

      setOverdueCalMethod(masterControlSettings.overdueCalculationMethod || 'Whole months — a part month counts as full (recommended)');

      setAreasVal(masterControlSettings.areas || []);
      setPartnersVal(masterControlSettings.partners || []);
      setVehicleDocsVal(masterControlSettings.vehicleDocuments || []);
      setVehicleCompaniesVal(masterControlSettings.vehicleCompanies || []);
      setInsuranceCompaniesVal(masterControlSettings.insuranceCompanies || []);
      setShowroomsVal(masterControlSettings.showrooms || []);
    }
  }, [masterControlSettings]);


  useEffect(() => {
    if (whatsAppTemplates) {
      setWelcomeTpl(whatsAppTemplates.welcomeMessage || '');
      setDueTpl(whatsAppTemplates.dueReminderMessage || '');
      setReceiptTpl(whatsAppTemplates.receiptMessage || '');
    }
  }, [whatsAppTemplates]);

  // Redirect away from bulk-fd tab if disabled
  useEffect(() => {
    if (masterControlSettings && !masterControlSettings.bulkFdDateChangeEnabled && activeTab === 'bulk-fd') {
      setActiveTab('overview');
    }
  }, [masterControlSettings, activeTab]);

  // Defensive Aggregates with safe array checks
  const safeLoans = loans || [];
  const safeCustomers = customers || [];
  const safeReceipts = receipts || [];
  const safeFixedDeposits = fixedDeposits || [];
  const safeDayBookEntries = dayBookEntries || [];

  const activeLoans = safeLoans.filter((l) => l?.status === 'ACTIVE');
  const totalDisbursed = safeLoans.reduce((sum, l) => sum + (l?.principal || 0), 0);
  const totalOutstanding = safeLoans.reduce((sum, l) => sum + (l?.outstandingPrincipal || 0), 0);
  const totalCollected = safeReceipts.filter((r) => r?.kind !== 'NEW LOAN').reduce((sum, r) => sum + (r?.amount || 0), 0);
  const totalRecords = safeLoans.length + safeCustomers.length + safeReceipts.length + safeFixedDeposits.length + safeDayBookEntries.length;

  const todayStr = formatFDDate(new Date());

  // Fixed Deposit Overview Metrics (Section 25)
  const activeFDs = safeFixedDeposits.filter((f) => f?.status === 'ACTIVE');
  const withdrawnFDs = safeFixedDeposits.filter((f) => f?.status === 'WITHDRAWN' || (f?.status as string) === 'CLOSED');
  const totalFDCustomersCount = safeCustomers.filter((c) => !c.isDeleted && safeFixedDeposits.some((f) => isMatchingCustomerId(f.customerId, c))).length;
  const totalFDPrincipal = safeFixedDeposits.reduce((sum, f) => sum + (f?.principal || 0), 0);
  const totalActiveFDBalance = activeFDs.reduce((sum, f) => sum + (f?.remainingPrincipal ?? f?.principal ?? 0), 0);

  const pendingFDPeriods = getAllPendingFDInterestPeriods(activeFDs, fdInterestPayouts || [], todayStr);
  const pendingFDInterestTotal = pendingFDPeriods.reduce((sum, p) => sum + p.amount, 0);

  const maturingSoonFDs = activeFDs.filter((f) => {
    if (!f.maturityDate) return false;
    const comp = compareFDDates(normalizeDateString(f.maturityDate), todayStr);
    const diffDays = getDaysDifference(todayStr, normalizeDateString(f.maturityDate));
    return comp >= 0 && diffDays <= 30;
  });

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      showToast('Please enter password', 'warning');
      return;
    }
    setIsUnlocking(true);
    const success = await unlockMasterControl(passwordInput);
    setIsUnlocking(false);
    if (success) {
      setPasswordInput('');
    }
  };

  const handleSaveMasterChanges = () => {
    const baseLTs = masterControlSettings?.loanTypes && masterControlSettings.loanTypes.length > 0
      ? masterControlSettings.loanTypes
      : defaultLoanTypes;

    // Merge edits from loanTypeConfigs map back into loanTypes
    const updatedLoanTypes = baseLTs.map((lt) => {
      const cfg = loanTypeConfigs[lt.id] || {};
      const fee = loanTypesCardFees[lt.id];

      // Clean amount bands
      const cleanedBands = (cfg.amountBands || lt.amountBands || []).map(b => ({
        ...b,
        amount: b.amount === ('' as any) ? 0 : Number(b.amount) || 0,
        baseRateMonthly: b.baseRateMonthly === ('' as any) ? 0 : Number(b.baseRateMonthly) || 0,
        penaltyAfterMonths: b.penaltyAfterMonths === ('' as any) ? 0 : Number(b.penaltyAfterMonths) || 0,
        penaltyStepUpMonthly: b.penaltyStepUpMonthly === ('' as any) ? 0 : Number(b.penaltyStepUpMonthly) || 0
      }));

      return {
        ...lt,
        ...cfg,
        amountBands: cleanedBands,
        cardFeeEnabled: fee ? fee.enabled : (cfg.cardFeeEnabled ?? lt.cardFeeEnabled ?? true),
        cardFee: fee ? (Number(fee.amount) || 0) : (cfg.cardFee ?? lt.cardFee ?? 0),
        configurationVersion: (lt.configurationVersion || 1) + (JSON.stringify(cfg) !== JSON.stringify(lt) ? 1 : 0)
      };
    });

    // Validate amount bands for all types
    for (const lt of updatedLoanTypes) {
      for (const b of lt.amountBands || []) {
        if (b.amount < 0 || b.baseRateMonthly < 0 || b.penaltyAfterMonths < 0 || b.penaltyStepUpMonthly < 0) {
          showToast(`${lt.name} amount bands cannot contain negative values.`, 'error');
          return;
        }
      }
    }

    // Derive backward-compat flat fields from per-type configs
    const goldLT = updatedLoanTypes.find(lt => lt.id === 'gold-loan');
    const silverLT = updatedLoanTypes.find(lt => lt.id === 'silver-loan');
    const pronoteLT = updatedLoanTypes.find(lt => lt.id === 'pronote');
    const hireLT = updatedLoanTypes.find(lt => lt.id === 'hire-purchase');

    const numCardFee = cardFee === '' ? 10 : Number(cardFee);
    const numOverdueRate = overdueRate === '' ? 24 : Number(overdueRate);
    const numOverduePenalty = overduePenalty === '' ? 3.6 : Number(overduePenalty);
    const numGraceDays = graceDaysVal === '' ? 3 : Number(graceDaysVal);

    const cleanedTiers = overdueTiersList
      .map(t => ({
        overdueDays: Math.max(0, Math.floor(Number(t.overdueDays) || 0)),
        rate: Math.max(0, Number(t.rate) || 0)
      }))
      .sort((a, b) => a.overdueDays - b.overdueDays);

    if (!cleanedTiers.some(t => t.overdueDays === 0)) {
      cleanedTiers.unshift({ overdueDays: 0, rate: overdueBaseRateVal === '' ? 2.0 : Number(overdueBaseRateVal) });
    }

    updateMasterControlSettings({
      loanTypes: updatedLoanTypes,
      // Backward-compat flat fields derived from per-type configs
      showOnLoanIssue: goldLT?.showOnLoanIssue ?? true,
      hireShowOnLoanIssue: hireLT?.showOnLoanIssue ?? true,
      silverShowOnLoanIssue: silverLT?.showOnLoanIssue ?? true,
      pronoteShowOnLoanIssue: pronoteLT?.showOnLoanIssue ?? true,
      pronoteRate: pronoteLT?.defaultMonthlyRate ?? 12,
      amountBands: goldLT?.amountBands || [],
      silverAmountBands: silverLT?.amountBands || [],
      goldCardFeeEnabled: goldLT?.cardFeeEnabled ?? true,
      goldCardFee: goldLT?.cardFee ?? 0,
      silverCardFeeEnabled: silverLT?.cardFeeEnabled ?? true,
      silverCardFee: silverLT?.cardFee ?? 0,
      pronoteCardFeeEnabled: pronoteLT?.cardFeeEnabled ?? true,
      pronoteCardFee: pronoteLT?.cardFee ?? 0,
      hireCardFeeEnabled: hireLT?.cardFeeEnabled ?? true,
      hireCardFee: hireLT?.cardFee ?? 0,
      silverLoanMonthlyRate: silverLT?.defaultMonthlyRate ?? 2.0,
      pronoteMonthlyRate: pronoteLT?.defaultMonthlyRate ?? 12,
      hirePurchaseMonthlyRate: hireLT?.defaultMonthlyRate ?? 12,
      // Static non-loan-type settings
      overdueCalculationMethod: overdueCalMethod,
      overdueEscalationEnabled: overdueEscalationOn,
      overdueBaseRateMonthly: overdueBaseRateVal === '' ? 2.0 : Number(overdueBaseRateVal),
      overdueEscalationTiers: cleanedTiers,
      overdueInterest: {
        enabled: overdueEscalationOn,
        baseRate: overdueBaseRateVal === '' ? 2.0 : Number(overdueBaseRateVal),
        escalationTiers: cleanedTiers
      },
      animationsEnabled,
      performanceModeEnabled,
      bulkFdDateChangeEnabled,
      lockersEnabled,
      defaultCardFee: numCardFee,
      overdueInterestRatePA: numOverdueRate,
      overduePenaltyPerDayPercent: numOverduePenalty,
      graceDays: numGraceDays,
      upiId: upiIdVal,
      upiPayeeName: upiPayeeVal,
      areas: areasVal,
      partners: partnersVal,
      vehicleDocuments: vehicleDocsVal,
      vehicleCompanies: vehicleCompaniesVal,
      insuranceCompanies: insuranceCompaniesVal,
      showrooms: showroomsVal
    });
    updateWhatsAppTemplates({
      welcomeMessage: welcomeTpl,
      dueReminderMessage: dueTpl,
      receiptMessage: receiptTpl
    });
    setMasterControlOpen(false);
  };


  const handleAddArea = () => {
    if (newAreaInput.trim()) {
      setAreasVal(prev => [...prev, newAreaInput.trim()]);
      setNewAreaInput('');
    }
  };
  const handleRemoveArea = (index: number) => {
    setAreasVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPartner = () => {
    if (newPartnerInput.trim()) {
      setPartnersVal(prev => [...prev, newPartnerInput.trim()]);
      setNewPartnerInput('');
    }
  };
  const handleRemovePartner = (index: number) => {
    setPartnersVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDoc = () => {
    if (newDocInput.trim()) {
      setVehicleDocsVal(prev => [...prev, newDocInput.trim()]);
      setNewDocInput('');
    }
  };
  const handleRemoveDoc = (index: number) => {
    setVehicleDocsVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCompany = () => {
    if (newCompanyInput.trim()) {
      setVehicleCompaniesVal(prev => [...prev, newCompanyInput.trim()]);
      setNewCompanyInput('');
    }
  };
  const handleRemoveCompany = (index: number) => {
    setVehicleCompaniesVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddInsCompany = () => {
    if (newInsCompanyInput.trim()) {
      setInsuranceCompaniesVal(prev => [...prev, newInsCompanyInput.trim()]);
      setNewInsCompanyInput('');
    }
  };
  const handleRemoveInsCompany = (index: number) => {
    setInsuranceCompaniesVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddShowroom = () => {
    if (newShowroomInput.trim()) {
      setShowroomsVal(prev => [...prev, newShowroomInput.trim()]);
      setNewShowroomInput('');
    }
  };
  const handleRemoveShowroom = (index: number) => {
    setShowroomsVal(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAmountBandForType = (loanTypeId: string) => {
    const newBand: AmountBand = {
      id: `band-${loanTypeId}-${Date.now()}`,
      condition: 'Above',
      amount: 10000,
      baseRateMonthly: 1.5,
      penaltyAfterMonths: 3,
      penaltyStepUpMonthly: 0.1,
      penaltyCalculation: 'From the start — stepped rate over the whole overc'
    };
    setLoanTypeConfigs(prev => ({
      ...prev,
      [loanTypeId]: {
        ...prev[loanTypeId],
        amountBands: [...(prev[loanTypeId]?.amountBands || []), newBand]
      }
    }));
  };

  const handleUpdateAmountBandForType = (loanTypeId: string, bandId: string, field: string, value: any) => {
    setLoanTypeConfigs(prev => ({
      ...prev,
      [loanTypeId]: {
        ...prev[loanTypeId],
        amountBands: (prev[loanTypeId]?.amountBands || []).map(b =>
          b.id === bandId ? { ...b, [field]: value } : b
        )
      }
    }));
  };

  const handleRemoveAmountBandForType = (loanTypeId: string, bandId: string) => {
    setLoanTypeConfigs(prev => ({
      ...prev,
      [loanTypeId]: {
        ...prev[loanTypeId],
        amountBands: (prev[loanTypeId]?.amountBands || []).filter(b => b.id !== bandId)
      }
    }));
  };


  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero Banner */}
      <div className="admin-hero-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <KKVLogo size={52} />
          <div>
            <div className="admin-session-badge" style={{ marginBottom: '6px' }}>⚡ Admin Control Center</div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>KKV GOLD FINANCE</h1>
            <p style={{ fontSize: '13px', margin: '4px 0 0', color: 'var(--text-secondary)' }}>Manage companies, access, data &amp; danger-zone actions</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', background: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '1px solid rgba(201, 162, 39, 0.25)' }}>🟢 ADMIN SESSION ACTIVE</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'customers', label: 'Customer Management' },
          { key: 'rental', label: 'Complex Rental' },
          masterControlSettings?.bulkFdDateChangeEnabled && { key: 'bulk-fd', label: 'Bulk FD Date Change' },
          { key: 'devices', label: 'Devices' }
        ].filter((x): x is { key: string; label: string } => !!x).map((t) => (
          <button
            key={t.key}
            type="button"
            style={{
              borderRadius: '10px',
              fontSize: '13.5px',
              padding: '8px 18px',
              fontWeight: activeTab === t.key ? 700 : 600,
              backgroundColor: activeTab === t.key ? '#176B52' : '#FFFFFF',
              color: activeTab === t.key ? '#FFFFFF' : '#4B5E54',
              border: activeTab === t.key ? '1px solid #176B52' : '1px solid #D8E0DA',
              boxShadow: activeTab === t.key ? '0 4px 12px rgba(23, 107, 82, 0.28)' : '0 2px 4px rgba(15, 60, 45, 0.04)',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onClick={() => setActiveTab(t.key as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid #DDE5DF', boxShadow: '0 6px 20px rgba(15, 60, 45, 0.08)', backgroundColor: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1F2D26', margin: 0 }}>Master Control</h3>
                <p style={{ fontSize: '13px', color: '#66756D', margin: '3px 0 0' }}>Master security, bank &amp; UPI details, operations and danger-zone tools.</p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setMasterControlOpen(true)} style={{ backgroundColor: '#176B52', color: '#FFFFFF', fontWeight: 700, borderRadius: '10px', height: '42px', padding: '0 20px', boxShadow: '0 2px 8px rgba(23, 107, 82, 0.25)', gap: '8px' }}>
              <span>Open Master Control</span>
            </button>
          </div>

          {/* LOANS & CASH OVERVIEW */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>
              LOAN &amp; CASH OVERVIEW
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">CUSTOMERS</span>
                  <span className="stat-card-value">{safeCustomers.length}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Users size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">ACTIVE LOANS</span>
                  <span className="stat-card-value">{activeLoans.length}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}><CreditCard size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL DISBURSED</span>
                  <span className="stat-card-value">₹{totalDisbursed.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}><DollarSign size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">OUTSTANDING</span>
                  <span className="stat-card-value">₹{totalOutstanding.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Wallet size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">COLLECTED</span>
                  <span className="stat-card-value">₹{totalCollected.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#059669' }}><CheckCircle2 size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">CASH IN HAND</span>
                  <span className="stat-card-value">₹{(cashInHand || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Wallet size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">CASH AT BANK</span>
                  <span className="stat-card-value">₹{(cashAtBank || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}><Building2 size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL RECORDS</span>
                  <span className="stat-card-value">{totalRecords}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Database size={20} /></div>
              </div>
            </div>
          </div>

          {/* SECTION 25: FIXED DEPOSITS OVERVIEW */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>
              FIXED DEPOSITS OVERVIEW
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL FD CUSTOMERS</span>
                  <span className="stat-card-value">{totalFDCustomersCount}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Users size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">ACTIVE FDs</span>
                  <span className="stat-card-value">{activeFDs.length}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}><PiggyBank size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL FD PRINCIPAL</span>
                  <span className="stat-card-value">₹{totalFDPrincipal.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}><DollarSign size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">ACTIVE FD BALANCE</span>
                  <span className="stat-card-value">₹{totalActiveFDBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#059669' }}><Wallet size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">PENDING FD INTEREST</span>
                  <span className="stat-card-value" style={pendingFDInterestTotal > 0 ? { color: '#dc2626' } : undefined}>
                    ₹{pendingFDInterestTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: pendingFDInterestTotal > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.15)', color: pendingFDInterestTotal > 0 ? '#dc2626' : '#D97706' }}><Bell size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">MATURING SOON (30D)</span>
                  <span className="stat-card-value">{maturingSoonFDs.length}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}><Clock size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">WITHDRAWN FDs</span>
                  <span className="stat-card-value">{withdrawnFDs.length}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748b' }}><CheckCircle2 size={20} /></div>
              </div>

              <div
                className="stat-card"
                style={{ cursor: 'pointer', border: '1.5px dashed var(--color-primary-accent, #B48909)' }}
                onClick={() => setCurrentPage('settings')}
                title="Configured in Settings → Gold Rates & Rates"
              >
                <div className="stat-card-info">
                  <span className="stat-card-label">MASTER FD RATE</span>
                  <span className="stat-card-value" style={{ color: 'var(--color-primary-dark, #064e3b)' }}>
                    {(masterControlSettings?.fdInterestRate ?? 12).toFixed(2)}% <span style={{ fontSize: '12px', fontWeight: 600 }}>p.a.</span>
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Eff: {masterControlSettings?.fdInterestRateEffectiveFrom || '01-08-2026'}
                  </span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.18)', color: '#B48909' }}><Percent size={20} /></div>
              </div>
            </div>
          </div>

          {/* COMPLEX RENTAL MANAGEMENT OVERVIEW (LIVE PRIMARY DB) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏢 COMPLEX RENTAL MANAGEMENT (LIVE LEDGER)</span>
                {rentalSummaryLoading && <RefreshCw size={12} className="spin-animation" />}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage('rental-dashboard')}
                style={{ fontSize: '12px', height: '28px', padding: '0 12px', gap: '5px' }}
                title="Open Rental Management Module"
              >
                <span>Rental Management Module ↗</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL COMPLEXES</span>
                  <span className="stat-card-value">{rentalSummary?.totalComplexes ?? 0}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Building2 size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL SHOPS</span>
                  <span className="stat-card-value">{rentalSummary?.totalShops ?? 0}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}><Building2 size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">EXPECTED RENT</span>
                  <span className="stat-card-value">₹{(rentalSummary?.expectedMonthlyRent || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}><DollarSign size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">COLLECTED THIS MONTH</span>
                  <span className="stat-card-value" style={{ color: '#059669' }}>₹{(rentalSummary?.collectedThisMonth || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#059669' }}><CheckCircle2 size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">PENDING RENT</span>
                  <span className="stat-card-value" style={{ color: '#dc2626' }}>₹{(rentalSummary?.pendingRent || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}><AlertTriangle size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">AVAILABLE ADVANCE</span>
                  <span className="stat-card-value" style={{ color: '#2563eb' }}>₹{(rentalSummary?.advanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}><Wallet size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL EXPENSES</span>
                  <span className="stat-card-value" style={{ color: '#d97706' }}>₹{(rentalSummary?.totalExpenses || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}><DollarSign size={20} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">NET RENTAL COLLECTION</span>
                  <span className="stat-card-value" style={{ color: '#176B52', fontWeight: 800 }}>₹{(rentalSummary?.netCollection || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.15)', color: '#176B52' }}><CheckCircle2 size={20} /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complex Rental Tab Content (Synchronized Read-Only Live Ledger) */}
      {activeTab === 'rental' && <RentalAdminView />}

      {/* Customer Management Tab Content */}
      {activeTab === 'customers' && (() => {
        const query = adminCustSearch.toLowerCase().trim();

        const filteredCusts = customers
          .filter(c => (custSubTab === 'deleted' ? Boolean(c.isDeleted) : !c.isDeleted))
          .filter(c => {
            if (!query) return true;
            const canonicalId = getCanonicalCustomerId(c).toLowerCase();
            const numIdStr = c.customerId ? c.customerId.toString().toLowerCase() : '';
            const matchesLoanNo = safeLoans.some(l => isMatchingCustomerId(l.customerId, c) && l.loanNo.toLowerCase().includes(query));
            const matchesFDNo = safeFixedDeposits.some(f => isMatchingCustomerId(f.customerId, c) && f.fdNo.toLowerCase().includes(query));

            return (
              c.name.toLowerCase().includes(query) ||
              c.phone.includes(query) ||
              c.id.toLowerCase().includes(query) ||
              canonicalId.includes(query) ||
              numIdStr.includes(query) ||
              isMatchingCustomerId(query, c) ||
              matchesLoanNo ||
              matchesFDNo
            );
          });

        const topMatch = query && filteredCusts.length > 0 ? filteredCusts[0] : null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Bar: Subtabs & Search */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${custSubTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '6px 16px' }}
                    onClick={() => setCustSubTab('active')}
                  >
                    Active Customers ({customers.filter(c => !c.isDeleted).length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${custSubTab === 'deleted' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '6px 16px' }}
                    onClick={() => setCustSubTab('deleted')}
                  >
                    Deleted Customers ({customers.filter(c => c.isDeleted).length})
                  </button>
                </div>

                <div style={{ position: 'relative', width: '360px' }}>
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '38px', height: '40px', fontSize: '13px' }}
                    placeholder="Search Customer ID (e.g. CUST-0006), Name, Mobile..."
                    value={adminCustSearch}
                    onChange={(e) => setAdminCustSearch(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            {/* SECTION 17: TOP MATCH HIGHLIGHT CARD */}
            {topMatch && (
              (() => {
                const c = topMatch;
                const custCanonicalId = getCanonicalCustomerId(c);
                const custLoans = safeLoans.filter(l => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED');
                const custFDs = safeFixedDeposits.filter(f => isMatchingCustomerId(f.customerId, c));
                const activeCustFDs = custFDs.filter(f => f.status === 'ACTIVE');
                const totalCustFdBal = activeCustFDs.reduce((sum, f) => sum + (f.remainingPrincipal ?? f.principal ?? 0), 0);

                return (
                  <div
                    className="card"
                    style={{
                      padding: '18px 22px',
                      borderLeft: '5px solid var(--color-primary-accent, #059669)',
                      backgroundColor: '#ffffff',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-border)', overflow: 'hidden' }}>
                          {c.customerPhoto ? (
                            <img src={c.customerPhoto} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--color-primary-dark)', margin: 0 }}>
                              {c.name}
                            </h3>
                            <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 800 }}>
                              {custCanonicalId}
                            </span>
                            <span className="badge badge-success" style={{ fontSize: '11px' }}>
                              {c.isDeleted ? 'DELETED' : 'ACTIVE'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                            <span>Mobile: <strong>+91 {c.phone}</strong></span>
                            <span>&bull;</span>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>Loans: {custLoans.length}</span>
                            <span>&bull;</span>
                            <span style={{ fontWeight: 800, color: 'var(--color-gold-dark, #b45309)' }}>Fixed Deposits: {activeCustFDs.length} ACTIVE</span>
                            <span>&bull;</span>
                            <span style={{ fontWeight: 800, color: 'var(--color-primary-accent, #059669)' }}>FD Balance: ₹{totalCustFdBal.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedProfileCustomerId(c.id);
                          setCurrentPage('customer-profile');
                        }}
                        style={{ fontWeight: 800, padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Eye size={14} />
                        <span>View Customer Overview &rarr;</span>
                      </button>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Customer Table Card (Sections 2 & 3) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER ID</th>
                      <th>PROFILE</th>
                      <th>CUSTOMER</th>
                      <th>MOBILE</th>
                      <th>LOANS</th>
                      <th>FIXED DEPOSITS</th>
                      <th>FINANCIAL EXPOSURE</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'center', width: '160px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCusts.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          No {custSubTab === 'deleted' ? 'deleted' : 'active'} customer records found.
                        </td>
                      </tr>
                    ) : (
                      filteredCusts.map((c) => {
                        const custCanonicalId = getCanonicalCustomerId(c);
                        const custLoans = safeLoans.filter(l => isMatchingCustomerId(l.customerId, c) && l.status !== 'CLOSED');
                        const custOutstanding = custLoans.reduce((sum, l) => sum + (l.outstandingPrincipal ?? l.principal ?? 0), 0);
                        const custFDs = safeFixedDeposits.filter(f => isMatchingCustomerId(f.customerId, c));
                        const activeCustFDs = custFDs.filter(f => f.status === 'ACTIVE');
                        const totalCustFdBal = activeCustFDs.reduce((sum, f) => sum + (f.remainingPrincipal ?? f.principal ?? 0), 0);
                        const exposure = custOutstanding + totalCustFdBal;

                        return (
                          <tr key={c.id}>
                            <td>
                              <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 800 }}>
                                {custCanonicalId}
                              </span>
                            </td>
                            <td>
                              {c.customerPhoto ? (
                                <img
                                  src={c.customerPhoto}
                                  alt={c.name}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '1.5px solid var(--color-primary-accent)'
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--color-light-accent)',
                                    color: 'var(--color-primary-dark)',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{c.name}</td>
                            <td style={{ fontWeight: 600 }}>+91 {c.phone}</td>
                            <td>
                              {custLoans.length > 0 ? (
                                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                  {custLoans.length} Active
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>0 Loans</span>
                              )}
                            </td>
                            <td>
                              {/* Section 3: FIXED DEPOSITS COLUMN */}
                              {activeCustFDs.length > 0 ? (
                                <span className="badge badge-gold" style={{ fontSize: '11px', fontWeight: 800 }}>
                                  {activeCustFDs.length} ACTIVE
                                </span>
                              ) : custFDs.length > 0 ? (
                                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                                  {custFDs.length} Historical
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>0 FDs</span>
                              )}
                            </td>
                            <td>
                              <strong style={{ color: exposure > 0 ? 'var(--color-primary-dark)' : 'var(--text-muted)', fontSize: '12.5px' }}>
                                ₹{exposure.toLocaleString('en-IN')}
                              </strong>
                            </td>
                            <td>
                              {c.isDeleted ? (
                                <span className="badge badge-danger" style={{ fontSize: '11px' }}>DELETED</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '11px' }}>VERIFIED</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                {custSubTab === 'deleted' ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ height: '28px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                                      title="Restore Customer"
                                      onClick={() => restoreCustomer(c.id)}
                                    >
                                      <RotateCcw size={12} />
                                      <span>Restore</span>
                                    </button>
                                    {userRole === 'ADMIN' && (
                                      <button
                                        className="btn btn-sm"
                                        style={{
                                          height: '28px',
                                          padding: '0 8px',
                                          fontSize: '11px',
                                          gap: '4px',
                                          backgroundColor: '#ef4444',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '6px',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                        title="Delete Completely (Master Admin Only)"
                                        onClick={() => {
                                          setPermanentDeleteTarget(c);
                                          setPermanentDeleteInput('');
                                        }}
                                      >
                                        <Trash2 size={12} />
                                        <span>🗑 Delete Completely</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ height: '28px', padding: '0 8px', fontSize: '11px', gap: '4px', fontWeight: 700 }}
                                      title="View Customer Overview"
                                      onClick={() => {
                                        setSelectedProfileCustomerId(c.id);
                                        setCurrentPage('customer-profile');
                                      }}
                                    >
                                      <Eye size={12} />
                                      <span>View &rarr;</span>
                                    </button>
                                    <button
                                      className="icon-button"
                                      style={{ width: '28px', height: '28px' }}
                                      title="Edit Customer"
                                      onClick={() => startEditCustomer(c.id)}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    {userRole === 'ADMIN' && (
                                      <button
                                        className="icon-button"
                                        style={{ width: '28px', height: '28px', color: 'var(--color-danger, #ef4444)' }}
                                        title="Delete Customer (Master Admin Only)"
                                        onClick={() => setDeletingCustomer(c)}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {activeTab === 'bulk-fd' && masterControlSettings?.bulkFdDateChangeEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Bulk Fixed Deposit Date Change</h2>
                <p className="card-description">Modify deposit dates in bulk for selected Fixed Deposits. Daybook entry dates will automatically synchronize.</p>
              </div>
              {safeFixedDeposits.length > 0 && (
                <span className="badge badge-success">
                  {safeFixedDeposits.filter((f) => f.status === 'ACTIVE').length} Active FDs
                </span>
              )}
            </div>

            {safeFixedDeposits.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No fixed deposits in this company yet.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search deposits by name, FD no, or phone..."
                      className="input-control"
                      style={{ paddingLeft: '36px', width: '100%' }}
                      value={fdSearchText}
                      onChange={(e) => setFdSearchText(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${dateMode === 'shift' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                      onClick={() => setDateMode('shift')}
                    >
                      Shift by Days
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${dateMode === 'set' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                      onClick={() => setDateMode('set')}
                    >
                      Set Specific Date
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', backgroundColor: 'var(--bg-surface-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                  {dateMode === 'shift' ? (
                    <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                      <label className="form-label required">DAYS TO SHIFT (+/-)</label>
                      <input
                        type="number"
                        className="input-control"
                        placeholder="e.g. 5 or -10"
                        value={offsetDaysValue}
                        onChange={(e) => setOffsetDaysValue(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>
                  ) : (
                    <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                      <label className="form-label required">NEW DEPOSIT DATE</label>
                      <input
                        type="date"
                        className="input-control"
                        value={newDepDateVal}
                        onChange={(e) => setNewDepDateVal(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: '38px', fontWeight: 700 }}
                    disabled={selectedFdNos.length === 0 || (dateMode === 'shift' && !offsetDaysValue) || (dateMode === 'set' && !newDepDateVal)}
                    onClick={async () => {
                      let formattedDate: string | undefined = undefined;
                      if (dateMode === 'set' && newDepDateVal) {
                        const [yyyy, mm, dd] = newDepDateVal.split('-');
                        formattedDate = `${dd}/${mm}/${yyyy}`;
                      }

                      const success = await bulkUpdateFixedDepositDates(
                        selectedFdNos,
                        formattedDate,
                        dateMode === 'shift' ? (Number(offsetDaysValue) || 0) : undefined
                      );
                      if (success) {
                        setSelectedFdNos([]);
                        setOffsetDaysValue(0);
                        setNewDepDateVal('');
                      }
                    }}
                  >
                    Apply Change ({selectedFdNos.length} Selected)
                  </button>
                </div>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedFdNos.length === safeFixedDeposits.filter((f) => f.status === 'ACTIVE').length && safeFixedDeposits.filter((f) => f.status === 'ACTIVE').length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFdNos(safeFixedDeposits.filter((f) => f.status === 'ACTIVE').map((f) => f.fdNo));
                              } else {
                                setSelectedFdNos([]);
                              }
                            }}
                          />
                        </th>
                        <th>FD NO</th>
                        <th>DEPOSITOR</th>
                        <th>PRINCIPAL</th>
                        <th>RATE (% P.A.)</th>
                        <th>DEPOSIT DATE</th>
                        <th>MATURITY DATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeFixedDeposits
                        .filter((f) => {
                          const search = fdSearchText.toLowerCase();
                          return (
                            f.fdNo.toLowerCase().includes(search) ||
                            f.depositorName.toLowerCase().includes(search) ||
                            f.phone.includes(search)
                          );
                        })
                        .map((f) => {
                          const isSelected = selectedFdNos.includes(f.fdNo);
                          const isChangeable = f.status === 'ACTIVE';
                          return (
                            <tr key={f.id} style={{ opacity: isChangeable ? 1 : 0.6 }}>
                              <td>
                                <input
                                  type="checkbox"
                                  disabled={!isChangeable}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFdNos((prev) => [...prev, f.fdNo]);
                                    } else {
                                      setSelectedFdNos((prev) => prev.filter((no) => no !== f.fdNo));
                                    }
                                  }}
                                />
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{f.fdNo}</td>
                              <td style={{ fontWeight: 600 }}>{f.depositorName}</td>
                              <td style={{ fontWeight: 700 }}>₹{f.principal.toLocaleString('en-IN')}</td>
                              <td>{f.interestRatePA}%</td>
                              <td>{f.depositDate}</td>
                              <td>{f.maturityDate}</td>
                              <td>
                                <span className={`badge ${f.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                                  {f.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DEVICES & ACTIVE SESSION MANAGEMENT                                  */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (() => {
        const allSessions = sessions || [];
        const activeSessions = allSessions.filter((s) => s.status === 'ACTIVE');
        const inactiveSessions = allSessions.filter((s) => s.status !== 'ACTIVE');
        const otherActiveSessions = activeSessions.filter((s) => s.sessionId !== currentSessionId);
        const currentDeviceSession = allSessions.find((s) => s.sessionId === currentSessionId) || {
          sessionId: currentSessionId,
          userId: userRole === 'ADMIN' ? 'kkv_master_admin' : 'kkv_staff',
          userRole: userRole || 'ADMIN',
          userEmail: 'goldfinancekkv@gmail.com',
          deviceType: 'DESKTOP',
          deviceName: 'Windows PC (This Device)',
          operatingSystem: 'Windows 11',
          browser: 'Chrome',
          ipAddress: '192.168.1.102',
          location: 'Salem, Tamil Nadu, India',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'ACTIVE',
          isCurrent: true
        } as DeviceSession;

        const filteredSessions = allSessions.filter((s) => {
          const isCurr = s.sessionId === currentSessionId;
          if (deviceFilter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
          if (deviceFilter === 'INACTIVE' && s.status === 'ACTIVE') return false;
          if (deviceFilter === 'CURRENT' && !isCurr) return false;
          if (deviceFilter === 'MOBILE' && s.deviceType !== 'MOBILE' && s.deviceType !== 'TABLET') return false;
          if (deviceFilter === 'DESKTOP' && s.deviceType !== 'DESKTOP' && s.deviceType !== 'LAPTOP') return false;

          if (deviceSearch.trim()) {
            const q = deviceSearch.trim().toLowerCase();
            const matchName = s.deviceName?.toLowerCase().includes(q);
            const matchBrowser = s.browser?.toLowerCase().includes(q);
            const matchOS = s.operatingSystem?.toLowerCase().includes(q);
            const matchIp = s.ipAddress?.toLowerCase().includes(q);
            const matchId = s.sessionId?.toLowerCase().includes(q);
            if (!matchName && !matchBrowser && !matchOS && !matchIp && !matchId) return false;
          }
          return true;
        });

        const getDeviceIcon = (type?: string) => {
          switch (type) {
            case 'MOBILE':
              return <Smartphone size={22} />;
            case 'TABLET':
              return <Tablet size={22} />;
            case 'LAPTOP':
              return <Laptop size={22} />;
            default:
              return <Monitor size={22} />;
          }
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Header Card */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-dark)' }}>
                      DEVICE &amp; ACTIVE SESSION MANAGEMENT
                    </h2>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      View and manage devices currently signed in to KKV Gold Finance.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', backgroundColor: 'rgba(23, 107, 82, 0.08)', color: 'var(--color-primary-dark)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '1px solid rgba(23, 107, 82, 0.2)' }}>
                    Signed in as Master Admin (goldfinancekkv@gmail.com)
                  </span>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      fetchSessions();
                      showToast('Refreshed active device sessions.', 'info');
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">ACTIVE DEVICES</span>
                  <span className="stat-card-value" style={{ color: '#059669' }}>{activeSessions.length}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Live authenticated sessions</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#059669' }}><Activity size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">CURRENT DEVICE</span>
                  <span className="stat-card-value">1</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>This browser window</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909' }}><Monitor size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">OTHER ACTIVE DEVICES</span>
                  <span className="stat-card-value">{otherActiveSessions.length}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remote active sessions</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}><Smartphone size={20} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-card-info">
                  <span className="stat-card-label">TOTAL RECORDED SESSIONS</span>
                  <span className="stat-card-value">{allSessions.length}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active &amp; recent history</span>
                </div>
                <div className="stat-card-icon" style={{ backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52' }}><Database size={20} /></div>
              </div>
            </div>

            {/* CURRENT DEVICE HIGHLIGHT CARD */}
            <div className="card" style={{ padding: '24px', border: '2px solid var(--color-primary-accent, #B48909)', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 4px 18px rgba(180, 137, 9, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge badge-gold" style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
                    ★ CURRENT DEVICE (THIS BROWSER)
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
                    ACTIVE NOW
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', height: '32px', gap: '5px' }}
                    onClick={() => setSelectedSessionForDetails(currentDeviceSession)}
                  >
                    <Info size={13} />
                    <span>Technical Details</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', height: '32px', gap: '5px', color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => setSessionToRevoke(currentDeviceSession)}
                  >
                    <LogOut size={13} />
                    <span>Sign Out Current Device</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#B48909', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getDeviceIcon(currentDeviceSession.deviceType)}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DEVICE &amp; OS</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)' }}>{currentDeviceSession.deviceName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentDeviceSession.operatingSystem}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>BROWSER</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{currentDeviceSession.browser}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{currentDeviceSession.browserVersion || 'Latest'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>IP &amp; LOCATION</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-dark)' }}>{maskIpAddress(currentDeviceSession.ipAddress)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentDeviceSession.location || 'Salem, Tamil Nadu'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVITY STATUS</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#059669' }}>Last Active: Just now</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Logged in: {new Date(currentDeviceSession.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>

            {/* Filter, Search & Global Action Bar */}
            <div className="card" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { key: 'ALL', label: `All (${allSessions.length})` },
                    { key: 'ACTIVE', label: `Active (${activeSessions.length})` },
                    { key: 'INACTIVE', label: `Inactive (${inactiveSessions.length})` },
                    { key: 'CURRENT', label: 'Current Device' },
                    { key: 'DESKTOP', label: 'Desktop / Laptop' },
                    { key: 'MOBILE', label: 'Mobile / Tablet' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`btn btn-sm ${deviceFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px', borderRadius: 'var(--radius-full)', padding: '5px 14px' }}
                      onClick={() => setDeviceFilter(f.key as any)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{ position: 'relative', minWidth: '240px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Search device, browser, OS, IP..."
                      style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px', width: '100%' }}
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                    />
                  </div>

                  {otherActiveSessions.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ height: '36px', fontSize: '12px', fontWeight: 700, color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setShowRevokeAllOthersModal(true)}
                    >
                      <LogOut size={14} />
                      <span>Sign Out All Other Devices ({otherActiveSessions.length})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Other Devices / Sessions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AUTHENTICATED SESSIONS ({filteredSessions.length})
                </h3>
              </div>

              {filteredSessions.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Monitor size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>NO SESSIONS FOUND</div>
                  <div style={{ fontSize: '12.5px', marginTop: '4px' }}>No device sessions match the selected filter or search query.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {filteredSessions.map((s) => {
                    const isCurr = s.sessionId === currentSessionId;
                    const isActive = s.status === 'ACTIVE';
                    const isRevoked = s.status === 'REVOKED';

                    return (
                      <div
                        key={s.sessionId}
                        className="card"
                        style={{
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '16px',
                          border: isCurr ? '2px solid var(--color-primary-accent, #B48909)' : '1px solid var(--border-color)',
                          backgroundColor: isRevoked ? 'rgba(241, 245, 249, 0.6)' : '#ffffff',
                          position: 'relative'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '8px',
                                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                                  color: isActive ? '#059669' : '#64748b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {getDeviceIcon(s.deviceType)}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)' }}>
                                    {s.deviceName}
                                  </h4>
                                  {isCurr && (
                                    <span className="badge badge-gold" style={{ fontSize: '9px', fontWeight: 800 }}>
                                      CURRENT
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {s.browser} • {s.operatingSystem}
                                </div>
                              </div>
                            </div>

                            <div>
                              {isActive ? (
                                <span className="badge badge-success" style={{ fontSize: '10px', fontWeight: 800 }}>
                                  ● ACTIVE
                                </span>
                              ) : isRevoked ? (
                                <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                                  SIGNED OUT
                                </span>
                              ) : (
                                <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                                  ○ INACTIVE
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', padding: '12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>LOCATION</span>
                              <strong style={{ color: 'var(--text-dark)' }}>{s.location || 'Salem, Tamil Nadu'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>IP ADDRESS</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{maskIpAddress(s.ipAddress)}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>LOGGED IN</span>
                              <span>{new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>LAST ACTIVE</span>
                              <strong style={{ color: isActive ? '#059669' : 'var(--text-muted)' }}>{formatRelativeTime(s.lastActiveAt)}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11.5px', height: '30px' }}
                            onClick={() => setSelectedSessionForDetails(s)}
                          >
                            Details
                          </button>

                          {!isRevoked ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11.5px', height: '30px', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => setSessionToRevoke(s)}
                            >
                              <LogOut size={12} style={{ marginRight: '4px' }} />
                              <span>{isCurr ? 'Sign Out Self' : 'Sign Out'}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Session Ended
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MODAL 1: SIGN OUT CONFIRMATION (SINGLE SESSION) */}
            {sessionToRevoke && (
              <div className="modal-overlay" style={{ zIndex: 1100 }}>
                <div className="modal-content" style={{ maxWidth: '480px', padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <LogOut size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)' }}>
                        {sessionToRevoke.sessionId === currentSessionId ? 'SIGN OUT CURRENT DEVICE?' : 'SIGN OUT DEVICE?'}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Session Revocation Confirmation
                      </p>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card-muted, #f8fafc)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Device:</span>
                      <strong>{sessionToRevoke.deviceName} ({sessionToRevoke.operatingSystem})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Browser:</span>
                      <strong>{sessionToRevoke.browser}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>IP / Location:</span>
                      <span>{maskIpAddress(sessionToRevoke.ipAddress)} • {sessionToRevoke.location}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Last Active:</span>
                      <strong style={{ color: '#059669' }}>{formatRelativeTime(sessionToRevoke.lastActiveAt)}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', color: '#b91c1c', lineHeight: 1.45 }}>
                      {sessionToRevoke.sessionId === currentSessionId ? (
                        <span><strong>Warning:</strong> You are about to sign out your current session. You will be immediately returned to the workspace login screen.</span>
                      ) : (
                        <span><strong>Notice:</strong> This action will immediately terminate access for <strong>{sessionToRevoke.deviceName}</strong>. Any ongoing operations on that device will be safely halted.</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isRevoking}
                      onClick={() => setSessionToRevoke(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={isRevoking}
                      style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 800, padding: '8px 22px', border: 'none', borderRadius: '8px' }}
                      onClick={async () => {
                        setIsRevoking(true);
                        try {
                          await revokeSessionById(sessionToRevoke.sessionId);
                          setSessionToRevoke(null);
                        } finally {
                          setIsRevoking(false);
                        }
                      }}
                    >
                      {isRevoking ? 'Signing Out...' : 'Sign Out Device'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 2: SIGN OUT ALL OTHER DEVICES */}
            {showRevokeAllOthersModal && (
              <div className="modal-overlay" style={{ zIndex: 1100 }}>
                <div className="modal-content" style={{ maxWidth: '480px', padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)' }}>
                        SIGN OUT ALL OTHER DEVICES?
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Batch Session Termination
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '13px', lineHeight: 1.5 }}>
                    This action will immediately sign out <strong>{otherActiveSessions.length} remote active device(s)</strong>.
                    <br />
                    Your <strong>current device</strong> session will remain safely authenticated and active.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={isRevoking}
                      onClick={() => setShowRevokeAllOthersModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={isRevoking}
                      style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 800, padding: '8px 22px', border: 'none', borderRadius: '8px' }}
                      onClick={async () => {
                        setIsRevoking(true);
                        try {
                          await revokeOtherSessionsExceptCurrent();
                          setShowRevokeAllOthersModal(false);
                        } finally {
                          setIsRevoking(false);
                        }
                      }}
                    >
                      {isRevoking ? 'Signing Out...' : 'Sign Out All Others'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 3: TECHNICAL SESSION DETAILS */}
            {selectedSessionForDetails && (
              <div className="modal-overlay" style={{ zIndex: 1100 }}>
                <div className="modal-content" style={{ maxWidth: '540px', padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(23, 107, 82, 0.12)', color: '#176B52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Info size={20} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-dark)' }}>
                          SESSION TECHNICAL METADATA
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {selectedSessionForDetails.deviceName}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      onClick={() => setSelectedSessionForDetails(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Session Identifier:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{selectedSessionForDetails.sessionId}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>User Account:</span>
                      <strong>{selectedSessionForDetails.userEmail || 'goldfinancekkv@gmail.com'} ({selectedSessionForDetails.userRole})</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Device / Platform:</span>
                      <strong>{selectedSessionForDetails.deviceName} ({selectedSessionForDetails.deviceType})</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating System:</span>
                      <strong>{selectedSessionForDetails.operatingSystem}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Browser Engine:</span>
                      <strong>{selectedSessionForDetails.browser} ({selectedSessionForDetails.browserVersion || 'Latest'})</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>IP Address:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{maskIpAddress(selectedSessionForDetails.ipAddress)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Location:</span>
                      <strong>{selectedSessionForDetails.location || 'Salem, Tamil Nadu, India'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Screen Resolution:</span>
                      <span>{selectedSessionForDetails.screenResolution || '1920 × 1080'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Timezone:</span>
                      <span>{selectedSessionForDetails.timezone || 'Asia/Kolkata'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Login Timestamp:</span>
                      <span>{new Date(selectedSessionForDetails.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-card-muted, #f8fafc)', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Last Activity:</span>
                      <strong>{new Date(selectedSessionForDetails.lastActiveAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })} ({formatRelativeTime(selectedSessionForDetails.lastActiveAt)})</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setSelectedSessionForDetails(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Master Control Modal Overlay */}
      {masterControlOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            <button
              type="button"
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setMasterControlOpen(false)}
              aria-label="Close Master Control"
            >
              <X size={18} />
            </button>

            {!masterControlUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Master Control – Login</h3>
                <form onSubmit={handleUnlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label required">PASSWORD</label>
                    <input
                      type="password"
                      className="input-control"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" className="btn btn-primary" disabled={isUnlocking}>
                      {isUnlocking ? 'Unlocking...' : 'Unlock'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setMasterControlOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Master Control</h2>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', borderRadius: 'var(--radius-sm)', fontSize: '12px', border: '1px solid rgba(210, 168, 74, 0.25)' }}>
                  Changes here affect all NEW loans. Existing loans keep the rates they were issued at.
                </div>

                <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'rates', label: 'Rates & Payments' },
                    { key: 'loan-config', label: 'Loan Configuration' },
                    { key: 'fd-config', label: 'FD Configuration' },
                    { key: 'purity', label: 'Purity Management' },
                    { key: 'operations', label: 'Operations' },
                    { key: 'messaging', label: 'Messaging' },
                    { key: 'security', label: 'Security & Access' },
                    { key: 'danger', label: 'Danger Zone' }
                  ].map((mt) => (
                    <button
                      key={mt.key}
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: masterSubTab === mt.key ? (mt.key === 'danger' ? '#DC2626' : 'var(--color-primary-dark)') : 'var(--text-muted)',
                        borderBottom: masterSubTab === mt.key ? `2px solid ${mt.key === 'danger' ? '#DC2626' : 'var(--color-primary-dark)'}` : 'none',
                        paddingBottom: '4px'
                      }}
                      onClick={() => {
                        if (mt.key === 'danger') {
                          handleDangerZoneTabClick();
                        } else {
                          setMasterSubTab(mt.key as any);
                        }
                      }}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>

                {masterSubTab === 'rates' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>💡</span>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>Single Source of Truth:</strong> Changes to rates, amount bands, fees, and product toggles apply immediately to <strong>NEW</strong> loans in Loan Issue. Existing loans preserve their contractual rate and calculation snapshot.
                      </div>
                    </div>

                    {/* ── Dynamic Loan Type Chip Tabs ── */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(() => {
                        const activeLTs = (masterControlSettings?.loanTypes && masterControlSettings.loanTypes.length > 0
                          ? masterControlSettings.loanTypes
                          : defaultLoanTypes
                        ).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

                        return [
                          ...activeLTs.map(lt => ({ key: lt.id, label: lt.name })),
                          { key: 'card', label: '💳 Card Fee' },
                          { key: 'overdue', label: '🕐 Overdue Interest' },
                          { key: 'upi', label: '🔗 UPI Payment' }
                        ].map(sc => (
                          <button
                            key={sc.key}
                            type="button"
                            className={`btn btn-sm ${ratesSubChip === sc.key ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ borderRadius: 'var(--radius-full)', fontSize: '11.5px', padding: '4px 12px' }}
                            onClick={() => setRatesSubChip(sc.key)}
                          >
                            {sc.label}
                          </button>
                        ));
                      })()}
                    </div>

                    {/* ── Dynamic Loan Type Panel ── renders for any loanTypeId that is not card/overdue/upi */}
                    {ratesSubChip !== 'card' && ratesSubChip !== 'overdue' && ratesSubChip !== 'upi' && (() => {
                      const allLTs = masterControlSettings?.loanTypes && masterControlSettings.loanTypes.length > 0
                        ? masterControlSettings.loanTypes
                        : defaultLoanTypes;
                      const selectedLT = allLTs.find(lt => lt.id === ratesSubChip);
                      if (!selectedLT) return null;

                      const cfg = loanTypeConfigs[selectedLT.id] || {};
                      const showOnIssue = cfg.showOnLoanIssue ?? selectedLT.showOnLoanIssue ?? true;
                      const defaultRate = cfg.defaultMonthlyRate ?? selectedLT.defaultMonthlyRate ?? 0;
                      const interestProfile = selectedLT.interestProfileId || 'fixed-rate';
                      const hasBands = interestProfile === 'gold-bands' || interestProfile === 'silver-bands';
                      const currentBands = cfg.amountBands ?? selectedLT.amountBands ?? [];

                      const updateCfg = (patch: Record<string, any>) => {
                        setLoanTypeConfigs(prev => ({
                          ...prev,
                          [selectedLT.id]: { ...prev[selectedLT.id], ...patch }
                        }));
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div>
                              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{selectedLT.name}</h3>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {hasBands ? 'Rate is % per month, set by loan size via amount bands.' : 'Flat rate % per month for this loan type.'}
                                {!selectedLT.active && <span style={{ color: '#DC2626', marginLeft: 8 }}>⚠ Inactive — not shown in Loan Issue.</span>}
                              </span>
                            </div>
                          </div>

                          {/* Show on Loan Issue toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>SHOW ON LOAN ISSUE</span>
                            <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface-secondary)', padding: '2px', borderRadius: 'var(--radius-full)' }}>
                              <button type="button" className={`btn btn-sm ${showOnIssue ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => updateCfg({ showOnLoanIssue: true })} style={{ padding: '2px 10px', fontSize: '11px' }}>On</button>
                              <button type="button" className={`btn btn-sm ${!showOnIssue ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => updateCfg({ showOnLoanIssue: false })} style={{ padding: '2px 10px', fontSize: '11px' }}>Off</button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                            {/* Interest panel — bands or flat rate */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                              {hasBands ? (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div>
                                      <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>MONTHLY INTEREST AMOUNT BANDS</h4>
                                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Rate is % per month, pre-filled by loan size.</span>
                                    </div>
                                    <button type="button" className="btn btn-sm btn-secondary"
                                      style={{ gap: '4px', fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-md)' }}
                                      onClick={() => handleAddAmountBandForType(selectedLT.id)}>
                                      <Plus size={13} /><span>Add Band</span>
                                    </button>
                                  </div>
                                  {currentBands.length === 0 ? (
                                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
                                      No interest rate bands configured. Click "Add Band" to add one.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                      {currentBands.map((band, idx) => (
                                        <div key={band.id || idx} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr', gap: '8px', alignItems: 'center' }}>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>AMOUNT IS</label>
                                              <select className="input-control" value={band.condition}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'condition', e.target.value)}
                                                style={{ width: '100%', height: '36px', padding: '4px 8px', fontSize: '11px' }}>
                                                <option value="Below">Below</option>
                                                <option value="Above">Above</option>
                                              </select>
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>₹ AMOUNT</label>
                                              <input type="number" className="input-control" value={band.amount}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                                                style={{ fontSize: '11.5px', height: '36px' }} />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>BASE %/MONTH</label>
                                              <input type="number" step="0.1" className="input-control" value={band.baseRateMonthly}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'baseRateMonthly', e.target.value === '' ? '' : Number(e.target.value))}
                                                style={{ fontSize: '11.5px', height: '36px' }} />
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                              <label style={{ display: 'block', height: '14px' }}></label>
                                              <button type="button" style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px' }}
                                                onClick={() => handleRemoveAmountBandForType(selectedLT.id, band.id)} title="Delete Band">
                                                <Trash2 size={15} />
                                              </button>
                                            </div>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 4fr', gap: '8px' }}>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>PENALTY AFTER (MONTHS)</label>
                                              <input type="number" className="input-control" value={band.penaltyAfterMonths}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'penaltyAfterMonths', e.target.value === '' ? '' : Number(e.target.value))}
                                                style={{ fontSize: '11.5px', height: '36px' }} />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>PENALTY STEP-UP %/MONTH</label>
                                              <input type="number" step="0.05" className="input-control" value={band.penaltyStepUpMonthly}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'penaltyStepUpMonthly', e.target.value === '' ? '' : Number(e.target.value))}
                                                style={{ fontSize: '11.5px', height: '36px' }} />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>PENALTY IS COUNTED</label>
                                              <select className="input-control" value={band.penaltyCalculation}
                                                onChange={e => handleUpdateAmountBandForType(selectedLT.id, band.id, 'penaltyCalculation', e.target.value)}
                                                style={{ width: '100%', height: '36px', padding: '4px 8px', fontSize: '11px' }}>
                                                <option value="From the start — stepped rate over the whole overc">From the start — stepped rate over the whole overc</option>
                                                <option value="After threshold">After threshold</option>
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                        The first band that matches is used — make sure the last band catches everything else (usually Above 0).
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                                    MONTHLY INTEREST
                                  </h4>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label required" style={{ fontSize: '11px' }}>DEFAULT RATE %/MONTH</label>
                                    <input type="number" step="0.1" className="input-control"
                                      value={defaultRate}
                                      onChange={e => updateCfg({ defaultMonthlyRate: e.target.value === '' ? '' : Number(e.target.value) })} />
                                  </div>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '12px' }}>
                                    Applied to every new loan of this type. Existing loans preserve the rate at issue.
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Due System */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>DUE SYSTEM</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontSize: '11px' }}>PENALTY %/DAY ON OVERDUE EMI</label>
                                  <input type="number" step="0.1" className="input-control" value={overduePenalty}
                                    onChange={e => setOverduePenalty(e.target.value === '' ? '' : Number(e.target.value))} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontSize: '11px' }}>GRACE DAYS FROM DUE DATE</label>
                                  <input type="number" className="input-control" value={graceDaysVal}
                                    onChange={e => setGraceDaysVal(e.target.value === '' ? '' : Number(e.target.value))} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}





                    {ratesSubChip === 'card' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px' }}>💳</span>
                          <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Card Fee</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Charged at issue when the card fee box is ticked. Each loan type carries its own fee — switch one off and the box does not appear on Loan Issue for that type at all.
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                          {(masterControlSettings?.loanTypes && masterControlSettings.loanTypes.length > 0 ? masterControlSettings.loanTypes : defaultLoanTypes).map((lt, idx, arr) => {
                            const feeConfig = loanTypesCardFees[lt.id] || { enabled: lt.cardFeeEnabled ?? true, amount: lt.cardFee ?? 25 };
                            const isLast = idx === arr.length - 1;
                            return (
                              <div
                                key={lt.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                                  paddingBottom: isLast ? '0px' : '10px'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{lt.name}</span>
                                    {!lt.active && (
                                      <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                        Disabled
                                      </span>
                                    )}
                                    {lt.showOnLoanIssue === false && (
                                      <span style={{ fontSize: '10px', background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                        Hidden on Issue
                                      </span>
                                    )}
                                  </div>
                                  {lt.description && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{lt.description}</div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface-secondary)', padding: '2px', borderRadius: 'var(--radius-full)' }}>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${feeConfig.enabled ? 'btn-primary' : 'btn-secondary'}`}
                                      onClick={() => setLoanTypesCardFees((prev) => ({ ...prev, [lt.id]: { ...feeConfig, enabled: true } }))}
                                      style={{ padding: '2px 10px', fontSize: '11px' }}
                                    >
                                      On
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${!feeConfig.enabled ? 'btn-primary' : 'btn-secondary'}`}
                                      onClick={() => setLoanTypesCardFees((prev) => ({ ...prev, [lt.id]: { ...feeConfig, enabled: false } }))}
                                      style={{ padding: '2px 10px', fontSize: '11px' }}
                                    >
                                      Off
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>₹</span>
                                    <input
                                      type="number"
                                      className="input-control"
                                      value={feeConfig.amount}
                                      onChange={(e) => setLoanTypesCardFees((prev) => ({ ...prev, [lt.id]: { ...feeConfig, amount: e.target.value === '' ? ('' as any) : Math.max(0, Number(e.target.value)) } }))}
                                      style={{ width: '80px', height: '30px', fontSize: '12px', padding: '4px 8px' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ratesSubChip === 'overdue' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px' }}>🕐</span>
                          <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Overdue Interest &amp; Escalation</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Configure overdue interest calculation methods and progressive interest rate escalation tiers based on overdue duration.
                            </span>
                          </div>
                        </div>

                        {/* 1. OVERDUE CALCULATION METHOD */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                            WHEN A LOAN IS OVERDUE, FILL IN
                          </h4>
                          <div className="form-group" style={{ margin: 0 }}>
                            <select
                              className="input-control"
                              value={overdueCalMethod}
                              onChange={(e) => setOverdueCalMethod(e.target.value)}
                              style={{ width: '100%', height: '38px', padding: '4px 8px', fontSize: '12.5px' }}
                            >
                              <option value="Whole months — a part month counts as full (recommended)">
                                Whole months — a part month counts as full (recommended)
                              </option>
                              <option value="Exact days — calculation based on actual days late">
                                Exact days — calculation based on actual days late
                              </option>
                            </select>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Only the starting figure. You can still change the days on any receipt, and anything left over carries to the next one.
                          </span>
                        </div>

                        {/* 2. OVERDUE INTEREST PROGRESSIVE ESCALATION */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>📈</span>
                                <span>OVERDUE INTEREST ESCALATION</span>
                              </h4>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Automatically escalates the monthly interest rate progressively as loan delinquency duration increases.
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>ENABLE ESCALATION:</span>
                              <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface-secondary)', padding: '2px', borderRadius: 'var(--radius-full)' }}>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${overdueEscalationOn ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setOverdueEscalationOn(true)}
                                  style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 700 }}
                                >
                                  On
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${!overdueEscalationOn ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setOverdueEscalationOn(false)}
                                  style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 700 }}
                                >
                                  Off
                                </button>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', backgroundColor: 'var(--bg-surface-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-sm)' }}>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                BASE MONTHLY RATE (% / MO)
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  step="0.05"
                                  className="input-control"
                                  value={overdueBaseRateVal}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? '' : Number(e.target.value);
                                    setOverdueBaseRateVal(v);
                                    // Also update 0-day tier if present
                                    if (v !== '') {
                                      setOverdueTiersList(prev => prev.map(t => t.overdueDays === 0 ? { ...t, rate: Number(v) } : t));
                                    }
                                  }}
                                  style={{ width: '100px', height: '34px', fontWeight: 700 }}
                                />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>%/mo</span>
                              </div>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                Default base rate applied when overdue days &lt; first escalation threshold or when escalation is OFF.
                              </span>
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                ESCALATION STATUS
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', height: '34px' }}>
                                <span className={`badge ${overdueEscalationOn ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '11px', padding: '4px 10px' }}>
                                  {overdueEscalationOn ? '✓ Active (Tiers Controlling Rates)' : '○ Inactive (Fixed Base Rates Applied)'}
                                </span>
                              </div>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                {overdueTiersList.length} escalation tier{overdueTiersList.length === 1 ? '' : 's'} configured.
                              </span>
                            </div>
                          </div>

                          {/* Escalation Rules Table */}
                          <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                              <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>ESCALATION RULES TABLE</strong>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                                onClick={() => {
                                  setEditingTierIndex(null);
                                  setTierDaysInput('');
                                  setTierRateInput('');
                                  setShowTierModal(true);
                                }}
                              >
                                <Plus size={13} />
                                <span>Add Tier</span>
                              </button>
                            </div>

                            <table className="custom-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '60px' }}>TIER</th>
                                  <th>OVERDUE DAYS (≥)</th>
                                  <th>MONTHLY RATE (%)</th>
                                  <th>ANNUAL RATE (APR)</th>
                                  <th style={{ textAlign: 'right', width: '120px' }}>ACTIONS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {overdueTiersList.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                                      No escalation tiers configured. Click &quot;+ Add Tier&quot; to configure.
                                    </td>
                                  </tr>
                                ) : (
                                  overdueTiersList.map((tier, idx) => (
                                    <tr key={`tier-${tier.overdueDays}-${idx}`}>
                                      <td>
                                        <span className="badge badge-info" style={{ fontSize: '10px', fontWeight: 700 }}>
                                          {idx === 0 ? 'Base' : `Tier ${idx}`}
                                        </span>
                                      </td>
                                      <td>
                                        <strong style={{ color: 'var(--color-primary-dark)' }}>{tier.overdueDays} days</strong>
                                        {idx === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Starting Base)</span>}
                                      </td>
                                      <td>
                                        <strong style={{ color: idx > 0 ? '#b91c1c' : 'var(--text-primary)' }}>
                                          {Number(tier.rate).toFixed(2)}% / month
                                        </strong>
                                      </td>
                                      <td style={{ color: 'var(--text-muted)' }}>
                                        {(Number(tier.rate) * 12).toFixed(2)}% p.a.
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            style={{ padding: '2px 8px', fontSize: '11px' }}
                                            onClick={() => {
                                              setEditingTierIndex(idx);
                                              setTierDaysInput(String(tier.overdueDays));
                                              setTierRateInput(String(tier.rate));
                                              setShowTierModal(true);
                                            }}
                                            title="Edit Tier"
                                          >
                                            Edit
                                          </button>
                                          {idx > 0 && (
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-secondary"
                                              style={{ padding: '2px 8px', fontSize: '11px', color: '#dc2626' }}
                                              onClick={() => {
                                                setOverdueTiersList(prev => prev.filter((_, i) => i !== idx));
                                                showToast(`Removed tier at ${tier.overdueDays} days.`, 'info');
                                              }}
                                              title="Delete Tier"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* 3. INTERACTIVE OVERDUE SIMULATOR */}
                          <div style={{ border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'rgba(23, 107, 82, 0.03)' }}>
                            <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🔍</span>
                              <span>LIVE RATE SIMULATOR &amp; PREVIEW</span>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TEST DAYS OVERDUE:</label>
                                <input
                                  type="number"
                                  className="input-control"
                                  value={testSimulatorDays}
                                  onChange={(e) => setTestSimulatorDays(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                  style={{ width: '90px', height: '32px', fontWeight: 700 }}
                                />
                              </div>
                              {(() => {
                                const days = testSimulatorDays === '' ? 0 : Number(testSimulatorDays);
                                const simSettings = {
                                  overdueEscalationEnabled: overdueEscalationOn,
                                  overdueBaseRateMonthly: overdueBaseRateVal === '' ? 2.0 : Number(overdueBaseRateVal),
                                  overdueEscalationTiers: overdueTiersList
                                };
                                const details = getOverdueEscalationDetails(days, Number(overdueBaseRateVal) || 2.0, simSettings as any);
                                return (
                                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
                                    <span>
                                      Applicable Rate: <strong style={{ color: details.isEscalated ? '#dc2626' : 'var(--color-primary-dark)', fontSize: '13.5px' }}>{details.currentRate.toFixed(2)}% / mo</strong> ({(details.currentRate * 12).toFixed(2)}% p.a.)
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Tier: <strong style={{ color: 'var(--text-primary)' }}>{details.currentTierLabel}</strong>
                                    </span>
                                    {details.nextTier && (
                                      <>
                                        <span>•</span>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                          Next: <strong>{details.nextTier.rate.toFixed(2)}%</strong> at {details.nextTier.overdueDays}d (in {details.daysUntilNextTier} days)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* TIER ADD/EDIT MODAL */}
                        {showTierModal && (
                          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '16px' }}>
                            <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {editingTierIndex !== null ? 'EDIT ESCALATION TIER' : 'ADD NEW ESCALATION TIER'}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => setShowTierModal(false)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              <form onSubmit={(e) => {
                                e.preventDefault();
                                const days = Math.max(0, Math.floor(Number(tierDaysInput)));
                                const rate = Math.max(0, Number(tierRateInput));
                                if (isNaN(days) || isNaN(rate) || rate <= 0) {
                                  showToast('Please enter valid overdue days and rate.', 'warning');
                                  return;
                                }

                                if (editingTierIndex !== null) {
                                  // Update existing tier
                                  const updated = [...overdueTiersList];
                                  updated[editingTierIndex] = { overdueDays: days, rate };
                                  // Sort and deduplicate
                                  const sorted = updated.sort((a, b) => a.overdueDays - b.overdueDays);
                                  setOverdueTiersList(sorted);
                                  showToast('Escalation tier updated successfully.', 'success');
                                } else {
                                  // Add new tier
                                  if (overdueTiersList.some(t => t.overdueDays === days)) {
                                    showToast(`A tier for ${days} overdue days already exists. Please edit that tier instead.`, 'error');
                                    return;
                                  }
                                  const updated = [...overdueTiersList, { overdueDays: days, rate }]
                                    .sort((a, b) => a.overdueDays - b.overdueDays);
                                  setOverdueTiersList(updated);
                                  showToast('New escalation tier added.', 'success');
                                }
                                setShowTierModal(false);
                              }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label required" style={{ fontSize: '11.5px' }}>
                                    OVERDUE THRESHOLD (DAYS ≥)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="input-control"
                                    value={tierDaysInput}
                                    onChange={(e) => setTierDaysInput(e.target.value)}
                                    placeholder="e.g. 90"
                                    disabled={editingTierIndex === 0}
                                    required
                                    autoFocus
                                  />
                                  {editingTierIndex === 0 && (
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      Base tier threshold is fixed at 0 days.
                                    </span>
                                  )}
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label required" style={{ fontSize: '11.5px' }}>
                                    MONTHLY INTEREST RATE (%)
                                  </label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      min="0.1"
                                      step="0.05"
                                      className="input-control"
                                      value={tierRateInput}
                                      onChange={(e) => setTierRateInput(e.target.value)}
                                      placeholder="e.g. 2.10"
                                      required
                                    />
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>%/mo</span>
                                  </div>
                                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Equivalent Annual APR: {tierRateInput ? (Number(tierRateInput) * 12).toFixed(2) : '0.00'}% p.a.
                                  </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowTierModal(false)}
                                    style={{ fontSize: '12px' }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ fontSize: '12px' }}
                                  >
                                    {editingTierIndex !== null ? 'Save Tier' : 'Add Tier'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {ratesSubChip === 'upi' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>UPI SETTINGS</h4>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label required">UPI ID VIRTUAL ADDRESS</label>
                          <input
                            type="text"
                            placeholder="e.g. kkvgold@okaxis"
                            className="input-control"
                            value={upiIdVal}
                            onChange={(e) => setUpiIdVal(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label required">UPI ACCOUNT PAYEE NAME</label>
                          <input
                            type="text"
                            placeholder="e.g. KKV Gold Finance"
                            className="input-control"
                            value={upiPayeeVal}
                            onChange={(e) => setUpiPayeeVal(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {masterSubTab === 'loan-config' && (
                  <LoanConfigurationSection />
                )}

                {masterSubTab === 'fd-config' && (
                  <FDConfigurationSection />
                )}

                {masterSubTab === 'purity' && (
                  <PurityManagementSection />
                )}

                {masterSubTab === 'messaging' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <strong>Allowed placeholders:</strong>
                      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {"{name}, {loanId}, {loanType}, {principal}, {interest}, {dueDate}, {amount}, {emi}, {bankName}, {phone}, {upiId}, {upiPayee}, {advance}, {advanceLine}, {billNo}, {date}"}
                      </span>
                    </div>

                    <div className="form-group" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>WELCOME MESSAGE (SENT AFTER ISSUING A NEW LOAN)</label>
                      <textarea
                        className="input-control"
                        rows={3}
                        value={welcomeTpl}
                        onChange={(e) => setWelcomeTpl(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Predefined:</span>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setWelcomeTpl("Dear {name}, Thank you for choosing KKV GOLD FINANCE. Your pledge account {loanId} for ₹{principal} has been disbursed. Next due date is {dueDate}. Thank you.")}>Professional</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setWelcomeTpl("KKV GOLD FINANCE: Loan {loanId} for ₹{principal} disbursed to {name}. Next due: {dueDate}.")}>Short</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setWelcomeTpl("Hi {name}! Your loan {loanId} of ₹{principal} is active. Next due: {dueDate}. Thanks!")}>Friendly</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setWelcomeTpl("Dear {name}, thank you for choosing us. Gold Loan {loanId} of principal ₹{principal} is disbursed under KKV Gold. Overdue penalty: 3.6% per day after 3 grace days.")}>Detailed</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setWelcomeTpl("அன்புள்ள {name}, கே.கே.வி கோல்டு பைனான்ஸை தேர்வு செய்ததற்கு நன்றி. உங்கள் கடன் {loanId} தொகை ₹{principal} வழங்கப்பட்டது.")}>Tamil</button>
                      </div>
                    </div>

                    <div className="form-group" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>{"DUE REMINDER (PENDING LOANS -> WHATSAPP)"}</label>
                      <textarea
                        className="input-control"
                        rows={3}
                        value={dueTpl}
                        onChange={(e) => setDueTpl(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Predefined:</span>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("Dear {name}, your interest payment for Gold Loan {loanId} (Principal ₹{principal}) is pending. Due date: {dueDate}. Total amount due: ₹{amount}. UPI ID: {upiId}")}>Professional</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("Pending interest for Loan {loanId}: ₹{amount}. UPI: {upiId}.")}>Short</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("Hi {name}, interest for your Loan {loanId} was due on {dueDate}. Amount: ₹{amount}. UPI: {upiId}")}>Friendly</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("WARNING: Interest for loan {loanId} is overdue. Please settle ₹{amount} immediately on UPI {upiId} to avoid penalty charges.")}>Firm</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("Please pay your pending interest of ₹{amount} for Loan {loanId} via UPI {upiId} (Payee: {upiPayee}).")}>With UPI</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setDueTpl("Loan {loanId} interest due: ₹{amount}.")}>Very short</button>
                      </div>
                    </div>

                    <div className="form-group" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>RECEIPT MESSAGE (SENT UPON INTEREST PAYMENT/COLLECTIONS)</label>
                      <textarea
                        className="input-control"
                        rows={3}
                        value={receiptTpl}
                        onChange={(e) => setReceiptTpl(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Predefined:</span>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setReceiptTpl("Dear {name}, payment receipt #{billNo} of ₹{amount} for loan {loanId} has been successfully recorded on {date}. Thank you, KKV GOLD FINANCE.")}>Professional</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setReceiptTpl("Receipt #{billNo} of ₹{amount} received for loan {loanId} on {date}. Thank you.")}>Short</button>
                        <button type="button" className="btn btn-xs" style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-surface-secondary)' }} onClick={() => setReceiptTpl("Hi {name}! Staged payment receipt #{billNo} of ₹{amount} for loan {loanId} has been successfully completed on {date}. Thanks!")}>Friendly</button>
                      </div>
                    </div>
                  </div>
                )}

                {masterSubTab === 'operations' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {[
                        { key: 'areas-showrooms', label: '🏙️ Areas & Showrooms' },
                        { key: 'toggles', label: '⚙️ System Toggles' }
                      ].map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          className={`btn btn-sm ${operationsSubTab === sub.key ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ borderRadius: 'var(--radius-full)', fontSize: '12px' }}
                          onClick={() => setOperationsSubTab(sub.key as any)}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {operationsSubTab === 'areas-showrooms' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                        {/* Areas */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>AREAS CONFIG</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Komarapalayam"
                              value={newAreaInput}
                              onChange={(e) => setNewAreaInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddArea()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddArea} style={{ padding: '0 12px' }}>+ Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {areasVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No areas added</span> :
                              areasVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px', border: '1px solid rgba(201,162,39,0.2)' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemoveArea(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>

                        {/* Partners */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>PARTNERS (CAPITAL ACCOUNTS)</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Partner name"
                              value={newPartnerInput}
                              onChange={(e) => setNewPartnerInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddPartner()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddPartner} style={{ padding: '0 12px' }}>Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {partnersVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No partners added</span> :
                              partnersVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemovePartner(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>

                        {/* Vehicle Documents */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>VEHICLE DOCUMENTS</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Hypothecation letter"
                              value={newDocInput}
                              onChange={(e) => setNewDocInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddDoc()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddDoc} style={{ padding: '0 12px' }}>Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {vehicleDocsVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No documents added</span> :
                              vehicleDocsVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemoveDoc(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>

                        {/* Vehicle Companies */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>VEHICLE COMPANIES</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Honda"
                              value={newCompanyInput}
                              onChange={(e) => setNewCompanyInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddCompany()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddCompany} style={{ padding: '0 12px' }}>Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {vehicleCompaniesVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No companies added</span> :
                              vehicleCompaniesVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemoveCompany(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>

                        {/* Insurance Companies */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>INSURANCE COMPANIES</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Tata AIG"
                              value={newInsCompanyInput}
                              onChange={(e) => setNewInsCompanyInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddInsCompany()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddInsCompany} style={{ padding: '0 12px' }}>Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {insuranceCompaniesVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No insurance companies added</span> :
                              insuranceCompaniesVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemoveInsCompany(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>

                        {/* Showrooms */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>SHOWROOMS</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="Showroom branch"
                              value={newShowroomInput}
                              onChange={(e) => setNewShowroomInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddShowroom()}
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={handleAddShowroom} style={{ padding: '0 12px' }}>+ Add</button>
                          </div>
                          <div style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'var(--bg-surface-secondary)' }}>
                            {showroomsVal.length === 0 ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No showrooms added</span> :
                              showroomsVal.map((item, idx) => (
                                <span key={idx} className="badge badge-success" style={{ gap: '4px', fontSize: '10px', padding: '3px 8px' }}>
                                  {item}
                                  <button type="button" onClick={() => handleRemoveShowroom(idx)} style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', padding: 0 }}>×</button>
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {operationsSubTab === 'toggles' && (
                      <div>
                        <h3 style={{ fontSize: '12px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Feature Toggles</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                          <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>Interface Animations</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enable sidebar transition animations</span>
                            </div>
                            <input
                              type="checkbox"
                              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-dark)', cursor: 'pointer' }}
                              checked={animationsEnabled}
                              onChange={(e) => setAnimationsEnabled(e.target.checked)}
                            />
                          </div>

                          <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>Performance Mode</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Disable heavy effects for low-spec PCs</span>
                            </div>
                            <input
                              type="checkbox"
                              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-dark)', cursor: 'pointer' }}
                              checked={performanceModeEnabled}
                              onChange={(e) => setPerformanceModeEnabled(e.target.checked)}
                            />
                          </div>

                          <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>Bulk FD Date Shifting</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enable multi-FD calendar edit features</span>
                            </div>
                            <input
                              type="checkbox"
                              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-dark)', cursor: 'pointer' }}
                              checked={bulkFdDateChangeEnabled}
                              onChange={(e) => setBulkFdDateChangeEnabled(e.target.checked)}
                            />
                          </div>

                          <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>Cabinet Lockers</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Track safe deposits cabinets A &amp; B</span>
                            </div>
                            <input
                              type="checkbox"
                              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-dark)', cursor: 'pointer' }}
                              checked={lockersEnabled}
                              onChange={(e) => setLockersEnabled(e.target.checked)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {masterSubTab === 'security' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {[
                        { key: 'account', label: '👤 Account' },
                        { key: 'change-pass', label: '🔐 Change Master Password' }
                      ].map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          className={`btn btn-sm ${securitySubTab === sub.key ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ borderRadius: 'var(--radius-full)', fontSize: '12px' }}
                          onClick={() => setSecuritySubTab(sub.key as any)}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {securitySubTab === 'account' && (
                      <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>GOOGLE DRIVE ACCOUNT SYNC</span>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SIGNED IN AS</label>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>goldfinancekkv@gmail.com</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ width: 'fit-content', marginTop: '8px' }}
                          onClick={() => showToast('Google account cannot be signed out from this local offline build.', 'info')}
                        >
                          Sign Out
                        </button>
                      </div>
                    )}

                    {securitySubTab === 'change-pass' && (
                      <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>RESET MASTER ACCESS PASSWORD</span>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>CURRENT PASSWORD</label>
                          <input
                            type="password"
                            className="input-control"
                            value={currentMasterPass}
                            onChange={(e) => setCurrentMasterPass(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>NEW PASSWORD</label>
                          <input
                            type="password"
                            className="input-control"
                            value={newMasterPass}
                            onChange={(e) => setNewMasterPass(e.target.value)}
                          />
                        </div>
                        <div style={{ padding: '10px 14px', border: '1px solid #DC2626', color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.05)', borderRadius: 'var(--radius-sm)', fontSize: '11.5px' }}>
                          ⚠️ Stored password safety: Master password protects critical overrides and administrative data wipes.
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: 'fit-content' }}
                          disabled={isChangingMasterPass}
                          onClick={async () => {
                            if (!currentMasterPass || !newMasterPass) {
                              showToast('Please enter both current and new passwords.', 'warning');
                              return;
                            }
                            setIsChangingMasterPass(true);
                            const res = await changeMasterPassword(currentMasterPass, newMasterPass);
                            setIsChangingMasterPass(false);
                            if (res.success) {
                              setCurrentMasterPass('');
                              setNewMasterPass('');
                            }
                          }}
                        >
                          {isChangingMasterPass ? 'Saving...' : 'Secure stored passwords'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {masterSubTab === 'danger' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* WIPE ALL DATA ACTION */}
                    <div style={{ padding: '20px', backgroundColor: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Trash2 size={18} color="#DC2626" />
                        <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B', margin: 0 }}>WIPE ALL DATA</h4>
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                        Warning: Permanently resets all operational records (Customers, Loans, Receipts, Fixed Deposits, Rental, and Day Book). The system will automatically create a verified full backup ZIP and download it to your computer before any data is deleted.
                      </p>
                      <button
                        type="button"
                        className="btn"
                        style={{ backgroundColor: '#DC2626', color: '#FFF', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => {
                          setShowWipeModal(true);
                        }}
                      >
                        <Trash2 size={16} />
                        <span>Wipe All Data</span>
                      </button>
                    </div>

                    {/* RESTORE DATABASE ACTION */}
                    <div style={{ padding: '20px', backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <RotateCcw size={18} color="#1E3A8A" />
                        <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1E3A8A', margin: 0 }}>RESTORE BACKUP (FROM COMPUTER)</h4>
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
                        Restore the complete application database from a previously downloaded <code>.zip</code> (or <code>.json</code>) backup archive saved on your computer.
                      </p>
                      <button
                        type="button"
                        className="btn"
                        style={{ backgroundColor: '#2563EB', color: '#FFF', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => setShowRestoreModal(true)}
                      >
                        <Upload size={16} />
                        <span>Restore Backup From ZIP</span>
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <button type="button" className="btn btn-primary" onClick={handleSaveMasterChanges}>
                    <Save size={15} />
                    <span>Save Changes</span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setMasterControlOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fail-Safe Wipe All Data Modal */}
      <WipeAllDataModal
        isOpen={showWipeModal}
        onClose={() => setShowWipeModal(false)}
        onSuccessReset={() => {
          resetAllData();
          setMasterControlOpen(false);
        }}
        onOpenRestore={() => setShowRestoreModal(true)}
      />

      {/* Hidden Fail-Safe System Restore Modal */}
      <SystemRestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        onSuccessReload={() => {
          reloadAllData();
          setMasterControlOpen(false);
        }}
      />

      {/* View Customer Details Modal */}
      <ViewCustomerModal
        isOpen={!!viewingCustomer}
        customer={viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        onEdit={(cust) => {
          setViewingCustomer(null);
          startEditCustomer(cust.id);
        }}
      />

      {/* Admin Delete Confirmation Modal */}
      {deletingCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: 'var(--color-danger, #ef4444)' }}>
                Delete Customer?
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                You are about to permanently delete this customer record.
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                border: '1px solid var(--border-light, #cbd5e1)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div><strong>Customer Name:</strong> {deletingCustomer.name}</div>
              <div><strong>Customer ID:</strong> {deletingCustomer.id}</div>
              <div><strong>Mobile Number:</strong> +91 {deletingCustomer.phone}</div>
            </div>

            <div style={{ backgroundColor: 'var(--badge-danger-bg)', border: '1px solid var(--badge-danger-border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', color: 'var(--color-danger)', fontSize: '12px', fontWeight: 700, textAlign: 'center' }}>
              ⚠ This action cannot be undone.
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingCustomer(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ backgroundColor: 'var(--color-danger, #ef4444)', color: '#fff', fontWeight: 700 }}
                onClick={() => {
                  deleteCustomer(deletingCustomer.id);
                  setDeletingCustomer(null);
                }}
              >
                🗑 Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE DANGER CONFIRMATION MODAL */}
      {permanentDeleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3500,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              borderRadius: '16px',
              border: '2px solid #ef4444',
              backgroundColor: '#ffffff',
              boxShadow: '0 20px 40px rgba(239, 68, 68, 0.25)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>
                  ⚠ Permanently Delete Customer?
                </h3>
                <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                  Admin Authorization Required · Cannot be undone
                </span>
              </div>
            </div>

            {/* Warning Message */}
            <p style={{ fontSize: '13.5px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              You are about to permanently delete this customer and all associated records. This action cannot be undone.
            </p>

            {/* Customer Details Box */}
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#7f1d1d', fontWeight: 600 }}>Customer Name:</span>
                <strong style={{ color: '#991b1b', fontSize: '14px' }}>{permanentDeleteTarget.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#7f1d1d', fontWeight: 600 }}>Customer ID:</span>
                <span
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12px',
                    padding: '2px 10px',
                    borderRadius: '6px',
                    letterSpacing: '0.5px'
                  }}
                >
                  {permanentDeleteTarget.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#7f1d1d', fontWeight: 600 }}>Mobile Number:</span>
                <strong style={{ color: '#991b1b' }}>+91 {permanentDeleteTarget.phone}</strong>
              </div>
            </div>

            {/* Type DELETE Instruction & Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1f2937', marginBottom: '6px' }}>
                To permanently delete this customer and all associated records, type <strong style={{ color: '#dc2626' }}>DELETE</strong> below to confirm.
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="Type DELETE to confirm"
                value={permanentDeleteInput}
                onChange={(e) => setPermanentDeleteInput(e.target.value)}
                style={{
                  borderColor: permanentDeleteInput === 'DELETE' ? '#dc2626' : '#cbd5e1',
                  backgroundColor: permanentDeleteInput === 'DELETE' ? '#fef2f2' : '#ffffff',
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                  fontSize: '14px'
                }}
              />
              {permanentDeleteInput && permanentDeleteInput !== 'DELETE' && (
                <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                  ⚠ Type DELETE in capital letters to confirm.
                </span>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeletingPermanently}
                onClick={() => {
                  setPermanentDeleteTarget(null);
                  setPermanentDeleteInput('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={permanentDeleteInput !== 'DELETE' || isDeletingPermanently}
                onClick={handleConfirmPermanentDelete}
                style={{
                  backgroundColor: permanentDeleteInput === 'DELETE' && !isDeletingPermanently ? '#dc2626' : '#9ca3af',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '8px 20px',
                  borderRadius: '8px',
                  cursor: permanentDeleteInput === 'DELETE' && !isDeletingPermanently ? 'pointer' : 'not-allowed',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isDeletingPermanently ? (
                  <>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
