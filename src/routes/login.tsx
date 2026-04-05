import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { css } from "../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Card from "@/components/ui/card";
import * as Field from "@/components/ui/field";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bg: "bg.canvas",
        px: "4",
      })}
    >
      <div
        className={css({
          width: "full",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "8",
        })}
      >
        {/* Header */}
        <div className={css({ textAlign: "center" })}>
          <div
            className={css({
              width: "10",
              height: "10",
              rounded: "lg",
              bg: "colorPalette.9",
              mx: "auto",
              mb: "5",
            })}
          />
          <h1
            className={css({
              fontSize: "2xl",
              fontWeight: "600",
              color: "fg.default",
              letterSpacing: "tight",
              mb: "1",
            })}
          >
            Sign in
          </h1>
          <p className={css({ fontSize: "sm", color: "fg.muted" })}>Access your budget tracker</p>
        </div>

        {/* Card */}
        <Card.Root>
          <Card.Body className={css({ pt: "6" })}>
            <form
              onSubmit={handleSubmit}
              className={css({ display: "flex", flexDirection: "column", gap: "4" })}
            >
              <Field.Root>
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>Password</Field.Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field.Root>

              {error && (
                <p
                  className={css({
                    fontSize: "sm",
                    color: "fg.default",
                    bg: "bg.muted",
                    px: "3",
                    py: "2",
                    rounded: "md",
                  })}
                >
                  {error}
                </p>
              )}

              <Button type="submit" width="full" loading={isSubmitting} loadingText="Signing in...">
                Sign in
              </Button>
            </form>
          </Card.Body>
          <Card.Footer className={css({ justifyContent: "center" })}>
            <p className={css({ fontSize: "sm", color: "fg.muted" })}>
              No account?{" "}
              <Link
                to="/register"
                className={css({
                  color: "colorPalette.11",
                  fontWeight: "500",
                  _hover: { textDecoration: "underline" },
                })}
              >
                Register
              </Link>
            </p>
          </Card.Footer>
        </Card.Root>
      </div>
    </div>
  );
}
