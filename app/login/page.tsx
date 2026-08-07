import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Picks with Friends</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in with your email to see the group&apos;s parlays.
        </p>
      </div>
      <form
        action={async (formData) => {
          "use server";
          const email = formData.get("email");
          if (typeof email === "string" && email.length > 0) {
            await signIn("resend", { email, redirectTo: "/" });
          }
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Send magic link
        </button>
      </form>
    </main>
  );
}
