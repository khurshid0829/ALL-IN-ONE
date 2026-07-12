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
 *
 * "Ro'yxatdan tanlash" tugmasi — nomni eslay olmagan foydalanuvchi uchun,
 * to'liq ro'yxatni (sku_master uchun kategoriya bo'yicha guruhlangan holda)
 * ochib, yozmasdan tanlash imkonini beradi.
 */

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;
const MAX_RESULTS = 20;
const BROWSE_LIMIT = 1000;

const CATEGORY_LABELS = {
  asosiy: 'Asosiy',
  qadoqlash: 'Qadoqlash',
  qoshimcha: "Qo'shimcha",
  __none__: 'Boshqa / belgilanmagan',
};

export default function SearchSelect({
  entityType,          // 'sku_master' | 'customers'
  departmentId,        // sku_master uchun majburiy, customers uchun kerak emas
  skuType,             // ixtiyoriy: 'XOM' | 'MAX' (faqat sku_master uchun)
  placeholder = 'Qidirish...',
  initialLabel = '',   // tahrirlashda oldindan tanlangan nomni ko'rsatish uchun
  onSelect,
  disabled = false,
  enableBrowse = true, // "Ro'yxatdan tanlash" tugmasini ko'rsatish/yashirish
}) {
  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browseRows, setBrowseRows] = useState([]);
  const [browseCategory, setBrowseCategory] = useState('__all__');

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
          .select('id, sku_code, display_name, unit, department_id, tur, category')
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
    setBrowseOpen(false);

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

    setQuery(label);
    setIsOpen(false);
    setResults([]);
    setBrowseOpen(false);
    if (onSelect) onSelect(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setBrowseOpen(false);
    if (onSelect) onSelect(null);
  };

  const loadBrowseList = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      let req;

      if (entityType === 'sku_master') {
        req = supabase
          .from('sku_master')
          .select('id, sku_code, display_name, unit, department_id, tur, category')
          .eq('is_archived', false)
          .order('category', { ascending: true })
          .order('display_name', { ascending: true })
          .limit(BROWSE_LIMIT);

        if (departmentId) req = req.eq('department_id', departmentId);
        if (skuType) req = req.eq('tur', skuType);
      } else {
        req = supabase
          .from('customers')
          .select('id, full_name, phone')
          .eq('is_archived', false)
          .order('full_name', { ascending: true })
          .limit(BROWSE_LIMIT);
      }

      const { data, error: reqError } = await req;
      if (reqError) throw reqError;
      setBrowseRows(data || []);
    } catch (err) {
      console.error('SearchSelect ro\u2018yxat xatosi:', err);
      setBrowseError("Ro'yxatni yuklashda xatolik: " + (err?.message || "noma'lum xato"));
      setBrowseRows([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [entityType, departmentId, skuType]);

  const handleOpenBrowse = () => {
    setIsOpen(false);
    setBrowseCategory('__all__');
    setBrowseOpen(true);
    loadBrowseList();
  };

  // Tashqariga bosilganda ro'yxatni yopish
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setBrowseOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Browse ro'yxatini kategoriya bo'yicha guruhlash (sku_master uchun)
  const groupedBrowse = (() => {
    if (entityType !== 'sku_master') return null;
    const groups = {};
    for (const row of browseRows) {
      const key = row.category && row.category.trim() ? row.category : '__none__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  })();

  const browseCategoryKeys = groupedBrowse ? Object.keys(groupedBrowse) : [];

  const visibleBrowseRows = (() => {
    if (entityType !== 'sku_master') return browseRows;
    if (browseCategory === '__all__') return browseRows;
    return groupedBrowse[browseCategory] || [];
  })();

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

      {enableBrowse && !disabled && (
        <button
          type="button"
          className="search-select__browse-btn"
          onClick={handleOpenBrowse}
        >
          Ro'yxatdan tanlash
        </button>
      )}

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

      {browseOpen && (
        <div className="search-select__browse-panel">
          {entityType === 'sku_master' && browseCategoryKeys.length > 0 && (
            <div className="search-select__browse-tabs">
              <button
                type="button"
                className={
                  'search-select__browse-tab' +
                  (browseCategory === '__all__' ? ' search-select__browse-tab--active' : '')
                }
                onClick={() => setBrowseCategory('__all__')}
              >
                Hammasi
              </button>
              {browseCategoryKeys.map((key) => (
                <button
                  type="button"
                  key={key}
                  className={
                    'search-select__browse-tab' +
                    (browseCategory === key ? ' search-select__browse-tab--active' : '')
                  }
                  onClick={() => setBrowseCategory(key)}
                >
                  {CATEGORY_LABELS[key] || key}
                </button>
              ))}
            </div>
          )}

          {browseLoading && <div className="search-select__empty">Yuklanmoqda...</div>}
          {browseError && <div className="search-select__error">{browseError}</div>}

          {!browseLoading && !browseError && (
            <ul className="search-select__list search-select__list--browse">
              {visibleBrowseRows.length === 0 && (
                <li className="search-select__empty-inline">Ro'yxat bo'sh</li>
              )}
              {visibleBrowseRows.map((item) => (
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
        </div>
      )}
    </div>
  );
}
