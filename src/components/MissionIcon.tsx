import { adelinaIconForMission, isAdelinaIcon } from '../constants/adelina'
import type { MissionDefinition } from '../types/gamification'
import AdelinaCoin from './AdelinaCoin'
import styles from './MissionIcon.module.css'

interface MissionIconProps {
  mission: Pick<MissionDefinition, 'icon' | 'category'>
  size?: 'sm' | 'md' | 'lg'
}

function MissionIcon({ mission, size = 'md' }: MissionIconProps) {
  const adelinaKind = isAdelinaIcon(mission.icon)
    ? mission.icon
    : adelinaIconForMission(mission.category, mission.icon)

  if (adelinaKind) {
    return (
      <AdelinaCoin
        size={size}
        variant={adelinaKind === 'adelina-review' ? 'review' : 'coin'}
        alt={adelinaKind === 'adelina-review' ? 'Adelina de reseña' : 'Adelina'}
      />
    )
  }

  return (
    <span className={styles.emoji} aria-hidden="true">
      {mission.icon}
    </span>
  )
}

export default MissionIcon
