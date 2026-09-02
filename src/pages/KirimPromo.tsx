import Wizard from '../components/Wizard'

// Pembungkus tipis: kasih batas lebar biar wizard (yang didesain buat kartu
// mode HP) tidak melar aneh di layar lebar seperti desktop.
export default function KirimPromo({ onSesiHabis }: { onSesiHabis: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Wizard onSesiHabis={onSesiHabis} />
    </div>
  )
}
