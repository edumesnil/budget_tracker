import { useState, type FormEvent } from 'react'
import { useNavigate, Link, Navigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { css } from '../../styled-system/css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Card from '@/components/ui/card'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsSubmitting(false)
      return
    }

    try {
      const { error: signUpError } = await signUp(email, password)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bg: 'bg.canvas',
        px: '4',
      })}
    >
      <div
        className={css({
          width: 'full',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8',
        })}
      >
        {/* Header */}
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              width: '10',
              height: '10',
              rounded: 'lg',
              bg: 'colorPalette.9',
              mx: 'auto',
              mb: '5',
            })}
          />
          <h1
            className={css({
              fontSize: '2xl',
              fontWeight: '600',
              color: 'fg.default',
              letterSpacing: 'tight',
              mb: '1',
            })}
          >
            Create account
          </h1>
          <p className={css({ fontSize: 'sm', color: 'fg.muted' })}>
            Start tracking your finances
          </p>
        </div>

        {/* Card */}
        <Card.Root>
          <Card.Body className={css({ pt: '6' })}>
            <form
              onSubmit={handleSubmit}
              className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}
            >
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                <label
                  htmlFor="email"
                  className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                <label
                  htmlFor="password"
                  className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                <label
                  htmlFor="confirmPassword"
                  className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.default' })}
                >
                  Confirm password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p
                  className={css({
                    fontSize: 'sm',
                    color: 'fg.default',
                    bg: 'bg.muted',
                    px: '3',
                    py: '2',
                    rounded: 'md',
                  })}
                >
                  {error}
                </p>
              )}

              <Button type="submit" width="full" loading={isSubmitting} loadingText="Creating account...">
                Create account
              </Button>
            </form>
          </Card.Body>
          <Card.Footer className={css({ justifyContent: 'center' })}>
            <p className={css({ fontSize: 'sm', color: 'fg.muted' })}>
              Already have an account?{' '}
              <Link
                to="/login"
                className={css({
                  color: 'colorPalette.11',
                  fontWeight: '500',
                  _hover: { textDecoration: 'underline' },
                })}
              >
                Sign in
              </Link>
            </p>
          </Card.Footer>
        </Card.Root>
      </div>
    </div>
  )
}
