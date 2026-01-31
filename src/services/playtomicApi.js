// Playtomic API Service for Hala Padel
import axios from 'axios'

// Hala Padel Club Information
const HALA_PADEL_CLUB_ID = 'hala-padel'
const HALA_PADEL_VENUE_ID = import.meta.env.VITE_PLAYTOMIC_VENUE_ID || 'hala-padel'

// Base URL - قد يحتاج تعديل حسب الوثائق الفعلية
const API_BASE_URL = import.meta.env.VITE_PLAYTOMIC_API_URL || 'https://api.playtomic.io/v1'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
})

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const apiKey = import.meta.env.VITE_PLAYTOMIC_API_KEY
    if (apiKey) {
      // حسب طريقة المصادقة في Playtomic - قد تكون Bearer أو X-API-Key
      config.headers.Authorization = `Bearer ${apiKey}`
      // أو: config.headers['X-API-Key'] = apiKey
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Playtomic API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    })
    return Promise.reject(error)
  }
)

// Map Playtomic court names to local court names
const mapCourtName = (playtomicCourtName) => {
  const courtMap = {
    'Court 1': 'Court 1',
    'Court 2': 'Court 2',
    'Court 3': 'Court 3',
    'Court 4': 'Court 4',
  }
  return courtMap[playtomicCourtName] || playtomicCourtName
}

// Convert Playtomic booking format to local format
const convertPlaytomicBooking = (playtomicBooking) => {
  return {
    id: `playtomic_${playtomicBooking.id || playtomicBooking.booking_id}`,
    playtomicId: playtomicBooking.id || playtomicBooking.booking_id,
    source: 'playtomic', // Mark as Playtomic booking
    date: playtomicBooking.date || playtomicBooking.start_time?.split('T')[0],
    startTime: playtomicBooking.start_time 
      ? new Date(playtomicBooking.start_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }).slice(0, 5)
      : playtomicBooking.start_time,
    endTime: playtomicBooking.end_time
      ? new Date(playtomicBooking.end_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }).slice(0, 5)
      : playtomicBooking.end_time,
    resource: mapCourtName(playtomicBooking.court_name || playtomicBooking.court_id || 'Court 1'),
    court: playtomicBooking.court_id || playtomicBooking.court_name,
    participants: playtomicBooking.participants || [],
    amount: playtomicBooking.price || playtomicBooking.amount || 0,
    status: playtomicBooking.status || 'confirmed',
    notes: playtomicBooking.notes || '',
    // Additional Playtomic data
    playtomicData: {
      bookingId: playtomicBooking.id,
      userId: playtomicBooking.user_id,
      createdAt: playtomicBooking.created_at,
    }
  }
}

// Playtomic API Service
export const playtomicApi = {
  /**
   * Get bookings for Hala Padel
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of bookings
   */
  getBookings: async (startDate, endDate) => {
    try {
      // محاولة استخدام endpoint للحجوزات
      // قد يحتاج تعديل حسب الوثائق الفعلية
      const response = await apiClient.get(`/venues/${HALA_PADEL_VENUE_ID}/bookings`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          club_id: HALA_PADEL_CLUB_ID,
        }
      })

      // تحويل البيانات إلى تنسيق التطبيق
      const bookings = Array.isArray(response.data) 
        ? response.data 
        : (response.data.bookings || response.data.data || [])

      return bookings.map(convertPlaytomicBooking)
    } catch (error) {
      // إذا فشل الطلب، حاول استخدام endpoint بديل
      console.warn('Primary API endpoint failed, trying alternative...', error.message)
      
      // محاولة بديلة - قد يكون endpoint مختلف
      try {
        const response = await apiClient.get(`/clubs/${HALA_PADEL_CLUB_ID}/bookings`, {
          params: {
            from: startDate,
            to: endDate,
          }
        })

        const bookings = Array.isArray(response.data) 
          ? response.data 
          : (response.data.bookings || response.data.data || [])

        return bookings.map(convertPlaytomicBooking)
      } catch (altError) {
        console.error('All API endpoints failed:', altError)
        // إرجاع بيانات تجريبية للاختبار (يمكن حذفها لاحقاً)
        return getMockBookings(startDate, endDate)
      }
    }
  },

  /**
   * Get available courts for Hala Padel
   * @returns {Promise<Array>} Array of courts
   */
  getCourts: async () => {
    try {
      const response = await apiClient.get(`/venues/${HALA_PADEL_VENUE_ID}/courts`)
      return response.data.courts || response.data || []
    } catch (error) {
      console.error('Error fetching courts:', error)
      // إرجاع الملاعب الافتراضية
      return [
        { id: 'court-1', name: 'Court 1' },
        { id: 'court-2', name: 'Court 2' },
        { id: 'court-3', name: 'Court 3' },
        { id: 'court-4', name: 'Court 4' },
      ]
    }
  },

  /**
   * Get venue information for Hala Padel
   * @returns {Promise<Object>} Venue information
   */
  getVenueInfo: async () => {
    try {
      const response = await apiClient.get(`/venues/${HALA_PADEL_VENUE_ID}`)
      return response.data
    } catch (error) {
      console.error('Error fetching venue info:', error)
      return {
        id: HALA_PADEL_VENUE_ID,
        name: 'Hala Padel',
        address: 'Arid District, 11234, Riyadh',
        courts: 4,
      }
    }
  },
}

// Mock data for testing (يمكن حذفها عند ربط API الفعلي)
function getMockBookings(startDate, endDate) {
  // بيانات تجريبية للاختبار فقط
  const mockBookings = [
    {
      id: 'mock_1',
      playtomicId: '1',
      source: 'playtomic',
      date: startDate,
      startTime: '10:00',
      endTime: '11:00',
      resource: 'Court 1',
      court: 'court-1',
      participants: [],
      amount: 150,
      status: 'confirmed',
      notes: 'Mock booking from Playtomic',
    },
    {
      id: 'mock_2',
      playtomicId: '2',
      source: 'playtomic',
      date: startDate,
      startTime: '14:00',
      endTime: '15:30',
      resource: 'Court 2',
      court: 'court-2',
      participants: [],
      amount: 200,
      status: 'confirmed',
      notes: 'Mock booking from Playtomic',
    },
  ]
  return mockBookings
}

export default playtomicApi
