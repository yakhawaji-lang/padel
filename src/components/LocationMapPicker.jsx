import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon in Vite
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
L.Icon.Default.imagePath = ''

const DEFAULT_CENTER = [24.7136, 46.6753]
const DEFAULT_ZOOM = 12
const NOMINATIM_USER_AGENT = 'PadelClubsApp/1.0'

const LocationMapPicker = ({ value, onChange, className = '', placeholder, useMyLocationLabel = 'Use my location' }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  onChangeRef.current = onChange

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': NOMINATIM_USER_AGENT,
            'Accept-Language': 'en,ar'
          }
        }
      )
      if (!res.ok) throw new Error('Geocoding failed')
      const data = await res.json()
      return data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }, [])

  const updateLocation = useCallback(async (lat, lng) => {
    setLoading(true)
    setError(null)
    try {
      const address = await reverseGeocode(lat, lng)
      onChangeRef.current?.({ lat, lng, address })
    } catch (e) {
      setError('Failed to get address')
      onChangeRef.current?.({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
    }
    setLoading(false)
  }, [reverseGeocode])

  useEffect(() => {
    const container = mapRef.current
    if (!container) return

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) return

      const center = value?.lat && value?.lng ? [value.lat, value.lng] : DEFAULT_CENTER
      const map = L.map(container, {
        center,
        zoom: DEFAULT_ZOOM,
        zoomControl: false
      })

      L.control.zoom({ position: 'topright' }).addTo(map)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map)

      if (value?.lat && value?.lng) {
        const marker = L.marker([value.lat, value.lng]).addTo(map)
        markerRef.current = marker
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) map.removeLayer(markerRef.current)
        const marker = L.marker([lat, lng]).addTo(map)
        markerRef.current = marker
        updateLocation(lat, lng)
      })

      map.whenReady(() => {
        setTimeout(() => map.invalidateSize(), 100)
      })

      mapInstanceRef.current = map
    }, 150)

    return () => {
      clearTimeout(timer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && value?.lat && value?.lng) {
      mapInstanceRef.current.setView([value.lat, value.lng])
      if (markerRef.current) mapInstanceRef.current.removeLayer(markerRef.current)
      const marker = L.marker([value.lat, value.lng]).addTo(mapInstanceRef.current)
      markerRef.current = marker
    }
  }, [value?.lat, value?.lng])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15)
          if (markerRef.current) mapInstanceRef.current.removeLayer(markerRef.current)
          const marker = L.marker([latitude, longitude]).addTo(mapInstanceRef.current)
          markerRef.current = marker
        }
        updateLocation(latitude, longitude)
      },
      () => {
        setError('Could not get location')
        setLoading(false)
      }
    )
  }

  return (
    <div className={`location-map-picker ${className}`}>
      <div className="location-map-toolbar">
        <button
          type="button"
          className="location-map-use-btn"
          onClick={handleUseMyLocation}
          disabled={loading}
        >
          📍 {loading ? '...' : useMyLocationLabel}
        </button>
      </div>
      <div ref={mapRef} className="location-map-container" />
      {error && <p className="location-map-error">{error}</p>}
      {loading && <p className="location-map-loading">{placeholder || 'Loading address...'}</p>}
      {value?.address && !loading && <p className="location-map-address">{value.address}</p>}
    </div>
  )
}

export default LocationMapPicker
