import React, { useState, useMemo, useEffect } from 'react';
import '../styles/LoanIssue.css';
import { useApp, defaultPurityOptions } from '../context/AppContext';
import {
  OtherSelectField,
  NOMINEE_RELATION_OPTIONS,
  GUARANTOR_RELATION_OPTIONS,
  resolveRelation
} from '../components/common/OtherSelectField';
import { FinancialTermsSection } from '../components/common/FinancialTermsSection';
import { OrnamentItem, Customer, CalculationStrategy } from '../types';
import {
  formatIdProofDisplay,
  formatAadhaarInput,
  maskAadhaarNumber,
  maskPANNumber,
  validatePANNumber
} from '../utils/kycValidation';
import {
  getActiveLoanTypesForIssue,
  getProductCardFeeConfig,
  calculateLoanTerms
} from '../utils/loanCalculationUtils';
import { WebcamCapture } from '../components/common/WebcamCapture';
import {
  Plus,
  Camera,
  Search,
  X,
  User,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2
} from 'lucide-react';
import apiService from '../services/api';

export const LoanIssue: React.FC = () => {
  const { customers, loans, addLoan, setCurrentPage, showToast, masterControlSettings, getPurityRate } = useApp();

  // File Upload Ref & Lightbox State
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

  // Dynamic Active Configurations
  const activeLoanTypes = useMemo(() => {
    return getActiveLoanTypesForIssue(masterControlSettings?.loanTypes, masterControlSettings);
  }, [masterControlSettings]);

  const activeRepaymentSystems = useMemo(() => {
    const list = masterControlSettings?.repaymentSystems || [];
    const active = list.filter((r) => r.active);
    return active.length > 0 ? active : [
      { id: 'monthly-interest-only', name: 'Monthly Interest Only', calculationStrategy: 'MONTHLY_INTEREST_ONLY' as CalculationStrategy, active: true, sortOrder: 1 }
    ];
  }, [masterControlSettings?.repaymentSystems]);

  // Top Section: Authoritative Single-Sequence Synchronized Identifiers
  const [backendNextSeq, setBackendNextSeq] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiService.getNextLoanSequence().then((data) => {
      if (isMounted && data && typeof data.nextSequence === 'number') {
        setBackendNextSeq(data.nextSequence);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [loans]);

  const computedNextSeq = useMemo(() => {
    let maxNum = 0;
    if (Array.isArray(loans)) {
      for (const l of loans) {
        const match = (l.loanNo || '').match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return maxNum + 1;
  }, [loans]);

  const nextSequence = backendNextSeq !== null ? Math.max(backendNextSeq, computedNextSeq) : computedNextSeq;
  const displayReceiptNo = nextSequence;
  const displayLoanNo = `GL-${nextSequence}`;

  const currentBusinessDate = useMemo(() => {
    return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  }, []);

  const [loanTypeId, setLoanTypeId] = useState<string>(() => activeLoanTypes[0]?.id || 'gold-loan');
  const [repaymentSystemId, setRepaymentSystemId] = useState<string>(() => activeRepaymentSystems[0]?.id || 'monthly-interest-only');

  // Synchronize selection if active options change
  useEffect(() => {
    if (!activeLoanTypes.some(t => t.id === loanTypeId)) {
      setLoanTypeId(activeLoanTypes[0]?.id || 'gold-loan');
    }
  }, [activeLoanTypes, loanTypeId]);

  useEffect(() => {
    if (!activeRepaymentSystems.some(r => r.id === repaymentSystemId)) {
      setRepaymentSystemId(activeRepaymentSystems[0]?.id || 'monthly-interest-only');
    }
  }, [activeRepaymentSystems, repaymentSystemId]);

  const selectedLoanTypeConfig = activeLoanTypes.find(t => t.id === loanTypeId) || activeLoanTypes[0];
  const selectedRepaymentConfig = activeRepaymentSystems.find(r => r.id === repaymentSystemId) || activeRepaymentSystems[0];

  // Customer Selection & Preview State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [custSearchQuery, setCustSearchQuery] = useState<string>('');
  const [showCustSuggestions, setShowCustSuggestions] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ──────────────────────────────────────────────────────────────────────────
  // NOMINEE KYC STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [hasNominee, setHasNominee] = useState<boolean>(false);
  const [nomineeName, setNomineeName] = useState<string>('');
  const [nomineeDob, setNomineeDob] = useState<string>('');
  const [nomineeGender, setNomineeGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [nomineeRelation, setNomineeRelation] = useState<string>('Father');
  const [nomineeCustomRelation, setNomineeCustomRelation] = useState<string>('');
  const [nomineePhone, setNomineePhone] = useState<string>('');
  const [nomineeAltPhone, setNomineeAltPhone] = useState<string>('');
  const [nomineeEmail, setNomineeEmail] = useState<string>('');
  const [nomineeOccupation, setNomineeOccupation] = useState<string>('');
  const [nomineeAadhaarNo, setNomineeAadhaarNo] = useState<string>('');
  const [nomineePanNo, setNomineePanNo] = useState<string>('');
  const [nomineeAddress, setNomineeAddress] = useState<string>('');
  const [nomineePermanentAddress, setNomineePermanentAddress] = useState<string>('');
  const [nomineeSameAsCurrentAddress, setNomineeSameAsCurrentAddress] = useState<boolean>(false);
  const [nomineeSameAsCustomerAddress, setNomineeSameAsCustomerAddress] = useState<boolean>(false);
  const [nomineePhoto, setNomineePhoto] = useState<string | null>(null);
  const [isNomineeWebcamOpen, setIsNomineeWebcamOpen] = useState<boolean>(false);
  const [nomineeLocation, setNomineeLocation] = useState<any>(null);
  const [nomineeDocs, setNomineeDocs] = useState<{
    aadhaarFront: string | null;
    aadhaarBack: string | null;
    panCard: string | null;
  }>({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARANTOR KYC STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [hasGuarantor, setHasGuarantor] = useState<boolean>(false);
  const [guarantorName, setGuarantorName] = useState<string>('');
  const [guarantorDob, setGuarantorDob] = useState<string>('');
  const [guarantorAge, setGuarantorAge] = useState<string>('');
  const [guarantorGender, setGuarantorGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [guarantorRelation, setGuarantorRelation] = useState<string>('Friend');
  const [guarantorCustomRelation, setGuarantorCustomRelation] = useState<string>('');
  const [guarantorPhone, setGuarantorPhone] = useState<string>('');
  const [guarantorAltPhone, setGuarantorAltPhone] = useState<string>('');
  const [guarantorEmail, setGuarantorEmail] = useState<string>('');
  const [guarantorOccupation, setGuarantorOccupation] = useState<string>('');
  const [guarantorMonthlyIncome, setGuarantorMonthlyIncome] = useState<string>('');
  const [guarantorAadhaarNo, setGuarantorAadhaarNo] = useState<string>('');
  const [guarantorPanNo, setGuarantorPanNo] = useState<string>('');
  const [guarantorAddress, setGuarantorAddress] = useState<string>('');
  const [guarantorPermanentAddress, setGuarantorPermanentAddress] = useState<string>('');
  const [guarantorSameAsCurrentAddress, setGuarantorSameAsCurrentAddress] = useState<boolean>(false);
  const [guarantorPhoto, setGuarantorPhoto] = useState<string | null>(null);
  const [isGuarantorWebcamOpen, setIsGuarantorWebcamOpen] = useState<boolean>(false);
  const [guarantorDocs, setGuarantorDocs] = useState<{
    aadhaarFront: string | null;
    aadhaarBack: string | null;
    panCard: string | null;
    photo: string | null;
  }>({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    photo: null
  });

  const calculateAgeFromDob = (dobStr: string): number => {
    if (!dobStr) return 0;
    const parts = dobStr.includes('-') ? dobStr.split('-') : dobStr.split('/');
    let birthDate: Date;
    if (parts[0].length === 4) {
      birthDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      birthDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const handleToggleSameAsCustomerAddress = (checked: boolean) => {
    setNomineeSameAsCustomerAddress(checked);
    if (checked && selectedCustomer) {
      const cAddr = selectedCustomer.currentAddress || '';
      const pAddr = selectedCustomer.permanentAddress || selectedCustomer.currentAddress || '';
      setNomineeAddress(cAddr);
      setNomineePermanentAddress(pAddr);
    }
  };

  const handleNomineeSameAsCurrentAddressToggle = (checked: boolean) => {
    setNomineeSameAsCurrentAddress(checked);
    if (checked) {
      setNomineePermanentAddress(nomineeAddress);
    }
  };

  const handleGuarantorSameAsCurrentAddressToggle = (checked: boolean) => {
    setGuarantorSameAsCurrentAddress(checked);
    if (checked) {
      setGuarantorPermanentAddress(guarantorAddress);
    }
  };

  const handleKycDocUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Document file size must be less than 5 MB.', 'error');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast('Please upload a valid JPG, PNG, WEBP image or PDF file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onSuccess(event.target?.result as string);
      showToast('KYC document attached successfully!', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleNomineePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Nominee photo size must be less than 5 MB.', 'error');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast('Please select a valid image file (JPG, JPEG, PNG, WEBP).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setNomineePhoto(event.target?.result as string);
      showToast('Nominee photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGuarantorPhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Guarantor photo size must be less than 5 MB.', 'error');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast('Please select a valid image file (JPG, JPEG, PNG, WEBP).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setGuarantorPhoto(event.target?.result as string);
      showToast('Guarantor photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Financial details
  const [principal, setPrincipal] = useState<number | ''>(100000);
  const [disbursementMethod, setDisbursementMethod] = useState<'Cash' | 'Bank' | 'Cash + Bank'>('Cash');
  const [bankMode, setBankMode] = useState<string>('UPI');

  // Cash + Bank Split Details
  const [splitCashAmount, setSplitCashAmount] = useState<number | ''>(50000);
  const [splitBankAmount, setSplitBankAmount] = useState<number | ''>(50000);

  const numericPrincipal = typeof principal === 'number' ? principal : 0;

  // Advance Interest
  const [deductAdvanceInterest, setDeductAdvanceInterest] = useState<boolean>(false);
  const [advanceDays, setAdvanceDays] = useState<number>(0);
  const [advanceReceivingMethod, setAdvanceReceivingMethod] = useState<'Cash' | 'Bank' | 'Cash + Bank'>('Cash');

  // Card Fee strictly derived from Master Control configuration per loan product
  const cardFeeConfig = useMemo(() => {
    return getProductCardFeeConfig(selectedLoanTypeConfig?.name || selectedLoanTypeConfig?.id, masterControlSettings);
  }, [selectedLoanTypeConfig?.id, selectedLoanTypeConfig?.name, masterControlSettings]);

  const cardFeeEnabled = cardFeeConfig.enabled;
  const cardFeeAmount = cardFeeConfig.amount;
  const [cardFeeMode, setCardFeeMode] = useState<'Cash' | 'Bank'>('Bank');
  const [cardFeeBankMode, setCardFeeBankMode] = useState<string>('UPI');

  // Dynamic Unified Loan Calculation Terms from Master Control
  const loanTerms = useMemo(() => {
    return calculateLoanTerms({
      principal: numericPrincipal,
      loanTypeId: selectedLoanTypeConfig?.id,
      loanTypeName: selectedLoanTypeConfig?.name,
      repaymentStrategy: selectedRepaymentConfig?.calculationStrategy,
      settings: masterControlSettings,
      deductAdvanceInterest,
      advanceDays,
      customCardFeeEnabled: cardFeeEnabled,
      customCardFeeAmount: cardFeeAmount,
      issueDate: currentBusinessDate
    });
  }, [
    numericPrincipal,
    selectedLoanTypeConfig,
    selectedRepaymentConfig,
    masterControlSettings,
    deductAdvanceInterest,
    advanceDays,
    cardFeeEnabled,
    cardFeeAmount,
    currentBusinessDate
  ]);

  const interestRate = loanTerms.interestRate;
  const monthlyInterest = loanTerms.monthlyInterest;
  const advanceInterestAmount = loanTerms.advanceInterestAmount;

  // Purity Configuration Options
  const activePurityOptions = useMemo(() => {
    const list = masterControlSettings?.purityOptions || defaultPurityOptions;
    return list
      .filter(p => p.active)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [masterControlSettings?.purityOptions]);

  const defaultPurityName = useMemo(() => {
    return activePurityOptions[0]?.name || '22ct';
  }, [activePurityOptions]);

  const getRateForItem = (item: OrnamentItem): number => {
    if (item.rateUsed && item.rateUsed > 0) return item.rateUsed;
    return getPurityRate(item.purity || defaultPurityName);
  };

  const round3 = (val: number): number => {
    return Math.round((Number(val) || 0) * 1000) / 1000;
  };

  // Ornament Items
  const [items, setItems] = useState<OrnamentItem[]>([
    {
      id: 'item-1',
      item: '',
      qty: 1,
      purity: '22ct',
      grossWeight: 0,
      deductionWeight: 0,
      netWeight: 0
    }
  ]);
  const [manualMarketValue, setManualMarketValue] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [ornamentPhotos, setOrnamentPhotos] = useState<string[]>([]);

  // Auto Calculations
  const totalGrossWeight = round3(items.reduce((sum, item) => sum + (Number(item.grossWeight) || 0), 0));
  const totalDeductionWeight = round3(items.reduce((sum, item) => sum + (Number(item.deductionWeight) || 0), 0));
  const totalNetWeight = round3(items.reduce((sum, item) => sum + (Number(item.netWeight) || 0), 0));
  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const numericMarketValue = manualMarketValue.trim() !== '' ? Number(manualMarketValue) : 0;
  const ltv = numericPrincipal > 0 && numericMarketValue > 0 ? ((numericPrincipal / numericMarketValue) * 100).toFixed(2) : '0.00';

  // Weight validation errors
  const weightErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    items.forEach((item) => {
      const gross = Number(item.grossWeight) || 0;
      const deduction = Number(item.deductionWeight) || 0;
      if (deduction > gross) {
        errors[item.id] = `Deduction weight (${deduction.toFixed(3)}g) cannot be greater than gross weight (${gross.toFixed(3)}g).`;
      }
    });
    return errors;
  }, [items]);

  const hasWeightErrors = Object.keys(weightErrors).length > 0;

  // Items Handlers
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        item: '',
        qty: 1,
        purity: '22ct',
        grossWeight: 0,
        deductionWeight: 0,
        netWeight: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      showToast('At least one ornament item is required.', 'warning');
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof OrnamentItem, value: any) => {
    const allPurities = masterControlSettings?.purityOptions || defaultPurityOptions;
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === 'qty') {
            if (value === '') {
              updated.qty = '' as any;
            } else {
              const parsed = parseInt(String(value), 10);
              updated.qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
            }
          }

          // Automatically derive Net Weight = Gross - Deduction
          const rawGross = field === 'grossWeight' ? value : item.grossWeight;
          const rawDeduction = field === 'deductionWeight' ? value : item.deductionWeight;

          const grossNum = rawGross === '' ? 0 : (Number(rawGross) || 0);
          const deductionNum = rawDeduction === '' ? 0 : (Number(rawDeduction) || 0);
          const netNum = Math.max(0, round3(grossNum - deductionNum));

          updated.grossWeight = rawGross === '' ? '' : rawGross;
          updated.deductionWeight = rawDeduction === '' ? '' : rawDeduction;
          updated.netWeight = netNum;

          if (field === 'purity') {
            const pConfig = allPurities.find(
              p => p.name.trim().toLowerCase() === String(value).trim().toLowerCase() || p.id === value
            );
            if (pConfig) {
              updated.purityId = pConfig.id;
              updated.purityName = pConfig.name;
              updated.purityCategory = pConfig.category;
              updated.purityValue = pConfig.purityValue;
              updated.rateUsed = getPurityRate(pConfig.id);
            }
          }
          const currentRate = updated.rateUsed || getRateForItem(updated);
          updated.valuation = Math.round(netNum * currentRate);
          return updated;
        }
        return item;
      })
    );
  };

  // Canvas Image Compression Utility
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Multi-File Selection & Validation Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (ornamentPhotos.length + files.length > 6) {
      showToast('Maximum 6 ornament photos allowed.', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const newCompressedPhotos: string[] = [];

    for (const file of files) {
      if (!validTypes.includes(file.type.toLowerCase())) {
        showToast(`Please select a JPG, PNG, or WEBP image (${file.name}).`, 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Image size must be less than 5 MB (${file.name}).`, 'error');
        continue;
      }

      try {
        const compressedBase64 = await compressImage(file);
        newCompressedPhotos.push(compressedBase64);
      } catch (err) {
        showToast(`Failed to process image ${file.name}`, 'error');
      }
    }

    if (newCompressedPhotos.length > 0) {
      setOrnamentPhotos((prev) => [...prev, ...newCompressedPhotos]);
      showToast(`Uploaded ${newCompressedPhotos.length} ornament photo(s)`, 'success');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove Photo Handler
  const handleRemovePhoto = (index: number) => {
    setOrnamentPhotos((prev) => prev.filter((_, i) => i !== index));
    showToast('Ornament photo removed', 'info');
  };

  // Clear Form Handler
  const handleClearForm = () => {
    setSelectedCustomer(null);
    setCustSearchQuery('');
    setHasNominee(false);
    setNomineeName('');
    setNomineeRelation('Father');
    setNomineeCustomRelation('');
    setNomineeDob('');
    setNomineeGender('Male');
    setNomineePhone('');
    setNomineeAltPhone('');
    setNomineeEmail('');
    setNomineeOccupation('');
    setNomineeAadhaarNo('');
    setNomineePanNo('');
    setNomineeAddress('');
    setNomineePermanentAddress('');
    setNomineeSameAsCurrentAddress(false);
    setNomineeSameAsCustomerAddress(false);
    setNomineePhoto(null);
    setNomineeLocation(null);
    setNomineeDocs({
      aadhaarFront: null,
      aadhaarBack: null,
      panCard: null
    });
    setHasGuarantor(false);
    setGuarantorName('');
    setGuarantorRelation('Friend');
    setGuarantorCustomRelation('');
    setGuarantorAge('');
    setGuarantorDob('');
    setGuarantorGender('Male');
    setGuarantorPhone('');
    setGuarantorAltPhone('');
    setGuarantorEmail('');
    setGuarantorOccupation('');
    setGuarantorMonthlyIncome('');
    setGuarantorAadhaarNo('');
    setGuarantorPanNo('');
    setGuarantorAddress('');
    setGuarantorPermanentAddress('');
    setGuarantorSameAsCurrentAddress(false);
    setGuarantorPhoto(null);
    setGuarantorDocs({
      aadhaarFront: null,
      aadhaarBack: null,
      panCard: null,
      photo: null
    });
    setPrincipal(100000);
    setDisbursementMethod('Cash');
    setDeductAdvanceInterest(false);
    setAdvanceDays(0);
    setItems([
      {
        id: 'item-1',
        item: '',
        qty: 1,
        purity: '22ct',
        grossWeight: 0,
        deductionWeight: 0,
        netWeight: 0
      }
    ]);
    setAdditionalNotes('');
    setOrnamentPhotos([]);
    showToast('Form cleared', 'info');
  };

  // Submit Issue Loan
  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!selectedLoanTypeConfig || !selectedLoanTypeConfig.active || selectedLoanTypeConfig.showOnLoanIssue === false) {
      showToast('Interest configuration is unavailable for this Loan Type. Please contact the administrator.', 'error');
      return;
    }

    if (!selectedCustomer) {
      showToast('Customer not found. Please select an existing customer before issuing a loan.', 'error');
      return;
    }

    if (!numericPrincipal || numericPrincipal <= 0) {
      showToast('Please enter a valid loan principal amount.', 'error');
      return;
    }

    if (disbursementMethod === 'Bank' && !bankMode) {
      showToast('Please select a Bank Mode.', 'error');
      return;
    }

    if (disbursementMethod === 'Cash + Bank') {
      const cAmt = Number(splitCashAmount) || 0;
      const bAmt = Number(splitBankAmount) || 0;
      if (cAmt <= 0 || bAmt <= 0 || cAmt + bAmt !== numericPrincipal) {
        showToast('Cash + Bank amount must equal the Principal Amount.', 'error');
        return;
      }
    }

    // Validate Ornament Items
    if (!items || items.length === 0) {
      showToast('At least one ornament item is required.', 'error');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qVal = Number(it.qty);
      if (it.qty === ('' as any) || isNaN(qVal) || qVal < 1) {
        showToast(`Quantity must be at least 1 for ornament #${i + 1}.`, 'error');
        return;
      }
      if (!Number.isInteger(qVal)) {
        showToast(`Quantity must be a whole number for ornament #${i + 1}.`, 'error');
        return;
      }
      const gWeight = Number(it.grossWeight) || 0;
      const dWeight = Number(it.deductionWeight) || 0;
      if (gWeight < 0 || dWeight < 0) {
        showToast(`Weight values cannot be negative for ornament #${i + 1}.`, 'error');
        return;
      }
      if (dWeight > gWeight) {
        showToast(`Deduction weight (${dWeight.toFixed(3)}g) cannot be greater than gross weight (${gWeight.toFixed(3)}g) for ornament #${i + 1}.`, 'error');
        return;
      }
    }

    if (hasWeightErrors) {
      showToast('Please resolve ornament weight deduction errors before submitting.', 'error');
      return;
    }

    if (totalNetWeight <= 0) {
      showToast('Please specify ornament net weight greater than 0.', 'error');
      return;
    }

    if (!manualMarketValue.trim() || isNaN(numericMarketValue) || numericMarketValue <= 0) {
      showToast('Please enter a valid Total Market Value (₹) greater than 0.', 'error');
      return;
    }

    // Validate Nominee details when hasNominee is checked
    if (hasNominee) {
      if (!nomineeName.trim()) {
        showToast('Please enter the Nominee Full Name.', 'error');
        return;
      }
      if (!nomineeRelation || nomineeRelation === '-') {
        showToast('Please select the Relationship with Customer for Nominee.', 'error');
        return;
      }
      if (nomineeRelation === 'Other' && !nomineeCustomRelation.trim()) {
        showToast('Please specify the custom Nominee relationship.', 'error');
        return;
      }
      const cleanPhone = nomineePhone.replace(/\D/g, '');
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        showToast('Please enter a valid 10-digit Indian Mobile Number for Nominee.', 'error');
        return;
      }
      if (nomineeAltPhone && nomineeAltPhone.trim()) {
        const cleanAlt = nomineeAltPhone.replace(/\D/g, '');
        if (cleanAlt.length !== 10 || !/^[6-9]\d{9}$/.test(cleanAlt)) {
          showToast('Please enter a valid 10-digit Alternate Mobile Number for Nominee.', 'error');
          return;
        }
      }
      if (nomineeEmail && nomineeEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(nomineeEmail.trim())) {
          showToast('Please enter a valid Email address for Nominee.', 'error');
          return;
        }
      }
      if (nomineeDob) {
        const dobDate = new Date(nomineeDob);
        if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
          showToast('Nominee Date of Birth cannot be in the future.', 'error');
          return;
        }
      }

      const cleanAadhaar = nomineeAadhaarNo.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        showToast('Enter a valid 12-digit Aadhaar number for Nominee.', 'error');
        return;
      }

      if (nomineePanNo && nomineePanNo.trim()) {
        const panUpper = nomineePanNo.trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
          showToast('Enter a valid PAN number for Nominee (e.g. ABCDE1234F).', 'error');
          return;
        }
      }

      if (!nomineeAddress.trim()) {
        showToast('Please enter the Nominee Current Address.', 'error');
        return;
      }
    }

    // Validate Guarantor details when hasGuarantor is checked
    if (hasGuarantor) {
      if (!guarantorName.trim()) {
        showToast('Please enter the Guarantor Full Name.', 'error');
        return;
      }
      if (!guarantorRelation || guarantorRelation === '-') {
        showToast('Please select the Relationship with Customer for Guarantor.', 'error');
        return;
      }
      if (guarantorRelation === 'Other' && !guarantorCustomRelation.trim()) {
        showToast('Please specify the custom Guarantor relationship.', 'error');
        return;
      }
      const cleanPhone = guarantorPhone.replace(/\D/g, '');
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        showToast('Please enter a valid 10-digit Indian Mobile Number for Guarantor.', 'error');
        return;
      }
      if (guarantorAltPhone && guarantorAltPhone.trim()) {
        const cleanAlt = guarantorAltPhone.replace(/\D/g, '');
        if (cleanAlt.length !== 10 || !/^[6-9]\d{9}$/.test(cleanAlt)) {
          showToast('Please enter a valid 10-digit Alternate Mobile Number for Guarantor.', 'error');
          return;
        }
      }
      if (guarantorEmail && guarantorEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guarantorEmail.trim())) {
          showToast('Please enter a valid Email address for Guarantor.', 'error');
          return;
        }
      }
      if (guarantorDob) {
        const dobDate = new Date(guarantorDob);
        if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
          showToast('Guarantor Date of Birth cannot be in the future.', 'error');
          return;
        }
      }
      if (guarantorMonthlyIncome !== '' && Number(guarantorMonthlyIncome) < 0) {
        showToast('Guarantor Monthly Income cannot be negative.', 'error');
        return;
      }

      const cleanAadhaar = guarantorAadhaarNo.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        showToast('Enter a valid 12-digit Aadhaar number for Guarantor.', 'error');
        return;
      }

      if (guarantorPanNo && guarantorPanNo.trim()) {
        const panUpper = guarantorPanNo.trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
          showToast('Enter a valid PAN number for Guarantor (e.g. ABCDE1234F).', 'error');
          return;
        }
      }

      if (!guarantorAddress.trim()) {
        showToast('Please enter the Guarantor Current Address.', 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Revalidate latest business date and allocate sequence safely
      const finalBusinessDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      const finalLoanNo = displayLoanNo;
      const finalReceiptNo = displayReceiptNo;

      const cleanNomineeAadhaar = nomineeAadhaarNo.replace(/\D/g, '');
      const cleanNomineePan = nomineePanNo.trim().toUpperCase();
      const cleanNomineePhone = nomineePhone.replace(/\D/g, '');
      const cleanNomineeAltPhone = nomineeAltPhone.replace(/\D/g, '');

      const cleanGuarantorAadhaar = guarantorAadhaarNo.replace(/\D/g, '');
      const cleanGuarantorPan = guarantorPanNo.trim().toUpperCase();
      const cleanGuarantorPhone = guarantorPhone.replace(/\D/g, '');
      const cleanGuarantorAltPhone = guarantorAltPhone.replace(/\D/g, '');

      const created = addLoan({
        receiptBillNo: finalReceiptNo,
        loanNo: finalLoanNo,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerGender: (selectedCustomer.gender as any) || 'Male',
        customerAge: selectedCustomer.age || 30,
        customerOccupation: selectedCustomer.occupation || 'Self Employed',
        customerEmail: selectedCustomer.email,
        customerPhotoUrl: selectedCustomer.customerPhoto || undefined,
        customerCurrentAddress: selectedCustomer.currentAddress,
        customerPermanentAddress: selectedCustomer.permanentAddress || selectedCustomer.currentAddress,
        customerLocation: selectedCustomer.currentLocation
          ? {
              captured: true,
              coordinates: `${(selectedCustomer.currentLocation as any).latitude || ''}, ${(selectedCustomer.currentLocation as any).longitude || ''}`,
              mapsUrl: (selectedCustomer.currentLocation as any).googleMapsUrl || (selectedCustomer.currentLocation as any).mapsUrl || '',
              addressSummary: selectedCustomer.currentAddress
            }
          : undefined,
        nominee: hasNominee
          ? {
            hasNominee: true,
            enabled: true,
            name: nomineeName.trim(),
            fullName: nomineeName.trim(),
            relationship: resolveRelation(nomineeRelation, nomineeCustomRelation),
            relation: nomineeRelation,
            customRelation: nomineeRelation === 'Other' ? nomineeCustomRelation.trim() || null : null,
            specifiedRelation: nomineeRelation === 'Other' ? nomineeCustomRelation.trim() || null : null,
            phone: cleanNomineePhone,
            mobile: cleanNomineePhone,
            alternateMobile: cleanNomineeAltPhone || undefined,
            gender: nomineeGender,
            dateOfBirth: nomineeDob || undefined,
            age: calculateAgeFromDob(nomineeDob) || undefined,
            occupation: nomineeOccupation.trim() || undefined,
            email: nomineeEmail.trim() || undefined,
            photo: nomineePhoto || null,
            aadhaarNumber: cleanNomineeAadhaar,
            panNumber: cleanNomineePan || undefined,
            idProofNumber: cleanNomineeAadhaar,
            address: nomineeAddress.trim(),
            currentAddress: nomineeAddress.trim(),
            permanentAddress: nomineeSameAsCurrentAddress ? nomineeAddress.trim() : (nomineePermanentAddress.trim() || nomineeAddress.trim()),
            sameAsCurrentAddress: nomineeSameAsCurrentAddress,
            isSameAddress: nomineeSameAsCurrentAddress,
            location: nomineeLocation,
            documents: nomineeDocs
          }
          : undefined,
        guarantor: hasGuarantor
          ? {
            hasGuarantor: true,
            enabled: true,
            name: guarantorName.trim(),
            fullName: guarantorName.trim(),
            relationship: resolveRelation(guarantorRelation, guarantorCustomRelation),
            relation: guarantorRelation,
            customRelation: guarantorRelation === 'Other' ? guarantorCustomRelation.trim() || null : null,
            specifiedRelation: guarantorRelation === 'Other' ? guarantorCustomRelation.trim() || null : null,
            gender: guarantorGender,
            dateOfBirth: guarantorDob || undefined,
            age: calculateAgeFromDob(guarantorDob) || Number(guarantorAge) || undefined,
            phone: cleanGuarantorPhone,
            mobile: cleanGuarantorPhone,
            alternateMobile: cleanGuarantorAltPhone || undefined,
            email: guarantorEmail.trim() || undefined,
            occupation: guarantorOccupation.trim() || undefined,
            monthlyIncome: guarantorMonthlyIncome !== '' ? Number(guarantorMonthlyIncome) : 0,
            aadhaarNumber: cleanGuarantorAadhaar,
            panNumber: cleanGuarantorPan || undefined,
            idProof: cleanGuarantorAadhaar,
            address: guarantorAddress.trim(),
            currentAddress: guarantorAddress.trim(),
            permanentAddress: guarantorSameAsCurrentAddress ? guarantorAddress.trim() : (guarantorPermanentAddress.trim() || guarantorAddress.trim()),
            sameAsCurrentAddress: guarantorSameAsCurrentAddress,
            isSameAddress: guarantorSameAsCurrentAddress,
            documents: guarantorDocs
          }
          : undefined,
        kycDocuments: selectedCustomer.kycDocumentDriveIds || [],
        date: finalBusinessDate,
        loanType: selectedLoanTypeConfig.name,
        loanTypeId: selectedLoanTypeConfig.id,
        loanTypeName: selectedLoanTypeConfig.name,
        repaymentSystem: selectedRepaymentConfig.name,
        repaymentSystemId: selectedRepaymentConfig.id,
        repaymentSystemName: selectedRepaymentConfig.name,
        calculationStrategy: selectedRepaymentConfig.calculationStrategy,
        ...loanTerms.contractSnapshot,
        principal: numericPrincipal,
        interestRate: loanTerms.interestRate,
        bankMode: disbursementMethod === 'Cash' ? 'Cash' : (disbursementMethod === 'Bank' ? (bankMode as any) : 'Split'),
        splitBankMode: disbursementMethod === 'Cash + Bank' ? bankMode : undefined,
        cashAmount: disbursementMethod === 'Cash' ? numericPrincipal : (disbursementMethod === 'Cash + Bank' ? Number(splitCashAmount) || 0 : 0),
        bankAmount: disbursementMethod === 'Bank' ? numericPrincipal : (disbursementMethod === 'Cash + Bank' ? Number(splitBankAmount) || 0 : 0),
        deductAdvanceInterest,
        advanceDays,
        advanceInterestAmount,
        advanceInterestReceivingMethod: deductAdvanceInterest ? advanceReceivingMethod : undefined,
        cardFee: loanTerms.effectiveCardFee,
        cardFeeEnabled: loanTerms.contractSnapshot.cardFeeEnabled,
        cardFeePaymentMode: cardFeeMode,
        cardFeeBankMode: cardFeeMode === 'Bank' ? cardFeeBankMode : undefined,
        items: items.map(it => {
          const rawQty = Number(it.qty);
          const validQty = Number.isInteger(rawQty) && rawQty >= 1 ? rawQty : 1;
          const gross = Number(it.grossWeight) || 0;
          const deduction = Number(it.deductionWeight) || 0;
          const net = Math.max(0, round3(gross - deduction));
          return {
            ...it,
            qty: validQty,
            grossWeight: gross,
            deductionWeight: deduction,
            netWeight: net
          };
        }),
        totalGrossWeight,
        totalDeductionWeight,
        totalNetWeight,
        marketValue: numericMarketValue,
        ltv: Number(ltv),
        monthlyInterest,
        notes: additionalNotes,
        photos: ornamentPhotos,
        status: 'ACTIVE',
        disbursedAmount: loanTerms.netDisbursed,
        netDisbursed: loanTerms.netDisbursed,
        outstandingPrincipal: numericPrincipal,
        accruedInterest: 0,
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB').replace(/\//g, '-'),
        nextDueDate: loanTerms.nextDueDate
      });

      if (created) {
        showToast(`Loan ${created.loanNo || finalLoanNo} issued successfully!`, 'success');
        setCurrentPage('all-receipts');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content fi-page">

      {/* PAGE HEADER */}
      <div className="fi-page-header">
        <div>
          <h1 className="fi-page-title">Loan Issue</h1>
          <p className="fi-page-subtitle">Issue new loans and manage existing loan creation.</p>
        </div>
      </div>

      {/* ISSUE NEW LOAN FORM */}
      <form onSubmit={handleSubmitIssue} className="fi-rows fi-rows--lg">

          {/* SECTION 1 — LOAN CONFIGURATION */}
          <div className="fi-card">
            <div className="fi-section-header">
              <div className="fi-section-title-group">
                <span className="fi-section-icon">📋</span>
                <div>
                  <h2 className="fi-section-title">Loan Configuration</h2>
                  <p className="fi-section-desc">Reference numbers, issue date, loan type, and repayment system</p>
                </div>
              </div>
            </div>

            <div className="fi-rows">
              <div className="fi-grid-3">
                <div className="fi-field">
                  <div className="fi-label-sub">
                    <label className="fi-label">Receipt / Bill No <span className="fi-req">*</span></label>
                    <span className="fi-label-badge">✓ Auto</span>
                  </div>
                  <input
                    type="text"
                    className="input-control"
                    value={displayReceiptNo}
                    readOnly
                    tabIndex={-1}
                    inputMode="none"
                    style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'default', fontWeight: 600 }}
                  />
                  <span className="fi-hint">✓ Auto-generated by system</span>
                </div>

                <div className="fi-field">
                  <div className="fi-label-sub">
                    <label className="fi-label">Loan No <span className="fi-req">*</span></label>
                    <span className="fi-label-badge">✓ Auto</span>
                  </div>
                  <input
                    type="text"
                    className="input-control"
                    value={displayLoanNo}
                    readOnly
                    tabIndex={-1}
                    inputMode="none"
                    style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'default', fontWeight: 600 }}
                  />
                  <span className="fi-hint">✓ Auto-generated by system</span>
                </div>

                <div className="fi-field">
                  <div className="fi-label-sub">
                    <label className="fi-label">Loan Issue Date <span className="fi-req">*</span></label>
                    <span className="fi-label-badge">🔒 System Date</span>
                  </div>
                  <input
                    type="text"
                    className="input-control"
                    value={currentBusinessDate}
                    readOnly
                    tabIndex={-1}
                    inputMode="none"
                    style={{ backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', cursor: 'default', fontWeight: 600 }}
                  />
                  <span className="fi-hint">✓ Current business date (read-only)</span>
                </div>
              </div>

              <div className="fi-grid-2">
                <div className="fi-field">
                  <label className="fi-label">Loan Type <span className="fi-req">*</span></label>
                  <select className="input-control" value={loanTypeId} onChange={(e) => setLoanTypeId(e.target.value)}>
                    {activeLoanTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fi-field">
                  <label className="fi-label">Repayment System <span className="fi-req">*</span></label>
                  <select className="input-control" value={repaymentSystemId} onChange={(e) => setRepaymentSystemId(e.target.value)}>
                    {activeRepaymentSystems.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Centralized Configuration Preview Summary */}
              {selectedLoanTypeConfig ? (
                <div
                  style={{
                    backgroundColor: 'rgba(5, 150, 105, 0.05)',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginTop: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px dashed rgba(5, 150, 105, 0.2)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary-dark, #059669)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ⚙️ LOAN CONFIGURATION
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#047857', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                      🔒 Master Control Linked
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '12px',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Loan Type
                      </span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-dark, #0f172a)' }}>
                        {selectedLoanTypeConfig.name}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Interest Rate
                      </span>
                      <strong style={{ fontSize: '13.5px', color: '#047857' }}>
                        {interestRate}% per month
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Card Processing Fee
                      </span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--color-primary-dark, #059669)' }}>
                        {cardFeeEnabled ? `₹${cardFeeAmount}` : '₹0 (Disabled)'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Interest Profile
                      </span>
                      <strong style={{ fontSize: '13.5px', color: '#1d4ed8' }}>
                        {selectedLoanTypeConfig.interestProfileId === 'silver-bands'
                          ? 'Silver Amount Bands'
                          : selectedLoanTypeConfig.interestProfileId === 'pronote-interest'
                          ? 'Pronote Interest'
                          : selectedLoanTypeConfig.interestProfileId === 'fixed-rate'
                          ? `Fixed Rate (${selectedLoanTypeConfig.defaultMonthlyRate || interestRate}%/mo)`
                          : 'Gold Amount Bands'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Repayment
                      </span>
                      <strong style={{ fontSize: '13.5px', color: '#7e22ce' }}>
                        {selectedRepaymentConfig?.name || 'Monthly Interest Only'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                        Configuration Version
                      </span>
                      <span
                        className="badge badge-info"
                        style={{ fontSize: '11.5px', fontWeight: 800, padding: '2px 8px' }}
                      >
                        V{selectedLoanTypeConfig.configurationVersion || 1}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', padding: '12px 16px', marginTop: '12px', color: '#991b1b', fontSize: '12.5px', fontWeight: 700 }}>
                  ⚠️ Interest configuration is missing for this Loan Type. Please contact the administrator.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 1 — CUSTOMER SELECTION & READ-ONLY PREVIEW */}
          <div className="fi-card">
            <div className="fi-section-header">
              <div className="fi-section-title-group">
                <span className="fi-section-icon">🔍</span>
                <div>
                  <h2 className="fi-section-title">Customer Selection</h2>
                  <p className="fi-section-desc">Search and select an existing borrower by Customer ID, Name, or Mobile Number</p>
                </div>
              </div>
            </div>

            <div className="fi-rows">
              <div className="fi-field" style={{ position: 'relative' }}>
                <label className="fi-label">Search Customer <span className="fi-req">*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '38px', height: '42px', fontSize: '13.5px' }}
                    placeholder="Search by Customer ID (e.g. CUST-0001), Name, or Mobile Number..."
                    value={custSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustSearchQuery(val);
                      setShowCustSuggestions(true);

                      const normVal = val.trim().toLowerCase();
                      if (normVal) {
                        const match = customers.find(c => !c.isDeleted && (
                          c.id.toLowerCase() === normVal ||
                          (c.customerId && c.customerId.toString() === normVal) ||
                          (c.phone && c.phone.replace(/\D/g, '').slice(-10) === normVal.replace(/\D/g, '').slice(-10))
                        ));
                        if (match) {
                          setSelectedCustomer(match);
                        }
                      }
                    }}
                    onFocus={() => setShowCustSuggestions(true)}
                  />
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>

                {/* Auto Suggestions Dropdown */}
                {showCustSuggestions && custSearchQuery.trim() && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-light, #cbd5e1)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}
                  >
                    {customers
                      .filter(c => !c.isDeleted)
                      .filter(c => {
                        const q = custSearchQuery.toLowerCase().trim();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.phone.includes(q) ||
                          c.id.toLowerCase().includes(q) ||
                          (c.customerId && c.customerId.toString() === q)
                        );
                      })
                      .length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>
                        ⚠ Customer not found. Please enter a valid Customer ID or search for an existing customer.
                      </div>
                    ) : (
                      customers
                        .filter(c => !c.isDeleted)
                        .filter(c => {
                          const q = custSearchQuery.toLowerCase().trim();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.phone.includes(q) ||
                            c.id.toLowerCase().includes(q) ||
                            (c.customerId && c.customerId.toString() === q)
                          );
                        })
                        .map((c, idx) => (
                          <div
                            key={`sug-${c.id}-${idx}`}
                            style={{
                              padding: '10px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-subtle, #f1f5f9)'
                            }}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustSearchQuery(`${c.name} (${c.id})`);
                              setShowCustSuggestions(false);
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {c.customerPhoto ? (
                                <img src={c.customerPhoto} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-light-accent)', color: 'var(--color-primary-dark)', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <strong style={{ fontSize: '13.5px', color: 'var(--text-dark)' }}>{c.name}</strong>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block' }}>+91 {c.phone}</span>
                              </div>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: '11px' }}>{c.id}</span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Customer Not Found Warning Banner */}
              {!selectedCustomer && (
                <div style={{ backgroundColor: 'var(--badge-danger-bg)', border: '1px solid var(--badge-danger-border)', borderRadius: '8px', padding: '12px 16px', color: 'var(--color-danger)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>⚠ Customer not found. Please enter a valid Customer ID or search for an existing customer.</span>
                </div>
              )}

              {/* READ-ONLY CUSTOMER PREVIEW CARD */}
              {selectedCustomer && (
                <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light, #cbd5e1)', backgroundColor: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-dark, #059669)' }}>
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
                            👤 CUSTOMER SELECTED
                          </h3>
                          <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                            ✓ Existing Customer Selected
                          </span>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>Read-Only Borrower KYC Profile linked by Customer ID</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', padding: '4px 12px', gap: '6px' }}
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustSearchQuery('');
                      }}
                    >
                      <X size={14} />
                      <span>Change Customer</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '20px', alignItems: 'start' }}>
                    {/* Col 1: Photo & ID */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      {selectedCustomer.customerPhoto ? (
                        <img
                          src={selectedCustomer.customerPhoto}
                          alt={selectedCustomer.name}
                          style={{ width: '110px', height: '120px', borderRadius: '10px', objectFit: 'cover', border: '2px solid var(--color-primary-accent, #059669)', marginBottom: '8px' }}
                        />
                      ) : (
                        <div style={{ width: '110px', height: '120px', borderRadius: '10px', backgroundColor: 'var(--color-light-accent, #e6f4f1)', color: 'var(--color-primary-dark, #163f35)', fontSize: '36px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          {selectedCustomer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <strong style={{ fontSize: '15px', color: 'var(--text-dark, #0f172a)' }}>{selectedCustomer.name}</strong>
                      <span className="badge badge-success" style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 700 }}>
                        {selectedCustomer.id}
                      </span>
                    </div>

                    {/* Col 2: Personal Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>📱 PHONE</span>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-dark)' }}>+91 {selectedCustomer.phone}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>👤 GENDER</span>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>{selectedCustomer.gender || 'Male'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>🎂 AGE / DATE OF BIRTH</span>
                        <strong style={{ color: 'var(--text-dark)' }}>
                          {selectedCustomer.dateOfBirth ? `DOB: ${selectedCustomer.dateOfBirth}` : `${selectedCustomer.age || 30} Years`}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>💼 OCCUPATION</span>
                        <span>{selectedCustomer.occupation || 'Self Employed'}</span>
                      </div>
                    </div>

                    {/* Col 3: ID Proof, Addresses & Location */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>🪪 ID PROOF</span>
                        <strong style={{ color: 'var(--color-primary-dark)' }}>{selectedCustomer.idProof}: </strong>
                        <span>{formatIdProofDisplay(selectedCustomer.idProof, selectedCustomer.idNumber)}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>📍 CURRENT ADDRESS</span>
                        <span>{selectedCustomer.currentAddress || 'Saved Address'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>🏠 PERMANENT ADDRESS</span>
                        <span>{selectedCustomer.permanentAddress || selectedCustomer.currentAddress || 'Same as Current'}</span>
                      </div>
                      {((selectedCustomer.currentLocation as any)?.googleMapsUrl || (selectedCustomer.currentLocation as any)?.mapsUrl || (selectedCustomer.location as any)?.googleMapsUrl) && (
                        <div style={{ marginTop: '4px' }}>
                          <a
                            href={(selectedCustomer.currentLocation as any)?.googleMapsUrl || (selectedCustomer.currentLocation as any)?.mapsUrl || (selectedCustomer.location as any)?.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '4px 10px', gap: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <span>🔗 View Saved Location on Map</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* NOMINEE & GUARANTOR SECTION */}
          <div className="fi-card">
            <div className="fi-section-header">
              <div className="fi-section-title-group">
                <span className="fi-section-icon">🤝</span>
                <div>
                  <h3 className="fi-section-title">Nominee &amp; Guarantor Details</h3>
                  <p className="fi-section-desc">Optional nominee &amp; guarantor information for the loan</p>
                </div>
              </div>
            </div>

            {/* Nominee & Guarantor */}
            <div className="fi-rows">

              {/* ──────────────────────────────────────────────────────── */}
              {/* NOMINEE KYC SECTION                                     */}
              {/* ──────────────────────────────────────────────────────── */}
              <div>
                <label className="fi-checkbox-row">
                  <input type="checkbox" checked={hasNominee} onChange={(e) => setHasNominee(e.target.checked)} />
                  <span className="fi-checkbox-label"><span className="fi-checkbox-label-icon">👤</span> Do you have a Nominee?</span>
                </label>

                {hasNominee && (
                  <div className="fi-sub-panel fi-rows" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light, #e2e8f0)', padding: '24px', borderRadius: '12px', marginTop: '12px', boxShadow: 'var(--shadow-sm)' }}>
                    
                    {/* SECTION 1: BASIC INFORMATION */}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <User size={16} /> 1. BASIC INFORMATION
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {/* NOMINEE PHOTO UPLOAD & WEBCAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed var(--border-light, #cbd5e1)', overflow: 'hidden', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {nomineePhoto ? (
                              <img src={nomineePhoto} alt="Nominee Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '4px' }}>
                                <Camera size={24} style={{ margin: '0 auto 4px auto', display: 'block', opacity: 0.5 }} />
                                <span>Nominee Photo</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', height: '28px', padding: '0 8px', gap: '4px' }}
                              onClick={() => setIsNomineeWebcamOpen(true)}
                            >
                              <Camera size={12} />
                              <span>Webcam</span>
                            </button>

                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', height: '28px', padding: '0 8px', gap: '4px', cursor: 'pointer', margin: 0 }}>
                              <Upload size={12} />
                              <span>Upload</span>
                              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleNomineePhotoFileUpload} />
                            </label>

                            {nomineePhoto && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', height: '28px', padding: '0 6px', color: 'var(--color-danger, #ef4444)' }}
                                onClick={() => setNomineePhoto(null)}
                                title="Remove Photo"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* BASIC DETAILS GRID */}
                        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div className="fi-grid-2">
                            <div className="fi-field">
                              <label className="fi-label">Nominee Full Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="Enter full name"
                                value={nomineeName}
                                onChange={(e) => setNomineeName(e.target.value)}
                              />
                            </div>

                            <div className="fi-field">
                              <label className="fi-label">Gender</label>
                              <select
                                className="select-control input-control"
                                value={nomineeGender}
                                onChange={(e) => setNomineeGender(e.target.value as any)}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div className="fi-grid-2">
                            <div className="fi-field">
                              <label className="fi-label">Date of Birth</label>
                              <input
                                type="date"
                                className="input-control"
                                value={nomineeDob}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setNomineeDob(e.target.value)}
                              />
                              {nomineeDob && (
                                <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                                  Calculated Age: {calculateAgeFromDob(nomineeDob)} Years
                                </span>
                              )}
                            </div>

                            <div className="fi-field">
                              <OtherSelectField
                                label="Relationship with Customer *"
                                value={nomineeRelation}
                                customValue={nomineeCustomRelation}
                                options={NOMINEE_RELATION_OPTIONS}
                                customPlaceholder="Specify relation (e.g. Aunt, Uncle)"
                                customLabel="Specify Relation *"
                                onChange={(val, custom) => { setNomineeRelation(val); setNomineeCustomRelation(custom); }}
                              />
                            </div>
                          </div>

                          <div className="fi-field">
                            <label className="fi-label">Occupation (Optional)</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Salaried, Business, Agriculture, Homemaker"
                              value={nomineeOccupation}
                              onChange={(e) => setNomineeOccupation(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: CONTACT INFORMATION */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <span>📱 2. CONTACT INFORMATION</span>
                      </div>

                      <div className="fi-grid-3">
                        <div className="fi-field">
                          <label className="fi-label">Mobile Number <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className="input-control readonly" style={{ width: '50px', textAlign: 'center', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                              +91
                            </span>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="10-digit mobile number"
                              maxLength={10}
                              value={nomineePhone}
                              onChange={(e) => setNomineePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            />
                          </div>
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">Alternate Mobile (Optional)</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className="input-control readonly" style={{ width: '50px', textAlign: 'center', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                              +91
                            </span>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="10-digit alternate mobile"
                              maxLength={10}
                              value={nomineeAltPhone}
                              onChange={(e) => setNomineeAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            />
                          </div>
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">Email Address (Optional)</label>
                          <input
                            type="email"
                            className="input-control"
                            placeholder="nominee@email.com"
                            value={nomineeEmail}
                            onChange={(e) => setNomineeEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: KYC INFORMATION */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <ShieldCheck size={16} /> 3. KYC IDENTIFICATION
                      </div>

                      <div className="fi-grid-2">
                        <div className="fi-field">
                          <label className="fi-label">Aadhaar Number <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="12-digit Aadhaar number"
                            maxLength={14}
                            value={formatAadhaarInput(nomineeAadhaarNo)}
                            onChange={(e) => setNomineeAadhaarNo(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          />
                          {nomineeAadhaarNo.replace(/\D/g, '').length === 12 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                              ✓ Valid 12-digit format ({maskAadhaarNumber(nomineeAadhaarNo)})
                            </span>
                          )}
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">PAN Number (Optional)</label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            style={{ textTransform: 'uppercase' }}
                            value={nomineePanNo}
                            onChange={(e) => setNomineePanNo(e.target.value.toUpperCase().slice(0, 10))}
                          />
                          {nomineePanNo && validatePANNumber(nomineePanNo).isValid && (
                            <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                              ✓ Valid PAN format ({maskPANNumber(nomineePanNo)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: ADDRESS DETAILS */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📍 4. RESIDENTIAL ADDRESS
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-dark)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={nomineeSameAsCurrentAddress}
                              onChange={(e) => handleNomineeSameAsCurrentAddressToggle(e.target.checked)}
                            />
                            <span>Same as Current Address</span>
                          </label>

                          {selectedCustomer && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={nomineeSameAsCustomerAddress}
                                onChange={(e) => handleToggleSameAsCustomerAddress(e.target.checked)}
                              />
                              <span>Copy Customer Address</span>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="fi-field" style={{ marginBottom: '14px' }}>
                        <label className="fi-label">Current Address <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea
                          className="input-control"
                          rows={2}
                          placeholder="Complete current residential address"
                          value={nomineeAddress}
                          onChange={(e) => {
                            setNomineeAddress(e.target.value);
                            if (nomineeSameAsCurrentAddress) {
                              setNomineePermanentAddress(e.target.value);
                            }
                          }}
                        />
                      </div>

                      <div className="fi-field">
                        <label className="fi-label">Permanent Address (Optional)</label>
                        <textarea
                          className="input-control"
                          rows={2}
                          placeholder="Permanent address (or same as current)"
                          value={nomineePermanentAddress}
                          onChange={(e) => {
                            setNomineePermanentAddress(e.target.value);
                            if (nomineeSameAsCurrentAddress && e.target.value !== nomineeAddress) {
                              setNomineeSameAsCurrentAddress(false);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 5: KYC DOCUMENTS */}
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> 5. NOMINEE KYC DOCUMENTS (OPTIONAL)
                      </div>

                      <div className="fi-grid-3">
                        {/* Aadhaar Front */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>Aadhaar Front</span>
                          {nomineeDocs.aadhaarFront ? (
                            <div>
                              {nomineeDocs.aadhaarFront.startsWith('data:image') ? (
                                <img src={nomineeDocs.aadhaarFront} alt="Aadhaar Front" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setNomineeDocs(prev => ({ ...prev, aadhaarFront: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload Front</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setNomineeDocs(p => ({ ...p, aadhaarFront: url })))} />
                            </label>
                          )}
                        </div>

                        {/* Aadhaar Back */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>Aadhaar Back</span>
                          {nomineeDocs.aadhaarBack ? (
                            <div>
                              {nomineeDocs.aadhaarBack.startsWith('data:image') ? (
                                <img src={nomineeDocs.aadhaarBack} alt="Aadhaar Back" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setNomineeDocs(prev => ({ ...prev, aadhaarBack: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload Back</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setNomineeDocs(p => ({ ...p, aadhaarBack: url })))} />
                            </label>
                          )}
                        </div>

                        {/* PAN Card */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>PAN Card</span>
                          {nomineeDocs.panCard ? (
                            <div>
                              {nomineeDocs.panCard.startsWith('data:image') ? (
                                <img src={nomineeDocs.panCard} alt="PAN Card" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setNomineeDocs(prev => ({ ...prev, panCard: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload PAN</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setNomineeDocs(p => ({ ...p, panCard: url })))} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* ──────────────────────────────────────────────────────── */}
              {/* GUARANTOR KYC SECTION                                   */}
              {/* ──────────────────────────────────────────────────────── */}
              <div>
                <label className="fi-checkbox-row">
                  <input type="checkbox" checked={hasGuarantor} onChange={(e) => setHasGuarantor(e.target.checked)} />
                  <span className="fi-checkbox-label"><span className="fi-checkbox-label-icon">🤝</span> Do you have a Guarantor?</span>
                </label>

                {hasGuarantor && (
                  <div className="fi-sub-panel fi-rows" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light, #e2e8f0)', padding: '24px', borderRadius: '12px', marginTop: '12px', boxShadow: 'var(--shadow-sm)' }}>
                    
                    {/* SECTION 1: BASIC INFORMATION */}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <User size={16} /> 1. BASIC INFORMATION
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {/* GUARANTOR PHOTO UPLOAD & WEBCAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed var(--border-light, #cbd5e1)', overflow: 'hidden', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {guarantorPhoto ? (
                              <img src={guarantorPhoto} alt="Guarantor Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '4px' }}>
                                <Camera size={24} style={{ margin: '0 auto 4px auto', display: 'block', opacity: 0.5 }} />
                                <span>Guarantor Photo</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', height: '28px', padding: '0 8px', gap: '4px' }}
                              onClick={() => setIsGuarantorWebcamOpen(true)}
                            >
                              <Camera size={12} />
                              <span>Webcam</span>
                            </button>

                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', height: '28px', padding: '0 8px', gap: '4px', cursor: 'pointer', margin: 0 }}>
                              <Upload size={12} />
                              <span>Upload</span>
                              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleGuarantorPhotoFileUpload} />
                            </label>

                            {guarantorPhoto && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', height: '28px', padding: '0 6px', color: 'var(--color-danger, #ef4444)' }}
                                onClick={() => setGuarantorPhoto(null)}
                                title="Remove Photo"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* BASIC DETAILS GRID */}
                        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div className="fi-grid-2">
                            <div className="fi-field">
                              <label className="fi-label">Guarantor Full Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="Enter full name"
                                value={guarantorName}
                                onChange={(e) => setGuarantorName(e.target.value)}
                              />
                            </div>

                            <div className="fi-field">
                              <label className="fi-label">Gender</label>
                              <select
                                className="select-control input-control"
                                value={guarantorGender}
                                onChange={(e) => setGuarantorGender(e.target.value as any)}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div className="fi-grid-2">
                            <div className="fi-field">
                              <label className="fi-label">Date of Birth</label>
                              <input
                                type="date"
                                className="input-control"
                                value={guarantorDob}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setGuarantorDob(e.target.value)}
                              />
                              {guarantorDob && (
                                <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                                  Calculated Age: {calculateAgeFromDob(guarantorDob)} Years
                                </span>
                              )}
                            </div>

                            <div className="fi-field">
                              <OtherSelectField
                                label="Relationship with Customer *"
                                value={guarantorRelation}
                                customValue={guarantorCustomRelation}
                                options={GUARANTOR_RELATION_OPTIONS}
                                customPlaceholder="Specify relation (e.g. Colleague, Neighbor)"
                                customLabel="Specify Relation *"
                                onChange={(val, custom) => { setGuarantorRelation(val); setGuarantorCustomRelation(custom); }}
                              />
                            </div>
                          </div>

                          <div className="fi-grid-2">
                            <div className="fi-field">
                              <label className="fi-label">Occupation (Optional)</label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="e.g. Salaried, Business, Agriculture"
                                value={guarantorOccupation}
                                onChange={(e) => setGuarantorOccupation(e.target.value)}
                              />
                            </div>

                            <div className="fi-field">
                              <label className="fi-label">Monthly Income (₹) (Optional)</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="input-control"
                                placeholder="e.g. 35000"
                                value={guarantorMonthlyIncome}
                                onChange={(e) => setGuarantorMonthlyIncome(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: CONTACT INFORMATION */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <span>📱 2. CONTACT INFORMATION</span>
                      </div>

                      <div className="fi-grid-3">
                        <div className="fi-field">
                          <label className="fi-label">Mobile Number <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className="input-control readonly" style={{ width: '50px', textAlign: 'center', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                              +91
                            </span>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="10-digit mobile number"
                              maxLength={10}
                              value={guarantorPhone}
                              onChange={(e) => setGuarantorPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            />
                          </div>
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">Alternate Mobile (Optional)</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className="input-control readonly" style={{ width: '50px', textAlign: 'center', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                              +91
                            </span>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="10-digit alternate mobile"
                              maxLength={10}
                              value={guarantorAltPhone}
                              onChange={(e) => setGuarantorAltPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            />
                          </div>
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">Email Address (Optional)</label>
                          <input
                            type="email"
                            className="input-control"
                            placeholder="guarantor@email.com"
                            value={guarantorEmail}
                            onChange={(e) => setGuarantorEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: KYC INFORMATION */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <ShieldCheck size={16} /> 3. KYC IDENTIFICATION
                      </div>

                      <div className="fi-grid-2">
                        <div className="fi-field">
                          <label className="fi-label">Aadhaar Number <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="12-digit Aadhaar number"
                            maxLength={14}
                            value={formatAadhaarInput(guarantorAadhaarNo)}
                            onChange={(e) => setGuarantorAadhaarNo(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          />
                          {guarantorAadhaarNo.replace(/\D/g, '').length === 12 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                              ✓ Valid 12-digit format ({maskAadhaarNumber(guarantorAadhaarNo)})
                            </span>
                          )}
                        </div>

                        <div className="fi-field">
                          <label className="fi-label">PAN Number (Optional)</label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            style={{ textTransform: 'uppercase' }}
                            value={guarantorPanNo}
                            onChange={(e) => setGuarantorPanNo(e.target.value.toUpperCase().slice(0, 10))}
                          />
                          {guarantorPanNo && validatePANNumber(guarantorPanNo).isValid && (
                            <span style={{ fontSize: '11px', color: 'var(--color-primary-accent, #059669)', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                              ✓ Valid PAN format ({maskPANNumber(guarantorPanNo)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: ADDRESS DETAILS */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📍 4. RESIDENTIAL ADDRESS
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-dark)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guarantorSameAsCurrentAddress}
                            onChange={(e) => handleGuarantorSameAsCurrentAddressToggle(e.target.checked)}
                          />
                          <span>Same as Current Address</span>
                        </label>
                      </div>

                      <div className="fi-field" style={{ marginBottom: '14px' }}>
                        <label className="fi-label">Current Address <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea
                          className="input-control"
                          rows={2}
                          placeholder="Complete current residential address"
                          value={guarantorAddress}
                          onChange={(e) => {
                            setGuarantorAddress(e.target.value);
                            if (guarantorSameAsCurrentAddress) {
                              setGuarantorPermanentAddress(e.target.value);
                            }
                          }}
                        />
                      </div>

                      <div className="fi-field">
                        <label className="fi-label">Permanent Address (Optional)</label>
                        <textarea
                          className="input-control"
                          rows={2}
                          placeholder="Permanent address (or same as current)"
                          value={guarantorPermanentAddress}
                          onChange={(e) => {
                            setGuarantorPermanentAddress(e.target.value);
                            if (guarantorSameAsCurrentAddress && e.target.value !== guarantorAddress) {
                              setGuarantorSameAsCurrentAddress(false);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 5: KYC DOCUMENTS */}
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> 5. GUARANTOR KYC DOCUMENTS (OPTIONAL)
                      </div>

                      <div className="fi-grid-3">
                        {/* Aadhaar Front */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>Aadhaar Front</span>
                          {guarantorDocs.aadhaarFront ? (
                            <div>
                              {guarantorDocs.aadhaarFront.startsWith('data:image') ? (
                                <img src={guarantorDocs.aadhaarFront} alt="Aadhaar Front" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setGuarantorDocs(prev => ({ ...prev, aadhaarFront: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload Front</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setGuarantorDocs(p => ({ ...p, aadhaarFront: url })))} />
                            </label>
                          )}
                        </div>

                        {/* Aadhaar Back */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>Aadhaar Back</span>
                          {guarantorDocs.aadhaarBack ? (
                            <div>
                              {guarantorDocs.aadhaarBack.startsWith('data:image') ? (
                                <img src={guarantorDocs.aadhaarBack} alt="Aadhaar Back" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setGuarantorDocs(prev => ({ ...prev, aadhaarBack: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload Back</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setGuarantorDocs(p => ({ ...p, aadhaarBack: url })))} />
                            </label>
                          )}
                        </div>

                        {/* PAN Card */}
                        <div style={{ border: '1px dashed var(--border-light, #cbd5e1)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-surface-secondary, #f8fafc)', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>PAN Card</span>
                          {guarantorDocs.panCard ? (
                            <div>
                              {guarantorDocs.panCard.startsWith('data:image') ? (
                                <img src={guarantorDocs.panCard} alt="PAN Card" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--color-primary-accent)', fontWeight: 700, padding: '20px 0' }}>📄 PDF Document Attached</div>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', height: '24px', padding: '0 6px' }}
                                onClick={() => setGuarantorDocs(prev => ({ ...prev, panCard: null }))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', cursor: 'pointer', margin: '6px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Upload size={12} />
                              <span>Upload PAN</span>
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => handleKycDocUpload(e, (url) => setGuarantorDocs(p => ({ ...p, panCard: url })))} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>
          </div>

          {/* SECTION 3 — FINANCIAL TERMS & DISBURSEMENT */}
          <FinancialTermsSection
            principal={principal}
            onPrincipalChange={setPrincipal}
            disbursementMethod={disbursementMethod}
            onDisbursementMethodChange={setDisbursementMethod}
            bankMode={bankMode}
            onBankModeChange={setBankMode}
            splitCashAmount={splitCashAmount}
            onSplitCashAmountChange={setSplitCashAmount}
            splitBankAmount={splitBankAmount}
            onSplitBankAmountChange={setSplitBankAmount}
            interestRate={interestRate}
            deductAdvanceInterest={deductAdvanceInterest}
            onDeductAdvanceInterestChange={setDeductAdvanceInterest}
            advanceDays={advanceDays}
            onAdvanceDaysChange={setAdvanceDays}
            advanceInterestAmount={advanceInterestAmount}
            advanceReceivingMethod={advanceReceivingMethod}
            onAdvanceReceivingMethodChange={setAdvanceReceivingMethod}
            cardFeeEnabled={cardFeeEnabled}
            cardFeeAmount={cardFeeAmount}
            cardFeeMode={cardFeeMode}
            onCardFeeModeChange={setCardFeeMode}
            cardFeeBankMode={cardFeeBankMode}
            onCardFeeBankModeChange={setCardFeeBankMode}
          />

          {/* SECTION 4 — GOLD ORNAMENT DETAILS */}
          <div className="fi-card">
            <div className="fi-section-header">
              <div className="fi-section-title-group">
                <span className="fi-section-icon">🢙</span>
                <div>
                  <h3 className="fi-section-title">Gold Ornament Details</h3>
                  <p className="fi-section-desc">Items pledged as collateral, weights, and purity</p>
                </div>
              </div>
              <button type="button" className="fi-btn-ghost" onClick={handleAddItem}>
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table fi-ornament-table">
                <thead>
                  <tr>
                    <th className="col-seq">#</th>
                    <th className="col-item">ITEM</th>
                    <th className="col-qty">QTY</th>
                    <th className="col-purity">PURITY</th>
                    <th className="col-gross">GROSS WT (G)</th>
                    <th className="col-deduct">DEDUCTION (G)</th>
                    <th className="col-net">NET WT (G)</th>
                    <th className="col-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isRowError = Number(item.deductionWeight || 0) > Number(item.grossWeight || 0);

                    return (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td className="col-seq" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td className="col-item">
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Ring, Chain, Earring"
                              aria-label={`Ornament #${idx + 1} Item Name`}
                              value={item.item}
                              onChange={(e) => handleItemChange(item.id, 'item', e.target.value)}
                            />
                          </td>
                          <td className="col-qty">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="input-control fi-qty-input no-spinners"
                              aria-label={`Ornament #${idx + 1} Quantity`}
                              placeholder="1"
                              value={item.qty !== undefined && item.qty !== null ? item.qty : ''}
                              onKeyDown={(e) => {
                                if (
                                  ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                                  (e.ctrlKey || e.metaKey)
                                ) {
                                  return;
                                }
                                if (!/^\d$/.test(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                if (raw === '') {
                                  handleItemChange(item.id, 'qty', '');
                                } else {
                                  const parsed = parseInt(raw, 10);
                                  handleItemChange(item.id, 'qty', isNaN(parsed) ? '' : Math.max(1, parsed));
                                }
                              }}
                              onBlur={() => {
                                if (!item.qty || Number(item.qty) < 1 || !Number.isInteger(Number(item.qty))) {
                                  handleItemChange(item.id, 'qty', 1);
                                }
                              }}
                            />
                          </td>
                          <td className="col-purity">
                            <select
                              className="input-control"
                              aria-label={`Ornament #${idx + 1} Purity`}
                              value={item.purity}
                              onChange={(e) => handleItemChange(item.id, 'purity', e.target.value)}
                            >
                              {activePurityOptions.map((p) => (
                                <option key={p.id} value={p.name}>
                                  {p.name} {p.category !== 'GOLD' ? `(${p.category})` : ''}
                                </option>
                              ))}
                              {item.purity && !activePurityOptions.some((p) => p.name.trim().toLowerCase() === (item.purity || '').trim().toLowerCase()) && (
                                <option value={item.purity}>{item.purity} (Inactive)</option>
                              )}
                            </select>
                          </td>
                          <td className="col-gross">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="input-control"
                              aria-label={`Ornament #${idx + 1} Gross Weight`}
                              value={item.grossWeight !== undefined && item.grossWeight !== null ? item.grossWeight : ''}
                              placeholder="0.000"
                              onChange={(e) => handleItemChange(item.id, 'grossWeight', e.target.value)}
                            />
                          </td>
                          <td className="col-deduct">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className={`input-control ${isRowError ? 'input-error' : ''}`}
                              style={isRowError ? { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}
                              aria-label={`Ornament #${idx + 1} Deduction Weight`}
                              value={item.deductionWeight !== undefined && item.deductionWeight !== null ? item.deductionWeight : ''}
                              placeholder="0.000"
                              title="Stone / bead / non-gold deduction weight"
                              onChange={(e) => handleItemChange(item.id, 'deductionWeight', e.target.value)}
                            />
                          </td>
                          <td className="col-net">
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="input-control"
                                readOnly
                                aria-label={`Ornament #${idx + 1} Net Weight`}
                                value={item.netWeight !== undefined && item.netWeight !== null ? `${Number(item.netWeight).toFixed(3)}` : '0.000'}
                                placeholder="0.000"
                                style={{
                                  backgroundColor: 'var(--bg-surface-secondary, #f1f5f9)',
                                  fontWeight: 700,
                                  color: 'var(--color-primary-dark, #0f172a)',
                                  cursor: 'not-allowed',
                                  paddingRight: '45px'
                                }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: 'var(--primary, #d97706)',
                                  backgroundColor: 'var(--primary-subtle, rgba(217, 119, 6, 0.12))',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  pointerEvents: 'none',
                                  userSelect: 'none'
                                }}
                              >
                                Auto
                              </span>
                            </div>
                          </td>
                          <td className="col-action">
                            <button
                              type="button"
                              className="fi-row-delete-btn"
                              onClick={() => handleRemoveItem(item.id)}
                              title="Remove item"
                              aria-label={`Remove ornament #${idx + 1}`}
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                        {weightErrors[item.id] && (
                          <tr>
                            <td
                              colSpan={8}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#dc2626',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
                              }}
                            >
                              ⚠ {weightErrors[item.id]}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {/* TOTALS Row */}
                  <tr style={{ fontWeight: 800, backgroundColor: 'var(--bg-surface-subtle)' }}>
                    <td colSpan={2} style={{ textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '14px' }}>TOTALS</td>
                    <td className="col-qty" style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{totalQty}</td>
                    <td className="col-purity" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                    <td className="col-gross" style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>{totalGrossWeight.toFixed(3)}</td>
                    <td className="col-deduct" style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>{totalDeductionWeight.toFixed(3)}</td>
                    <td className="col-net" style={{ color: 'var(--color-primary-dark)', fontWeight: 800 }}>{totalNetWeight.toFixed(3)}</td>
                    <td className="col-action"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calculations Row */}
            <div className="fi-grid-3">
              <div className="fi-field">
                <label className="fi-label">Total Weight (g)</label>
                <input type="text" className="input-control" readOnly
                  value={totalNetWeight > 0 ? `${totalNetWeight.toFixed(3)} g` : 'auto'} />
              </div>

              <div className="fi-field">
                <label className="fi-label">
                  Market Value (₹) <span className="fi-req">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-control"
                  placeholder="Enter total market value"
                  value={manualMarketValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setManualMarketValue(val);
                    }
                  }}
                />
              </div>

              <div className="fi-field">
                <label className="fi-label">LTV %</label>
                <input
                  type="text"
                  className="input-control"
                  readOnly
                  value={numericPrincipal > 0 && numericMarketValue > 0 ? `${ltv}%` : ''}
                  placeholder="0.00%"
                />
              </div>
            </div>

            {/* Additional Notes Textarea */}
            <div className="fi-field">
              <label className="fi-label">Additional Notes (Optional)</label>
              <textarea
                className="input-control fi-textarea"
                rows={2}
                placeholder="Any extra remarks about the pledged items"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </div>

            {/* Hidden native file picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Ornament Photos Uploader */}
            <div className="fi-field" style={{ marginTop: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="fi-label">ORNAMENT PHOTOS (UP TO 6)</label>
                <span className="badge badge-info" style={{ fontSize: '11px' }}>
                  {ornamentPhotos.length} / 6 Photos Uploaded
                </span>
              </div>
              <p className="fi-hint" style={{ margin: '0 0 12px 0' }}>
                Upload clear photos of the pledged gold/ornaments for verification and record keeping (JPG, PNG, WEBP - Max 5 MB each).
              </p>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Photo Thumbnails */}
                {ornamentPhotos.map((photoUrl, idx) => (
                  <div
                    key={`ornament-photo-${idx}`}
                    style={{
                      position: 'relative',
                      width: '110px',
                      height: '110px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '2px solid var(--border-light, #e2e8f0)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <img
                      src={photoUrl}
                      alt={`Ornament Photo ${idx + 1}`}
                      onClick={() => setPreviewImageIndex(idx)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 0',
                        textAlign: 'center'
                      }}
                    >
                      Photo {idx + 1}
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        color: '#ffffff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                      title="Remove Photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* Add Photo Button */}
                {ornamentPhotos.length < 6 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '110px',
                      height: '110px',
                      borderRadius: '10px',
                      border: '2px dashed var(--color-primary-accent, #059669)',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                      color: 'var(--color-primary-dark, #163f35)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Camera size={22} color="var(--color-primary-accent)" />
                    <span>+ Add Photo</span>
                  </button>
                ) : (
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '8px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                    Maximum 6 photos allowed.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* LIGHTBOX PREVIEW MODAL */}
          {previewImageIndex !== null && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setPreviewImageIndex(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'relative',
                  maxWidth: '90vw',
                  maxHeight: '85vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <button
                  type="button"
                  onClick={() => setPreviewImageIndex(null)}
                  style={{
                    position: 'absolute',
                    top: '-40px',
                    right: 0,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={28} />
                </button>

                <img
                  src={ornamentPhotos[previewImageIndex]}
                  alt={`Preview ${previewImageIndex + 1}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '75vh',
                    borderRadius: '8px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    objectFit: 'contain'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', color: '#ffffff' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={previewImageIndex === 0}
                    onClick={() => setPreviewImageIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                    style={{ opacity: previewImageIndex === 0 ? 0.5 : 1 }}
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  <span style={{ fontSize: '13px', fontWeight: 700 }}>
                    Photo {previewImageIndex + 1} of {ornamentPhotos.length}
                  </span>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={previewImageIndex === ornamentPhotos.length - 1}
                    onClick={() => setPreviewImageIndex((prev) => (prev !== null && prev < ornamentPhotos.length - 1 ? prev + 1 : prev))}
                    style={{ opacity: previewImageIndex === ornamentPhotos.length - 1 ? 0.5 : 1 }}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5 — DYNAMIC LOAN INTEREST & PRICING PREVIEW */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
              border: '1.5px solid var(--color-primary-accent, #059669)',
              borderRadius: 'var(--fi-radius, 12px)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary-dark, #163f35)', margin: 0, letterSpacing: '0.5px' }}>
                  LOAN INTEREST &amp; PRICING PREVIEW
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {loanTerms.matchingBand
                    ? `Matched Master Band: ${loanTerms.matchingBand.condition} ₹${loanTerms.matchingBand.amount.toLocaleString('en-IN')} (${loanTerms.interestRate}%/mo · Penalty after ${loanTerms.matchingBand.penaltyAfterMonths} mos · Step-up ${loanTerms.matchingBand.penaltyStepUpMonthly}%/mo)`
                    : `Master Control active rate for ${selectedLoanTypeConfig?.name || 'Gold Loan'} (${loanTerms.interestRate}%/mo)`}
                </span>
              </div>
              <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 700 }}>
                {selectedRepaymentConfig?.name || 'Monthly Interest Only'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Principal</span>
                <strong style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>₹{numericPrincipal.toLocaleString('en-IN')}</strong>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Interest Rate</span>
                <strong style={{ fontSize: '14.5px', color: 'var(--color-primary-dark, #163f35)' }}>{loanTerms.interestRate}% / mo</strong>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Monthly Interest</span>
                <strong style={{ fontSize: '14.5px', color: 'var(--color-primary-dark, #163f35)' }}>₹{loanTerms.monthlyInterest.toLocaleString('en-IN')}</strong>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Processing / Card Fee</span>
                <strong style={{ fontSize: '14.5px', color: loanTerms.effectiveCardFee > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                  {loanTerms.effectiveCardFee > 0 ? `₹${loanTerms.effectiveCardFee.toLocaleString('en-IN')}` : '₹0'}
                </strong>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Net Disbursed</span>
                <strong style={{ fontSize: '15px', color: 'var(--color-primary-accent, #059669)', fontWeight: 900 }}>₹{loanTerms.netDisbursed.toLocaleString('en-IN')}</strong>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Next Due Date</span>
                <strong style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>{loanTerms.nextDueDate}</strong>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>ℹ️</span>
              <span>Interest is calculated using the active Master Control rate for this loan type. Contractual values lock upon issue.</span>
            </div>
          </div>

          {/* Submit Action Buttons */}
          <div className="fi-actions">
            <button type="submit" className="fi-btn-primary" disabled={isSubmitting || !selectedCustomer}>
              {isSubmitting ? 'Creating Loan...' : 'Issue Loan & Generate Receipt'}
            </button>
            <button type="button" className="fi-btn-secondary" onClick={handleClearForm} disabled={isSubmitting}>
              Clear Form
            </button>
          </div>

          {/* SECTION 6 — RECENT LOANS TABLE */}
          <div className="fi-card">
            <div className="fi-section-header">
              <div className="fi-section-title-group">
                <span className="fi-section-icon">📜</span>
                <div>
                  <h3 className="fi-section-title">Recent Loans</h3>
                  <p className="fi-section-desc">Last 10 issued loans</p>
                </div>
              </div>
            </div>

            <div className="table-container">
              {loans.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-surface-subtle)', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
                    <Camera size={24} color="var(--text-muted)" />
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No loans issued yet.</p>
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>LOAN #</th>
                      <th>TYPE</th>
                      <th>CUSTOMER</th>
                      <th>PRINCIPAL</th>
                      <th>RATE</th>
                      <th>TENURE</th>
                      <th>NEXT DUE</th>
                      <th>OUTSTANDING</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.slice(0, 10).map((l, idx) => (
                      <tr key={`recent-loan-${l.id}-${idx}`}>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{l.loanNo}</td>
                        <td>{l.loanType}</td>
                        <td style={{ fontWeight: 600 }}>{l.customerName}</td>
                        <td style={{ fontWeight: 700 }}>₹{l.principal.toLocaleString('en-IN')}</td>
                        <td>{l.interestRate}%</td>
                        <td>12 mos</td>
                        <td>{l.nextDueDate || l.date}</td>
                        <td style={{ fontWeight: 700 }}>₹{l.outstandingPrincipal.toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`badge ${l.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </form>

      {/* WEBCAM CAPTURE MODAL FOR NOMINEE */}
      <WebcamCapture
        isOpen={isNomineeWebcamOpen}
        onClose={() => setIsNomineeWebcamOpen(false)}
        onCapture={(_file, dataUrl) => {
          setNomineePhoto(dataUrl);
          setIsNomineeWebcamOpen(false);
          showToast('Nominee photo captured via webcam!', 'success');
        }}
      />

      {/* WEBCAM CAPTURE MODAL FOR GUARANTOR */}
      <WebcamCapture
        isOpen={isGuarantorWebcamOpen}
        onClose={() => setIsGuarantorWebcamOpen(false)}
        onCapture={(_file, dataUrl) => {
          setGuarantorPhoto(dataUrl);
          setIsGuarantorWebcamOpen(false);
          showToast('Guarantor photo captured via webcam!', 'success');
        }}
      />
    </div>
  );
};
