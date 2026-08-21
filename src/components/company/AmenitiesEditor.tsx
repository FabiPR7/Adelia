import type { RestaurantAmenities, RestaurantType } from '../../types/amenities'
import { AMENITY_CONFIGS, RESTAURANT_TYPE_CONFIGS, DEFAULT_AMENITIES } from '../../types/amenities'
import styles from './AmenitiesEditor.module.css'

interface AmenitiesEditorProps {
  amenities: RestaurantAmenities
  onChange: (amenities: RestaurantAmenities) => void
}

export default function AmenitiesEditor({ amenities, onChange }: AmenitiesEditorProps) {
  const currentAmenities = { ...DEFAULT_AMENITIES, ...amenities }

  const handleToggle = (key: keyof Omit<RestaurantAmenities, 'types'>) => {
    onChange({
      ...currentAmenities,
      [key]: !currentAmenities[key],
    })
  }

  const handleTypeToggle = (type: RestaurantType) => {
    const currentTypes = currentAmenities.types || []
    const hasType = currentTypes.includes(type)
    
    const newTypes = hasType
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type]

    onChange({
      ...currentAmenities,
      types: newTypes.length > 0 ? newTypes : ['restaurante'], // Al menos uno
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Tipo de Establecimiento</h3>
        <p className={styles.sectionDescription}>Selecciona uno o varios</p>
        
        <div className={styles.typeGrid}>
          {RESTAURANT_TYPE_CONFIGS.map((config) => {
            const isActive = currentAmenities.types.includes(config.value)
            return (
              <button
                key={config.value}
                type="button"
                className={`${styles.typeCard} ${isActive ? styles.typeCardActive : ''}`}
                onClick={() => handleTypeToggle(config.value)}
              >
                <span className={styles.typeIcon}>{config.icon}</span>
                <span className={styles.typeLabel}>{config.label}</span>
                {isActive && <span className={styles.typeCheck}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Servicios y Características</h3>
        <p className={styles.sectionDescription}>Activa los servicios que ofreces</p>
        
        <div className={styles.amenitiesGrid}>
          {AMENITY_CONFIGS.map((config) => {
            const isActive = currentAmenities[config.key]
            return (
              <div key={config.key} className={styles.amenityItem}>
                <div className={styles.amenityInfo}>
                  <span className={styles.amenityIcon}>{config.icon}</span>
                  <span className={styles.amenityLabel}>{config.label}</span>
                </div>
                
                <button
                  type="button"
                  className={`${styles.toggle} ${isActive ? styles.toggleActive : ''}`}
                  onClick={() => handleToggle(config.key)}
                  aria-label={`${isActive ? 'Desactivar' : 'Activar'} ${config.label}`}
                >
                  <span className={styles.toggleSlider}></span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
