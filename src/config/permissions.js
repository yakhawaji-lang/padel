/**
 * Centralized permission definitions for Platform Admin and Club Admin
 */

export const PLATFORM_PERMISSIONS = [
  { id: 'all-clubs', label: { en: 'All Clubs Dashboard', ar: 'لوحة جميع الأندية' }, icon: '📊' },
  { id: 'manage-clubs', label: { en: 'Manage Clubs', ar: 'إدارة الأندية' }, icon: '🏢' },
  { id: 'all-members', label: { en: 'All Members', ar: 'أعضاء المنصة' }, icon: '👥' },
  { id: 'admin-users', label: { en: 'Admin Users', ar: 'مدراء المنصة' }, icon: '👤' }
]

export const CLUB_PERMISSIONS = [
  { id: 'dashboard', label: { en: 'Dashboard', ar: 'لوحة التحكم' }, icon: '📊' },
  { id: 'members', label: { en: 'Members', ar: 'الأعضاء' }, icon: '👥' },
  { id: 'accounting', label: { en: 'Accounting', ar: 'المحاسبة' }, icon: '💼' },
  { id: 'offers', label: { en: 'Offers', ar: 'العروض' }, icon: '🎁' },
  { id: 'store', label: { en: 'Store', ar: 'المتجر' }, icon: '🛒' },
  { id: 'settings', label: { en: 'Settings', ar: 'الإعدادات' }, icon: '⚙️' },
  { id: 'users', label: { en: 'Club Users', ar: 'مدراء النادي' }, icon: '👤' }
]
