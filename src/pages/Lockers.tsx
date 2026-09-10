import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, HardDrive, Key, UserCheck, Trash2, IndianRupee } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard, StatGrid } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface LockerData {
    id: string; // e.g. A-1, B-5
    cabinet: 'A' | 'B';
    number: number;
    status: 'Available' | 'Occupied';
    customerName?: string;
    customerPhone?: string;
    issueDate?: string;
    annualRent?: number;
    notes?: string;
}

export const Lockers: React.FC = () => {
    const { customers, addDayBookEntry, showToast } = useApp();
    const [activeCabinet, setActiveCabinet] = useState<'A' | 'B'>('A');
    const [selectedLocker, setSelectedLocker] = useState<LockerData | null>(null);

    // Initialize 61 lockers: Cabinet A (30) and Cabinet B (31)
    const [lockers, setLockers] = useState<LockerData[]>(() => {
        const stored = localStorage.getItem('kkv_lockers_data');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }

        const initial: LockerData[] = [];
        // Cabinet A: 30 lockers
        for (let i = 1; i <= 30; i++) {
            initial.push({
                id: `A-${i}`,
                cabinet: 'A',
                number: i,
                status: 'Available',
            });
        }
        // Cabinet B: 31 lockers
        for (let i = 1; i <= 31; i++) {
            initial.push({
                id: `B-${i}`,
                cabinet: 'B',
                number: i,
                status: 'Available',
            });
        }
        return initial;
    });

    useEffect(() => {
        localStorage.setItem('kkv_lockers_data', JSON.stringify(lockers));
    }, [lockers]);

    // Allocation Form State
    const [custName, setCustName] = useState('');
    const [custPhone, setCustPhone] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [rent, setRent] = useState(1200);
    const [noteText, setNoteText] = useState('');

    // Rent payment state
    const [payAmount, setPayAmount] = useState(1200);
    const [payMode, setPayMode] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');

    const handleLockerClick = (locker: LockerData) => {
        setSelectedLocker(locker);
        if (locker.status === 'Occupied') {
            setCustName(locker.customerName || '');
            setCustPhone(locker.customerPhone || '');
            setIssueDate(locker.issueDate || '');
            setRent(locker.annualRent || 1200);
            setNoteText(locker.notes || '');
        } else {
            setCustName('');
            setCustPhone('');
            setIssueDate(new Date().toISOString().split('T')[0]);
            setRent(1200);
            setNoteText('');
        }
    };

    const handleIssueLocker = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocker) return;

        if (!custName.trim()) {
            showToast('Please specify a holder name', 'error');
            return;
        }

        const updated = lockers.map(l => {
            if (l.id === selectedLocker.id) {
                return {
                    ...l,
                    status: 'Occupied' as const,
                    customerName: custName.trim(),
                    customerPhone: custPhone.trim(),
                    issueDate,
                    annualRent: rent,
                    notes: noteText.trim()
                };
            }
            return l;
        });

        setLockers(updated);
        setSelectedLocker(null);
        showToast(`Locker ${selectedLocker.id} successfully allocated to ${custName}`, 'success');
    };

    const handleVacateLocker = () => {
        if (!selectedLocker) return;

        const confirmVacate = window.confirm(`Are you sure you want to vacate Locker ${selectedLocker.id}?`);
        if (!confirmVacate) return;

        const updated = lockers.map(l => {
            if (l.id === selectedLocker.id) {
                return {
                    ...l,
                    status: 'Available' as const,
                    customerName: undefined,
                    customerPhone: undefined,
                    issueDate: undefined,
                    annualRent: undefined,
                    notes: undefined
                };
            }
            return l;
        });

        setLockers(updated);
        setSelectedLocker(null);
        showToast(`Locker ${selectedLocker.id} vacated successfully.`, 'info');
    };

    const handlePayRent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocker) return;

        // Record to Daybook
        addDayBookEntry({
            particulars: `Locker Rent Collection (${selectedLocker.id}) - ${selectedLocker.customerName}`,
            accountHead: 'Locker Rental Revenue',
            mode: payMode,
            cashIn: payMode === 'Cash' ? payAmount : 0,
            cashOut: 0,
            bankIn: payMode !== 'Cash' ? payAmount : 0,
            bankOut: 0,
            date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            customerName: selectedLocker.customerName || '',
            loanNo: `LOCKER-${selectedLocker.id}`,
            billNo: `LR-${Date.now().toString().slice(-4)}`
        });

        showToast(`Recorded rent payment of ₹${payAmount.toLocaleString('en-IN')} for Locker ${selectedLocker.id}`, 'success');
        setSelectedLocker(null);
    };

    const cabinetLockers = lockers.filter(l => l.cabinet === activeCabinet);
    const occupiedCount = lockers.filter(l => l.status === 'Occupied').length;
    const availableCount = lockers.length - occupiedCount;
    const occupancyRate = Math.round((occupiedCount / lockers.length) * 100);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Safe Vault & Lockers"
                description="Manage secure vault storage lockers, allocation records, and annual lease rent collections."
                breadcrumbs={[{ label: 'Home' }, { label: 'Lockers & Vault' }]}
            />

            {/* KPI Overview */}
            <StatGrid columns={3}>
                <StatCard
                    title="Total Locker Capacity"
                    value="61 Lockers"
                    subtitle="Cabinet A (30) + Cabinet B (31)"
                    icon={<HardDrive className="w-5 h-5 text-indigo-500" />}
                    variant="indigo"
                />
                <StatCard
                    title="Allocated / Occupied"
                    value={`${occupiedCount} Lockers`}
                    subtitle={`${occupancyRate}% vault occupancy`}
                    icon={<Key className="w-5 h-5 text-amber-500" />}
                    variant="amber"
                />
                <StatCard
                    title="Available / Vacant"
                    value={`${availableCount} Lockers`}
                    subtitle="Ready for immediate lease"
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
                    variant="emerald"
                />
            </StatGrid>

            {/* Main Panel Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Locker Grid View */}
                <div className="lg:col-span-8">
                    <Card
                        title="Vault Locker Grid"
                        subtitle={`Cabinet ${activeCabinet} • Click any locker slot to view details or allocate`}
                        headerRight={
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setActiveCabinet('A')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                        activeCabinet === 'A'
                                            ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    Cabinet A (30)
                                </button>
                                <button
                                    onClick={() => setActiveCabinet('B')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                        activeCabinet === 'B'
                                            ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    Cabinet B (31)
                                </button>
                            </div>
                        }
                    >
                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700"></span>
                                Available
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 dark:bg-amber-950/50 dark:border-amber-700"></span>
                                Occupied
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded ring-2 ring-primary-500"></span>
                                Selected
                            </span>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 py-2">
                            {cabinetLockers.map(l => {
                                const isSelected = selectedLocker?.id === l.id;
                                const isOccupied = l.status === 'Occupied';
                                return (
                                    <button
                                        key={l.id}
                                        onClick={() => handleLockerClick(l)}
                                        className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 ${
                                            isSelected
                                                ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50 dark:bg-primary-950/40 shadow-md scale-105 z-10'
                                                : isOccupied
                                                ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 hover:border-amber-300'
                                                : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/40'
                                        }`}
                                    >
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                            #{l.number}
                                        </span>
                                        <span className="text-sm font-bold tracking-tight mt-0.5">
                                            {l.id}
                                        </span>
                                        <div className="mt-1">
                                            {isOccupied ? (
                                                <Key className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Locker Detail Inspector */}
                <div className="lg:col-span-4">
                    <Card
                        title="Locker Inspector"
                        subtitle={selectedLocker ? `Details for ${selectedLocker.id}` : 'Select a locker slot to inspect'}
                    >
                        {selectedLocker ? (
                            <div className="space-y-4">
                                <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
                                    selectedLocker.status === 'Occupied'
                                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                        : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            selectedLocker.status === 'Occupied'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                        }`}>
                                            <Key className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                Locker {selectedLocker.id}
                                            </div>
                                            <div className="text-xs font-semibold capitalize mt-0.5">
                                                <span className={selectedLocker.status === 'Occupied' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                                    {selectedLocker.status === 'Occupied' ? 'Allocated / Occupied' : 'Vacant / Available'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedLocker.status === 'Available' ? (
                                    /* Issue Locker Form */
                                    <form onSubmit={handleIssueLocker} className="space-y-3.5 pt-1">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Customer Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                                list="locker-customer-list"
                                                placeholder="Type name or select customer..."
                                                value={custName}
                                                onChange={(e) => {
                                                    setCustName(e.target.value);
                                                    const matched = customers.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                                                    if (matched) setCustPhone(matched.phone);
                                                }}
                                                required
                                            />
                                            <datalist id="locker-customer-list">
                                                {customers.map(c => <option key={c.id} value={c.name} />)}
                                            </datalist>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                                placeholder="e.g. 9876543210"
                                                value={custPhone}
                                                onChange={e => setCustPhone(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    Issue Date
                                                </label>
                                                <input
                                                    type="date"
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                                    value={issueDate}
                                                    onChange={e => setIssueDate(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    Annual Rent (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                                    value={rent}
                                                    onChange={e => setRent(Number(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Notes / Key Tag
                                            </label>
                                            <textarea
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                                rows={2}
                                                placeholder="Item tags, security key details..."
                                                value={noteText}
                                                onChange={e => setNoteText(e.target.value)}
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            variant="primary"
                                            icon={<UserCheck className="w-4 h-4" />}
                                            className="w-full justify-center mt-2"
                                        >
                                            Issue Locker Key
                                        </Button>
                                    </form>
                                ) : (
                                    /* Occupied Details & Actions */
                                    <div className="space-y-4 pt-1">
                                        <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Holder:</span>
                                                <span className="font-bold text-slate-900 dark:text-white">{selectedLocker.customerName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Phone:</span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedLocker.customerPhone || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Issue Date:</span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedLocker.issueDate}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Annual Rent:</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{selectedLocker.annualRent?.toLocaleString('en-IN')}</span>
                                            </div>
                                            {selectedLocker.notes && (
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 italic">
                                                    "{selectedLocker.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Record Rent Payout Form */}
                                        <form onSubmit={handlePayRent} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                                                Collect Rent Payment
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                                                    value={payAmount}
                                                    onChange={e => setPayAmount(Number(e.target.value))}
                                                />
                                                <select
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                                                    value={payMode}
                                                    onChange={e => setPayMode(e.target.value as any)}
                                                >
                                                    <option value="Cash">Cash Counter</option>
                                                    <option value="Bank">Bank Transfer</option>
                                                    <option value="UPI">Business UPI</option>
                                                </select>
                                            </div>

                                            <Button
                                                type="submit"
                                                variant="primary"
                                                size="sm"
                                                className="w-full justify-center"
                                            >
                                                Record Rent Voucher
                                            </Button>
                                        </form>

                                        {/* Vacate Button */}
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            icon={<Trash2 className="w-3.5 h-3.5" />}
                                            onClick={handleVacateLocker}
                                            className="w-full justify-center"
                                        >
                                            Vacate & Release Locker
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400 dark:text-slate-600">
                                <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-xs font-medium max-w-xs mx-auto">
                                    Select any locker slot in Cabinet A or B to inspect records, register handovers, or record lease rent.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
