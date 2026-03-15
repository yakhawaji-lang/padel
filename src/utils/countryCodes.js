/**
 * Country calling codes for phone input.
 * Saudi Arabia (+966) is default. iso2 for search/display (e.g. SA, AE).
 */
export const COUNTRY_CODES = [
  { code: '966', iso2: 'SA', dial: '+966', label: 'السعودية', labelEn: 'Saudi Arabia', flag: '🇸🇦', isDefault: true },
  { code: '971', iso2: 'AE', dial: '+971', label: 'الإمارات', labelEn: 'UAE', flag: '🇦🇪' },
  { code: '965', iso2: 'KW', dial: '+965', label: 'الكويت', labelEn: 'Kuwait', flag: '🇰🇼' },
  { code: '973', iso2: 'BH', dial: '+973', label: 'البحرين', labelEn: 'Bahrain', flag: '🇧🇭' },
  { code: '974', iso2: 'QA', dial: '+974', label: 'قطر', labelEn: 'Qatar', flag: '🇶🇦' },
  { code: '968', iso2: 'OM', dial: '+968', label: 'عمان', labelEn: 'Oman', flag: '🇴🇲' },
  { code: '962', iso2: 'JO', dial: '+962', label: 'الأردن', labelEn: 'Jordan', flag: '🇯🇴' },
  { code: '20', iso2: 'EG', dial: '+20', label: 'مصر', labelEn: 'Egypt', flag: '🇪🇬' },
  { code: '961', iso2: 'LB', dial: '+961', label: 'لبنان', labelEn: 'Lebanon', flag: '🇱🇧' },
  { code: '963', iso2: 'SY', dial: '+963', label: 'سوريا', labelEn: 'Syria', flag: '🇸🇾' },
  { code: '964', iso2: 'IQ', dial: '+964', label: 'العراق', labelEn: 'Iraq', flag: '🇮🇶' },
  { code: '90', iso2: 'TR', dial: '+90', label: 'تركيا', labelEn: 'Turkey', flag: '🇹🇷' },
  { code: '44', iso2: 'GB', dial: '+44', label: 'بريطانيا', labelEn: 'UK', flag: '🇬🇧' },
  { code: '1', iso2: 'US', dial: '+1', label: 'أمريكا/كندا', labelEn: 'US/Canada', flag: '🇺🇸' },
  { code: '33', iso2: 'FR', dial: '+33', label: 'فرنسا', labelEn: 'France', flag: '🇫🇷' },
  { code: '49', iso2: 'DE', dial: '+49', label: 'ألمانيا', labelEn: 'Germany', flag: '🇩🇪' },
  { code: '39', iso2: 'IT', dial: '+39', label: 'إيطاليا', labelEn: 'Italy', flag: '🇮🇹' },
  { code: '34', iso2: 'ES', dial: '+34', label: 'إسبانيا', labelEn: 'Spain', flag: '🇪🇸' },
  { code: '31', iso2: 'NL', dial: '+31', label: 'هولندا', labelEn: 'Netherlands', flag: '🇳🇱' },
  { code: '61', iso2: 'AU', dial: '+61', label: 'أستراليا', labelEn: 'Australia', flag: '🇦🇺' },
  { code: '91', iso2: 'IN', dial: '+91', label: 'الهند', labelEn: 'India', flag: '🇮🇳' },
  { code: '86', iso2: 'CN', dial: '+86', label: 'الصين', labelEn: 'China', flag: '🇨🇳' },
  { code: '81', iso2: 'JP', dial: '+81', label: 'اليابان', labelEn: 'Japan', flag: '🇯🇵' },
  { code: '82', iso2: 'KR', dial: '+82', label: 'كوريا', labelEn: 'South Korea', flag: '🇰🇷' },
  { code: '7', iso2: 'RU', dial: '+7', label: 'روسيا', labelEn: 'Russia', flag: '🇷🇺' },
  { code: '55', iso2: 'BR', dial: '+55', label: 'البرازيل', labelEn: 'Brazil', flag: '🇧🇷' },
  { code: '52', iso2: 'MX', dial: '+52', label: 'المكسيك', labelEn: 'Mexico', flag: '🇲🇽' },
  { code: '27', iso2: 'ZA', dial: '+27', label: 'جنوب أفريقيا', labelEn: 'South Africa', flag: '🇿🇦' },
  { code: '234', iso2: 'NG', dial: '+234', label: 'نيجيريا', labelEn: 'Nigeria', flag: '🇳🇬' },
  { code: '254', iso2: 'KE', dial: '+254', label: 'كينيا', labelEn: 'Kenya', flag: '🇰🇪' },
  { code: '212', iso2: 'MA', dial: '+212', label: 'المغرب', labelEn: 'Morocco', flag: '🇲🇦' },
  { code: '213', iso2: 'DZ', dial: '+213', label: 'الجزائر', labelEn: 'Algeria', flag: '🇩🇿' },
  { code: '216', iso2: 'TN', dial: '+216', label: 'تونس', labelEn: 'Tunisia', flag: '🇹🇳' },
  { code: '249', iso2: 'SD', dial: '+249', label: 'السودان', labelEn: 'Sudan', flag: '🇸🇩' },
]

/** Match country by search term (label, labelEn, code, iso2, dial) */
export function matchCountrySearch(country, search, language) {
  if (!search || !search.trim()) return true
  const q = search.trim().toLowerCase()
  const label = (language === 'ar' ? country.label : country.labelEn || '').toLowerCase()
  const code = (country.code || '').toLowerCase()
  const iso2 = (country.iso2 || '').toLowerCase()
  const dial = (country.dial || '+' + country.code || '').toLowerCase()
  return label.includes(q) || code.includes(q) || iso2.includes(q) || dial.includes(q)
}

/** Get default (Saudi) country */
export const DEFAULT_COUNTRY = COUNTRY_CODES.find(c => c.isDefault) || COUNTRY_CODES[0]

/** Normalize phone digits for search: countryCode + number (strip leading 0 for Saudi) */
export function normalizeSearchDigits(countryCode, number) {
  const digits = (number || '').replace(/\D/g, '')
  let num = digits
  if (countryCode === '966' && num.startsWith('0')) {
    num = num.slice(1)
  }
  return countryCode + num
}

/** Min digits for valid search per country (without country code) */
export function getMinDigitsForCountry(code) {
  if (code === '966') return 9
  return 8
}

/** Normalize member's stored phone for matching (handles 0512345678, 512345678, +966512345678) */
export function normalizeMemberPhone(s) {
  const digits = (s || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0') && digits.length === 10) {
    return '966' + digits.slice(1)
  }
  if (digits.length === 9 && digits.startsWith('5') && !digits.startsWith('966')) {
    return '966' + digits
  }
  return digits
}
