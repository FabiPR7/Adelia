import type { RestaurantAmenities } from '../../types/amenities'
import { AMENITY_CONFIGS, RESTAURANT_TYPE_CONFIGS, DEFAULT_AMENITIES } from '../../types/amenities'
import styles from './AmenitiesDisplay.module.css'

interface AmenitiesDisplayProps {
  amenities?: RestaurantAmenities
  compact?: boolean // Vista compacta para preview (antes de "Ver ficha completa")
  showTypes?: boolean // Mostrar tipos de establecimiento
}

export default function AmenitiesDisplay({ 
  amenities, 
  compact = false,
  showTypes = true 
}: AmenitiesDisplayProps) {
  const currentAmenities = { ...DEFAULT_AMENITIES, ...(amenities || {}) }

  if (compact) {
    // Vista compacta: solo mostrar los primeros 6 más relevantes
    const compactAmenities = AMENITY_CONFIGS.slice(0, 6)
    
    return (
      <div className={styles.compactContainer}>
        {compactAmenities.map((config) => {
          const isActive = currentAmenities[config.key]
          return (
            <div
              key={config.key}
              className={`${styles.compactIcon} ${!isActive ? styles.compactIconDisabled : ''}`}
              title={config.label}
            >
              <span className={styles.icon}>{config.icon}</span>
              {!isActive && <span className={styles.prohibitedSign}>🚫</span>}
            </div>
          )
        })}
      </div>
    )
  }

  // Vista completa
  return (
    <div className={styles.container}>
      {showTypes && currentAmenities.types.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tipo de Establecimiento</h3>
          <div className={styles.typesList}>
            {currentAmenities.types.map((type) => {
              const config = RESTAURANT_TYPE_CONFIGS.find((c) => c.value === type)
              if (!config) return null
              return (
                <div key={type} className={styles.typeBadge}>
                  <span className={styles.typeIcon}>{config.icon}</span>
                  <span className={styles.typeLabel}>{config.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Servicios y Características</h3>
        <div className={styles.amenitiesGrid}>
          {AMENITY_CONFIGS.map((config) => {
            const isActive = currentAmenities[config.key]
            return (
              <div
                key={config.key}
                className={`${styles.amenityCard} ${!isActive ? styles.amenityCardDisabled : ''}`}
              >
                <div className={styles.amenityIconWrapper}>
                  <span className={styles.amenityIcon}>{config.icon}</span>
                  {!isActive && (
                    <span className={styles.prohibitedOverlay}>🚫</span>
                  )}
                </div>
                <span className={styles.amenityLabel}>{config.label}</span>
                <span className={`${styles.amenityStatus} ${isActive ? styles.statusActive : styles.statusInactive}`}>
                  {isActive ? 'Disponible' : 'No disponible'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
