import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("collab_auth_token", token);
    }

    navigate("/");
  }, [navigate]);

  return <div className="text-white p-6">Signing you in…</div>;
}
