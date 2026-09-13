import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  User,
  Camera,
  Upload,
  MapPin,
  CheckCircle2,
  BookmarkCheck,
  ShieldCheck,
  X,
  RefreshCw,
  FileText,
  Trash2,
  Plus,
  ExternalLink
} from 'lucide-react';

import { StructuredAddress, LocationDetails, Customer } from '../types';
import {
  validatePhone,
  validateIDProof,
  formatPhoneInput,
  parseCustomerKYC
} from '../utils/kycValidation';
import { IDProofInputFields } from '../components/common/IDProofInputFields';
import { ViewCustomerModal } from '../components/common/ViewCustomerModal';
import { emptyStructuredAddress, formatStructuredAddress } from '../utils/addressUtils';
import { AgeDobInput, calculateAgeFromDob } from '../components/common/AgeDobInput';
import { apiService } from '../services/api';
import { isMatchingCustomerId, getCanonicalCustomerId } from '../utils/customerUtils';

export interface AddCustomerProps {
  mode?: 'add' | 'edit';
  customerId?: string | null;
}

interface UploadedKycItem {
  id: string;
  file: File;
  name: string;
  size: string;
  preview: string;
  isPdf: boolean;
  docType: string;
}

/**
 * Helper to convert Base64 dataURL to a File object
 */
function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export const AddCustomer: React.FC<AddCustomerProps> = ({
  mode: propMode,
  customerId: propCustomerId
}) => {
  const {
    customers,
    setCurrentPage,
    addCustomer,
    updateCustomer,
    reloadAllData,
    showToast,
    currentPage,
    editingCustomerId,
    setEditingCustomerId
  } = useApp();

  const effectiveCustomerId = propCustomerId || editingCustomerId;
  const isEditMode =
    propMode === 'edit' ||
    currentPage === 'edit-customer' ||
    Boolean(effectiveCustomerId && propMode !== 'add');

  const [targetCustomer, setTargetCustomer] = useState<Customer | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  const [duplicateCustomerMatch, setDuplicateCustomerMatch] = useState<Customer | null>(null);
  const [viewingDuplicateCustomer, setViewingDuplicateCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Personal Info State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [age, setAge] = useState<number>(30);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [occupation, setOccupation] = useState('');
  const [email, setEmail] = useState('');

  // Customer Photo State
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null);
  const [photoSource, setPhotoSource] = useState<'upload' | 'webcam' | null>(null);

  // Webcam Capture Modal State
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Identity Proof State
  const [idProof, setIdProof] = useState('Aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [extraPan, setExtraPan] = useState('');
  const [docName, setDocName] = useState('');

  // Existing Attached KYC Documents (from storage)
  const [existingKycDocs, setExistingKycDocs] = useState<any[]>([]);

  // Attached KYC Document Files to upload
  const [kycFiles, setKycFiles] = useState<UploadedKycItem[]>([]);

  // Address State
  const [currentAddressText, setCurrentAddressText] = useState('');
  const [permanentAddressText, setPermanentAddressText] = useState('');
  const [sameAddress, setSameAddress] = useState(true);

  // Location State
  const [currentLoc, setCurrentLoc] = useState<LocationDetails | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [mapsUrlInput, setMapsUrlInput] = useState('');

  // Populate form with existing customer data
  const populateFormWithCustomer = (cust: Customer) => {
    setTargetCustomer(cust);
    setName(cust.name || cust.fullName || '');
    const cleanPhone = formatPhoneInput(cust.phone || cust.phoneNumber || '');
    setPhone(cleanPhone);
    setPhoneError('');
    setPhoneTouched(false);
    setDuplicateCustomerMatch(null);

    setGender(cust.gender || 'Male');
    setAge(cust.age ?? 30);
    setDateOfBirth(cust.dateOfBirth || '');
    setOccupation(cust.occupation || '');
    setEmail(cust.email || '');

    setCustomerPhoto(cust.customerPhoto || cust.customerPhotoData?.url || null);
    setCustomerPhotoFile(null);
    setPhotoSource(cust.photoSource || (cust.customerPhoto ? 'upload' : null));

    const parsedKYC = parseCustomerKYC(cust);
    setIdProof(parsedKYC.idProof || 'Aadhaar');
    setIdNumber(parsedKYC.idNumber || '');
    setExtraPan(parsedKYC.extraPan || '');
    setDocName(parsedKYC.docName || '');

    const currAddr =
      cust.currentAddress ||
      (cust.currentAddressDetails ? formatStructuredAddress(cust.currentAddressDetails) : '') ||
      '';
    const permAddr =
      cust.permanentAddress ||
      (cust.permanentAddressDetails ? formatStructuredAddress(cust.permanentAddressDetails) : '') ||
      '';
    setCurrentAddressText(currAddr);
    setPermanentAddressText(permAddr || currAddr);
    setSameAddress(!permAddr || currAddr === permAddr);

    const loc = (cust.currentLocation as LocationDetails) || null;
    setCurrentLoc(loc);
    if (loc?.googleMapsUrl) {
      setMapsUrlInput(loc.googleMapsUrl);
      setLocationStatus('✓ Location saved on file');
    }

    if (cust.kycDocuments && Array.isArray(cust.kycDocuments)) {
      setExistingKycDocs(cust.kycDocuments);
    }
  };

  // Load customer or draft on mount/change
  useEffect(() => {
    if (isEditMode && effectiveCustomerId) {
      setIsLoadingCustomer(true);
      const found = customers.find(
        (c) =>
          c.id === effectiveCustomerId ||
          c.customerId?.toString() === effectiveCustomerId ||
          isMatchingCustomerId(effectiveCustomerId, c)
      );
      if (found) {
        populateFormWithCustomer(found);
      }

      // Also fetch from API to ensure the most complete and fresh record
      apiService
        .getCustomerById(effectiveCustomerId)
        .then((res) => {
          if (res && res.success && res.data) {
            populateFormWithCustomer(res.data);
          }
        })
        .catch((err) => {
          console.warn('[AddCustomer] Could not fetch fresh customer by ID:', err);
        })
        .finally(() => {
          setIsLoadingCustomer(false);
        });
    } else {
      // In Add mode, load draft from localStorage if available
      try {
        const savedDraft = localStorage.getItem('kkv_kyc_draft');
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft.name) setName(draft.name);
          if (draft.phone) setPhone(draft.phone);
          if (draft.gender) setGender(draft.gender);
          if (draft.age) setAge(draft.age);
          if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
          if (draft.occupation) setOccupation(draft.occupation);
          if (draft.email) setEmail(draft.email);
          if (draft.customerPhoto) setCustomerPhoto(draft.customerPhoto);
          if (draft.photoSource) setPhotoSource(draft.photoSource);
          if (draft.idProof) setIdProof(draft.idProof);
          if (draft.idNumber) setIdNumber(draft.idNumber);
          if (draft.currentAddressText) setCurrentAddressText(draft.currentAddressText);
          if (draft.permanentAddressText) setPermanentAddressText(draft.permanentAddressText);
          if (draft.sameAddress !== undefined) setSameAddress(draft.sameAddress);
        }
      } catch {
        // ignore draft parse error
      }
    }
  }, [isEditMode, effectiveCustomerId]);

  // Handlers
  const handlePhoneChange = (val: string) => {
    const formatted = formatPhoneInput(val);
    setPhone(formatted);
    setPhoneTouched(true);
    const res = validatePhone(formatted);

    const norm = formatted.replace(/\D/g, '').slice(-10);
    if (norm.length === 10) {
      const match = customers.find(
        (c) =>
          !c.isDeleted &&
          (!isEditMode ||
            (c.id !== (targetCustomer?.id || effectiveCustomerId) &&
              !isMatchingCustomerId(targetCustomer?.id || effectiveCustomerId || '', c))) &&
          (c.phoneNormalized === norm || (c.phone && c.phone.replace(/\D/g, '').slice(-10) === norm))
      );
      if (match) {
        setDuplicateCustomerMatch(match);
        setPhoneError('This mobile number is already registered to another customer.');
        return;
      }
    }

    setDuplicateCustomerMatch(null);
    setPhoneError(res.isValid ? '' : (res.error || ''));
  };

  const handleIdProofChange = (payload: {
    idProof: string;
    idNumber: string;
    extraPan?: string;
    docName?: string;
    isValid: boolean;
    error?: string;
  }) => {
    setIdProof(payload.idProof);
    setIdNumber(payload.idNumber);
    setExtraPan(payload.extraPan || '');
    setDocName(payload.docName || '');
  };

  const handleAgeDobChange = (val: { mode: 'dob' | 'age'; dateOfBirth: string; age: number }) => {
    setDateOfBirth(val.dateOfBirth);
    setAge(val.age);
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please upload a valid JPG, JPEG, PNG, or WEBP image file.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10 MB.', 'error');
      return;
    }

    setCustomerPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setCustomerPhoto(reader.result as string);
      setPhotoSource('upload');
      showToast('Customer photo attached successfully', 'success');
    };
    reader.readAsDataURL(file);
  };

  // KYC Document Files Upload Handler
  const handleKycDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files || []);
    if (incomingFiles.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const newItems: UploadedKycItem[] = [];

    for (const file of incomingFiles) {
      if (!allowedTypes.includes(file.type)) {
        showToast(`Skipped "${file.name}": Unsupported format. (JPG, PNG, WEBP, PDF allowed)`, 'warning');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(`Skipped "${file.name}": Exceeds 10MB limit.`, 'warning');
        continue;
      }

      const isPdf = file.type === 'application/pdf';
      const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      const preview = isPdf ? '' : URL.createObjectURL(file);

      newItems.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: sizeStr,
        preview,
        isPdf,
        docType: idProof || 'Aadhaar'
      });
    }

    if (newItems.length > 0) {
      setKycFiles((prev) => [...prev, ...newItems]);
      showToast(`${newItems.length} KYC document(s) attached successfully`, 'success');
    }
    // reset input value so same file can be re-uploaded if desired
    e.target.value = '';
  };

  const removeKycDoc = (id: string) => {
    setKycFiles((prev) => prev.filter((d) => d.id !== id));
  };

  // Webcam Capture Controls
  const startWebcam = async () => {
    try {
      setTempPhoto(null);
      setIsWebcamOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      showToast('Unable to access webcam. Please check browser permissions.', 'error');
      setIsWebcamOpen(false);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    setIsWebcamOpen(false);
    setTempPhoto(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setTempPhoto(dataUrl);
    }
  };

  const confirmWebcamPhoto = () => {
    if (tempPhoto) {
      setCustomerPhoto(tempPhoto);
      setPhotoSource('webcam');
      try {
        const file = dataURLtoFile(tempPhoto, `customer-webcam-${Date.now()}.jpg`);
        setCustomerPhotoFile(file);
      } catch {
        // ignore conversion error
      }
      stopWebcam();
      showToast('Webcam photo captured successfully', 'success');
    }
  };

  // GPS Location Capture
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setLocationStatus('Capturing GPS location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        setCurrentLoc({
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          capturedAt: new Date().toISOString(),
          googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
          locationMethod: 'gps'
        });

        setLocationStatus(`✓ Location Captured: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)} (±${accuracy}m)`);
        showToast('GPS location captured successfully', 'success');
      },
      (err) => {
        setLocationStatus(null);
        showToast(`Location capture failed: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Google Maps URL Parsing
  const handleUseMapsLink = () => {
    if (!mapsUrlInput.trim()) {
      showToast('Please enter or paste a valid Google Maps URL.', 'error');
      return;
    }

    const trimmed = mapsUrlInput.trim();
    setCurrentLoc({
      latitude: null,
      longitude: null,
      accuracy: null,
      googleMapsUrl: trimmed,
      locationMethod: 'google_maps_url',
      capturedAt: new Date().toISOString()
    });

    setLocationStatus('✓ Google Maps URL saved successfully');
    showToast('Google Maps location link validated', 'success');
  };

  // Save Draft (Add Mode)
  const handleSaveDraft = () => {
    const draft = {
      name,
      phone,
      gender,
      age,
      dateOfBirth,
      occupation,
      email,
      customerPhoto,
      photoSource,
      idProof,
      idNumber,
      currentAddressText,
      permanentAddressText,
      sameAddress,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('kkv_kyc_draft', JSON.stringify(draft));
    showToast('KYC Profile Draft Saved Successfully', 'info');
  };

  const handleBackToCustomers = () => {
    if (setEditingCustomerId) {
      setEditingCustomerId(null);
    }
    setCurrentPage('customers');
  };

  // Form Submit to Backend (Shared Add/Edit logic)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setPhoneTouched(true);
    const phoneRes = validatePhone(phone);
    const idRes = validateIDProof(idProof, idNumber, extraPan, docName);

    setPhoneError(phoneRes.isValid ? '' : (phoneRes.error || ''));

    if (!name.trim()) {
      showToast('Customer Full Name is required.', 'error');
      return;
    }

    if (!phoneRes.isValid) {
      showToast(phoneRes.error || 'Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (!idRes.isValid) {
      showToast(idRes.error || 'Please enter a valid ID proof number.', 'error');
      return;
    }

    if (!currentAddressText.trim()) {
      showToast('Current Address is required.', 'error');
      return;
    }

    const calculatedAgeFromDobVal = dateOfBirth ? calculateAgeFromDob(dateOfBirth) : null;
    const finalAge = calculatedAgeFromDobVal !== null ? calculatedAgeFromDobVal : Number(age) || 30;
    const finalPermAddress = sameAddress || !permanentAddressText.trim() ? currentAddressText : permanentAddressText;

    const currentStructured: StructuredAddress = {
      ...emptyStructuredAddress,
      street: currentAddressText.trim()
    };
    const permanentStructured: StructuredAddress = {
      ...emptyStructuredAddress,
      street: finalPermAddress.trim()
    };

    setIsSubmitting(true);

    try {
      // 1. Build multipart/form-data payload
      const formData = new FormData();
      formData.append('fullName', name.trim());
      formData.append('name', name.trim());
      formData.append('phoneNumber', phoneRes.normalizedValue || phone.trim());
      formData.append('phone', phoneRes.normalizedValue || phone.trim());
      formData.append('gender', gender);
      formData.append('age', String(finalAge));
      if (dateOfBirth) formData.append('dateOfBirth', dateOfBirth);
      formData.append('occupation', occupation.trim() || 'Self Employed');
      if (email.trim()) formData.append('email', email.trim());

      formData.append('address', currentAddressText.trim());
      formData.append('currentAddress', currentAddressText.trim());
      formData.append('permanentAddress', finalPermAddress.trim());
      formData.append('currentAddressDetails', JSON.stringify(currentStructured));
      formData.append('permanentAddressDetails', JSON.stringify(permanentStructured));

      if (currentLoc) formData.append('currentLocation', JSON.stringify(currentLoc));
      if (currentLoc && sameAddress) formData.append('permanentLocation', JSON.stringify(currentLoc));

      formData.append('idProofType', idProof);
      formData.append('idProof', idProof);
      formData.append('idProofNumber', idRes.formattedValue || idNumber.trim());
      formData.append('idNumber', idRes.formattedValue || idNumber.trim());
      if (extraPan) formData.append('extraPan', extraPan.trim());
      if (docName) formData.append('docName', docName.trim());

      // 2. Append Customer Photo
      if (customerPhotoFile) {
        formData.append('customerPhoto', customerPhotoFile);
      } else if (customerPhoto && customerPhoto.startsWith('data:image')) {
        const photoBlob = dataURLtoFile(customerPhoto, 'customer-photo.jpg');
        formData.append('customerPhoto', photoBlob);
      } else if (isEditMode && customerPhoto) {
        formData.append('customerPhotoUrl', customerPhoto);
      } else if (isEditMode && !customerPhoto) {
        formData.append('removePhoto', 'true');
      }

      // 3. Append attached KYC Documents
      kycFiles.forEach((item) => {
        formData.append('kycDocuments', item.file);
      });

      // 4. Dispatch Update or Create Request
      if (isEditMode) {
        const targetId = targetCustomer?.id || effectiveCustomerId || '';
        const response = await apiService.updateCustomerFormData(targetId, formData);

        if (response && (response.success || response.data)) {
          showToast('Customer KYC Profile Updated Successfully!', 'success');

          // Sync local AppContext state
          try {
            if (reloadAllData) {
              await reloadAllData();
            } else if (updateCustomer && response.data) {
              updateCustomer(targetId, response.data);
            }
          } catch {
            // ignore reload error
          }

          if (setEditingCustomerId) {
            setEditingCustomerId(null);
          }
          setCurrentPage('customers');
        } else {
          showToast(response?.message || 'Failed to update customer.', 'error');
        }
      } else {
        const response = await apiService.createCustomerFormData(formData);

        if (response && response.success) {
          showToast('Customer KYC Profile Created & Uploaded to Google Drive Successfully!', 'success');
          localStorage.removeItem('kkv_kyc_draft');

          // Sync local AppContext state
          try {
            if (reloadAllData) {
              await reloadAllData();
            } else if (response.data) {
              addCustomer(response.data);
            }
          } catch {
            // ignore reload error
          }

          setCurrentPage('customers');
        } else {
          showToast(response?.message || 'Failed to create customer.', 'error');
        }
      }
    } catch (err: any) {
      console.error(`[${isEditMode ? 'EditCustomer' : 'AddCustomer'}] Submission error:`, err);
      showToast(
        err.message ||
          `${isEditMode ? 'Customer update' : 'Customer creation'} failed. Please check network connection.`,
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingBottom: '80px', maxWidth: '960px', margin: '0 auto' }}>
      {/* PAGE HEADER NAVIGATION */}
      <div style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleBackToCustomers}
          disabled={isSubmitting}
          style={{ gap: '6px', fontSize: '13px', padding: '6px 14px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </button>
      </div>

      {/* MAIN COMPACT FORM CARD */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '24px 28px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* CARD TITLE & SUBTITLE HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: isEditMode ? 'rgba(201, 162, 39, 0.15)' : 'rgba(5, 150, 105, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isEditMode ? 'var(--color-primary-accent, #c9a227)' : 'var(--color-primary-dark, #059669)',
              flexShrink: 0
            }}
          >
            <User size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-dark, #0f172a)' }}>
              {isEditMode ? '👤 Edit Borrower KYC Details' : '👤 Customer / KYC Details'}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
              {isEditMode
                ? isLoadingCustomer
                  ? 'Loading existing customer details...'
                  : `Updating profile for Customer ID: ${targetCustomer ? getCanonicalCustomerId(targetCustomer) : effectiveCustomerId || ''}`
                : 'Personal information, identity proof, and addresses (Telegram Storage & Google Drive)'}
            </p>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle, #e2e8f0)', margin: '0 0 24px 0' }} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* SECTION 1: CUSTOMER PHOTO + PERSONAL DETAILS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '28px', alignItems: 'start' }}>
            {/* LEFT SIDE: CUSTOMER PHOTO */}
            <div>
              <label
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  display: 'block',
                  marginBottom: '8px'
                }}
              >
                CUSTOMER PHOTO
              </label>

              <div
                style={{
                  width: '150px',
                  height: '160px',
                  borderRadius: '10px',
                  border: '2px dashed var(--border-light, #cbd5e1)',
                  backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '10px'
                }}
              >
                {customerPhoto ? (
                  <img
                    src={customerPhoto}
                    alt="Customer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Camera size={32} style={{ opacity: 0.5, marginBottom: '6px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>No photo</span>
                  </div>
                )}
              </div>

              {/* WEBCAM & UPLOAD BUTTONS */}
              <div style={{ display: 'flex', gap: '6px', width: '150px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isSubmitting}
                  style={{ flex: 1, fontSize: '11.5px', padding: '6px 4px', justifyContent: 'center', gap: '4px' }}
                  onClick={startWebcam}
                >
                  <Camera size={13} />
                  <span>Webcam</span>
                </button>

                <label
                  className={`btn btn-secondary btn-sm ${isSubmitting ? 'disabled' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '11.5px',
                    padding: '6px 4px',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    margin: 0
                  }}
                >
                  <Upload size={13} />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    disabled={isSubmitting}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {customerPhoto && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  style={{
                    marginTop: '6px',
                    width: '150px',
                    fontSize: '11px',
                    color: 'var(--color-danger, #ef4444)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: 600
                  }}
                  onClick={() => {
                    setCustomerPhoto(null);
                    setCustomerPhotoFile(null);
                    setPhotoSource(null);
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* RIGHT SIDE: PERSONAL DETAILS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ROW 1: FULL NAME * | PHONE * */}
              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label required" style={{ fontSize: '12px', fontWeight: 800 }}>
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    required
                    disabled={isSubmitting}
                    placeholder="Enter customer full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label required" style={{ fontSize: '12px', fontWeight: 800 }}>
                    PHONE
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '0 10px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-surface-secondary, #f1f5f9)',
                        border: '1px solid var(--border-light, #cbd5e1)',
                        borderRadius: 'var(--radius-md, 6px)',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      +91
                    </span>
                    <input
                      type="text"
                      className="input-control"
                      style={{
                        flex: 1,
                        borderColor: phoneTouched && phoneError ? 'var(--color-danger, #ef4444)' : undefined
                      }}
                      required
                      disabled={isSubmitting}
                      maxLength={10}
                      placeholder="Enter 10-digit mobile number"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => {
                        setPhoneTouched(true);
                        const res = validatePhone(phone);
                        setPhoneError(res.isValid ? '' : (res.error || ''));
                      }}
                    />
                  </div>
                  {phoneTouched && phoneError && (
                    <small
                      style={{
                        color: 'var(--color-danger, #ef4444)',
                        fontSize: '11px',
                        marginTop: '3px',
                        display: 'block',
                        fontWeight: 600
                      }}
                    >
                      {phoneError}
                    </small>
                  )}

                  {duplicateCustomerMatch && (
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--badge-danger-bg)',
                        border: '1px solid var(--badge-danger-border)',
                        borderRadius: '8px',
                        marginTop: '6px',
                        color: 'var(--color-danger)',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span>
                        ⚠ Mobile registered to <strong>{duplicateCustomerMatch.name}</strong> (
                        {duplicateCustomerMatch.id})
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px', height: '26px', flexShrink: 0 }}
                        onClick={() => setViewingDuplicateCustomer(duplicateCustomerMatch)}
                      >
                        View Existing Customer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 2: GENDER * | AGE / DATE OF BIRTH */}
              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label required" style={{ fontSize: '12px', fontWeight: 800 }}>
                    GENDER
                  </label>
                  <select
                    className="select-control"
                    value={gender}
                    disabled={isSubmitting}
                    onChange={(e) => setGender(e.target.value as any)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <AgeDobInput
                  dateOfBirth={dateOfBirth}
                  age={age}
                  initialMode="age"
                  onChange={handleAgeDobChange}
                />
              </div>

              {/* ROW 3: OCCUPATION / WORK | EMAIL */}
              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>
                    OCCUPATION / WORK
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    disabled={isSubmitting}
                    placeholder="e.g. Farmer, Trader"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>
                    EMAIL
                  </label>
                  <input
                    type="email"
                    className="input-control"
                    disabled={isSubmitting}
                    placeholder="customer@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle, #e2e8f0)', margin: '4px 0' }} />

          {/* SECTION 2: IDENTITY PROOF & DOCUMENT UPLOADS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-primary-dark)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px'
              }}
            >
              IDENTITY PROOF &amp; KYC DOCUMENTS
            </span>

            <IDProofInputFields
              idProof={idProof}
              idNumber={idNumber}
              extraPan={extraPan}
              docName={docName}
              disabled={isSubmitting}
              onChange={handleIdProofChange}
            />

            {/* KYC DOCUMENT ATTACHMENT BOX */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dark, #0f172a)' }}>
                    📎 Upload KYC Documents (Google Drive)
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                    Attach copies of Aadhaar, PAN, Voter ID, Driving License, Passport, or Other (JPG, PNG, WEBP, PDF - max 10MB)
                  </p>
                </div>

                <label
                  className="btn btn-secondary btn-sm"
                  style={{
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    margin: 0
                  }}
                >
                  <Plus size={14} />
                  <span>Attach Document</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    disabled={isSubmitting}
                    style={{ display: 'none' }}
                    onChange={handleKycDocUpload}
                  />
                </label>
              </div>

              {/* LIST OF EXISTING SAVED KYC DOCUMENTS (Edit Mode) */}
              {isEditMode && existingKycDocs.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Existing Saved KYC Documents on file ({existingKycDocs.length})
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                    {existingKycDocs.map((doc, idx) => (
                      <div
                        key={`exist-kyc-${doc.fileId || idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-light, #cbd5e1)',
                          borderRadius: '6px',
                          position: 'relative'
                        }}
                      >
                        {doc.resourceType === 'raw' || doc.mimeType === 'application/pdf' ? (
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: 'var(--color-danger, #ef4444)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <FileText size={20} />
                          </div>
                        ) : (
                          <img
                            src={doc.url}
                            alt={doc.documentName || 'KYC Doc'}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              flexShrink: 0,
                              border: '1px solid var(--border-light, #e2e8f0)'
                            }}
                          />
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--text-dark)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {doc.documentName || doc.fileName || `${doc.documentType || 'KYC'} Document`}
                          </p>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {doc.documentType || 'Verified'} &bull; On File
                          </span>
                        </div>

                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--color-primary-accent, #059669)',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Open Document"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LIST OF NEWLY ATTACHED KYC FILES */}
              {kycFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginTop: '6px' }}>
                  {kycFiles.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-light, #cbd5e1)',
                        borderRadius: '6px',
                        position: 'relative'
                      }}
                    >
                      {item.isPdf ? (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--color-danger, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <FileText size={20} />
                        </div>
                      ) : (
                        <img
                          src={item.preview}
                          alt="KYC Preview"
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: '1px solid var(--border-light, #e2e8f0)'
                          }}
                        />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-dark)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {item.name}
                        </p>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {item.size} • {item.docType} (New)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeKycDoc(item.id)}
                        disabled={isSubmitting}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          borderRadius: '4px'
                        }}
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle, #e2e8f0)', margin: '4px 0' }} />

          {/* SECTION 3: ADDRESS DETAILS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--color-primary-dark)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}
              >
                ADDRESS DETAILS
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-primary-dark)'
                }}
              >
                <input
                  type="checkbox"
                  checked={sameAddress}
                  disabled={isSubmitting}
                  onChange={(e) => setSameAddress(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary-accent)', width: '15px', height: '15px' }}
                />
                <span>Same as Current Address</span>
              </label>
            </div>

            <div className="grid-2" style={{ gap: '18px' }}>
              {/* CURRENT ADDRESS */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label required" style={{ fontSize: '12px', fontWeight: 800 }}>
                  CURRENT ADDRESS
                </label>
                <textarea
                  className="input-control"
                  rows={3}
                  disabled={isSubmitting}
                  style={{ height: '88px', resize: 'vertical', fontSize: '13px' }}
                  placeholder="Enter current residential address"
                  value={currentAddressText}
                  onChange={(e) => {
                    setCurrentAddressText(e.target.value);
                    if (sameAddress) {
                      setPermanentAddressText(e.target.value);
                    }
                  }}
                />
              </div>

              {/* PERMANENT ADDRESS */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 800 }}>
                  PERMANENT ADDRESS
                </label>
                <textarea
                  className="input-control"
                  rows={3}
                  disabled={sameAddress || isSubmitting}
                  style={{
                    height: '88px',
                    resize: 'vertical',
                    fontSize: '13px',
                    backgroundColor: sameAddress ? 'var(--bg-surface-secondary, #f8fafc)' : '#fff'
                  }}
                  placeholder="Leave blank if same as current address"
                  value={sameAddress ? currentAddressText : permanentAddressText}
                  onChange={(e) => setPermanentAddressText(e.target.value)}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle, #e2e8f0)', margin: '4px 0' }} />

          {/* SECTION 4: CUSTOMER LOCATION */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: 'var(--radius-md, 10px)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <label
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-primary-dark)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                margin: 0
              }}
            >
              CUSTOMER LOCATION (FOR VISITS &amp; COLLECTION)
            </label>

            {/* GPS BUTTON */}
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={handleCaptureGps}
              style={{
                width: '100%',
                height: '42px',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13.5px',
                fontWeight: 700
              }}
            >
              <MapPin size={17} />
              <span>📍 Capture Current Location (GPS)</span>
            </button>

            {locationStatus && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#059669',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={15} />
                <span>{locationStatus}</span>
              </div>
            )}

            {/* CENTERED OR DIVIDER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
              <div style={{ flex: 1, borderTop: '1px solid var(--border-light, #cbd5e1)' }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}
              >
                OR
              </span>
              <div style={{ flex: 1, borderTop: '1px solid var(--border-light, #cbd5e1)' }} />
            </div>

            {/* GOOGLE MAPS URL INPUT + USE LINK BUTTON */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="input-control"
                disabled={isSubmitting}
                style={{ flex: 1, height: '40px', fontSize: '13px' }}
                placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
                value={mapsUrlInput}
                onChange={(e) => setMapsUrlInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={handleUseMapsLink}
                style={{
                  height: '40px',
                  padding: '0 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  gap: '6px'
                }}
              >
                <span>🔗 Use link</span>
              </button>
            </div>

            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Capture the customer's location while visiting their premises, or paste a Google Maps share link. Location
              access requires browser/device permission.
            </span>
          </div>

          {/* BOTTOM ACTION BUTTONS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              gap: '14px'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={handleBackToCustomers}
              style={{ height: '42px', padding: '0 20px', fontWeight: 600 }}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              {!isEditMode && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={handleSaveDraft}
                  style={{ gap: '8px', height: '42px', padding: '0 20px', fontWeight: 600 }}
                >
                  <BookmarkCheck size={16} />
                  <span>Save Draft</span>
                </button>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  height: '42px',
                  gap: '8px',
                  padding: '0 24px',
                  fontWeight: 700,
                  fontSize: '14px',
                  minWidth: '220px',
                  justifyContent: 'center'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>{isEditMode ? 'Updating in Storage...' : 'Saving to Storage...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>{isEditMode ? '✓ Save Changes' : '✓ Create & Verify Customer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* WEBCAM CAPTURE MODAL */}
      {isWebcamOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
              maxWidth: '520px',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-dark)' }}>
                📷 Capture Customer Photo
              </h3>
              <button
                type="button"
                onClick={stopWebcam}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                width: '100%',
                height: '320px',
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {tempPhoto ? (
                <img src={tempPhoto} alt="Captured preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={stopWebcam}>
                Cancel
              </button>

              {tempPhoto ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setTempPhoto(null)}
                    style={{ gap: '6px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmWebcamPhoto}
                    style={{ gap: '6px' }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm Photo</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={capturePhoto}
                  style={{ gap: '6px' }}
                >
                  <Camera size={16} />
                  <span>Capture Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW DUPLICATE CUSTOMER MODAL */}
      <ViewCustomerModal
        isOpen={!!viewingDuplicateCustomer}
        customer={viewingDuplicateCustomer}
        onClose={() => setViewingDuplicateCustomer(null)}
      />
    </div>
  );
};
