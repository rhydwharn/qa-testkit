export function PasswordResetEmail({
  resetLink,
  userName,
}: {
  resetLink: string;
  userName?: string;
}) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#f8f9fa", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <h1 style={{ color: "#1f2937", margin: "0 0 10px 0", fontSize: "24px" }}>
          Reset Your Password
        </h1>
        <p style={{ color: "#6b7280", margin: "0", fontSize: "14px" }}>
          QA Testkit - Password Recovery
        </p>
      </div>

      <div style={{ marginBottom: "20px", lineHeight: "1.6", color: "#374151" }}>
        <p>Hi {userName || "there"},</p>
        <p>
          We received a request to reset the password for your QA Testkit account. Click the button below to set a new password.
        </p>
        <p style={{ margin: "30px 0" }}>
          <a
            href={resetLink}
            style={{
              display: "inline-block",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            Reset Password
          </a>
        </p>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          Or copy and paste this link in your browser:
        </p>
        <p style={{ fontSize: "12px", color: "#6b7280", wordBreak: "break-all" }}>
          {resetLink}
        </p>
      </div>

      <div style={{ backgroundColor: "#fef2f2", padding: "15px", borderRadius: "6px", marginBottom: "20px", borderLeft: "4px solid #dc2626" }}>
        <p style={{ margin: "0", color: "#7f1d1d", fontSize: "14px" }}>
          <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this, you can ignore this email.
        </p>
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", fontSize: "12px", color: "#6b7280" }}>
        <p style={{ margin: "0 0 10px 0" }}>
          Questions? Visit our support page or reply to this email.
        </p>
        <p style={{ margin: "0" }}>
          © {new Date().getFullYear()} QA Testkit. All rights reserved.
        </p>
      </div>
    </div>
  );
}
