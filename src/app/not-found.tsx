import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <h1 className="page-title">Page not found.</h1>
      <p className="my-5 text-muted-foreground">
        This page or application is not available.
      </p>
      <Link href="/dashboard" className="text-link">
        Back to my account
      </Link>
    </div>
  );
}
