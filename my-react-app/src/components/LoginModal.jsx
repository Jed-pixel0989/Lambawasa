import { useState, useEffect } from 'react'
import './LoginModal.css'
import { api } from '../services/api'
import {
  HardHat,
  Building2,
  Crown,
  Banknote,
  Droplet,
  IdCard,
  Lock,
  ArrowRight,
  X,
  AlertTriangle,
  User,
} from 'lucide-react'

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onOpenRegister,
  flash,
  initialMode = 'consumer', // 'consumer' | 'field' | 'admin'
  consumerOnly = false,
  consumerAndFieldOnly = false,
}) {
  const [authMode, setAuthMode] = useState(initialMode) // 'consumer' | 'field' | 'admin'
  const [staffRolePreset, setStaffRolePreset] = useState('office')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync mode whenever modal is opened with specific intent
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode)
      setStaffRolePreset(initialMode === 'consumer' ? 'consumer' : initialMode === 'field' ? 'field' : 'office')
      setIdentifier('')
      setPassword('')
      setError('')
    }
  }, [isOpen, initialMode])

  if (!isOpen) return null

  // Quick switch tab handlers
  const handleSwitchTab = (mode, preset = 'office') => {
    setAuthMode(mode)
    setStaffRolePreset(preset)
    setIdentifier('')
    setPassword('')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedId = identifier.trim()
    const trimmedPass = password

    if (!trimmedId || !trimmedPass) {
      setError('Please provide your email and password.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const result = await api.login(trimmedId, trimmedPass)
      if (!result.success) throw new Error(result.error || 'Sign-in failed.')

      const user = result.user
      const isHousehold = user.role === 'House Hold'
      const isField = ['Field Staffs', 'Technician'].includes(user.role)
      const wrongStaffPreset = authMode === 'admin'
        && ((staffRolePreset === 'president' && user.role !== 'President')
          || (staffRolePreset === 'cashier' && user.role !== 'Cashier')
          || (staffRolePreset === 'office' && ['President', 'Cashier'].includes(user.role)))
      if (
        (authMode === 'consumer' && !isHousehold)
        || (authMode === 'field' && !isField)
        || (authMode === 'admin' && (isHousehold || isField))
        || wrongStaffPreset
      ) {
        await api.signOut()
        throw new Error('This account does not have access to the selected sign-in area.')
      }

      onLogin(user)
      if (flash) flash(`Welcome, ${user.fullName}.`)
      onClose()
    } catch (loginError) {
      setError(loginError?.message || 'Sign-in failed. Check your email and password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const themeClass =
    authMode === 'consumer'
      ? 'theme-consumer'
      : authMode === 'field'
      ? 'theme-field'
      : 'theme-admin'

  return (
    <div className="mobile-login-overlay" onClick={onClose}>
      <div className={`mobile-login-card ${themeClass}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          className="mobile-login-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Header Branding */}
        <div className="mobile-login-banner">
          <div className="mobile-login-brand">
            <div className="mobile-login-logo">
              {authMode === 'consumer' ? (
                <Droplet size={20} />
              ) : authMode === 'field' ? (
                <HardHat size={20} />
              ) : staffRolePreset === 'president' ? (
                <Crown size={20} />
              ) : staffRolePreset === 'cashier' ? (
                <Banknote size={20} />
              ) : (
                <Building2 size={20} />
              )}
            </div>
            <div className="mobile-login-titles">
              <h2>
                {authMode === 'consumer'
                  ? 'Household Consumer'
                  : authMode === 'field'
                  ? 'Field Staff Terminal'
                  : staffRolePreset === 'president'
                  ? 'President Suite'
                  : staffRolePreset === 'cashier'
                  ? 'Cashier Counter POS'
                  : 'Operations & Office'}
              </h2>
              <p>
                {authMode === 'consumer'
                  ? 'Check water statements, meter twin & pay bills'
                  : authMode === 'field'
                  ? 'Mobile meter reading, GIS mapping & work orders'
                  : 'Municipal billing runs, counter POS & audit logs'}
              </p>
            </div>
          </div>

          {/* Segmented Role Switcher (Touch-friendly Mobile Tabs) */}
          {!consumerOnly && !consumerAndFieldOnly && (
          <div className="mobile-role-segmented">
            <button
              type="button"
              className={`mobile-role-tab ${authMode === 'field' ? 'active tab-field' : ''}`}
              onClick={() => handleSwitchTab('field', 'field')}
            >
              <HardHat size={14} /> Field Staff
            </button>
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'office' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'office')}
            >
              <Building2 size={14} /> Office Staff
            </button>}
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'president' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'president')}
            >
              <Crown size={14} /> President
            </button>}
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'cashier' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'cashier')}
            >
              <Banknote size={14} /> Cashier
            </button>}
          </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="mobile-login-body">
          {error && (
            <div className="mobile-error-pill" role="alert" aria-live="polite">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* INPUT 1: CONSUMER vs FIELD vs ADMIN */}
          <div className="mobile-field-group">
            <label className="mobile-field-label">
              <span>
                {authMode === 'consumer'
                  ? 'Email address'
                  : authMode === 'field'
                  ? 'Field staff email'
                  : 'Staff email'}
              </span>
            </label>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon">
                {authMode === 'field' ? <IdCard size={18} /> : <User size={18} />}
              </span>
              <input
                className="mobile-field-input"
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
          </div>

          {/* INPUT 2: PASSWORD / PIN */}
          <div className="mobile-field-group">
            <label className="mobile-field-label">
              <span>Password</span>
            </label>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon"><Lock size={18} /></span>
              <input
                className="mobile-field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Submit Action */}
          <button type="submit" className="mobile-login-submit" disabled={isSubmitting}>
            <span>
              {isSubmitting
                ? 'Signing in…'
                : authMode === 'consumer'
                ? 'Sign In to Consumer Portal'
                : authMode === 'field'
                ? 'Access Field Staff Terminal'
                : staffRolePreset === 'president'
                ? 'Enter Executive President Suite'
                : staffRolePreset === 'cashier'
                ? 'Open Cashier POS Terminal'
                : 'Sign In to Operations Suite'}
            </span>
            <ArrowRight size={18} />
          </button>

          {/* Consumer Registration Link */}
          {authMode === 'consumer' && onOpenRegister && (
            <div className="mobile-login-footer">
              <span>New household in Lambawasa?</span>
              <button type="button" onClick={onOpenRegister}>
                Register Account
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  )
}
