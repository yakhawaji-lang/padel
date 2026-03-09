import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const BarcodeDisplay = ({ value, options = {}, className = '' }) => {
  const svgRef = useRef(null)

  useEffect(() => {
    if (value && svgRef.current) {
      try {
        JsBarcode(svgRef.current, String(value).trim(), {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          margin: 4,
          ...options
        })
      } catch (e) {
        /* invalid barcode */
      }
    }
  }, [value, options])

  if (!value || !String(value).trim()) return null

  return <svg ref={svgRef} className={`barcode-svg ${className}`} />
}

export default BarcodeDisplay
