import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { css } from "../../styled-system/css";
import { Spinner } from "@/components/ui/spinner";

export default function IndexPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          bg: "bg.canvas",
        })}
      >
        <Spinner
          className={css({
            width: "8",
            height: "8",
            color: "colorPalette.9",
          })}
        />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
