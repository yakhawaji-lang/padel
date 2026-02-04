// Utility to ensure Hala Padel exists
import { loadClubs, saveClubs } from '../../storage/adminStorage'

export const ensureHalaPadelExists = () => {
  const clubs = loadClubs()
  const hasHalaPadel = clubs.some(c => c.id === 'hala-padel')
  
  if (!hasHalaPadel) {
    const halaPadel = {
      id: 'hala-padel',
      name: 'Hala Padel',
      nameAr: 'هلا بادل',
      address: 'Arid District, 11234, Riyadh',
      addressAr: 'حي العارض، 11234، الرياض',
      phone: '',
      email: '',
      website: 'https://playtomic.com/clubs/hala-padel',
      playtomicVenueId: 'hala-padel',
      playtomicApiKey: '',
      courts: [
        { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
        { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
        { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
        { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
      ],
      settings: {
        defaultLanguage: 'en',
        timezone: 'Asia/Riyadh',
        currency: 'SAR',
        bookingDuration: 60,
        maxBookingAdvance: 30,
        cancellationPolicy: 24
      },
      tournaments: [],
      tournamentTypes: [
        {
          id: 'king-of-court',
          name: 'King of the Court',
          nameAr: 'ملك الملعب',
          description: 'Winners stay on court',
          descriptionAr: 'الفائزون يبقون على الملعب'
        },
        {
          id: 'social',
          name: 'Social Tournament',
          nameAr: 'بطولة سوشيال',
          description: 'Round-robin format',
          descriptionAr: 'نظام دوري'
        }
      ],
      members: [],
      bookings: [],
      offers: [],
      accounting: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    clubs.unshift(halaPadel)
    saveClubs(clubs).catch(e => console.error('saveClubs:', e))
    return true
  }
  
  return false
}
