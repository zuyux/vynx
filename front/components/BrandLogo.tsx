import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Vynx, home" className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current">
    <Image src="/logo-white.svg" alt="" width={33} height={24} className={`h-6 w-auto${light ? " brightness-0" : ""}`} />
  </Link>;
}
