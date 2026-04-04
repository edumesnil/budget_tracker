import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { css } from '../../styled-system/css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Card from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(signInError.message)
        return
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign in')
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
        bg: 'bg',
        px: '4',
      })}
    >
      <Card.Root
        className={css({
          width: 'full',
          maxWidth: 'md',
        })}
      >
        <Card.Header>
          <Card.Title className={css({ fontSize: '2xl' })}>
            Login
          </Card.Title>
          <Card.Description>
            Enter your credentials to access your account
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <form
            onSubmit={handleSubmit}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
            })}
          >
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <label
                htmlFor="email"
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'fg',
                })}
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
              />
            </div>

            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5',
              })}
            >
              <label
                htmlFor="password"
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'fg',
                })}
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'red.500',
                })}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              width="full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card.Body>
        <Card.Footer
          className={css({
            justifyContent: 'center',
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: 'fg.muted',
            })}
          >
            Don't have an account?{' '}
            <Link
              to="/register"
              className={css({
                color: 'accent.default',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Register
            </Link>
          </p>
        </Card.Footer>
      </Card.Root>
    </div>
  )
}
