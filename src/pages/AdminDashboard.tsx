import { useEffect, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { getAdminCompanies, markCompanyMustChangePassword } from '../services/firestore'
import { createCompany, deleteCompany, updateCompany } from '../services/adminApi'
import { logout } from '../services/auth'
import type { AdminCompany } from '../types'
import styles from './AdminDashboard.module.css'

interface CompanyFormState {
  name: string
  location: string
  phone: string
  website: string
  password: string
}

const EMPTY_FORM: CompanyFormState = {
  name: '',
  location: '',
  phone: '',
  website: '',
  password: '',
}

function formatRegisteredDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function AdminDashboard() {
  const { refreshProfile } = useAuth()
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null)
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<AdminCompany | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  const loadCompanies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await getAdminCompanies()
      setCompanies(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las empresas desde Firestore.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCompanies()
  }, [])

  const openCreateForm = () => {
    setEditingCompany(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setSuccess(null)
  }

  const openEditForm = (company: AdminCompany) => {
    setEditingCompany(company)
    setForm({
      name: company.name,
      location: company.location,
      phone: company.phone,
      website: company.website,
      password: '',
    })
    setShowForm(true)
    setSuccess(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingCompany(null)
    setForm(EMPTY_FORM)
  }

  const togglePasswordVisibility = (companyId: string) => {
    setVisiblePasswords((current) => ({
      ...current,
      [companyId]: !current[companyId],
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const newPassword = form.password.trim()

      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: form.name,
          location: form.location,
          phone: form.phone,
          website: form.website,
          ...(newPassword ? { password: newPassword } : {}),
        })

        if (newPassword) {
          await markCompanyMustChangePassword(editingCompany.ownerUid, editingCompany.id)
        }

        setSuccess(
          newPassword
            ? `Empresa "${form.name}" actualizada. Deberá cambiar la contraseña al entrar.`
            : `Empresa "${form.name}" actualizada correctamente.`,
        )
      } else {
        const result = await createCompany({
          name: form.name,
          location: form.location,
          phone: form.phone,
          website: form.website,
          password: newPassword,
        })

        await markCompanyMustChangePassword(result.company.ownerUid, result.company.id)

        setSuccess(`Empresa "${form.name}" creada. Deberá cambiar la contraseña al entrar.`)
      }

      closeForm()
      await loadCompanies()
      await refreshProfile()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('Failed to fetch')
            ? 'No se pudo conectar con la API. Ejecuta npm run dev (incluye frontend y API).'
            : err.message
          : 'No se pudo guardar la empresa.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (company: AdminCompany) => {
    setCompanyToDelete(company)
  }

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) {
      return
    }

    setIsDeletingCompany(true)
    setError(null)
    setSuccess(null)

    try {
      await deleteCompany(companyToDelete.id)
      setSuccess(`Empresa "${companyToDelete.name}" eliminada.`)
      setCompanyToDelete(null)
      await loadCompanies()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('Failed to fetch')
            ? 'No se pudo conectar con la API. Ejecuta npm run dev.'
            : err.message
          : 'No se pudo eliminar la empresa.',
      )
    } finally {
      setIsDeletingCompany(false)
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/adelia-logo.png" alt="Adelia" className={styles.logo} />
          <div>
            <h1>Panel Admin</h1>
            <p>Gestión de empresas</p>
          </div>
        </div>
        <button type="button" className={styles.logoutButton} onClick={() => setLogoutConfirmOpen(true)}>
          Cerrar sesión
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div>
            <h2>Empresas registradas</h2>
            <p>{companies.length} empresa(s) activa(s)</p>
          </div>
          <button type="button" className={styles.createButton} onClick={openCreateForm}>
            + Nueva empresa
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {isLoading ? (
          <p className={styles.loadingText}>Cargando empresas…</p>
        ) : companies.length === 0 ? (
          <div className={styles.empty}>
            <p>No hay empresas todavía. Crea la primera.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Nombre acceso</th>
                  <th>Contraseña</th>
                  <th>Alta</th>
                  <th>Contacto</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                      <span className={styles.subText}>{company.location}</span>
                    </td>
                    <td>{company.loginName}</td>
                    <td>
                      <div className={styles.passwordCell}>
                        {company.loginPassword === '—' ? (
                          <>
                            <span className={styles.missingPassword}>Sin registrar</span>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => openEditForm(company)}
                            >
                              Asignar
                            </button>
                          </>
                        ) : (
                          <>
                            <code>
                              {visiblePasswords[company.id]
                                ? company.loginPassword
                                : '••••••••'}
                            </code>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => togglePasswordVisibility(company.id)}
                            >
                              {visiblePasswords[company.id] ? 'Ocultar' : 'Ver'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{formatRegisteredDate(company.createdAt)}</td>
                    <td>
                      <span className={styles.subText}>{company.phone}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" onClick={() => openEditForm(company)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => handleDelete(company)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{editingCompany ? 'Editar empresa' : 'Nueva empresa'}</h3>
            <p className={styles.modalHint}>
              {editingCompany
                ? 'Actualiza los datos de la empresa. Si cambias la contraseña, se guardará aquí.'
                : 'Solo tú puedes dar de alta empresas. No hay registro público.'}
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label>
                Nombre de la empresa
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Dirección
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  required
                />
              </label>
              <label>
                Teléfono
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </label>
              <label>
                Web (opcional)
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </label>
              <label>
                {editingCompany ? 'Nueva contraseña' : 'Contraseña de acceso'}
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingCompany}
                  placeholder={
                    editingCompany
                      ? 'Escribe la nueva contraseña (obligatorio si quieres cambiarla)'
                      : ''
                  }
                />
              </label>

              <div className={styles.formActions}>
                <button type="button" onClick={closeForm}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Cerrar sesión"
        message="¿Estás seguro de que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(companyToDelete)}
        title="Eliminar empresa"
        message={
          companyToDelete
            ? `¿Estás seguro de eliminar "${companyToDelete.name}"? Se borrará su acceso, contraseña, mesas y reservas.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={isDeletingCompany}
        onConfirm={() => void handleConfirmDeleteCompany()}
        onCancel={() => setCompanyToDelete(null)}
      />
    </div>
  )
}

export default AdminDashboard
