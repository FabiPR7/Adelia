import { getStripTitleArt } from '../utils/levelRankingStripAssets'
import styles from './GamificationRankingStripCard.module.css'

interface StripLevelTitleProps {
  level: number
  levelTitle: string
}

function StripLevelTitle({ level, levelTitle }: StripLevelTitleProps) {
  const titleArt = getStripTitleArt(level)

  return (
    <>
      <img
        src={titleArt}
        alt=""
        className={styles.titleBackdrop}
        draggable={false}
        aria-hidden="true"
      />
      <span className={styles.srOnly}>{levelTitle}</span>
    </>
  )
}

export default StripLevelTitle
