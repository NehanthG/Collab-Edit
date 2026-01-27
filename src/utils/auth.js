export async function getMe() {
  const token = localStorage.getItem("collab_auth_token");

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}
