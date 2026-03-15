/**
 * Country calling codes for phone input.
 * Saudi Arabia (+966) is default and fixed.
 */
export const COUNTRY_CODES = [
  { code: '966', dial: '+966', label: 'السعودية', labelEn: 'Saudi Arabia', flag: '🇸🇦', isDefault: true },
  { code: '971', dial: '+971', label: 'الإمارات', labelEn: 'UAE', flag: '🇦🇪' },
  { code: '965', dial: '+965', label: 'الكويت', labelEn: 'Kuwait', flag: '🇰🇼' },
  { code: '973', dial: '+973', label: 'البحرين', labelEn: 'Bahrain', flag: '🇧🇭' },
  { code: '974', dial: '+974', label: 'قطر', labelEn: 'Qatar', flag: '🇶🇦' },
  { code: '968', dial: '+968', label: 'عمان', labelEn: 'Oman', flag: '🇴🇲' },
  { code: '962', dial: '+962', label: 'الأردن', labelEn: 'Jordan', flag: '🇯🇴' },
  { code: '20', dial: '+20', label: 'مصر', labelEn: 'Egypt', flag: '🇪🇬' },
  { code: '961', dial: '+961', label: 'لبنان', labelEn: 'Lebanon', flag: '🇱🇧' },
  { code: '963', dial: '+963', label: 'سوريا', labelEn: 'Syria', flag: '🇸🇾' },
  { code: '964', dial: '+964', label: 'العراق', labelEn: 'Iraq', flag: '🇮🇶' },
  { code: '90', dial: '+90', label: 'تركيا', labelEn: 'Turkey', flag: '🇹🇷' },
  { code: '44', dial: '+44', label: 'بريطانيا', labelEn: 'UK', flag: '🇬🇧' },
  { code: '1', dial: '+1', label: 'أمريكا/كندا', labelEn: 'US/Canada', flag: '🇺🇸' },
  { code: '33', dial: '+33', label: 'فرنسا', labelEn: 'France', flag: '🇫🇷' },
  { code: '49', dial: '+49', label: 'ألمانيا', labelEn: 'Germany', flag: '🇩🇪' },
  { code: '39', dial: '+39', label: 'إيطاليا', labelEn: 'Italy', flag: '🇮🇹' },
  { code: '34', dial: '+34', label: 'إسبانيا', labelEn: 'Spain', flag: '🇪🇸' },
  { code: '31', dial: '+31', label: 'هولندا', labelEn: 'Netherlands', flag: '🇳🇱' },
  { code: '61', dial: '+61', label: 'أستراليا', labelEn: 'Australia', flag: '🇦🇺' },
  { code: '91', dial: '+91', label: 'الهند', labelEn: 'India', flag: '🇮🇳' },
  { code: '86', dial: '+86', label: 'الصين', labelEn: 'China', flag: '🇨🇳' },
  { code: '81', dial: '+81', label: 'اليابان', labelEn: 'Japan', flag: '🇯🇵' },
  { code: '82', dial: '+82', label: 'كوريا', labelEn: 'South Korea', flag: '🇰🇷' },
  { code: '7', dial: '+7', label: 'روسيا', labelEn: 'Russia', flag: '🇷🇺' },
  { code: '55', dial: '+55', label: 'البرازيل', labelEn: 'Brazil', flag: '🇧🇷' },
  { code: '52', dial: '+52', label: 'المكسيك', labelEn: 'Mexico', flag: '🇲🇽' },
  { code: '27', dial: '+27', label: 'جنوب أفريقيا', labelEn: 'South Africa', flag: '🇿🇦' },
  { code: '234', dial: '+234', label: 'نيجيريا', labelEn: 'Nigeria', flag: '🇳🇬' },
  { code: '254', dial: '+254', label: 'كينيا', labelEn: 'Kenya', flag: '🇰🇪' },
  { code: '212', dial: '+212', label: 'المغرب', labelEn: 'Morocco', flag: '🇲🇦' },
  { code: '213', dial: '+213', label: 'الجزائر', labelEn: 'Algeria', flag: '🇩🇿' },
  { code: '216', dial: '+216', label: 'تونس', labelEn: 'Tunisia', flag: '🇹🇳' },
  { code: '249', dial: '+249', label: 'السودان', labelEn: 'Sudan', flag: '🇸🇩' },
]

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
