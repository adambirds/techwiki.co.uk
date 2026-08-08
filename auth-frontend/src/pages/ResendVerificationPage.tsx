import Alert from "@/components/Alert";
import {authApi} from "@/utils/api";
import {useState} from "react";

export default function ResendVerificationPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setError(null);

        try {
            const result = await authApi.resendVerification(email);
            if (result.success) {
                setMessage(
                    result.message ||
                        "If an unverified account exists, an email has been sent.",
                );
            } else {
                setError(
                    result.message || "Could not send verification email.",
                );
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not send verification email.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <h2 className="text-center text-2xl leading-9 font-bold tracking-tight text-slate-900 dark:text-white">
                Resend verification email
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                Enter the address used for your TechWiki account.
            </p>

            {message && (
                <Alert type="success" className="mt-6">
                    {message}
                </Alert>
            )}
            {error && (
                <Alert type="error" className="mt-6">
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm leading-6 font-medium text-slate-900 dark:text-white"
                    >
                        Email address
                    </label>
                    <div className="mt-2">
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary w-full"
                >
                    {isLoading ? "Sending..." : "Send verification email"}
                </button>
            </form>

            <p className="mt-6 text-center text-sm">
                <a
                    href="/login"
                    className="text-brand font-semibold hover:underline"
                >
                    Back to sign in
                </a>
            </p>
        </>
    );
}
