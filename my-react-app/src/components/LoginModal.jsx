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
  passwordRecoveryMode = false,
  onPasswordRecoveryComplete,
}) {
  const [authMode, setAuthMode] = useState(initialMode) // 'consumer' | 'field' | 'admin'
  const [staffRolePreset, setStaffRolePreset] = useState('office')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFlow, setPasswordFlow] = useState(passwordRecoveryMode ? 'update' : 'login')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRecoveryActive = passwordRecoveryMode || passwordFlow === 'update'

  // Reset form-local state when the modal opens or its login area changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode)
      setStaffRolePreset(initialMode === 'consumer' ? 'consumer' : initialMode === 'field' ? 'field' : 'office')
      setIdentifier('')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFlow('login')
      setNotice('')
      setError('')
    }
  }, [isOpen, initialMode])

  useEffect(() => {
    if (passwordRecoveryMode) {
      setPasswordFlow('update')
      setPassword('')
      setError('')
      setNotice('')
    }
  }, [passwordRecoveryMode])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null

  // Quick switch tab handlers
  const handleSwitchTab = (mode, preset = 'office') => {
    setPasswordFlow('login')
    setAuthMode(mode)
    setStaffRolePreset(preset)
    setIdentifier('')
    setPassword('')
    setNotice('')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (passwordFlow === 'sent' || passwordFlow === 'updated') return

    if (passwordFlow === 'request') {
      const email = identifier.trim()
      if (!email) {
        setError('Enter your account email address first.')
        return
      }
      setIsSubmitting(true)
      setError('')
      setNotice('')
      try {
        await api.requestPasswordReset(email)
        setPasswordFlow('sent')
        setNotice('If an account exists for this email, a password reset link is on its way.')
      } catch (requestError) {
        setError(requestError?.message || 'Could not send the password reset email.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (passwordFlow === 'update') {
      if (newPassword.length < 8) {
        setError('Use a password with at least 8 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('The passwords do not match.')
        return
      }
      setIsSubmitting(true)
      setError('')
      setNotice('')
      try {
        await api.updatePassword(newPassword)
        setPasswordFlow('updated')
        setNewPassword('')
        setConfirmPassword('')
        setNotice('Your password has been updated. You can now sign in with it.')
        if (onPasswordRecoveryComplete) onPasswordRecoveryComplete()
      } catch (updateError) {
        setError(updateError?.message || 'Could not update the password. Request a new reset link and try again.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

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

  const handleBackToLogin = () => {
    setPasswordFlow('login')
    setNewPassword('')
    setConfirmPassword('')
    setNotice('')
    setError('')
  }

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
                {passwordFlow === 'request'
                  ? 'Reset your password'
                  : passwordFlow === 'sent'
                  ? 'Check your email'
                  : passwordFlow === 'update'
                  ? 'Choose a new password'
                  : passwordFlow === 'updated'
                  ? 'Password updated'
                  : authMode === 'consumer'
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
                {isRecoveryActive || passwordFlow !== 'login'
                  ? 'Securely restore access to your Lambawasa account'
                  : authMode === 'consumer'
                  ? 'Check water statements, meter twin & pay bills'
                  : authMode === 'field'
                  ? 'Mobile meter reading, GIS mapping & work orders'
                  : 'Municipal billing runs, counter POS & audit logs'}
              </p>
            </div>
          </div>

          {/* Segmented Role Switcher (Touch-friendly Mobile Tabs) */}
          {!isRecoveryActive && passwordFlow === 'login' && !consumerOnly && !consumerAndFieldOnly && (
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
          {notice && (
            <div className="mobile-success-pill" role="status" aria-live="polite">
              {notice}
            </div>
          )}

          {passwordFlow === 'login' && (
          <>
          {/* INPUT 1: CONSUMER vs FIELD vs ADMIN */}
          <div className="mobile-field-group">
            <label className="mobile-field-label" htmlFor="login-email">
                {authMode === 'consumer'
                  ? 'Email address'
                  : authMode === 'field'
                  ? 'Field staff email'
                  : 'Staff email'}
            </label>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon">
                {authMode === 'field' ? <IdCard size={18} /> : <User size={18} />}
              </span>
              <input
                id="login-email"
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
            <div className="mobile-field-label">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="mobile-forgot-password"
                onClick={() => {
                  setPasswordFlow('request')
                  setPassword('')
                  setNotice('')
                  setError('')
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon"><Lock size={18} /></span>
              <input
                id="login-password"
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
          </>
          )}

          {passwordFlow === 'request' && (
            <>
              <p className="mobile-password-help">
                Enter the email address for your account. We’ll send a secure reset link if it’s registered.
              </p>
              <div className="mobile-field-group">
                <label className="mobile-field-label" htmlFor="password-reset-email">Email address</label>
                <div className="mobile-field-input-wrap">
                  <span className="mobile-field-icon"><User size={18} /></span>
                  <input
                    id="password-reset-email"
                    className="mobile-field-input"
                    type="email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" className="mobile-login-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending link…' : 'Send reset link'}
                <ArrowRight size={18} />
              </button>
              <div className="mobile-login-footer">
                <button type="button" onClick={handleBackToLogin}>Back to sign in</button>
              </div>
            </>
          )}

          {passwordFlow === 'sent' && (
            <div className="mobile-login-footer">
              <button type="button" onClick={() => {
                setPasswordFlow('request')
                setNotice('')
                setError('')
              }}>Try another email</button>
              <button type="button" onClick={handleBackToLogin}>Back to sign in</button>
            </div>
          )}

          {passwordFlow === 'update' && (
            <>
              <p className="mobile-password-help">Choose a new password with at least 8 characters.</p>
              <div className="mobile-field-group">
                <label className="mobile-field-label" htmlFor="new-password">New password</label>
                <div className="mobile-field-input-wrap">
                  <span className="mobile-field-icon"><Lock size={18} /></span>
                  <input
                    id="new-password"
                    className="mobile-field-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="mobile-field-group">
                <label className="mobile-field-label" htmlFor="confirm-new-password">Confirm new password</label>
                <div className="mobile-field-input-wrap">
                  <span className="mobile-field-icon"><Lock size={18} /></span>
                  <input
                    id="confirm-new-password"
                    className="mobile-field-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="mobile-login-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating password…' : 'Update password'}
                <ArrowRight size={18} />
              </button>
            </>
          )}

          {passwordFlow === 'updated' && (
            <button type="button" className="mobile-login-submit" onClick={handleBackToLogin}>
              Back to sign in
              <ArrowRight size={18} />
            </button>
          )}

          {/* Consumer Registration Link */}
          {passwordFlow === 'login' && authMode === 'consumer' && onOpenRegister && (
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
