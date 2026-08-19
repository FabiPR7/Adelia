import { Sparkles } from 'lucide-react'
import { CHALLENGE_MINIGAME_LABELS, type ChallengeMinigameId } from '../../types/reservationChallenges'

interface ChallengeMinigameSlotProps {
  minigameId: ChallengeMinigameId
}

function ChallengeMinigameSlot({ minigameId }: ChallengeMinigameSlotProps) {
  const label = CHALLENGE_MINIGAME_LABELS[minigameId]

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-5 text-center shadow-inner backdrop-blur-md">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl" />
      <Sparkles className="mx-auto text-fuchsia-200" size={22} />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100/80">
        Minijuego del duelo
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white">
        {label}
      </h3>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/75">
        Este minijuego se monta en el siguiente paso, con su propia lógica.
        El ganador se queda la reserva a su nombre.
      </p>
    </div>
  )
}

export default ChallengeMinigameSlot
