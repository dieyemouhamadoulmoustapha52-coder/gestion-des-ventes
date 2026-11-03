/** Dialogue de confirmation générique (suppressions…). */
import Modal from './Modal.jsx'
import Button from './Button.jsx'

/**
 * @param {{open: boolean, title: string, message: string,
 *          confirmLabel?: string, pending?: boolean,
 *          onConfirm: () => void, onClose: () => void}} props
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  pending = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Veuillez patienter…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  )
}
