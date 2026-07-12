import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import './SearchSelect.css';

/**
 * SearchSelect — umumiy "qidiruv bilan tanlash" komponenti.
 *
 * Ishlatilishi:
 *   sku_master uchun:
 *     <SearchSelect
 *        entityType="sku_master"
 *        departmentId={departmentId}
 *        skuType="MAX"                // ixtiyoriy: "XOM" yoki "MAX" bilan filtr
 *        placeholder="Mahsulot qidirish..."
 *        onSelect={(item) => setSelectedSku(item)}
 *     />
 *
 *   customers uchun:
 *     <SearchSelect
 *        entityType="customers"
 *        placeholder="Mijoz qidirish..."
 *        onSelect={(item) => setSelectedCustomer(item)}
 *     />
 *
 * onSelect callback tanlangan qatorni (butun obyekt: id, nomi va h.k.) qaytaradi.
 */

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;
const MAX_RESULTS = 20;

export default function SearchSelect({
  entityType,          // 'sku_master' | 'customers'
  departmentId,        // sku_master uchun majburiy, customers uchun kerak emas
  skuType,             // ixtiyoriy: 'XOM' | 'MAX' (faqat sku_master uchun)
  placeholder = 'Qidirish...',
  initialLabel = '',   // tahrirlashda oldindan tanlangan nomni ko'rsatish uchun
  onSelect,
  disabled = false,
}) {
  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const runSearch = useCallback(async (text) => {
    setIsLoading(true);
    setError(null);
    try {
      let req;

      if (entityType === 'sku_master') {
        req = supabase
          .from('sku_master')
          .select('id, sku_code, display_name, unit, department_id, tur')
          .eq('is_archived', false)
          .or(`display_name.ilike.%${text}%,sku_code.ilike.%${text}%`)
          .limit(MAX_RESULTS);

        if (departmentId) {
          req = req.eq('department_id', departmentId);
        }
        if (skuType) {
          // 'tur' ustuni: qiymati 'XOM' (xomashyo) yoki 'MAX' (mahsulot)
          req = req.eq('tur', skuType);
        }
      } else if (entityType === 'customers') {
        req = supabase
          .from('customers')
          .select('id, full_name, phone')
          .eq('is_archived', false)
          .ilike('full_name', `%${text}%`)
          .limit(MAX_RESULTS);
      } else {
        throw new Error(`Noma'lum entityType: ${entityType}`);
      }

      const { data, error: reqError } = await req;
      if (reqError) throw reqError;

      setResults(data || []);
      setIsOpen(true);
    } catch (err) {
      console.error('SearchSelect qidiruv xatosi:', err);
      setError(
        "Qidirishda xatolik: " + (err?.message || "noma'lum xato")
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, departmentId, skuType]);

  const handleChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setSelected(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < MIN_CHARS) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(text.trim());
    }, DEBOUNCE_MS);
  };

  const handlePick = (item) => {
    const label = entityType === 'sku_master'
      ? `${item.sku_code} — ${item.display_name}`
      : item.full_name;

    setSelected(item);
    setQuery(label);
    setIsOpen(false);
    setResults([]);
    if (onSelect) onSelect(item);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onSelect) onSelect(null);
  };

  // Tashqariga bosilganda ro'yxatni yopish
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-select" ref={containerRef}>
      <div className="search-select__input-wrap">
        <input
          type="text"
          className="search-select__input"
          value={query}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          disabled={disabled}
        />
        {isLoading && <span className="search-select__spinner" />}
        {!isLoading && query && (
          <button
            type="button"
            className="search-select__clear"
            onClick={handleClear}
            aria-label="Tozalash"
          >
            ×
          </button>
        )}
      </div>

      {error && <div className="search-select__error">{error}</div>}

      {isOpen && results.length > 0 && (
        <ul className="search-select__list">
          {results.map((item) => (
            <li
              key={item.id}
              className="search-select__item"
              onClick={() => handlePick(item)}
            >
              {entityType === 'sku_master' ? (
                <>
                  <span className="search-select__code">{item.sku_code}</span>
                  <span className="search-select__name">{item.display_name}</span>
                  {item.unit && <span className="search-select__unit">{item.unit}</span>}
                </>
              ) : (
                <>
                  <span className="search-select__name">{item.full_name}</span>
                  {item.phone && <span className="search-select__unit">{item.phone}</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isLoading && results.length === 0 && query.trim().length >= MIN_CHARS && (
        <div className="search-select__empty">Hech narsa topilmadi</div>
      )}
    </div>
  );
}
