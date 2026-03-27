interface LogoProps {
  className?: string;
}

export default function ReadilyLogo({ className = "" }: LogoProps) {
  return (
    <span className={`text-lg font-semibold tracking-tight text-primary ${className}`}>
      Readily Take-Home Project
    </span>
  );
}
