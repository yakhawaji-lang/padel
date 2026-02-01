import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon in Vite
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const DEFAULT_CENTER = [24.7136, 46.6753]
const DEFAULT_ZOOM = 12

const LocationMapPicker = ({ value, onChange, className = '', placeholder }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView(
      value?.lat && value?.lng ? [value.lat, value.lng] : DEFAULT_CENTER,
      DEFAULT_ZOOM
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    if (value?.lat && value?.lng) {
      const marker = L.marker([value.lat, value.lng]).addTo(map)
      markerRef.current = marker
    }

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) map.removeLayer(markerRef.current)
      const marker = L.marker([lat, lng]).addTo(map)
      markerRef.current = marker
      setLoading(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: { 'Accept-Language': 'en,ar' }
        })
        const data = await res.json()
        const address = data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        onChange({ lat, lng, address })
      } catch {
        onChange({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
      }
      setLoading(false)
    })

    mapInstanceRef.current = map
    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && value?.lat && value?.lng) {
      mapInstanceRef.current.setView([value.lat, value.lng], mapInstanceRef.current.getZoom())
      if (markerRef.current) mapInstanceRef.current.removeLayer(markerRef.current)
      const marker = L.marker([value.lat, value.lng]).addTo(mapInstanceRef.current)
      markerRef.current = marker
    }
  }, [value?.lat, value?.lng])

  return (
    <div className={className}>
      <div ref={mapRef} className="location-map-container" />
      {loading && <p className="location-map-loading">{placeholder || 'Loading address...'}</p>}
      {value?.address && !loading && <p className="location-map-address">{value.address}</p>}
    </div>
  )
}

export default LocationMapPicker
