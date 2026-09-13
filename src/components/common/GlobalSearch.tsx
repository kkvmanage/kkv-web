import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, DollarSign, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { SearchInput } from './SearchInput';
import { apiService } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { Customer, Loan, Receipt } from '../../types';

export interface GlobalSearchResultItem {
  type: 'customer' | 'loan' | 'receipt';
  id: string;
  title: string;
  subtitle: string;
  metadata?: string;
  data: any;
}

export const GlobalSearch: React.FC = () => {
  const { customers, loans, receipts, setCurrentPage, isRentalPortal } = useApp();

  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const [matchedCustomers, setMatchedCustomers] = useState<Customer[]>([]);
  const [matchedLoans, setMatchedLoans] = useState<Loan[]>([]);
  const [matchedReceipts, setMatchedReceipts] = useState<Receipt[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Perform search (backend API + local fallback)
  const performSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) {
        setMatchedCustomers([]);
        setMatchedLoans([]);
        setMatchedReceipts([]);
        setIsOpen(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setIsOpen(true);
      setSelectedIndex(-1);

      try {
        const res = await apiService.globalSearch(q);
        if (res && (res.customers || res.loans || res.receipts)) {
          setMatchedCustomers(res.customers || []);
          setMatchedLoans(res.loans || []);
          setMatchedReceipts(res.receipts || []);
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to local context filtering
      }

      // Local Fallback Filter
      const cHits = customers
        .filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.idNumber && c.idNumber.toLowerCase().includes(q))
        )
        .slice(0, 5);

      const lHits = loans
        .filter((l) =>
          l.loanNo.toLowerCase().includes(q) ||
          l.customerName.toLowerCase().includes(q) ||
          l.customerId.toLowerCase().includes(q) ||
          ((l as any).phone && String((l as any).phone).includes(q))
        )
        .slice(0, 5);

      const rHits = receipts
        .filter((r) =>
          (r.receiptNo && String(r.receiptNo).toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.loanNo && String(r.loanNo).toLowerCase().includes(q))
        )
        .slice(0, 5);

      setMatchedCustomers(cHits);
      setMatchedLoans(lHits);
      setMatchedReceipts(rHits);
      setLoading(false);
    },
    [customers, loans, receipts]
  );

  // Flattened results list for keyboard indexing
  const allFlattenedResults: GlobalSearchResultItem[] = [
    ...matchedCustomers.map((c) => ({
      type: 'customer' as const,
      id: c.id,
      title: c.name,
      subtitle: `${c.phone} • ID: ${c.id}`,
      metadata: `${c.activeLoansCount || 0} active loan(s)`,
      data: c
    })),
    ...matchedLoans.map((l) => ({
      type: 'loan' as const,
      id: l.id,
      title: `Loan No: ${l.loanNo}`,
      subtitle: `${l.customerName} • ${l.loanTypeName || l.loanType}`,
      metadata: `₹${l.principal.toLocaleString('en-IN')}`,
      data: l
    })),
    ...matchedReceipts.map((r) => ({
      type: 'receipt' as const,
      id: r.id,
      title: `Receipt #${r.receiptNo}`,
      subtitle: `${r.customerName} • ${r.kind}`,
      metadata: `₹${r.amount.toLocaleString('en-IN')}`,
      data: r
    }))
  ];

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || allFlattenedResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allFlattenedResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allFlattenedResults.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < allFlattenedResults.length) {
        e.preventDefault();
        handleSelectResult(allFlattenedResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectResult = (item: GlobalSearchResultItem) => {
    setIsOpen(false);
    setQuery('');

    if (item.type === 'customer') {
      setCurrentPage('customers');
    } else if (item.type === 'loan') {
      setCurrentPage('loan-display');
    } else if (item.type === 'receipt') {
      setCurrentPage('all-receipts');
    }
  };

  // Helper to highlight matching text
  const renderHighlightedText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={i}
          style={{
            backgroundColor: 'rgba(201, 162, 39, 0.35)',
            color: 'inherit',
            padding: '0 2px',
            borderRadius: '2px'
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const hasResults = allFlattenedResults.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
      <SearchInput
        value={query}
        onChange={setQuery}
        onDebouncedChange={performSearch}
        placeholder={isRentalPortal ? "Search shops, tenants, complexes..." : "Search customers, loans..."}
        loading={loading}
        onFocus={() => {
          if (query.trim()) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        inputStyle={{
          borderRadius: 'var(--radius-full, 9999px)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          height: '38px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
        }}
      />

      {/* Floating Results Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-light, #e2e8f0)',
            borderRadius: 'var(--radius-md, 10px)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
            maxHeight: '420px',
            overflowY: 'auto',
            zIndex: 1000,
            padding: '8px 0'
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Loader2 size={16} className="animate-spin" color="var(--color-primary-accent)" />
              <span>Searching application...</span>
            </div>
          ) : !hasResults ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No matching customers, loans, or receipts found for &quot;{query}&quot;.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Category: CUSTOMERS */}
              {matchedCustomers.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)'
                    }}
                  >
                    Customers ({matchedCustomers.length})
                  </div>

                  {matchedCustomers.map((c) => {
                    const itemIndex = allFlattenedResults.findIndex((r) => r.id === c.id && r.type === 'customer');
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <div
                        key={`c-${c.id}`}
                        onClick={() =>
                          handleSelectResult({
                            type: 'customer',
                            id: c.id,
                            title: c.name,
                            subtitle: c.phone,
                            data: c
                          })
                        }
                        style={{
                          padding: '10px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(201, 162, 39, 0.12)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--color-primary-accent)' : '3px solid transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(201, 162, 39, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <User size={16} color="var(--color-primary-dark)" />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>
                              {renderHighlightedText(c.name, query)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {renderHighlightedText(c.phone, query)} • ID: {c.id}
                            </div>
                          </div>
                        </div>

                        <ArrowRight size={14} color="var(--text-muted)" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category: LOANS */}
              {matchedLoans.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)'
                    }}
                  >
                    Loans ({matchedLoans.length})
                  </div>

                  {matchedLoans.map((l) => {
                    const itemIndex = allFlattenedResults.findIndex((r) => r.id === l.id && r.type === 'loan');
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <div
                        key={`l-${l.id}`}
                        onClick={() =>
                          handleSelectResult({
                            type: 'loan',
                            id: l.id,
                            title: l.loanNo,
                            subtitle: l.customerName,
                            data: l
                          })
                        }
                        style={{
                          padding: '10px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(201, 162, 39, 0.12)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--color-primary-accent)' : '3px solid transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <DollarSign size={16} color="#059669" />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>
                              {renderHighlightedText(l.loanNo, query)} • {renderHighlightedText(l.customerName, query)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {l.loanTypeName || l.loanType} • ₹{l.principal.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        <ArrowRight size={14} color="var(--text-muted)" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category: RECEIPTS */}
              {matchedReceipts.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      backgroundColor: 'var(--bg-surface-secondary, #f8fafc)'
                    }}
                  >
                    Receipts ({matchedReceipts.length})
                  </div>

                  {matchedReceipts.map((r) => {
                    const itemIndex = allFlattenedResults.findIndex((rItem) => rItem.id === r.id && rItem.type === 'receipt');
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <div
                        key={`r-${r.id}`}
                        onClick={() =>
                          handleSelectResult({
                            type: 'receipt',
                            id: r.id,
                            title: `Receipt #${r.receiptNo}`,
                            subtitle: r.customerName,
                            data: r
                          })
                        }
                        style={{
                          padding: '10px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(201, 162, 39, 0.12)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--color-primary-accent)' : '3px solid transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <FileText size={16} color="#2563eb" />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>
                              Receipt #{renderHighlightedText(r.receiptNo.toString(), query)} • {renderHighlightedText(r.customerName, query)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {r.kind} • ₹{r.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        <ArrowRight size={14} color="var(--text-muted)" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
